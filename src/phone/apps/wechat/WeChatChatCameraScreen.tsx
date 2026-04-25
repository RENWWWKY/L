import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Image as ImageIcon } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { logConsole } from './consoleLogger'

// 微信聊天里图片一般会更小一些：这里压到 1MB 以内，提升加载速度与存储效率
const MAX_BYTES = 1 * 1024 * 1024

async function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(fr.error ?? new Error('FileReader'))
    fr.readAsDataURL(blob)
  })
}

async function compressToJpegUnder2MB(params: { source: CanvasImageSource; width: number; height: number }): Promise<string> {
  const { source } = params

  // 先做一次尺寸约束，避免大图爆内存
  const clampTo = (maxSide: number) => {
    const w0 = params.width
    const h0 = params.height
    const max = Math.max(w0, h0)
    if (max <= maxSide) return { w: w0, h: h0 }
    const scale = maxSide / max
    return { w: Math.round(w0 * scale), h: Math.round(h0 * scale) }
  }

  const tryEncode = async (w: number, h: number, quality: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('无法处理图片')
    ctx.drawImage(source, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', quality))
    if (!blob) throw new Error('图片编码失败')
    return blob
  }

  // 第一轮：1280 边长 + 0.82 质量，逐步降质
  let { w, h } = clampTo(1280)
  let q = 0.82
  for (let i = 0; i < 6; i += 1) {
    const blob = await tryEncode(w, h, q)
    if (blob.size <= MAX_BYTES) {
      logConsole('frontend', `图片压缩OK：${w}x${h} q=${q.toFixed(2)} bytes=${blob.size}`)
      const dataUrl = await blobToBase64DataUrl(blob)
      return dataUrl
        .replace(/^data:image\/jpeg;base64,/i, '')
        .trim()
    }
    q = Math.max(0.5, q - 0.08)
  }

  // 第二轮：再降尺寸到 960
  ;({ w, h } = clampTo(960))
  q = 0.78
  for (let i = 0; i < 8; i += 1) {
    const blob = await tryEncode(w, h, q)
    if (blob.size <= MAX_BYTES) {
      logConsole('frontend', `图片压缩OK(降尺寸)：${w}x${h} q=${q.toFixed(2)} bytes=${blob.size}`)
      const dataUrl = await blobToBase64DataUrl(blob)
      return dataUrl
        .replace(/^data:image\/jpeg;base64,/i, '')
        .trim()
    }
    q = Math.max(0.45, q - 0.06)
  }

  // 仍超过：返回最后一次结果（仍是 jpeg）
  const last = await tryEncode(w, h, q)
  logConsole('frontend', `图片压缩超2MB仍返回：${w}x${h} q=${q.toFixed(2)} bytes=${last.size}`)
  const dataUrl = await blobToBase64DataUrl(last)
  return dataUrl.replace(/^data:image\/jpeg;base64,/i, '').trim()
}

type Stage = 'camera' | 'preview'

export function WeChatChatCameraScreen({
  open,
  onClose,
  onSend,
  onToast,
}: {
  open: boolean
  onClose: () => void
  onSend: (payload: { base64: string; mime: 'image/jpeg' }) => void
  onToast: (msg: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const openRef = useRef(open)
  const startSeqRef = useRef(0)
  const startStreamRef = useRef<() => void>(() => {})
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [stage, setStage] = useState<Stage>('camera')
  const stageRef = useRef<Stage>(stage)
  const [previewBase64, setPreviewBase64] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retryAbortRef = useRef(0)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const stopStream = useCallback(() => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startStream = useCallback(async () => {
    const seq = (startSeqRef.current += 1)
    try {
      logConsole(
        'frontend',
        `getUserMedia: secure=${String(window.isSecureContext)} origin=${window.location.origin} facing=${facing}`,
      )

      const tryStart = async (constraints: MediaStreamConstraints) => {
        return await navigator.mediaDevices.getUserMedia(constraints)
      }

      let s: MediaStream
      try {
        s = await tryStart({
          video: { facingMode: facing },
          audio: false,
        })
      } catch (e) {
        // iOS / 某些机型会对 facingMode 更挑剔：失败时回退为任意 video
        const err = e as { name?: string; message?: string }
        logConsole('error', `getUserMedia(primary) failed: ${err?.name || 'Error'} ${err?.message || ''}`.trim())
        s = await tryStart({ video: true, audio: false })
        logConsole('frontend', `getUserMedia: fallback video=true ok`)
      }

      // 如果这次请求已经过期（或用户已离开/不在相机页），直接停止新流并退出，避免触发 AbortError 噪声
      if (seq !== startSeqRef.current || !openRef.current || stageRef.current !== 'camera') {
        s.getTracks().forEach((t) => t.stop())
        return
      }

      // 替换流：先拿到新流再停旧流，减少 iOS 上“中途被打断”的 AbortError
      const prev = streamRef.current
      streamRef.current = s
      if (prev) prev.getTracks().forEach((t) => t.stop())

      streamRef.current = s
      const v = videoRef.current
      if (v) {
        v.srcObject = s
        // iOS 上 play() 偶发 AbortError：做轻量重试，不重拉 getUserMedia
        v.muted = true
        v.playsInline = true
        v.autoplay = true
        for (let i = 0; i < 3; i += 1) {
          try {
            await v.play()
            break
          } catch (pe) {
            const perr = pe as { name?: string; message?: string }
            const nm = perr?.name || 'Error'
            const ms = perr?.message || ''
            logConsole('frontend', `video.play retry ${i + 1}/3 failed: ${nm} ${ms}`.trim())
            await new Promise<void>((r) => window.setTimeout(r, 180))
          }
        }
      }
    } catch (e) {
      const err = e as { name?: string; message?: string }
      const name = err?.name || (e instanceof Error ? e.name : 'Error')
      const msg = err?.message || (e instanceof Error ? e.message : String(e ?? 'unknown'))
      // 如果这次调用在生命周期内已被新请求替换/页面关闭，AbortError 属正常噪声
      if (name === 'AbortError' && (seq !== startSeqRef.current || !openRef.current || stageRef.current !== 'camera')) {
        logConsole('frontend', `getUserMedia aborted (stale): ${name} ${msg}`.trim())
        return
      }
      logConsole('error', `getUserMedia failed: ${name} ${msg}`.trim())

       // AbortError 在 iOS / 开发模式（StrictMode effect 反复执行）里很常见：
       // 可能是上一次请求被打断，并不代表真的“无法访问相机”。这里做一次短延迟重试，不立刻关闭页面。
      if (name === 'AbortError' && openRef.current && stageRef.current === 'camera') {
         const n = retryAbortRef.current + 1
         retryAbortRef.current = n
         if (n <= 2) {
           logConsole('frontend', `AbortError: 将在 220ms 后重试（第 ${n} 次）`)
           window.setTimeout(() => {
             if (!openRef.current) return
            startStreamRef.current()
           }, 220)
           return
         }
       }

      const lower = `${name} ${msg}`.toLowerCase()
      const tip =
        lower.includes('notallowed') || lower.includes('permission') || lower.includes('denied')
          ? '无法访问相机，请在系统设置中允许应用使用相机'
          : lower.includes('notfound') || lower.includes('devicesnotfound')
            ? '无法访问相机：未检测到摄像头设备'
            : lower.includes('notreadable') || lower.includes('trackstart')
              ? '无法访问相机：可能被其它应用占用，请关闭占用相机的应用后重试'
              : lower.includes('overconstrained')
                ? '无法访问相机：当前设备不支持所选摄像头，请尝试切换摄像头'
                : !window.isSecureContext
                  ? '无法访问相机：需要 HTTPS 或 localhost 才能使用相机'
                  : '无法访问相机，请检查设备'
      onToast(tip)
      onClose()
    }
  }, [facing, onClose, onToast, stopStream])

  useEffect(() => {
    startStreamRef.current = () => {
      void startStream()
    }
  }, [startStream])

  useEffect(() => {
    if (!open) return
    retryAbortRef.current = 0
    logConsole('frontend', '相机页打开：开始请求 getUserMedia')
    void startStream()
    return () => stopStream()
  }, [open, startStream, stopStream])

  const capture = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    const w = v.videoWidth
    const h = v.videoHeight
    if (!w || !h) {
      onToast('无法访问相机，请检查设备')
      return
    }
    // 快门闪一下（无彩色）
    const root = v.closest('[data-wx-camera-root]') as HTMLElement | null
    if (root) {
      root.dataset.flash = '1'
      window.setTimeout(() => {
        if (root.dataset.flash) delete root.dataset.flash
      }, 90)
    }
    try {
      const base64 = await compressToJpegUnder2MB({ source: v, width: w, height: h })
      logConsole('frontend', `拍摄得到 base64 长度=${base64.length}`)
      setPreviewBase64(base64)
      setStage('preview')
      stopStream()
    } catch {
      onToast('图片处理失败，请重试')
    }
  }, [onToast, stopStream])

  const pickFromAlbum = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onPickFile = useCallback(
    async (f: File | null) => {
      if (!f) return
      try {
        logConsole('frontend', `相册选择：name=${f.name} type=${f.type} bytes=${f.size}`)
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(f)
          const el = new window.Image()
          el.onload = () => {
            URL.revokeObjectURL(url)
            resolve(el)
          }
          el.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('图片读取失败'))
          }
          el.src = url
        })
        const base64 = await compressToJpegUnder2MB({ source: img, width: img.naturalWidth, height: img.naturalHeight })
        logConsole('frontend', `相册得到 base64 长度=${base64.length}`)
        setPreviewBase64(base64)
        setStage('preview')
        stopStream()
      } catch {
        onToast('图片处理失败，请重试')
      }
    },
    [onToast, stopStream],
  )

  const previewUrl = useMemo(() => (previewBase64 ? `data:image/jpeg;base64,${previewBase64}` : ''), [previewBase64])

  if (!open) return null

  return (
    <motion.div
      className="absolute inset-0 z-[260] flex min-h-0 min-w-0 flex-col bg-black"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      data-wx-camera-root
    >
      <style>{`
        [data-wx-camera-root][data-flash='1']::after{
          content:'';
          position:absolute;
          inset:0;
          background:#ffffff;
          opacity:0.55;
          pointer-events:none;
        }
      `}</style>

      {/* 顶部栏 */}
      <div className="flex shrink-0 items-center justify-between px-4" style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 0px))', height: 56 }}>
        {stage === 'camera' ? (
          <button type="button" className="text-[16px] text-white" onClick={onClose}>
            取消
          </button>
        ) : (
          <button
            type="button"
            className="text-[16px] text-white"
            onClick={() => {
              setStage('camera')
              setPreviewBase64('')
              void startStream()
            }}
          >
            重拍
          </button>
        )}

        {stage === 'camera' ? (
          <button
            type="button"
            aria-label="切换摄像头"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            onClick={() => setFacing((p) => (p === 'environment' ? 'user' : 'environment'))}
          >
            <Camera size={24} strokeWidth={2} className="text-white" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="rounded-[16px] bg-black px-4 py-2 text-[14px] font-medium text-white"
            style={{ border: '1px solid rgba(255,255,255,0.22)' }}
            onClick={() => {
              if (!previewBase64) return
              onSend({ base64: previewBase64, mime: 'image/jpeg' })
            }}
          >
            发送
          </button>
        )}
      </div>

      {/* 预览区 */}
      <div className="relative min-h-0 flex-1">
        {stage === 'camera' ? (
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        ) : previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-contain" />
        ) : null}
      </div>

      {/* 底部栏 */}
      {stage === 'camera' ? (
        <div
          className="flex shrink-0 items-center justify-center bg-black"
          style={{ height: 120, paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex w-full items-center justify-center px-6">
            <button
              type="button"
              aria-label="相册"
              className="mr-auto flex h-10 w-10 items-center justify-center rounded-full"
              onClick={pickFromAlbum}
            >
              <ImageIcon size={24} strokeWidth={2} className="text-white" aria-hidden />
            </button>

            <Pressable
              type="button"
              aria-label="拍摄"
              onClick={() => void capture()}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ border: '3px solid #ffffff' }}
            >
              <div className="h-[54px] w-[54px] rounded-full bg-white" aria-hidden />
            </Pressable>

            <div className="ml-auto h-10 w-10" aria-hidden />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.currentTarget.value = ''
              void onPickFile(f)
            }}
          />
        </div>
      ) : null}
    </motion.div>
  )
}

