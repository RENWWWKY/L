import { ImagePlus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchUnbanStatus, submitUnbanApplication } from '../../userSystem/userSystemApi'
import type { userAccountThemeTokens } from '../../userSystem/userAccountTheme'
import type { UnbanStatusState } from '../../userSystem/types'

type ThemeTokens = ReturnType<typeof userAccountThemeTokens>

type Props = {
  t: ThemeTokens
  inputCls: string
  profileBanned: boolean
  onInfo: (message: string) => void
  onError: (message: string) => void
  onSubmitted?: () => void
}

const MAX_FILE_BYTES = 5 * 1024 * 1024

async function compressDataUrl(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法处理图片'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('无法读取图片'))
    img.src = dataUrl
  })
}

async function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请上传 JPG、PNG 或 WebP 图片')
  if (file.size > MAX_FILE_BYTES) throw new Error('单张图片不能超过 5MB')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
  if (dataUrl.length > 900_000) return compressDataUrl(dataUrl, 1400, 0.82)
  return dataUrl
}

export function UserAccountUnbanPanel({
  t,
  inputCls,
  profileBanned,
  onInfo,
  onError,
  onSubmitted,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<UnbanStatusState | null>(null)
  const [reason, setReason] = useState('')
  const [correctedQq, setCorrectedQq] = useState('')
  const [correctedDcId, setCorrectedDcId] = useState('')
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const s = await fetchUnbanStatus()
    setState(s)
    if (s) {
      setCorrectedQq(s.currentQq || '')
      setCorrectedDcId(s.currentDcId || '')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, profileBanned])

  const handlePickImages = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    onError('')
    setUploading(true)
    try {
      const next = [...evidenceImages]
      for (const file of Array.from(files)) {
        next.push(await readImageFile(file))
      }
      setEvidenceImages(next)
    } catch (e) {
      onError(e instanceof Error ? e.message : '上传图片失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [evidenceImages, onError])

  const removeImage = useCallback((index: number) => {
    setEvidenceImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    onError('')
    onInfo('')
    if (!state?.banned) {
      onError('当前账号未封禁')
      return
    }
    if (state.pendingApplication) {
      onError('您已有待审核的解封申请')
      return
    }
    if (reason.trim().length < 10) {
      onError('请填写至少 10 字的解封申请理由')
      return
    }
    if (!correctedQq.trim() && !correctedDcId.trim()) {
      onError('请至少填写更正后的 QQ 号或 Discord ID')
      return
    }
    if (!evidenceImages.length) {
      onError('请上传至少一张群或 DC 社区证明截图')
      return
    }

    setSubmitting(true)
    try {
      const r = await submitUnbanApplication({
        reason: reason.trim(),
        evidenceImages,
        correctedQq: correctedQq.trim(),
        correctedDcId: correctedDcId.trim(),
      })
      if (!r.ok) {
        onError(r.error)
        return
      }
      onInfo(r.message)
      setReason('')
      setEvidenceImages([])
      await refresh()
      onSubmitted?.()
    } finally {
      setSubmitting(false)
    }
  }, [
    correctedDcId,
    correctedQq,
    evidenceImages,
    onError,
    onInfo,
    onSubmitted,
    reason,
    refresh,
    state?.banned,
    state?.pendingApplication,
  ])

  const canApply = !!state?.banned && !state.pendingApplication

  return (
    <div className="space-y-4">
      <div className={`rounded-[16px] border p-4 ${t.card}`}>
        <h2 className="text-[16px] font-semibold">解封申请</h2>

        {loading ? (
          <p className={`mt-4 text-[13px] ${t.subtitle}`}>加载中…</p>
        ) : !state?.banned ? (
          <p className={`mt-3 text-[13px] leading-6 ${t.muted}`}>您的账号当前未封禁，无需提交解封申请。</p>
        ) : (
          <>
            <div className={`mt-3 rounded-[12px] border px-3 py-3 text-[13px] leading-6 ${t.statusRejected}`}>
              账号已被封禁，无法进入 Lumi 主页验证。请填写解封申请并上传在官方 QQ 群或 Discord 社区内的证明截图，同时更正您的 QQ 号或 Discord ID。
              {state.banReason ? ` 封禁原因：${state.banReason}` : ''}
            </div>

            {state.latestApplication && state.latestApplication.status !== 'pending' ? (
              <div className={`mt-3 rounded-[12px] border px-3 py-3 text-[13px] ${t.infoBox}`}>
                上次申请：{state.latestApplication.statusLabel}
                {state.latestApplication.adminNote ? ` · ${state.latestApplication.adminNote}` : ''}
              </div>
            ) : null}

            {state.pendingApplication ? (
              <div className={`mt-3 rounded-[12px] border px-3 py-3 text-[13px] ${t.infoBox}`}>
                您的解封申请正在审核中，请耐心等待管理员处理。
              </div>
            ) : null}

            {canApply ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className={`mb-1 block text-[12px] ${t.label}`}>解封申请理由</span>
                  <textarea
                    className={`min-h-[100px] w-full rounded-[10px] border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5] ${t.input}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="请说明封禁原因、您的实际情况等（至少 10 字）"
                  />
                </label>

                <label className="block">
                  <span className={`mb-1 block text-[12px] ${t.label}`}>更正 QQ 号</span>
                  <input
                    className={inputCls}
                    value={correctedQq}
                    onChange={(e) => setCorrectedQq(e.target.value)}
                    placeholder="请填写可在群内查到的 QQ 号"
                    inputMode="numeric"
                  />
                </label>

                <label className="block">
                  <span className={`mb-1 block text-[12px] ${t.label}`}>更正 Discord ID</span>
                  <input
                    className={inputCls}
                    value={correctedDcId}
                    onChange={(e) => setCorrectedDcId(e.target.value)}
                    placeholder="请填写可在社区内查到的 Discord ID"
                  />
                </label>

                <div>
                  <span className={`mb-2 block text-[12px] ${t.label}`}>群 / DC 社区证明截图</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handlePickImages(e.target.files)}
                  />
                  <button
                    type="button"
                    className={`inline-flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[13px] disabled:opacity-50 ${t.secondaryBtn}`}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                    {uploading ? '处理中…' : '上传截图'}
                  </button>
                  <p className={`mt-2 text-[12px] leading-5 ${t.subtitle}`}>
                    请上传能证明您在官方 QQ 群或 Discord 社区内的截图（如群成员列表、聊天记录等）。
                  </p>

                  {evidenceImages.length ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {evidenceImages.map((src, index) => (
                        <div key={`${index}-${src.slice(0, 24)}`} className="relative overflow-hidden rounded-[10px] border">
                          <img src={src} alt={`证明 ${index + 1}`} className="aspect-square w-full object-cover" />
                          <button
                            type="button"
                            className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/55 text-white"
                            aria-label="删除图片"
                            onClick={() => removeImage(index)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className={`h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
                  disabled={submitting || uploading}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? '提交中…' : '提交解封申请'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
