import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { personaDb } from '../newFriendsPersona/idb'

type VnPlaySpeed = 1 | 1.5 | 2

export interface ChromaKeyConfig {
  enabled: boolean
  targetColor: string
  tolerance: number
  edgeSoftness: number
}

export interface SpriteConfig {
  charId: string
  imageUrl: string
  scale: number
  /**
   * 采用相对舞台中心的百分比偏移，保证跨容器尺寸一致：
   * x: 相对舞台宽度百分比；y: 相对舞台高度百分比
   */
  position: { x: number; y: number }
  chromaKey: ChromaKeyConfig
}

const DEFAULT_CHROMA_KEY: ChromaKeyConfig = {
  enabled: false,
  targetColor: '#00FF00',
  tolerance: 24,
  edgeSoftness: 18,
}

const VN_SPRITE_CONFIG_KV_KEY = 'wechat-dating-vn-sprite-configs-v1'

function normalizeLoadedSpriteConfigs(raw: unknown): Record<string, SpriteConfig> {
  if (!raw || typeof raw !== 'object') return {}
  const input = raw as Record<string, unknown>
  const out: Record<string, SpriteConfig> = {}
  for (const [id, value] of Object.entries(input)) {
    if (!value || typeof value !== 'object') continue
    const row = value as Partial<SpriteConfig> & { chromaKey?: Partial<ChromaKeyConfig> }
    const charId = String(row.charId || id || '').trim()
    if (!charId) continue
    const imageUrl = typeof row.imageUrl === 'string' ? row.imageUrl : ''
    const scale = Number.isFinite(row.scale as number) ? Number(row.scale) : 1
    const posRaw = row.position ?? { x: 0, y: 0 }
    const x = Number.isFinite((posRaw as any).x) ? Number((posRaw as any).x) : 0
    const y = Number.isFinite((posRaw as any).y) ? Number((posRaw as any).y) : 0
    const ck = row.chromaKey ?? {}
    out[charId] = {
      charId,
      imageUrl,
      scale,
      position: { x, y },
      chromaKey: {
        enabled: typeof ck.enabled === 'boolean' ? ck.enabled : DEFAULT_CHROMA_KEY.enabled,
        targetColor: typeof ck.targetColor === 'string' ? ck.targetColor : DEFAULT_CHROMA_KEY.targetColor,
        tolerance: Number.isFinite(ck.tolerance as number) ? Number(ck.tolerance) : DEFAULT_CHROMA_KEY.tolerance,
        edgeSoftness: Number.isFinite(ck.edgeSoftness as number)
          ? Number(ck.edgeSoftness)
          : DEFAULT_CHROMA_KEY.edgeSoftness,
      },
    }
  }
  return out
}

type VnStore = {
  isAutoPlay: boolean
  playSpeed: VnPlaySpeed
  isInnerVoiceMode: boolean
  logOpen: boolean
  spriteConfigs: Record<string, SpriteConfig>
  toggleAutoPlay: () => void
  cyclePlaySpeed: () => void
  toggleInnerVoiceMode: () => void
  openLog: () => void
  closeLog: () => void
  setSpriteConfig: (charId: string, patch: Partial<Omit<SpriteConfig, 'charId'>> & { chromaKey?: Partial<ChromaKeyConfig> }) => void
  clearSpriteConfig: (charId: string) => void
}

const VnStoreContext = createContext<VnStore | null>(null)

export function VNStoreProvider({ children }: { children: ReactNode }) {
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const [playSpeed, setPlaySpeed] = useState<VnPlaySpeed>(1)
  const [isInnerVoiceMode, setIsInnerVoiceMode] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [spriteConfigs, setSpriteConfigs] = useState<Record<string, SpriteConfig>>({})
  const [spriteConfigsHydrated, setSpriteConfigsHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await personaDb.getPhoneKv(VN_SPRITE_CONFIG_KV_KEY)
        if (cancelled) return
        setSpriteConfigs(normalizeLoadedSpriteConfigs(raw))
      } catch {
        if (!cancelled) setSpriteConfigs({})
      } finally {
        if (!cancelled) setSpriteConfigsHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!spriteConfigsHydrated) return
    void personaDb.setPhoneKv(VN_SPRITE_CONFIG_KV_KEY, spriteConfigs).catch(() => {})
  }, [spriteConfigs, spriteConfigsHydrated])

  const value = useMemo<VnStore>(
    () => ({
      isAutoPlay,
      playSpeed,
      isInnerVoiceMode,
      logOpen,
      spriteConfigs,
      toggleAutoPlay: () => setIsAutoPlay((v) => !v),
      cyclePlaySpeed: () => {
        setPlaySpeed((v) => (v === 1 ? 1.5 : v === 1.5 ? 2 : 1))
      },
      toggleInnerVoiceMode: () => setIsInnerVoiceMode((v) => !v),
      openLog: () => setLogOpen(true),
      closeLog: () => setLogOpen(false),
      setSpriteConfig: (charId, patch) => {
        const id = String(charId || '').trim()
        if (!id) return
        setSpriteConfigs((prev) => {
          const current = prev[id] ?? {
            charId: id,
            imageUrl: '',
            scale: 1,
            position: { x: 0, y: 0 },
            chromaKey: { ...DEFAULT_CHROMA_KEY },
          }
          const next: SpriteConfig = {
            ...current,
            ...patch,
            position: patch.position ? { ...current.position, ...patch.position } : current.position,
            chromaKey: patch.chromaKey ? { ...current.chromaKey, ...patch.chromaKey } : current.chromaKey,
          }
          return { ...prev, [id]: next }
        })
      },
      clearSpriteConfig: (charId) => {
        const id = String(charId || '').trim()
        if (!id) return
        setSpriteConfigs((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
      },
    }),
    [isAutoPlay, playSpeed, isInnerVoiceMode, logOpen, spriteConfigs],
  )

  return <VnStoreContext.Provider value={value}>{children}</VnStoreContext.Provider>
}

export function useVNStore() {
  const ctx = useContext(VnStoreContext)
  if (!ctx) throw new Error('useVNStore must be used within VNStoreProvider')
  return ctx
}

export function useActiveSprite(speakerId: string | null | undefined) {
  const { spriteConfigs } = useVNStore()
  const id = String(speakerId || '').trim()
  if (!id) return null
  return spriteConfigs[id] ?? null
}

