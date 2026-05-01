import { motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { ChromaKeyRenderer } from './ChromaKeyRenderer'
import { useVNStore } from './useVNStore'

type SpriteActor = {
  id: string
  name: string
  avatarUrl?: string
}

type Props = {
  open: boolean
  actors: SpriteActor[]
  onClose: () => void
}

const COLOR_PRESETS = ['#00FF00', '#0000FF', '#FFFFFF', '#000000'] as const

type EyeDropperLike = {
  open: () => Promise<{ sRGBHex: string }>
}

type WindowWithEyeDropper = Window & {
  EyeDropper?: new () => EyeDropperLike
}

export function SpriteEditorPage({ open, actors, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { spriteConfigs, setSpriteConfig, clearSpriteConfig } = useVNStore()
  const [activeId, setActiveId] = useState<string>(() => actors[0]?.id ?? '')
  const [lowQualityPreview, setLowQualityPreview] = useState(false)

  const activeActorId = useMemo(() => {
    if (actors.some((x) => x.id === activeId)) return activeId
    return actors[0]?.id ?? ''
  }, [activeId, actors])

  const activeConfig = spriteConfigs[activeActorId] ?? {
    charId: activeActorId,
    imageUrl: '',
    scale: 1,
    position: { x: 0, y: 0 },
    chromaKey: {
      enabled: false,
      targetColor: '#00FF00',
      tolerance: 24,
      edgeSoftness: 18,
    },
  }

  const toStagePx = (xPct: number, yPct: number) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    return {
      x: (xPct / 100) * rect.width,
      y: (yPct / 100) * rect.height,
    }
  }

  const toStagePct = (xPx: number, yPx: number) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    return {
      x: Math.max(-100, Math.min(100, (xPx / Math.max(1, rect.width)) * 100)),
      y: Math.max(-100, Math.min(100, (yPx / Math.max(1, rect.height)) * 100)),
    }
  }

  const pickColorFromScreen = async () => {
    const win = window as WindowWithEyeDropper
    if (!win.EyeDropper) return
    try {
      const eyeDropper = new win.EyeDropper()
      const result = await eyeDropper.open()
      if (result?.sRGBHex) {
        setSpriteConfig(activeActorId, { chromaKey: { targetColor: result.sRGBHex.toUpperCase() } })
      }
    } catch {
      // 用户取消吸色时忽略
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[95] h-[100dvh] bg-[#F6F7F9]">
      <div className="flex h-full flex-col">
        <div
          ref={stageRef}
          className="relative h-1/2 overflow-hidden border-b border-[#E8EBEF] bg-[#0F1115]/78 backdrop-blur-xl"
        >
          <div className="absolute inset-x-0 bottom-0 h-28 bg-white/12 backdrop-blur-sm" />
          <div className="absolute inset-x-4 bottom-3 rounded-xl border border-white/30 bg-white/20 px-4 py-2 text-center text-[12px] text-white/90">
            VN 对话框预览
          </div>

          {activeConfig.imageUrl ? (
            <motion.div
              drag
              dragMomentum={false}
              onDragEnd={(_, info) => {
                const base = toStagePx(activeConfig.position.x, activeConfig.position.y)
                const next = toStagePct(base.x + info.offset.x, base.y + info.offset.y)
                setSpriteConfig(activeActorId, { position: next })
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none"
              style={{
                x: toStagePx(activeConfig.position.x, activeConfig.position.y).x,
                y: toStagePx(activeConfig.position.x, activeConfig.position.y).y,
                scale: activeConfig.scale,
                transformOrigin: 'center bottom',
              }}
              animate={{ opacity: [0, 1] }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <ChromaKeyRenderer
                imageUrl={activeConfig.imageUrl}
                chromaKey={activeConfig.chromaKey}
                lowQualityPreview={lowQualityPreview}
                className="max-h-[40dvh] w-auto rounded-lg"
              />
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white/65">
              当前角色尚未上传立绘
            </div>
          )}
        </div>

        <div className="h-1/2 overflow-y-auto rounded-t-[24px] border-t border-[#E4E7EC] bg-white px-4 pb-6 pt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file || !activeActorId) return
              const reader = new FileReader()
              reader.onload = () => {
                const src = typeof reader.result === 'string' ? reader.result : ''
                if (!src) return
                setSpriteConfig(activeActorId, { imageUrl: src })
              }
              reader.readAsDataURL(file)
              e.currentTarget.value = ''
            }}
          />

          <div className="mb-4">
            <p className="mb-2 text-[12px] tracking-[0.08em] text-[#8A93A1]">出场人物</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {actors.map((a) => {
                const active = a.id === activeActorId
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActiveId(a.id)}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-[12px]"
                    style={{
                      borderColor: active ? '#D4AF37' : '#E6EAF0',
                      color: '#202733',
                      boxShadow: active ? '0 0 0 1px rgba(212,175,55,0.55)' : 'none',
                      background: '#fff',
                    }}
                  >
                    {a.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-4 rounded-[14px] border border-[#ECEFF4] px-3 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-[10px] border border-[#E2E7EF] px-3 py-2 text-[12px] text-[#2C3442]"
              >
                + 上传立绘
              </button>
              <button
                type="button"
                onClick={() => clearSpriteConfig(activeActorId)}
                className="rounded-[10px] border border-[#E2E7EF] px-3 py-2 text-[12px] text-[#8A93A1]"
              >
                清除
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block text-[12px] text-[#8A93A1]">
                大小
                <input
                  type="range"
                  min={0.4}
                  max={2.4}
                  step={0.01}
                  value={activeConfig.scale}
                  onChange={(e) => setSpriteConfig(activeActorId, { scale: Number(e.target.value) })}
                  className="mt-1 h-px w-full accent-[#B7BFCB]"
                />
              </label>
              <label className="block text-[12px] text-[#8A93A1]">
                垂直高度
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={activeConfig.position.y}
                  onChange={(e) =>
                    setSpriteConfig(activeActorId, {
                      position: { ...activeConfig.position, y: Number(e.target.value) },
                    })
                  }
                  className="mt-1 h-px w-full accent-[#B7BFCB]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[14px] border border-[#ECEFF4] px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] text-[#8A93A1]">色度抠图实验室</p>
              <label className="flex items-center gap-2 text-[12px] text-[#2C3442]">
                <input
                  type="checkbox"
                  checked={activeConfig.chromaKey.enabled}
                  onChange={(e) => setSpriteConfig(activeActorId, { chromaKey: { enabled: e.target.checked } })}
                />
                启用抠图
              </label>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <input
                type="color"
                value={activeConfig.chromaKey.targetColor}
                onChange={(e) => {
                  setSpriteConfig(activeActorId, { chromaKey: { targetColor: e.target.value.toUpperCase() } })
                  e.currentTarget.blur()
                }}
                className="h-8 w-8 rounded border border-[#E2E7EF] bg-transparent p-0"
              />
              <button
                type="button"
                onClick={pickColorFromScreen}
                className="rounded-[10px] border border-[#E2E7EF] px-2.5 py-1 text-[11px] text-[#4B5563]"
              >
                系统吸色
              </button>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded-full border border-[#DDE3EC]"
                  style={{ background: c }}
                  onClick={() => setSpriteConfig(activeActorId, { chromaKey: { targetColor: c } })}
                  aria-label={`预设颜色 ${c}`}
                />
              ))}
            </div>

            <label className="block text-[12px] text-[#8A93A1]">
              抠图强度
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activeConfig.chromaKey.tolerance}
                onPointerDown={() => setLowQualityPreview(true)}
                onPointerUp={() => setLowQualityPreview(false)}
                onChange={(e) => setSpriteConfig(activeActorId, { chromaKey: { tolerance: Number(e.target.value) } })}
                className="mt-1 h-px w-full accent-[#B7BFCB]"
              />
            </label>
            <label className="mt-3 block text-[12px] text-[#8A93A1]">
              边缘羽化
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={activeConfig.chromaKey.edgeSoftness}
                onPointerDown={() => setLowQualityPreview(true)}
                onPointerUp={() => setLowQualityPreview(false)}
                onChange={(e) => setSpriteConfig(activeActorId, { chromaKey: { edgeSoftness: Number(e.target.value) } })}
                className="mt-1 h-px w-full accent-[#B7BFCB]"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] bg-[#111827] px-4 py-2 text-[12px] text-white"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

