import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { useEffect, useRef } from 'react'

const ENVELOPE_TEXTURE_URL = new URL('../../../image/信封纹理纸.png', import.meta.url).toString()

type EnvelopeRevealProps = {
  open: boolean
  onClose: () => void
  onRevealed: () => void
}

const BLUR_TEXT_LINES = [
  { width: '86%', opacity: 0.32 },
  { width: '92%', opacity: 0.26 },
  { width: '74%', opacity: 0.28 },
  { width: '88%', opacity: 0.24 },
  { width: '64%', opacity: 0.22 },
]

export function EnvelopeReveal({ open, onClose, onRevealed }: EnvelopeRevealProps) {
  const runningRef = useRef(false)

  const shellControls = useAnimation()
  const sealControls = useAnimation()
  const flapControls = useAnimation()
  const letterControls = useAnimation()
  const whiteoutControls = useAnimation()

  useEffect(() => {
    if (!open) {
      runningRef.current = false
      shellControls.set({ opacity: 0, y: 8, scale: 0.96 })
      sealControls.set({ opacity: 1, scale: 1 })
      flapControls.set({ rotateX: 0, zIndex: 40 })
      letterControls.set({ y: 0, opacity: 0 })
      whiteoutControls.set({ opacity: 0, zIndex: 0 })
      return
    }

    void (async () => {
      shellControls.set({ opacity: 0, y: 8, scale: 0.96 })
      sealControls.set({ opacity: 1, scale: 1 })
      flapControls.set({ rotateX: 0, zIndex: 40 })
      letterControls.set({ y: 0, opacity: 0 })
      whiteoutControls.set({ opacity: 0, zIndex: 0 })
      await shellControls.start({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleReveal = async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      // 1. 印章破裂
      await sealControls.start({
        scale: 1.3,
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeOut' },
      })

      // 2. 信纸显现（防漏边）
      letterControls.set({ opacity: 1 })

      // 3. 封口三角翻开（先保持最上层）
      await flapControls.start({
        rotateX: -180,
        transition: { duration: 0.6, ease: 'easeInOut' },
      })

      // 4. 翻转后降层到信纸下方、内背上方
      flapControls.set({ zIndex: 15 })

      // 5. 抽出信纸
      await letterControls.start({
        y: '-75%',
        transition: { duration: 0.8, ease: 'easeOut' },
      })

      // 6. 白屏转场
      await whiteoutControls.start({
        opacity: 1,
        zIndex: 9999,
        transition: { duration: 0.5, ease: 'easeInOut' },
      })

      // 7. 回调跳转
      onRevealed()
      onClose()
    } finally {
      runningRef.current = false
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/72"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26 }}
        >
          <motion.div animate={shellControls} className="relative">
            <div
              className="relative h-[220px] w-[320px]"
              style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
            >
              {/* Layer 1: 信封内背 */}
              <div
                className="absolute inset-0 z-10 rounded-[10px] border border-black/12 shadow-[0_18px_56px_rgba(0,0,0,0.32)]"
                style={{
                  backgroundImage: `url(${ENVELOPE_TEXTURE_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'brightness(0.75)',
                }}
              />

              {/* Layer 2: 信纸 */}
              <motion.div
                animate={letterControls}
                className="absolute bottom-2 left-4 right-4 top-6 z-20 overflow-hidden rounded-[8px] border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                style={{
                  opacity: 0,
                  backgroundImage:
                    'repeating-linear-gradient(transparent, transparent 24px, #E5E7EB 24px, #E5E7EB 25px)',
                }}
              >
                <div className="px-5 pt-5">
                  {BLUR_TEXT_LINES.map((line, idx) => (
                    <div
                      key={idx}
                      className="mb-3 h-[7px] rounded-full bg-[#374151]"
                      style={{ width: line.width, opacity: line.opacity, filter: 'blur(2px)' }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Layer 3: 正面口袋 */}
              <div
                className="absolute inset-0 z-30"
                style={{
                  backgroundImage: `url(${ENVELOPE_TEXTURE_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  clipPath: 'polygon(0% 0%, 50% 60%, 100% 0%, 100% 100%, 0% 100%)',
                }}
              />

              {/* Layer 4: 顶层封口三角 */}
              <motion.div
                animate={flapControls}
                className="absolute inset-0 z-40 drop-shadow-[0_2px_2px_rgba(0,0,0,0.12)]"
                style={{
                  backgroundImage: `url(${ENVELOPE_TEXTURE_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 60%)',
                  transformOrigin: 'top center',
                  backfaceVisibility: 'visible',
                }}
              />

              {/* 印章 */}
              <motion.button
                type="button"
                aria-label="拆开信封"
                animate={sealControls}
                whileTap={{ scale: 0.95 }}
                onClick={handleReveal}
                className="absolute left-1/2 top-[60%] z-50 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d9ccb4] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.98), rgba(240,232,214,0.96) 58%, rgba(220,202,168,0.95) 100%)',
                }}
              >
                <span className="text-[11px] text-[#7f5a1f]">封</span>
              </motion.button>
            </div>
          </motion.div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-[max(16px,env(safe-area-inset-top,0px))] text-[12px] tracking-widest text-white/55"
          >
            关闭
          </button>

          <motion.div
            className="pointer-events-none fixed inset-0 bg-white"
            animate={whiteoutControls}
            initial={{ opacity: 0, zIndex: 0 }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

