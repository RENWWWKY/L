import { useCallback, useEffect, useState } from 'react'
import type { AppSlot } from '../types'
import { personaDb } from '../apps/wechat/newFriendsPersona/idb'
import { WECHAT_LUMI_PEER_CHARACTER_ID, wechatConversationKey } from '../apps/wechat/wechatConversationKey'
import { DesktopAppTile } from './DesktopAppTile'
import { Dock } from './Dock'
import { MusicWidget } from './MusicWidget'
import { PersonalCard } from './PersonalCard'
import { StatusBar } from './StatusBar'
import { useCustomization } from '../CustomizationContext'

type Props = {
  onOpenApp: (id: AppSlot['id']) => void
}

function useWeChatHomeUnreadBadge(): number {
  const { state } = useCustomization()
  const [playerIdentityId, setPlayerIdentityId] = useState<string | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    void personaDb.getCurrentIdentityId().then((id) => setPlayerIdentityId(id?.trim() ? id : '__none__'))
  }, [])

  const refresh = useCallback(() => {
    if (playerIdentityId === null) return
    const pid = playerIdentityId
    const list = state.wechatPersonaContacts ?? []
    const keySet = new Set<string>()
    keySet.add(wechatConversationKey(WECHAT_LUMI_PEER_CHARACTER_ID, pid))
    for (const c of list) {
      keySet.add(wechatConversationKey(c.characterId, pid))
    }
    const keys = Array.from(keySet)
    void Promise.all(keys.map((k) => personaDb.countUnreadWeChatCharacterMessages(k))).then((counts) =>
      setCount(counts.reduce((a, b) => a + b, 0)),
    )
  }, [state.wechatPersonaContacts, playerIdentityId])

  useEffect(() => {
    refresh()
    const on = () => refresh()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [refresh])

  return count
}

const APP_POSITIONS: Record<AppSlot['id'], { col: number; row: number }> = {
  wechat: { col: 3, row: 4 },
  takeout: { col: 4, row: 4 },
  weibo: { col: 3, row: 5 },
  api: { col: 4, row: 5 },
  voiceprint: { col: 2, row: 6 },
  appearance: { col: 1, row: 6 },
}

export function HomeScreen({ onOpenApp }: Props) {
  const { state } = useCustomization()
  const { apps, ui, theme } = state
  const wechatUnread = useWeChatHomeUnreadBadge()
  const dockAppIds = new Set(apps.slice(0, 4).map((a) => a.id))
  const desktopApps = apps.filter((a) => !dockAppIds.has(a.id))
  const compactDesktop = !ui.fullScreen || ui.showDeviceFrame
  const hasWallpaper = !!theme.wallpaperUrl?.trim()
  const contentSafeTop = ui.fullScreen && !ui.showStatusBar ? 'env(safe-area-inset-top, 0px)' : '0px'

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        backgroundColor: hasWallpaper ? 'transparent' : 'var(--phone-bg)',
        backgroundImage: theme.wallpaperUrl ? `url(${theme.wallpaperUrl})` : 'none',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: theme.wallpaperFit === 'contain' ? 'contain' : 'cover',
      }}
    >
      {ui.showStatusBar ? <StatusBar /> : null}

      <div
        className="min-h-0 flex flex-1 items-stretch justify-center overflow-hidden px-3 pb-0"
        style={{ paddingTop: `calc(${contentSafeTop} + 0.25rem)` }}
      >
        <div
          className="grid h-full w-full max-w-[360px] items-stretch gap-2.5"
          style={{
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
          }}
        >
          <div style={{ gridColumn: '1 / 5', gridRow: '1 / 4' }}>
            <PersonalCard />
          </div>

          <div style={{ gridColumn: '1 / 3', gridRow: '4 / 6' }}>
            <MusicWidget />
          </div>

          {desktopApps.map((app) => {
            const pos = APP_POSITIONS[app.id]
            return (
              <div
                key={app.id}
                style={{
                  gridColumn: `${pos.col} / ${pos.col + 1}`,
                  gridRow: `${pos.row} / ${pos.row + 1}`,
                }}
              >
                <DesktopAppTile
                  app={app}
                  onOpen={onOpenApp}
                  className="h-full w-full"
                  compact={compactDesktop}
                />
              </div>
            )
          })}
        </div>
      </div>

      <Dock apps={apps} onOpen={onOpenApp} compact={compactDesktop} wechatBadgeCount={wechatUnread} />
    </div>
  )
}
