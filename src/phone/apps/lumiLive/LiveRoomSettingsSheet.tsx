import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { phoneNumStyle } from '../../types'
import { LIVE_PLATINUM, LIVE_SERIF, LIVE_Z } from './constants'
import {
  LIVE_DANMAKU_STYLE_OPTIONS,
  LIVE_SCENE_DURATION_OPTIONS,
  type LiveDanmakuStyle,
  type LiveRoomSettings,
} from './types'

const BATCH_OPTIONS = [1, 2, 3, 4, 5] as const
const MAX_BG_BYTES = 4.5 * 1024 * 1024

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'))
      return
    }
    if (file.size > MAX_BG_BYTES) {
      reject(new Error('图片过大，请选 4.5MB 以内'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url) reject(new Error('读取失败'))
      else resolve(url)
    }
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

export function LiveRoomSettingsSheet({
  open,
  settings,
  onClose,
  onChange,
}: {
  open: boolean
  settings: LiveRoomSettings
  onClose: () => void
  onChange: (next: LiveRoomSettings) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const patch = (partial: Partial<LiveRoomSettings>) => {
    onChange({ ...settings, ...partial })
  }

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const url = await readImageAsDataUrl(file)
      patch({ backgroundUrl: url })
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败')
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭设置"
            className="absolute inset-0 bg-black/40"
            style={{ zIndex: LIVE_Z.settings }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-[20px] border-t border-white/15 bg-black/55 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ zIndex: LIVE_Z.settings + 1 }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            role="dialog"
            aria-label="直播间设置"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <p
                  className="text-[15px] tracking-[0.18em] text-white/90"
                  style={{ fontFamily: LIVE_SERIF }}
                >
                  连线设置
                </p>
                <p className="mt-1 text-[11px] tracking-[0.12em] text-white/40">ROOM PREFS</p>
              </div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/20 text-white/70"
                aria-label="关闭"
              >
                <X className="size-4" strokeWidth={1.5} />
              </Pressable>
            </div>

            <div className="space-y-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
              {/* Background */}
              <section>
                <p className="text-[12px] tracking-[0.1em] text-white/50">直播背景</p>
                <div className="mt-2 overflow-hidden rounded-[14px] border border-white/12 bg-white/[0.04]">
                  <div className="relative aspect-[16/10] bg-[#141416]">
                    {settings.backgroundUrl ? (
                      <img
                        src={settings.backgroundUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[12px] text-white/35">
                        未上传 · 使用默认封面
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 p-3">
                    <Pressable
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#D4AF37]/40 py-2 text-[12px]"
                      style={{ color: LIVE_PLATINUM }}
                    >
                      <ImagePlus className="size-3.5" strokeWidth={1.5} />
                      上传图片
                    </Pressable>
                    {settings.backgroundUrl ? (
                      <Pressable
                        type="button"
                        onClick={() => {
                          setError('')
                          patch({ backgroundUrl: '' })
                        }}
                        className="flex size-10 items-center justify-center rounded-full border border-white/20 text-white/70"
                        aria-label="清除背景"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.5} />
                      </Pressable>
                    ) : null}
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    void onPickFile(f)
                  }}
                />
                {error ? <p className="mt-2 text-[12px] text-rose-300/90">{error}</p> : null}
              </section>

              {/* Batch count */}
              <section>
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] tracking-[0.1em] text-white/50">每次生成弹幕条数</p>
                  <span className="text-[13px] text-white/80" style={phoneNumStyle}>
                    {settings.danmakuBatchCount}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  {BATCH_OPTIONS.map((n) => {
                    const on = settings.danmakuBatchCount === n
                    return (
                      <Pressable
                        key={n}
                        type="button"
                        onClick={() => patch({ danmakuBatchCount: n })}
                        className={`flex h-9 flex-1 items-center justify-center rounded-full border text-[13px] ${
                          on
                            ? 'border-[#D4AF37]/55 bg-[#D4AF37]/15 text-[#E8D5A3]'
                            : 'border-white/15 bg-white/[0.04] text-white/70'
                        }`}
                        style={phoneNumStyle}
                      >
                        {n}
                      </Pressable>
                    )
                  })}
                </div>
              </section>

              {/* Scene duration */}
              <section>
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] tracking-[0.1em] text-white/50">每次画面时长</p>
                  <span className="text-[13px] text-white/80" style={phoneNumStyle}>
                    {settings.sceneDurationSec}s
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-white/35">「反应」后生成的直播画面时间轴长度</p>
                <div className="mt-2 flex gap-2">
                  {LIVE_SCENE_DURATION_OPTIONS.map((n) => {
                    const on = settings.sceneDurationSec === n
                    return (
                      <Pressable
                        key={n}
                        type="button"
                        onClick={() => patch({ sceneDurationSec: n })}
                        className={`flex h-9 flex-1 items-center justify-center rounded-full border text-[12px] ${
                          on
                            ? 'border-[#D4AF37]/55 bg-[#D4AF37]/15 text-[#E8D5A3]'
                            : 'border-white/15 bg-white/[0.04] text-white/70'
                        }`}
                        style={phoneNumStyle}
                      >
                        {n}s
                      </Pressable>
                    )
                  })}
                </div>
              </section>

              {/* Style */}
              <section>
                <p className="text-[12px] tracking-[0.1em] text-white/50">弹幕风格</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {LIVE_DANMAKU_STYLE_OPTIONS.map((opt) => {
                    const on = settings.danmakuStyle === opt.id
                    return (
                      <Pressable
                        key={opt.id}
                        type="button"
                        onClick={() => patch({ danmakuStyle: opt.id as LiveDanmakuStyle })}
                        className={`rounded-[12px] border px-3 py-3 text-left ${
                          on
                            ? 'border-[#D4AF37]/50 bg-[#D4AF37]/12'
                            : 'border-white/12 bg-white/[0.04]'
                        }`}
                      >
                        <p className={`text-[13px] ${on ? 'text-[#E8D5A3]' : 'text-white/90'}`}>
                          {opt.label}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-white/40">{opt.blurb}</p>
                      </Pressable>
                    )
                  })}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
