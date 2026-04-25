import type { AppSlot } from '../types'
import { useCustomization } from '../CustomizationContext'
import { DesktopAppTile } from './DesktopAppTile'
import { DockCapsule } from './DockCapsule'

const DOCK_COUNT = 4

type Props = {
  apps: AppSlot[]
  onOpen: (id: AppSlot['id']) => void
  compact?: boolean
  wechatBadgeCount?: number
}

export function Dock({ apps, onOpen, compact = false, wechatBadgeCount = 0 }: Props) {
  const { state } = useCustomization()
  const { theme, dockStyle } = state
  const dockApps = apps.slice(0, DOCK_COUNT)

  return (
    <div className="flex w-full shrink-0 justify-center px-3 pb-0 pt-1">
      <DockCapsule theme={theme} dockStyle={dockStyle}>
        <nav className="grid grid-cols-4 items-stretch gap-2" aria-label="底部 Dock（4x1）">
          {dockApps.map((app) => (
            <DesktopAppTile
              key={app.id}
              app={app}
              onOpen={onOpen}
              className="h-full w-full"
              compact={compact}
              badgeCount={app.id === 'wechat' ? wechatBadgeCount : 0}
            />
          ))}
        </nav>
      </DockCapsule>
    </div>
  )
}
