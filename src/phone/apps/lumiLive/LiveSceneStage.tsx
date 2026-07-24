import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useRef } from 'react'

import { phoneNumStyle } from '../../types'
import { LIVE_PLATINUM, LIVE_SERIF, LIVE_Z } from './constants'
import { formatSceneClock } from './sceneMock'
import { LIVE_SCENE_BEAT_LABEL, type LiveSceneBeat, type LiveScenePlayback } from './types'

export function LiveSceneStage({
  scene,
  progressMs,
  playing,
  bottomOffsetPx = 0,
  onSeek,
  onTogglePlay,
}: {
  scene: LiveScenePlayback | null
  progressMs: number
  playing: boolean
  bottomOffsetPx?: number
  onSeek: (ms: number) => void
  onTogglePlay: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const seekFromClientX = useCallback(
    (clientX: number) => {
      if (!scene || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
      onSeek(Math.round(ratio * scene.durationMs))
    },
    [onSeek, scene],
  )

  if (!scene) return null

  const beat: LiveSceneBeat | null =
    scene.beats.find((b) => progressMs >= b.atMs && progressMs < b.endMs) ??
    scene.beats[scene.beats.length - 1] ??
    null
  const ratio = scene.durationMs > 0 ? Math.min(1, progressMs / scene.durationMs) : 0

  return (
    <>
      {/* 画面描述层 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center px-6"
        style={{ zIndex: LIVE_Z.chrome + 2 }}
      >
        <AnimatePresence mode="wait">
          {beat ? (
            <motion.div
              key={beat.id}
              className="max-w-[92%] rounded-[16px] border border-white/15 bg-black/35 px-4 py-3.5 text-center backdrop-blur-2xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
            >
              <p
                className="text-[10px] tracking-[0.22em]"
                style={{ color: LIVE_PLATINUM, fontFamily: LIVE_SERIF }}
              >
                {LIVE_SCENE_BEAT_LABEL[beat.kind]}
              </p>
              <p
                className={`mt-2 text-[14px] leading-relaxed text-white ${
                  beat.kind === 'dialogue' ? 'italic' : ''
                }`}
                style={{
                  fontFamily: beat.kind === 'dialogue' ? LIVE_SERIF : undefined,
                  textShadow: '0 1px 8px rgba(0,0,0,0.55)',
                }}
              >
                {beat.text}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* 进度条 */}
      <div
        className="absolute inset-x-0 px-4 transition-[bottom] duration-150 ease-out"
        style={{
          zIndex: LIVE_Z.chat - 1,
          bottom: `calc(4.85rem + ${Math.max(0, bottomOffsetPx)}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <div className="rounded-full border border-white/12 bg-black/45 px-3 py-2 backdrop-blur-2xl">
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={onTogglePlay}
              className="text-[10px] tracking-[0.14em] text-white/55"
            >
              {playing ? '暂停' : '继续'}
            </button>
            <p className="text-[11px] text-white/70" style={phoneNumStyle}>
              {formatSceneClock(progressMs)} / {formatSceneClock(scene.durationMs)}
            </p>
          </div>
          <div
            ref={trackRef}
            className="relative h-5 cursor-pointer touch-none"
            onPointerDown={(e) => {
              draggingRef.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              seekFromClientX(e.clientX)
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return
              seekFromClientX(e.clientX)
            }}
            onPointerUp={(e) => {
              draggingRef.current = false
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                // ignore
              }
            }}
            onPointerCancel={() => {
              draggingRef.current = false
            }}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={scene.durationMs}
            aria-valuenow={progressMs}
            aria-label="画面进度"
            tabIndex={0}
          >
            <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/20" />
            <div
              className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
              style={{
                width: `${ratio * 100}%`,
                background: `linear-gradient(90deg, rgba(212,175,55,0.35), ${LIVE_PLATINUM})`,
              }}
            />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E8D5A3]/80 bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.45)]"
              style={{ left: `${ratio * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
