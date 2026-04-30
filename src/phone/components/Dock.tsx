import { AnimatePresence, motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { AppSlot } from '../types'
import { useCustomization } from '../CustomizationContext'
import { useLongPress } from '../hooks/useLongPress'
import { DesktopAppTile } from './DesktopAppTile'
import { DockCapsule } from './DockCapsule'

const DOCK_COUNT = 4

type Props = {
  apps: Array<AppSlot | null>
  onOpen: (id: AppSlot['id']) => void
  compact?: boolean
  wechatBadgeCount?: number
  isEditMode?: boolean
  onRequestEditMode?: (id: AppSlot['id']) => void
  activeDragId?: AppSlot['id'] | null
  hoverIndex?: number | null
  registerNode?: (id: AppSlot['id'], node: HTMLDivElement | null) => void
  dockNavRef?: RefObject<HTMLElement | null>
  onPointerDragStart?: (id: AppSlot['id'], event: React.PointerEvent<HTMLButtonElement>) => void
}

export function Dock({
  apps,
  onOpen,
  compact = false,
  wechatBadgeCount = 0,
  isEditMode = false,
  onRequestEditMode,
  activeDragId = null,
  hoverIndex = null,
  registerNode,
  dockNavRef,
  onPointerDragStart,
}: Props) {
  const { state } = useCustomization()
  const { theme, dockStyle } = state

  return (
    <div
      data-dock-root="true"
      className="flex w-full shrink-0 justify-center px-3 pt-1"
      style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))' }}
    >
      <DockCapsule theme={theme} dockStyle={dockStyle}>
        <nav ref={dockNavRef} className="grid grid-cols-4 items-stretch gap-2" aria-label="底部 Dock（4x1）">
          {Array.from({ length: DOCK_COUNT }, (_, index) => {
            const app = apps[index] ?? null
            const longPressHandlers = useLongPress({
              delay: 500,
              moveTolerance: 10,
              onLongPress: () => {
                if (app) onRequestEditMode?.(app.id)
              },
            })

            return (
              <div key={`dock-slot-${index}`} className="relative">
                <AnimatePresence>
                  {isEditMode && hoverIndex === index ? (
                    <motion.div
                      className="pointer-events-none absolute inset-1 rounded-[22px] border border-[#D4AF37]/70 bg-white/24 shadow-[0_10px_24px_rgba(212,175,55,0.12)]"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    />
                  ) : null}
                </AnimatePresence>
                {app ? (
                  <motion.div layout ref={(node) => registerNode?.(app.id, node)}>
                    <DesktopAppTile
                      app={app}
                      onOpen={onOpen}
                      className="h-full w-full"
                      compact={compact}
                      badgeCount={app.id === 'wechat' ? wechatBadgeCount : 0}
                      isEditMode={isEditMode}
                      isActiveDrag={activeDragId === app.id}
                      isGhosted={activeDragId === app.id}
                      pointerHandlers={
                        isEditMode
                          ? {
                              onPointerDown: (event) => onPointerDragStart?.(app.id, event),
                            }
                          : longPressHandlers
                      }
                    />
                  </motion.div>
                ) : null}
              </div>
            )
          })}
        </nav>
      </DockCapsule>
    </div>
  )
}
