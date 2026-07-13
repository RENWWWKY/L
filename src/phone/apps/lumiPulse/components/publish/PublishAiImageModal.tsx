import { motion } from 'framer-motion'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../../../components/Pressable'
import { loadResolvedImageGenSettings } from '../../../api/loadResolvedImageGenSettings'
import { generateMomentsImage } from '../../../../../components/moments/momentsImageGen'
import { isMomentsImageGenConfigured } from '../../../../../components/moments/momentsImageGenAvailability'
import { PULSE_COLORS } from '../../constants'

export function PublishAiImageModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void
  onGenerated: (dataUrl: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')
    try {
      const settings = await loadResolvedImageGenSettings()
      if (!isMomentsImageGenConfigured(settings)) {
        setError('请先在 API 预设或朋友圈设置中配置生图引擎')
        return
      }
      const dataUrl = await generateMomentsImage({
        prompt: trimmed,
        settings,
        promptContext: 'moments',
      })
      onGenerated(dataUrl)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '生图失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1290] bg-black/25 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-4 top-[18%] z-[1300] mx-auto max-w-md rounded-[24px] bg-white/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" style={{ color: PULSE_COLORS.lightGold }} strokeWidth={1.5} />
            <p className="text-[14px] font-medium text-[#1C1C1E]">AI 纪实生图</p>
          </div>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the scene in English…"
          className="min-h-[100px] w-full resize-none rounded-2xl bg-[#F8F8F7] p-4 font-serif text-[15px] leading-relaxed text-[#1C1C1E] outline-none placeholder:text-neutral-300"
          autoFocus
        />
        {error ? <p className="mt-2 text-[11px] text-[#C45C5C]">{error}</p> : null}
        <Pressable
          type="button"
          disabled={!prompt.trim() || loading}
          onClick={() => void generate()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#1C1C1E] py-3 text-[13px] font-medium text-white disabled:opacity-35"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" style={{ color: PULSE_COLORS.lightGold }} />
              <span>生成中…</span>
            </>
          ) : (
            '生成并添加'
          )}
        </Pressable>
      </motion.div>
    </>
  )
}
