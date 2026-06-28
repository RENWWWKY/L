import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { Pressable } from '../../../components/Pressable'
import { ShareContactSheet } from '../favorites/ShareContactSheet'
import { requestOpenWeChatPersonaChat } from '../wechatFocusChatNavigation'
import { LocationMessageCard } from './LocationMessageCard'
import {
  buildDefaultLocationSpoofDraft,
  buildWeChatLocationPayload,
  DISTANCE_SLIDER_MAX_KM,
  formatTargetDistanceLabel,
  parseDistanceInput,
  type LocationSpoofDraft,
} from './wechatLocationUtils'

const PICKER_Z = 5200

function getWeChatPageRoot(): HTMLElement | null {
  return document.querySelector('[data-phone-page="wechat"]')
}

function UnderlineField({
  label,
  subLabel,
  value,
  onChange,
  placeholder,
}: {
  label: string
  subLabel: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">{label}</span>
        <span className="text-[10px] text-neutral-300">{subLabel}</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full border-0 border-b border-dashed border-neutral-300 bg-transparent py-2 text-[15px] text-black outline-none placeholder:text-neutral-300 focus:border-neutral-800"
      />
    </label>
  )
}

/** 坐标覆写面板 · 底部毛玻璃抽屉 */
export function LocationSpoofModal({
  open,
  sending,
  onClose,
  onSend,
  onSendToContact,
  conversationCharacterId,
}: {
  open: boolean
  sending: boolean
  onClose: () => void
  onSend: (payload: NonNullable<ReturnType<typeof buildWeChatLocationPayload>>) => void
  onSendToContact?: (
    characterId: string,
    payload: NonNullable<ReturnType<typeof buildWeChatLocationPayload>>,
  ) => Promise<void>
  conversationCharacterId: string
  personaCharacterId?: string | null
  userAvatarUrl?: string
  characterAvatarUrl?: string
  userLabel?: string
  characterLabel?: string
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() => getWeChatPageRoot())
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<LocationSpoofDraft | null>(null)
  const [distanceInput, setDistanceInput] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [shareSending, setShareSending] = useState(false)
  const [shareError, setShareError] = useState('')

  const busy = sending || shareSending

  const distanceKm = draft && draft.distanceMeters >= 0 ? draft.distanceMeters / 1000 : 0

  const previewPayload = useMemo(() => {
    if (!draft) return null
    if (draft.distanceMeters < 0) {
      const base = buildWeChatLocationPayload({ ...draft, distanceMeters: 0 })
      return base ? { ...base, distance: 'Unknown', distanceMeters: undefined } : null
    }
    return buildWeChatLocationPayload(draft)
  }, [draft])

  const loadDraft = useCallback(() => {
    setLoading(true)
    try {
      const seedKey = `${conversationCharacterId}-${Date.now()}`
      const next = buildDefaultLocationSpoofDraft(seedKey)
      setDraft(next)
      setDistanceInput(formatTargetDistanceLabel(next.distanceMeters))
    } finally {
      setLoading(false)
    }
  }, [conversationCharacterId])

  useEffect(() => {
    setPortalRoot(getWeChatPageRoot())
  }, [open])

  useEffect(() => {
    if (!open) return
    loadDraft()
  }, [loadDraft, open])

  const syncDistanceFromKm = (km: number) => {
    const meters = Math.max(0, Math.min(DISTANCE_SLIDER_MAX_KM * 1000, km * 1000))
    setDraft((d) => (d ? { ...d, distanceMeters: meters } : d))
    setDistanceInput(formatTargetDistanceLabel(meters))
  }

  const handleDistanceInputBlur = () => {
    const parsed = parseDistanceInput(distanceInput)
    if (parsed != null) {
      setDraft((d) => (d ? { ...d, distanceMeters: parsed } : d))
      setDistanceInput(formatTargetDistanceLabel(parsed))
    } else if (/unknown/i.test(distanceInput.trim())) {
      setDraft((d) => (d ? { ...d, distanceMeters: -1 } : d))
      setDistanceInput('Unknown')
    }
  }

  useEffect(() => {
    if (!open) {
      setShareOpen(false)
      setShareSending(false)
      setShareError('')
    }
  }, [open])

  const handleSend = () => {
    if (!previewPayload || busy) return
    onSend(previewPayload)
  }

  const handleShareConfirm = async (characterId: string) => {
    if (!previewPayload || busy || !onSendToContact) return
    setShareSending(true)
    setShareError('')
    try {
      await onSendToContact(characterId, previewPayload)
      setShareOpen(false)
      if (characterId.trim() !== conversationCharacterId.trim()) {
        requestOpenWeChatPersonaChat(characterId)
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setShareSending(false)
    }
  }

  const content = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            style={{ zIndex: PICKER_Z - 1 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!busy) onClose()
            }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 flex max-h-[min(92vh,780px)] flex-col overflow-hidden rounded-t-[24px] border-t border-white/40 bg-white/82 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
            style={{ zIndex: PICKER_Z }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 42 }}
          >
            <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
              <div className="w-8" />
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
                  Override Coordinates
                </p>
                <p className="mt-0.5 text-[13px] font-medium tracking-wide text-black">坐标重定向</p>
              </div>
              <Pressable
                onClick={onClose}
                disabled={busy}
                className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 disabled:opacity-40"
                aria-label="关闭"
              >
                <X className="size-4" strokeWidth={1.75} />
              </Pressable>
            </div>

            {loading || !draft || !previewPayload ? (
              <div className="flex flex-1 items-center justify-center py-20 text-neutral-500">
                <Loader2 className="mr-2 size-5 animate-spin" />
                <span className="font-mono text-[11px] uppercase tracking-widest">Initializing</span>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <div className="space-y-6">
                    <UnderlineField
                      label="Target"
                      subLabel="目标锚点"
                      value={draft.name}
                      onChange={(name) => setDraft((d) => (d ? { ...d, name } : d))}
                      placeholder="Blue Note Jazz Club"
                    />
                    <UnderlineField
                      label="Details"
                      subLabel="详细坐标"
                      value={draft.address}
                      onChange={(address) => setDraft((d) => (d ? { ...d, address } : d))}
                      placeholder="朝阳区三里屯路…"
                    />
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                          Proximity
                        </span>
                        <span className="text-[10px] text-neutral-300">相对距离</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={DISTANCE_SLIDER_MAX_KM}
                          step={0.05}
                          value={Math.min(DISTANCE_SLIDER_MAX_KM, Math.max(0, distanceKm))}
                          onChange={(e) => syncDistanceFromKm(Number(e.target.value))}
                          className="min-w-0 flex-1 accent-black"
                          disabled={draft.distanceMeters < 0}
                        />
                        <input
                          value={distanceInput}
                          onChange={(e) => setDistanceInput(e.target.value)}
                          onBlur={handleDistanceInputBlur}
                          className="w-[88px] shrink-0 border-0 border-b border-dashed border-neutral-300 bg-transparent py-1 text-right font-mono text-[12px] text-[#8B7355] outline-none focus:border-neutral-800"
                          aria-label="精确距离"
                        />
                      </div>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400">
                        0 — {DISTANCE_SLIDER_MAX_KM.toLocaleString('en-US')} KM · 可手填 0.05 km 或 Unknown
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">Preview</p>
                    <LocationMessageCard data={previewPayload} compact />
                  </div>
                </div>

                <div
                  className="shrink-0 border-t border-neutral-200/80 bg-white/70 px-5 py-4 backdrop-blur-xl"
                  style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
                >
                  {shareError ? (
                    <p className="mb-2 text-center text-[12px] text-red-500">{shareError}</p>
                  ) : null}
                  <Pressable
                    onClick={handleSend}
                    disabled={busy || !previewPayload}
                    className="flex h-12 w-full items-center justify-center rounded-none bg-black font-mono text-[12px] uppercase tracking-[0.22em] text-white disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      '发送坐标 · Transmit Signal'
                    )}
                  </Pressable>
                  {onSendToContact ? (
                    <Pressable
                      onClick={() => {
                        if (busy || !previewPayload) return
                        setShareError('')
                        setShareOpen(true)
                      }}
                      disabled={busy || !previewPayload}
                      className="mt-2 flex h-11 w-full items-center justify-center border border-neutral-300 bg-white font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-700 disabled:opacity-40"
                    >
                      发送给… · Send To
                    </Pressable>
                  ) : null}
                </div>
              </>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )

  const sheet = onSendToContact ? (
    <ShareContactSheet
      open={shareOpen}
      sending={shareSending}
      onClose={() => {
        if (shareSending) return
        setShareOpen(false)
        setShareError('')
      }}
      onConfirm={handleShareConfirm}
    />
  ) : null

  if (!portalRoot) {
    return (
      <>
        {content}
        {sheet}
      </>
    )
  }
  return (
    <>
      {createPortal(content, portalRoot)}
      {sheet}
    </>
  )
}

export const LocationSendSheet = LocationSpoofModal
