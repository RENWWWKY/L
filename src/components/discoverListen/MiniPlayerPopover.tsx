import { AnimatePresence, motion } from 'framer-motion'
import {
  AlignLeft,
  ArrowUpRight,
  HeartPulse,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { useCustomization } from '../../phone/CustomizationContext'
import { sendMusicSyncInvite } from '../../phone/apps/wechat/musicSync/sendMusicSyncInvite'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { useMusicStore } from '../../stores/useMusicStore'
import type { ListenPlayMode } from './listenPlayMode'
import { InviteListenerDrawer } from './InviteListenerDrawer'
import { listenTogetherPlayerEngine } from './listenTogetherPlayerEngine'
import { navigateToListenTogetherFullscreen } from './listenTogetherNavigation'
import { SyncCapsule } from './SyncCapsule'
import type { InviteableContact } from './useInviteableWeChatContacts'

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.8 }

function PlayModeIcon({ mode }: { mode: ListenPlayMode }) {
  const cls = 'size-4'
  switch (mode) {
    case 'repeatOne':
      return <Repeat1 className={cls} strokeWidth={1.75} />
    case 'repeatAll':
      return <Repeat className={cls} strokeWidth={1.75} />
    case 'shuffle':
      return <Shuffle className={cls} strokeWidth={1.75} />
    case 'heart':
      return (
        <span className="relative inline-flex size-4 items-center justify-center">
          <span
            className="absolute -right-0.5 -top-0.5 size-1 rounded-full bg-rose-400/80"
            aria-hidden
          />
          <HeartPulse className={cls} strokeWidth={1.75} />
        </span>
      )
    default:
      return <Repeat className={cls} strokeWidth={1.75} />
  }
}

export type MiniPlayerPopoverProps = {
  open: boolean
  onClose: () => void
  anchorSide: 'left' | 'right'
  anchorY: number
}

export function MiniPlayerPopover({
  open,
  onClose,
  anchorSide,
  anchorY,
}: MiniPlayerPopoverProps) {
  const track = useMusicStore((s) => s.currentTrack)
  const isPlaying = useMusicStore((s) => s.isPlaying)
  const canUseHeartMode = useMusicStore((s) => s.canUseHeartMode)
  const listenPlayMode = useMusicStore((s) => s.listenPlayMode)
  const syncListening = useMusicStore((s) => s.syncListening)
  const setSyncListening = useMusicStore((s) => s.setSyncListening)
  const openDesktopLyricsKeepOrb = useMusicStore((s) => s.openDesktopLyricsKeepOrb)
  const { state } = useCustomization()
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)

  const userAvatar = useMemo(
    () =>
      resolveCharacterAvatarUrl({ avatarUrl: state.profile.avatarImageUrl }) ||
      state.profile.avatarImageUrl ||
      'https://api.dicebear.com/7.x/notionists/svg?seed=me-rose',
    [state.profile.avatarImageUrl],
  )
  const userName = state.profile.displayName?.trim() || '我'

  const handleInviteConfirm = useCallback(
    async (contact: InviteableContact) => {
      if (!track || inviteSending) return
      setInviteSending(true)
      try {
        await sendMusicSyncInvite({
          characterId: contact.characterId,
          contactName: contact.remarkName,
          contactAvatar: contact.avatarUrl,
          track,
        })
        setSyncListening(null)
        setInviteDrawerOpen(false)
        onClose()
      } catch {
        // 静默失败；后续可接 toast
      } finally {
        setInviteSending(false)
      }
    },
    [inviteSending, onClose, setSyncListening, track],
  )

  if (!track) return null

  const panelTop = Math.max(12, anchorY - 120)

  const openDesktopLyrics = () => {
    openDesktopLyricsKeepOrb()
    onClose()
  }

  return (
    <>
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭控制面板"
            className="absolute inset-0 z-[1] bg-[#2D2422]/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="音乐控制"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={SPRING}
            className="absolute z-[2] w-[min(300px,calc(100%-72px))] overflow-hidden rounded-[26px] border border-rose-100/70 bg-gradient-to-b from-[#FFF0F3]/95 via-white/92 to-white/88 shadow-[0_20px_56px_rgba(255,192,203,0.18)] backdrop-blur-2xl"
            style={
              anchorSide === 'right'
                ? { right: 60, top: panelTop }
                : { left: 60, top: panelTop }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-4 pb-4 pt-3.5">
              <button
                type="button"
                aria-label="打开听一听全屏播放"
                title="全屏播放"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                  void navigateToListenTogetherFullscreen()
                }}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-rose-50/80 hover:text-stone-600"
              >
                <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
              </button>

              <SyncCapsule
                sync={syncListening}
                userAvatar={userAvatar}
                userName={userName}
                onInviteClick={() => setInviteDrawerOpen(true)}
              />

              <div className="flex items-center gap-3 pr-8">
                {track.cover ? (
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-rose-100/80 shadow-sm">
                    <img src={track.cover} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-[#FFF0F3] to-stone-100 ring-1 ring-rose-100/80" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#2D2422]">{track.title}</p>
                  <p className="truncate text-[12px] text-stone-400">{track.artist}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between px-0.5">
                <button
                  type="button"
                  aria-label="切换播放模式"
                  title={
                    canUseHeartMode
                      ? undefined
                      : '心动模式仅在「我喜欢的音乐」歌单可用'
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    listenTogetherPlayerEngine.cyclePlayMode()
                  }}
                  className={`flex h-9 w-9 items-center justify-center transition-colors ${
                    listenPlayMode === 'heart'
                      ? 'rounded-2xl bg-gradient-to-br from-rose-100 via-pink-50 to-white text-rose-500 shadow-sm ring-1 ring-rose-200/80'
                      : 'rounded-full text-stone-500 hover:bg-[#FFF0F3]/80 hover:text-stone-700'
                  }`}
                >
                  <PlayModeIcon mode={listenPlayMode} />
                </button>
                <button
                  type="button"
                  aria-label="桌面歌词"
                  onClick={(e) => {
                    e.stopPropagation()
                    openDesktopLyrics()
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 ring-1 ring-rose-100/60 transition-colors hover:bg-[#FFF0F3]/80 hover:text-stone-700"
                >
                  <AlignLeft className="size-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="上一首"
                  onClick={(e) => {
                    e.stopPropagation()
                    void listenTogetherPlayerEngine.playPrev()
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-[#FFF0F3]/60"
                >
                  <SkipBack className="size-4 fill-current" strokeWidth={0} />
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? '暂停' : '播放'}
                  onClick={(e) => {
                    e.stopPropagation()
                    listenTogetherPlayerEngine.togglePlay()
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE4E8] via-[#FFF0F3] to-white text-[#2D2422] shadow-[0_8px_24px_rgba(255,192,203,0.28)] ring-1 ring-rose-100/80"
                >
                  {isPlaying ? (
                    <Pause className="size-5 fill-current" strokeWidth={0} />
                  ) : (
                    <Play className="size-5 fill-current pl-0.5" strokeWidth={0} />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="下一首"
                  onClick={(e) => {
                    e.stopPropagation()
                    void listenTogetherPlayerEngine.playNext()
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-[#FFF0F3]/60"
                >
                  <SkipForward className="size-4 fill-current" strokeWidth={0} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
    <InviteListenerDrawer
      open={inviteDrawerOpen}
      onClose={() => setInviteDrawerOpen(false)}
      onConfirm={handleInviteConfirm}
      sending={inviteSending}
    />
    </>
  )
}
