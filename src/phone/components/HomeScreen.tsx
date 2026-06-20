import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DESKTOP_LAYOUT_SLOT_COUNT, type AppSlot } from '../types'
import { personaDb } from '../apps/wechat/newFriendsPersona/idb'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  resolvePrivateWeChatConversationKey,
  wechatConversationKey,
} from '../apps/wechat/wechatConversationKey'
import { DesktopAppTile } from './DesktopAppTile'
import { Dock } from './Dock'
import { MusicWidget } from './MusicWidget'
import { PersonalCard } from './PersonalCard'
import { StatusBar } from './StatusBar'
import { WheelWidget } from './WheelWidget'
import { resolvePublicImageUrl } from '../../publicAssetUrl'
import { useCustomization } from '../CustomizationContext'
import { useLongPress } from '../hooks/useLongPress'

type Props = {
  onOpenApp: (id: AppSlot['id']) => void
  onOpenUserAccount?: () => void
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
    void (async () => {
      const keySet = new Set<string>()
      keySet.add(wechatConversationKey(WECHAT_LUMI_PEER_CHARACTER_ID, pid))
      for (const c of list) {
        const ch = await personaDb.getCharacter(c.characterId)
        keySet.add(resolvePrivateWeChatConversationKey(c.characterId, ch, pid))
      }
      const keys = Array.from(keySet)
      const counts = await Promise.all(keys.map((k) => personaDb.countUnreadWeChatCharacterMessages(k)))
      setCount(counts.reduce((a, b) => a + b, 0))
    })()
  }, [state.wechatPersonaContacts, playerIdentityId])

  useEffect(() => {
    refresh()
    const on = () => refresh()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [refresh])

  return count
}

const HOME_WIDGET_LAYOUT_STORAGE_KEY = 'lumi-home-widget-layout-v1'
const RESET_HOME_WIDGET_LAYOUT_EVENT = 'lumi-reset-home-widget-layout'
type ProfileAnchor = 'top' | 'bottom'
/** 仅用于读取旧版 localStorage 迁移 */
type MusicSide = 'left' | 'right'
type DesktopWidgetBand = 'upper' | 'lower'

const FREE_HOME_LAYOUT_VERSION = 2
/** 2×2 左上角（与现有 grid 行列线一致） */
type GridPoint = { col: number; row: number }

type GridArea = {
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
}

type HomeWidgetLayout = {
  profile: GridArea
  music: GridArea
  wheel: GridArea
  desktopSlots: Array<{ col: number; row: number }>
}

function legacyGetHomeWidgetLayout(
  profileAnchor: ProfileAnchor,
  musicSide: MusicSide,
  widgetBand: DesktopWidgetBand,
): HomeWidgetLayout {
  if (profileAnchor === 'bottom') {
    if (widgetBand === 'upper') {
      if (musicSide === 'left') {
        return {
          profile: { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 },
          music: { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 3 },
          wheel: { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 3 },
          desktopSlots: [
            { col: 1, row: 3 },
            { col: 2, row: 3 },
            { col: 3, row: 3 },
            { col: 4, row: 3 },
            { col: 1, row: 4 },
            { col: 2, row: 4 },
          ],
        }
      }
      return {
        profile: { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 },
        music: { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 3 },
        wheel: { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 3 },
        desktopSlots: [
          { col: 1, row: 3 },
          { col: 2, row: 3 },
          { col: 3, row: 3 },
          { col: 4, row: 3 },
          { col: 3, row: 4 },
          { col: 4, row: 4 },
        ],
      }
    }
    if (musicSide === 'left') {
      return {
        profile: { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 },
        desktopSlots: [
          { col: 1, row: 1 },
          { col: 2, row: 1 },
          { col: 3, row: 1 },
          { col: 4, row: 1 },
          { col: 1, row: 2 },
          { col: 2, row: 2 },
        ],
        music: { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 5 },
        wheel: { colStart: 3, colEnd: 5, rowStart: 3, rowEnd: 5 },
      }
    }
    return {
      profile: { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 },
      desktopSlots: [
        { col: 1, row: 1 },
        { col: 2, row: 1 },
        { col: 3, row: 1 },
        { col: 4, row: 1 },
        { col: 3, row: 2 },
        { col: 4, row: 2 },
      ],
      music: { colStart: 3, colEnd: 5, rowStart: 3, rowEnd: 5 },
      wheel: { colStart: 1, colEnd: 3, rowStart: 3, rowEnd: 5 },
    }
  }

  if (widgetBand === 'upper') {
    if (musicSide === 'right') {
      return {
        profile: { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 },
        music: { colStart: 3, colEnd: 5, rowStart: 5, rowEnd: 7 },
        wheel: { colStart: 1, colEnd: 3, rowStart: 5, rowEnd: 7 },
        desktopSlots: [
          { col: 1, row: 7 },
          { col: 2, row: 7 },
          { col: 3, row: 7 },
          { col: 4, row: 7 },
          { col: 1, row: 8 },
          { col: 2, row: 8 },
        ],
      }
    }
    return {
      profile: { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 },
      music: { colStart: 1, colEnd: 3, rowStart: 5, rowEnd: 7 },
      wheel: { colStart: 3, colEnd: 5, rowStart: 5, rowEnd: 7 },
      desktopSlots: [
        { col: 1, row: 7 },
        { col: 2, row: 7 },
        { col: 3, row: 7 },
        { col: 4, row: 7 },
        { col: 1, row: 8 },
        { col: 2, row: 8 },
      ],
    }
  }

  if (musicSide === 'right') {
    return {
      profile: { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 },
      desktopSlots: [
        { col: 1, row: 5 },
        { col: 2, row: 5 },
        { col: 3, row: 5 },
        { col: 4, row: 5 },
        { col: 3, row: 6 },
        { col: 4, row: 6 },
      ],
      music: { colStart: 3, colEnd: 5, rowStart: 7, rowEnd: 9 },
      wheel: { colStart: 1, colEnd: 3, rowStart: 7, rowEnd: 9 },
    }
  }
  return {
    profile: { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 },
    desktopSlots: [
      { col: 1, row: 5 },
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
      { col: 1, row: 6 },
      { col: 2, row: 6 },
    ],
    music: { colStart: 1, colEnd: 3, rowStart: 7, rowEnd: 9 },
    wheel: { colStart: 3, colEnd: 5, rowStart: 7, rowEnd: 9 },
  }
}

/** 名片以外的 4×4 桌面区（绝对网格行） */
function getDesktopFourByFourArea(profileAnchor: ProfileAnchor): GridArea {
  if (profileAnchor === 'bottom') {
    return { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 }
  }
  return { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 }
}

function getProfileGridArea(profileAnchor: ProfileAnchor): GridArea {
  if (profileAnchor === 'bottom') return { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 }
  return { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 }
}

function originTo2x2(o: GridPoint): GridArea {
  return { colStart: o.col, colEnd: o.col + 2, rowStart: o.row, rowEnd: o.row + 2 }
}

function gridAreasOverlap(a: GridArea, b: GridArea): boolean {
  return a.colStart < b.colEnd && b.colStart < a.colEnd && a.rowStart < b.rowEnd && b.rowStart < a.rowEnd
}

function cellKey(c: GridPoint): string {
  return `${c.col},${c.row}`
}

function cellsOfArea(a: GridArea): GridPoint[] {
  const out: GridPoint[] = []
  for (let r = a.rowStart; r < a.rowEnd; r += 1) {
    for (let col = a.colStart; col < a.colEnd; col += 1) {
      out.push({ col, row: r })
    }
  }
  return out
}

/** 名片外的 4×4 桌面每一格 */
function listAllDesktopCells(profileAnchor: ProfileAnchor): GridPoint[] {
  return cellsOfArea(getDesktopFourByFourArea(profileAnchor))
}

/**
 * 是否「明确要把音乐/罗盘与对方换位」：必须比离自己原点更近地靠近对方中心，且落在对方 2×2 区域内（避免误触 + 与吸附抢判）。
 */
function shouldSwapMusicWheelAtDrop(
  pt: { x: number; y: number },
  which: 'music' | 'wheel',
  layoutAtDragStart: { music: GridPoint; wheel: GridPoint },
  getAreaCenter: (area: GridArea) => { x: number; y: number } | null,
  getGridAreaClientBounds: (area: GridArea) => { left: number; top: number; right: number; bottom: number } | null,
): boolean {
  const self = which === 'music' ? layoutAtDragStart.music : layoutAtDragStart.wheel
  const other = which === 'music' ? layoutAtDragStart.wheel : layoutAtDragStart.music
  const selfC = getAreaCenter(originTo2x2(self))
  const otherC = getAreaCenter(originTo2x2(other))
  if (!selfC || !otherC) return false
  const dSelf = Math.hypot(pt.x - selfC.x, pt.y - selfC.y)
  const dOther = Math.hypot(pt.x - otherC.x, pt.y - otherC.y)
  if (dOther >= dSelf * 0.88) return false
  const b = getGridAreaClientBounds(originTo2x2(other))
  if (!b) return false
  const pad = 10
  return (
    pt.x >= b.left - pad &&
    pt.x <= b.right + pad &&
    pt.y >= b.top - pad &&
    pt.y <= b.bottom + pad
  )
}

/**
 * 仅把「压在组件 2×2 下 / 出桌面 / 重复格」的图标槽挪到空位；其余槽坐标不动。
 * 挪移时优先选离该槽**原坐标**最近的空位，避免行优先扫描导致每次微调都整排乱飘。
 */
function relocateIconSlotsAfterWidgets(
  profileAnchor: ProfileAnchor,
  music: GridPoint,
  wheel: GridPoint,
  slots: GridPoint[],
): GridPoint[] {
  const n = DESKTOP_LAYOUT_SLOT_COUNT
  const widgetCellSet = new Set(
    [...cellsOfArea(originTo2x2(music)), ...cellsOfArea(originTo2x2(wheel))].map(cellKey),
  )
  const allCells = listAllDesktopCells(profileAnchor)
  const desktopKeySet = new Set(allCells.map(cellKey))

  const out = slots.slice(0, n).map((s) => ({ col: s.col, row: s.row }))
  while (out.length < n) {
    out.push({ col: 1, row: 1 })
  }
  /** 持久化里的「原位」，用于就近落点，避免反复换边 */
  const initialPos = out.map((s) => ({ col: s.col, row: s.row }))

  const occ = new Set<string>()
  const needReassign: number[] = []

  for (let i = 0; i < n; i += 1) {
    const s = out[i]!
    const k = cellKey(s)
    const onDesktop = desktopKeySet.has(k)
    const underWidget = widgetCellSet.has(k)
    const dup = occ.has(k)
    if (onDesktop && !underWidget && !dup) {
      occ.add(k)
    } else {
      needReassign.push(i)
    }
  }

  if (needReassign.length === 0) {
    return out
  }

  needReassign.sort((ia, ib) => {
    const a = initialPos[ia]!
    const b = initialPos[ib]!
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })

  for (const i of needReassign) {
    const orig = initialPos[i]!
    const candidates = allCells.filter((c) => {
      const ck = cellKey(c)
      return !widgetCellSet.has(ck) && !occ.has(ck)
    })
    if (!candidates.length) break
    candidates.sort((a, b) => {
      const da = Math.abs(a.col - orig.col) + Math.abs(a.row - orig.row)
      const db = Math.abs(b.col - orig.col) + Math.abs(b.row - orig.row)
      if (da !== db) return da - db
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })
    const picked = candidates[0]!
    out[i] = picked
    occ.add(cellKey(picked))
  }

  return out
}

function listTwoByTwoTopLefts(profileAnchor: ProfileAnchor): GridPoint[] {
  const rows = profileAnchor === 'bottom' ? [1, 2, 3] : [5, 6, 7]
  const cols = [1, 2, 3] as const
  const out: GridPoint[] = []
  for (const row of rows) {
    for (const col of cols) {
      out.push({ col, row })
    }
  }
  return out
}

function defaultSlotOrigins(profileAnchor: ProfileAnchor): GridPoint[] {
  if (profileAnchor === 'bottom') {
    return [
      { col: 1, row: 3 },
      { col: 2, row: 3 },
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 1, row: 4 },
      { col: 2, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 4 },
    ]
  }
  return [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 1, row: 8 },
    { col: 2, row: 8 },
    { col: 3, row: 8 },
    { col: 4, row: 8 },
  ]
}

function padIconSlotOrigins(profileAnchor: ProfileAnchor, slots: GridPoint[] | undefined): GridPoint[] {
  const full = defaultSlotOrigins(profileAnchor)
  if (!Array.isArray(slots) || slots.length === 0) return full
  const out = slots.slice(0, DESKTOP_LAYOUT_SLOT_COUNT).map((s, i) =>
    s && typeof s.col === 'number' && typeof s.row === 'number' ? { col: s.col, row: s.row } : full[i]!,
  )
  while (out.length < DESKTOP_LAYOUT_SLOT_COUNT) {
    out.push(full[out.length]!)
  }
  return out
}

function defaultMusicWheelOrigins(profileAnchor: ProfileAnchor): { music: GridPoint; wheel: GridPoint } {
  if (profileAnchor === 'bottom') return { music: { col: 1, row: 1 }, wheel: { col: 3, row: 1 } }
  return { music: { col: 1, row: 5 }, wheel: { col: 3, row: 5 } }
}

function buildLiveHomeLayout(
  profileAnchor: ProfileAnchor,
  music: GridPoint,
  wheel: GridPoint,
  slots: GridPoint[],
): HomeWidgetLayout {
  return {
    profile: getProfileGridArea(profileAnchor),
    music: originTo2x2(music),
    wheel: originTo2x2(wheel),
    desktopSlots: slots.slice(0, DESKTOP_LAYOUT_SLOT_COUNT),
  }
}

function migrateStorageToFreeHome(): {
  profileAnchor: ProfileAnchor
  music: GridPoint
  wheel: GridPoint
  slots: GridPoint[]
} {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HOME_WIDGET_LAYOUT_STORAGE_KEY) || '{}') as {
      v?: number
      profileAnchor?: ProfileAnchor
      music?: GridPoint
      wheel?: GridPoint
      slots?: GridPoint[]
      musicSide?: MusicSide
      widgetBand?: DesktopWidgetBand
    }
    if (raw.v === FREE_HOME_LAYOUT_VERSION && raw.music && raw.wheel && Array.isArray(raw.slots)) {
      const anchor = raw.profileAnchor === 'bottom' || raw.profileAnchor === 'top' ? raw.profileAnchor : 'top'
      const music = raw.music
      const wheel = raw.wheel
      const slots = padIconSlotOrigins(anchor, raw.slots as GridPoint[])
      return {
        profileAnchor: anchor,
        music,
        wheel,
        slots: relocateIconSlotsAfterWidgets(anchor, music, wheel, slots),
      }
    }
    const anchor = raw.profileAnchor === 'bottom' || raw.profileAnchor === 'top' ? raw.profileAnchor : 'top'
    const musicSide = raw.musicSide === 'right' || raw.musicSide === 'left' ? raw.musicSide : 'left'
    const band = raw.widgetBand === 'lower' || raw.widgetBand === 'upper' ? raw.widgetBand : 'upper'
    const L = legacyGetHomeWidgetLayout(anchor, musicSide, band)
    const music = { col: L.music.colStart, row: L.music.rowStart }
    const wheel = { col: L.wheel.colStart, row: L.wheel.rowStart }
    const slotsRaw = L.desktopSlots.map((s) => ({ col: s.col, row: s.row }))
    const slots = padIconSlotOrigins(anchor, slotsRaw)
    return {
      profileAnchor: anchor,
      music,
      wheel,
      slots: relocateIconSlotsAfterWidgets(anchor, music, wheel, slots),
    }
  } catch {
    const anchor: ProfileAnchor = 'top'
    const { music, wheel } = defaultMusicWheelOrigins(anchor)
    return {
      profileAnchor: anchor,
      music,
      wheel,
      slots: relocateIconSlotsAfterWidgets(anchor, music, wheel, defaultSlotOrigins(anchor)),
    }
  }
}

const FLOAT_TRANSITION = {
  duration: 2.6,
  repeat: Infinity,
  repeatType: 'mirror' as const,
  ease: 'easeInOut' as const,
}
const DOCK_COUNT = 4
const DESKTOP_GRID_COLUMNS = 4
/** 整张桌面网格行数：名片占 4 行 + 下方图标区 4 行 = 8（图标区为 4×4） */
const DESKTOP_GRID_ROWS = 8
const DESKTOP_GRID_GAP_PX = 10
const DOCK_GAP_PX = 8

/** 拖拽幽灵位置：不落弹簧动画，避免图标跟不上手指 */
const DRAG_GHOST_TRANSITION = {
  left: { duration: 0 },
  top: { duration: 0 },
  width: { duration: 0 },
  height: { duration: 0 },
  opacity: { duration: 0.1 },
  scale: { duration: 0.12 },
} as const

type DropTarget =
  | { zone: 'desktop'; index: number }
  | { zone: 'dock'; index: number }

function firstDesktopCandidate(
  layout: Array<AppSlot['id'] | null>,
  excludedIds: Set<AppSlot['id']>,
  preferredIndex?: number,
): AppSlot['id'] | null {
  if (
    typeof preferredIndex === 'number' &&
    preferredIndex >= 0 &&
    preferredIndex < layout.length &&
    layout[preferredIndex] &&
    !excludedIds.has(layout[preferredIndex]!)
  ) {
    return layout[preferredIndex]!
  }
  for (const id of layout) {
    if (id && !excludedIds.has(id)) return id
  }
  return null
}

function previewPlacement(
  dockIds: AppSlot['id'][],
  desktopLayout: Array<AppSlot['id'] | null>,
  activeId: AppSlot['id'],
  source: DropTarget,
  target: DropTarget,
): { dockIds: AppSlot['id'][]; desktopLayout: Array<AppSlot['id'] | null> } {
  const nextDock = [...dockIds]
  const nextDesktop = [...desktopLayout]
  const excludedIds = new Set<AppSlot['id']>([activeId])

  if (source.zone === 'dock') nextDock[source.index] = '__empty__' as AppSlot['id']
  else nextDesktop[source.index] = null

  for (let i = 0; i < nextDock.length; i += 1) {
    if (i !== source.index && nextDock[i] === activeId) nextDock[i] = '__empty__' as AppSlot['id']
  }
  for (let i = 0; i < nextDesktop.length; i += 1) {
    if (nextDesktop[i] === activeId) nextDesktop[i] = null
  }

  if (target.zone === 'dock') {
    const displaced = nextDock[target.index]
    nextDock[target.index] = activeId
    if (displaced && displaced !== ('__empty__' as AppSlot['id'])) {
      if (source.zone === 'dock' && source.index !== target.index) {
        nextDock[source.index] = displaced
      } else if (source.zone === 'desktop' && nextDesktop[source.index] === null) {
        nextDesktop[source.index] = displaced
      } else {
        const emptyIndex = nextDesktop.findIndex((slot) => slot === null)
        if (emptyIndex >= 0) nextDesktop[emptyIndex] = displaced
      }
    }
  } else {
    const displaced = nextDesktop[target.index]
    nextDesktop[target.index] = activeId
    if (displaced) {
      if (source.zone === 'desktop' && source.index !== target.index && nextDesktop[source.index] === null) {
        nextDesktop[source.index] = displaced
      } else if (source.zone === 'dock') {
        nextDock[source.index] = displaced
      } else {
        const emptyIndex = nextDesktop.findIndex((slot) => slot === null)
        if (emptyIndex >= 0) nextDesktop[emptyIndex] = displaced
      }
    } else if (source.zone === 'dock') {
      const fallback = firstDesktopCandidate(nextDesktop, excludedIds, source.index)
      if (fallback) {
        nextDock[source.index] = fallback
        const fallbackIndex = nextDesktop.findIndex((slot) => slot === fallback)
        if (fallbackIndex >= 0) nextDesktop[fallbackIndex] = null
      }
    }
  }

  return {
    dockIds: nextDock.filter((id) => id !== ('__empty__' as AppSlot['id'])),
    desktopLayout: nextDesktop,
  }
}

type SortableDesktopTileProps = {
  app: AppSlot
  slotIndex: number
  slot: { col: number; row: number }
  compact: boolean
  isEditMode: boolean
  isActiveDrag: boolean
  isLongPressPrimed: boolean
  onOpenApp: (id: AppSlot['id']) => void
  onEnterEditMode: (id: AppSlot['id']) => void
  registerNode: (id: AppSlot['id'], node: HTMLDivElement | null) => void
  onPointerDragStart: (id: AppSlot['id'], event: React.PointerEvent<HTMLElement>) => void
}

function SortableDesktopTile({
  app,
  slotIndex,
  slot,
  compact,
  isEditMode,
  isActiveDrag,
  isLongPressPrimed,
  onOpenApp,
  onEnterEditMode,
  registerNode,
  onPointerDragStart,
}: SortableDesktopTileProps) {
  const longPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: () => onEnterEditMode(app.id),
  })

  const floatingSeed = slotIndex + 1

  return (
    <motion.div
      ref={(node) => registerNode(app.id, node)}
      layout={false}
      style={{
        gridColumn: `${slot.col} / ${slot.col + 1}`,
        gridRow: `${slot.row} / ${slot.row + 1}`,
        zIndex: isActiveDrag ? 55 : isEditMode ? 30 : 14,
      }}
      animate={
        isEditMode && !isActiveDrag
          ? {
              y: [-1.5 - (floatingSeed % 2) * 0.2, 2, -1.5 - (floatingSeed % 2) * 0.2],
              rotate: [-0.6, 0.8, -0.5],
            }
          : {
              y: 0,
              rotate: 0,
            }
      }
      transition={isEditMode && !isActiveDrag ? FLOAT_TRANSITION : { duration: 0.18, ease: 'easeOut' }}
    >
      <div className="h-full w-full touch-none">
        <DesktopAppTile
          app={app}
          onOpen={onOpenApp}
          className="h-full w-full"
          compact={compact}
          isEditMode={isEditMode}
          isActiveDrag={isActiveDrag}
          isLongPressPrimed={isLongPressPrimed}
          isGhosted={isActiveDrag}
          pointerHandlers={
            isEditMode
              ? {
                  onPointerDown: (event) => onPointerDragStart(app.id, event),
                }
              : longPressHandlers
          }
        />
      </div>
    </motion.div>
  )
}

type ActiveDragState = {
  id: AppSlot['id']
  source: DropTarget
  pointerId: number
  width: number
  height: number
  offsetX: number
  offsetY: number
  x: number
  y: number
}

type ActiveWidgetDragState = {
  widget: 'profile' | 'music' | 'wheel'
  pointerId: number
  width: number
  height: number
  offsetX: number
  offsetY: number
  x: number
  y: number
}

function readInitialFreeHomeLayout(): {
  profileAnchor: ProfileAnchor
  music: GridPoint
  wheel: GridPoint
  slots: GridPoint[]
} {
  if (typeof window === 'undefined') {
    return {
      profileAnchor: 'top',
      ...defaultMusicWheelOrigins('top'),
      slots: defaultSlotOrigins('top'),
    }
  }
  return migrateStorageToFreeHome()
}

export function HomeScreen({ onOpenApp, onOpenUserAccount }: Props) {
  const { state, reorderApps, setDesktopLayout } = useCustomization()
  const { apps, ui, theme } = state
  const wechatUnread = useWeChatHomeUnreadBadge()
  const appMap = new Map(apps.map((app) => [app.id, app] as const))
  const initialFree = readInitialFreeHomeLayout()
  const [profileAnchorState, setProfileAnchorState] = useState<ProfileAnchor>(initialFree.profileAnchor)
  const [musicOriginState, setMusicOriginState] = useState<GridPoint>(initialFree.music)
  const [wheelOriginState, setWheelOriginState] = useState<GridPoint>(initialFree.wheel)
  const [slotOriginsState, setSlotOriginsState] = useState<GridPoint[]>(initialFree.slots)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null)
  const [activeWidgetDrag, setActiveWidgetDrag] = useState<ActiveWidgetDragState | null>(null)
  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false)
  const [hoverSlotIndex, setHoverSlotIndex] = useState<number | null>(null)
  const [hoverDockIndex, setHoverDockIndex] = useState<number | null>(null)
  const [primedAppId, setPrimedAppId] = useState<AppSlot['id'] | null>(null)
  const [primedStaticWidget, setPrimedStaticWidget] = useState<'profile' | 'music' | 'wheel' | null>(null)
  const [dockIdsState, setDockIdsState] = useState<AppSlot['id'][]>(() => apps.slice(0, DOCK_COUNT).map((app) => app.id))
  const [desktopLayoutState, setDesktopLayoutState] = useState<Array<AppSlot['id'] | null>>(() => state.desktopLayout)
  const dockIdsRef = useRef<AppSlot['id'][]>(apps.slice(0, DOCK_COUNT).map((app) => app.id))
  const desktopLayoutRef = useRef<Array<AppSlot['id'] | null>>(state.desktopLayout)
  const tileNodeMapRef = useRef(new Map<AppSlot['id'], HTMLDivElement | null>())
  const profileNodeRef = useRef<HTMLDivElement | null>(null)
  const musicNodeRef = useRef<HTMLDivElement | null>(null)
  const wheelNodeRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dockNavRef = useRef<HTMLElement | null>(null)
  const dragBaseRef = useRef<{ dockIds: AppSlot['id'][]; desktopLayout: Array<AppSlot['id'] | null> } | null>(null)
  /** 静态组件拖拽开始时的布局快照（名片松手时用，避免与 ref 帧不同步） */
  const staticWidgetDragStartRef = useRef<{
    profileAnchor: ProfileAnchor
    music: GridPoint
    wheel: GridPoint
    slots: GridPoint[]
  } | null>(null)
  const compactDesktop = !ui.fullScreen || ui.showDeviceFrame
  const hasWallpaper = !!theme.wallpaperUrl?.trim()
  const contentSafeTop = ui.fullScreen && !ui.showStatusBar ? 'env(safe-area-inset-top, 0px)' : '0px'
  const widgetLayout = useMemo(
    () => buildLiveHomeLayout(profileAnchorState, musicOriginState, wheelOriginState, slotOriginsState),
    [profileAnchorState, musicOriginState, wheelOriginState, slotOriginsState],
  )
  const desktopSlots = widgetLayout.desktopSlots
  const homeLayoutRef = useRef({
    profileAnchor: profileAnchorState,
    music: musicOriginState,
    wheel: wheelOriginState,
    slots: slotOriginsState,
  })
  homeLayoutRef.current = {
    profileAnchor: profileAnchorState,
    music: musicOriginState,
    wheel: wheelOriginState,
    slots: slotOriginsState,
  }

  useEffect(() => {
    if (activeDrag || activeWidgetDrag) return
    const nextDock = apps.slice(0, DOCK_COUNT).map((app) => app.id)
    const allowed = new Set(apps.slice(DOCK_COUNT).map((app) => app.id))
    const next = desktopSlots.map((_, index) => {
      const id = state.desktopLayout[index] ?? null
      return id && allowed.has(id) ? id : null
    })
    for (const app of apps.slice(DOCK_COUNT)) {
      if (next.includes(app.id)) continue
      const emptyIndex = next.findIndex((slot) => slot === null)
      if (emptyIndex < 0) break
      next[emptyIndex] = app.id
    }
    dockIdsRef.current = nextDock
    setDockIdsState(nextDock)
    desktopLayoutRef.current = next
    setDesktopLayoutState(next)
  }, [activeDrag, activeWidgetDrag, apps, desktopSlots, state.desktopLayout])

  const handleEnterEditMode = useCallback((id: AppSlot['id']) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12)
    }
    setPrimedAppId(id)
    setIsEditMode(true)
    setActiveDrag(null)
    setActiveWidgetDrag(null)
    setHoverSlotIndex(null)
    setHoverDockIndex(null)
    window.setTimeout(() => {
      setPrimedAppId((current) => (current === id ? null : current))
    }, 280)
  }, [])

  const persistFreeHomeLayout = useCallback(
    (next: { profileAnchor: ProfileAnchor; music: GridPoint; wheel: GridPoint; slots: GridPoint[] }) => {
      const slots = relocateIconSlotsAfterWidgets(next.profileAnchor, next.music, next.wheel, next.slots)
      setProfileAnchorState(next.profileAnchor)
      setMusicOriginState(next.music)
      setWheelOriginState(next.wheel)
      setSlotOriginsState((prev) => {
        if (
          prev.length === slots.length &&
          slots.every((s, i) => prev[i]?.col === s.col && prev[i]?.row === s.row)
        ) {
          return prev
        }
        return slots
      })
      try {
        window.localStorage.setItem(
          HOME_WIDGET_LAYOUT_STORAGE_KEY,
          JSON.stringify({
            v: FREE_HOME_LAYOUT_VERSION,
            profileAnchor: next.profileAnchor,
            music: next.music,
            wheel: next.wheel,
            slots,
          }),
        )
      } catch {
        // ignore storage failures
      }
    },
    [],
  )

  const handleEnterStaticWidgetEditMode = useCallback((widget: 'profile' | 'music' | 'wheel') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12)
    }
    setPrimedStaticWidget(widget)
    setIsEditMode(true)
    setActiveDrag(null)
    setActiveWidgetDrag(null)
    setHoverSlotIndex(null)
    setHoverDockIndex(null)
    window.setTimeout(() => {
      setPrimedStaticWidget((current) => (current === widget ? null : current))
    }, 280)
  }, [])

  const resetWidgetLayout = useCallback(() => {
    const anchor: ProfileAnchor = 'top'
    const { music, wheel } = defaultMusicWheelOrigins(anchor)
    const slots = relocateIconSlotsAfterWidgets(anchor, music, wheel, defaultSlotOrigins(anchor))
    setProfileAnchorState(anchor)
    setMusicOriginState(music)
    setWheelOriginState(wheel)
    setSlotOriginsState(slots)
    setActiveWidgetDrag(null)
    setPrimedStaticWidget(null)
    try {
      window.localStorage.setItem(
        HOME_WIDGET_LAYOUT_STORAGE_KEY,
        JSON.stringify({
          v: FREE_HOME_LAYOUT_VERSION,
          profileAnchor: anchor,
          music,
          wheel,
          slots,
        }),
      )
    } catch {
      // ignore storage failures
    }
  }, [])

  const handleAppOpen = useCallback((id: AppSlot['id']) => {
    if (isEditMode) return
    onOpenApp(id)
  }, [isEditMode, onOpenApp])

  const profileLongPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: (event) => {
      handleEnterStaticWidgetEditMode('profile')
      handleStaticWidgetPointerDragStart('profile', event)
    },
  })

  const musicLongPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: (event) => {
      handleEnterStaticWidgetEditMode('music')
      handleStaticWidgetPointerDragStart('music', event)
    },
  })

  const exitEditMode = useCallback(() => {
    reorderApps([...dockIdsRef.current, ...desktopLayoutRef.current.filter((id): id is AppSlot['id'] => !!id)])
    setDesktopLayout(desktopLayoutRef.current)
    setIsEditMode(false)
    setActiveDrag(null)
    setActiveWidgetDrag(null)
    setHoverSlotIndex(null)
    setHoverDockIndex(null)
    setPrimedAppId(null)
    setPrimedStaticWidget(null)
  }, [reorderApps, setDesktopLayout])

  const registerTileNode = useCallback((id: AppSlot['id'], node: HTMLDivElement | null) => {
    tileNodeMapRef.current.set(id, node)
  }, [])

  const getSlotCenter = useCallback((slotIndex: number) => {
    const grid = gridRef.current
    const slot = desktopSlots[slotIndex]
    if (!grid || !slot) return null
    const rect = grid.getBoundingClientRect()
    const colWidth = (rect.width - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_COLUMNS - 1)) / DESKTOP_GRID_COLUMNS
    const rowHeight = (rect.height - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_ROWS - 1)) / DESKTOP_GRID_ROWS
    const x = rect.left + (slot.col - 1) * (colWidth + DESKTOP_GRID_GAP_PX) + colWidth / 2
    const y = rect.top + (slot.row - 1) * (rowHeight + DESKTOP_GRID_GAP_PX) + rowHeight / 2
    return { x, y }
  }, [desktopSlots])

  const getAreaCenter = useCallback((area: GridArea) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const colWidth = (rect.width - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_COLUMNS - 1)) / DESKTOP_GRID_COLUMNS
    const rowHeight = (rect.height - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_ROWS - 1)) / DESKTOP_GRID_ROWS
    const startX = rect.left + (area.colStart - 1) * (colWidth + DESKTOP_GRID_GAP_PX)
    const endX = rect.left + (area.colEnd - 1) * colWidth + (area.colEnd - 2) * DESKTOP_GRID_GAP_PX
    const startY = rect.top + (area.rowStart - 1) * (rowHeight + DESKTOP_GRID_GAP_PX)
    const endY = rect.top + (area.rowEnd - 1) * rowHeight + (area.rowEnd - 2) * DESKTOP_GRID_GAP_PX
    return { x: (startX + endX) / 2, y: (startY + endY) / 2 }
  }, [])

  const getGridAreaClientBounds = useCallback((area: GridArea) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const colWidth = (rect.width - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_COLUMNS - 1)) / DESKTOP_GRID_COLUMNS
    const rowHeight = (rect.height - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_ROWS - 1)) / DESKTOP_GRID_ROWS
    const left = rect.left + (area.colStart - 1) * (colWidth + DESKTOP_GRID_GAP_PX)
    const right = rect.left + (area.colEnd - 1) * colWidth + (area.colEnd - 2) * DESKTOP_GRID_GAP_PX
    const top = rect.top + (area.rowStart - 1) * (rowHeight + DESKTOP_GRID_GAP_PX)
    const bottom = rect.top + (area.rowEnd - 1) * rowHeight + (area.rowEnd - 2) * DESKTOP_GRID_GAP_PX
    return { left, top, right, bottom }
  }, [])

  /** 指针是否在名片外的 4×4 桌面区内（含组件带与图标格） */
  const isPointInDesktopFourByFour = useCallback(
    (point: { x: number; y: number }) => {
      const area = getDesktopFourByFourArea(profileAnchorState)
      const b = getGridAreaClientBounds(area)
      if (!b) return false
      const pad = 28
      return (
        point.x >= b.left - pad &&
        point.x <= b.right + pad &&
        point.y >= b.top - pad &&
        point.y <= b.bottom + pad
      )
    },
    [getGridAreaClientBounds, profileAnchorState],
  )

  const getDockCenter = useCallback((slotIndex: number) => {
    const nav = dockNavRef.current
    if (!nav) return null
    const rect = nav.getBoundingClientRect()
    const colWidth = (rect.width - DOCK_GAP_PX * (DOCK_COUNT - 1)) / DOCK_COUNT
    return {
      x: rect.left + slotIndex * (colWidth + DOCK_GAP_PX) + colWidth / 2,
      y: rect.top + rect.height / 2,
    }
  }, [])

  const resolveNearestSlotIndex = useCallback((point: { x: number; y: number }) => {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < desktopSlots.length; i += 1) {
      const center = getSlotCenter(i)
      if (!center) continue
      const distance = Math.hypot(point.x - center.x, point.y - center.y)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }
    return nearestIndex
  }, [desktopSlots.length, getSlotCenter])

  const resolveNearestProfileAnchor = useCallback((point: { x: number; y: number }): ProfileAnchor => {
    const topCenter = getAreaCenter(getProfileGridArea('top'))
    const bottomCenter = getAreaCenter(getProfileGridArea('bottom'))
    if (!topCenter || !bottomCenter) return 'top'
    return Math.hypot(point.x - topCenter.x, point.y - topCenter.y) <=
      Math.hypot(point.x - bottomCenter.x, point.y - bottomCenter.y)
      ? 'top'
      : 'bottom'
  }, [getAreaCenter])

  /** 在桌面 4×4 内吸附 2×2：仅避开名片区与另一组件；图标槽可被「压住」，松手后 {@link relocateIconSlotsAfterWidgets} 会把图标挤到空位（含第 1、2 行） */
  const snapTwoByTwoForDrag = useCallback(
    (point: { x: number; y: number }, which: 'music' | 'wheel'): GridPoint => {
      const { profileAnchor, music, wheel } = homeLayoutRef.current
      const fallback = which === 'music' ? music : wheel
      const grid = gridRef.current
      if (!grid) return fallback
      const other = which === 'music' ? wheel : music
      const profileArea = getProfileGridArea(profileAnchor)
      const otherArea = originTo2x2(other)

      const candidates = listTwoByTwoTopLefts(profileAnchor)
        .map((o) => ({ o, area: originTo2x2(o) }))
        .filter(({ area }) => {
          if (gridAreasOverlap(area, otherArea)) return false
          if (gridAreasOverlap(area, profileArea)) return false
          return true
        })
      if (!candidates.length) return fallback
      let best = candidates[0]!
      let bestD = Number.POSITIVE_INFINITY
      for (const x of candidates) {
        const c = getAreaCenter(x.area)
        if (!c) continue
        const d = Math.hypot(point.x - c.x, point.y - c.y)
        if (d < bestD) {
          bestD = d
          best = x
        }
      }
      return best.o
    },
    [getAreaCenter],
  )

  const resolveDropTarget = useCallback((point: { x: number; y: number }): DropTarget => {
    const nav = dockNavRef.current
    if (nav) {
      const dockRect = nav.getBoundingClientRect()
      const inDockBand =
        point.y >= dockRect.top - 32 &&
        point.y <= dockRect.bottom + 32 &&
        point.x >= dockRect.left - 24 &&
        point.x <= dockRect.right + 24
      if (inDockBand) {
        let nearestIndex = 0
        let nearestDistance = Number.POSITIVE_INFINITY
        for (let i = 0; i < DOCK_COUNT; i += 1) {
          const center = getDockCenter(i)
          if (!center) continue
          const distance = Math.hypot(point.x - center.x, point.y - center.y)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = i
          }
        }
        return { zone: 'dock', index: nearestIndex }
      }
    }
    return { zone: 'desktop', index: resolveNearestSlotIndex(point) }
  }, [getDockCenter, resolveNearestSlotIndex])

  const applyPreview = useCallback((id: AppSlot['id'], source: DropTarget, target: DropTarget) => {
    const base = dragBaseRef.current
    if (!base) return
    const next = previewPlacement(base.dockIds, base.desktopLayout, id, source, target)
    dockIdsRef.current = next.dockIds
    desktopLayoutRef.current = next.desktopLayout
    setDockIdsState(next.dockIds)
    setDesktopLayoutState(next.desktopLayout)
    setHoverDockIndex(target.zone === 'dock' ? target.index : null)
    setHoverSlotIndex(target.zone === 'desktop' ? target.index : null)
  }, [])

  const handlePointerDragStart = useCallback((id: AppSlot['id'], source: DropTarget, event: React.PointerEvent<HTMLElement>) => {
    const tileNode = tileNodeMapRef.current.get(id)
    if (!tileNode) return
    const rect = tileNode.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragBaseRef.current = {
      dockIds: [...dockIdsRef.current],
      desktopLayout: [...desktopLayoutRef.current],
    }
    setActiveDrag({
      id,
      source,
      pointerId: event.pointerId,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      x: rect.left,
      y: rect.top,
    })
  }, [])

  const handleStaticWidgetPointerDragStart = useCallback(
    (widget: 'profile' | 'music' | 'wheel', event: React.PointerEvent<HTMLElement | HTMLButtonElement>) => {
      const node =
        widget === 'profile'
          ? profileNodeRef.current
          : widget === 'music'
            ? musicNodeRef.current
            : wheelNodeRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      staticWidgetDragStartRef.current = {
        profileAnchor: profileAnchorState,
        music: musicOriginState,
        wheel: wheelOriginState,
        slots: slotOriginsState,
      }
      setActiveWidgetDrag({
        widget,
        pointerId: event.pointerId,
        width: rect.width,
        height: rect.height,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        x: rect.left,
        y: rect.top,
      })
    },
    [musicOriginState, profileAnchorState, slotOriginsState, wheelOriginState],
  )

  useEffect(() => {
    if (!activeDrag) return

    let committedOnce = false
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== activeDrag.pointerId) return
      const nextX = event.clientX - activeDrag.offsetX
      const nextY = event.clientY - activeDrag.offsetY
      setActiveDrag((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev))
      const target = resolveDropTarget({ x: event.clientX, y: event.clientY })
      applyPreview(activeDrag.id, activeDrag.source, target)
    }

    const finish = (event: PointerEvent) => {
      if (committedOnce) return
      if (event.pointerId !== activeDrag.pointerId) return
      committedOnce = true
      cleanup()
      reorderApps([...dockIdsRef.current, ...desktopLayoutRef.current.filter((id): id is AppSlot['id'] => !!id)])
      const committed = [...desktopLayoutRef.current]
      dragBaseRef.current = null
      setDesktopLayoutState(committed)
      setDesktopLayout(committed)
      setActiveDrag(null)
      setHoverSlotIndex(null)
      setHoverDockIndex(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      cleanup()
    }
  }, [activeDrag, applyPreview, reorderApps, resolveDropTarget, setDesktopLayout])

  useEffect(() => {
    if (!activeWidgetDrag) return

    let finishedOnce = false
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== activeWidgetDrag.pointerId) return
      const nextX = event.clientX - activeWidgetDrag.offsetX
      const nextY = event.clientY - activeWidgetDrag.offsetY
      setActiveWidgetDrag((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev))
    }

    const finish = (event: PointerEvent) => {
      if (finishedOnce) return
      if (event.pointerId !== activeWidgetDrag.pointerId) return
      finishedOnce = true
      cleanup()

      const ref = homeLayoutRef.current
      const pt = { x: event.clientX, y: event.clientY }
      const inDesk = isPointInDesktopFourByFour(pt)
      const layoutStart =
        staticWidgetDragStartRef.current != null
          ? { music: staticWidgetDragStartRef.current.music, wheel: staticWidgetDragStartRef.current.wheel }
          : { music: ref.music, wheel: ref.wheel }
      if (activeWidgetDrag.widget === 'profile') {
        const start = staticWidgetDragStartRef.current
        staticWidgetDragStartRef.current = null
        const finalAnchor = resolveNearestProfileAnchor(pt)
        if (start) {
          let { music, wheel, slots } = start
          if (finalAnchor !== start.profileAnchor) {
            const dRow =
              finalAnchor === 'bottom' && start.profileAnchor === 'top'
                ? -4
                : finalAnchor === 'top' && start.profileAnchor === 'bottom'
                  ? 4
                  : 0
            if (dRow !== 0) {
              music = { ...music, row: music.row + dRow }
              wheel = { ...wheel, row: wheel.row + dRow }
              slots = slots.map((s) => ({ ...s, row: s.row + dRow }))
            }
          }
          persistFreeHomeLayout({
            profileAnchor: finalAnchor,
            music,
            wheel,
            slots,
          })
        } else {
          persistFreeHomeLayout({
            profileAnchor: finalAnchor,
            music: ref.music,
            wheel: ref.wheel,
            slots: ref.slots,
          })
        }
      } else if (activeWidgetDrag.widget === 'music') {
        let music = ref.music
        let wheel = ref.wheel
        if (inDesk) {
          if (shouldSwapMusicWheelAtDrop(pt, 'music', layoutStart, getAreaCenter, getGridAreaClientBounds)) {
            music = ref.wheel
            wheel = ref.music
          } else {
            music = snapTwoByTwoForDrag(pt, 'music')
          }
        }
        persistFreeHomeLayout({
          profileAnchor: ref.profileAnchor,
          music,
          wheel,
          slots: ref.slots,
        })
      } else {
        let music = ref.music
        let wheel = ref.wheel
        if (inDesk) {
          if (shouldSwapMusicWheelAtDrop(pt, 'wheel', layoutStart, getAreaCenter, getGridAreaClientBounds)) {
            music = ref.wheel
            wheel = ref.music
          } else {
            wheel = snapTwoByTwoForDrag(pt, 'wheel')
          }
        }
        persistFreeHomeLayout({
          profileAnchor: ref.profileAnchor,
          music,
          wheel,
          slots: ref.slots,
        })
      }
      staticWidgetDragStartRef.current = null
      setActiveWidgetDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      cleanup()
    }
  }, [
    activeWidgetDrag,
    getAreaCenter,
    getGridAreaClientBounds,
    isPointInDesktopFourByFour,
    persistFreeHomeLayout,
    resolveNearestProfileAnchor,
    snapTwoByTwoForDrag,
  ])

  useEffect(() => {
    const onReset = () => resetWidgetLayout()
    window.addEventListener(RESET_HOME_WIDGET_LAYOUT_EVENT, onReset)
    return () => window.removeEventListener(RESET_HOME_WIDGET_LAYOUT_EVENT, onReset)
  }, [resetWidgetLayout])

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        backgroundColor: hasWallpaper ? 'transparent' : 'var(--phone-bg)',
        backgroundImage: theme.wallpaperUrl ? `url(${resolvePublicImageUrl(theme.wallpaperUrl)})` : 'none',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: theme.wallpaperFit === 'contain' ? 'contain' : 'cover',
      }}
    >
      <AnimatePresence>
        {isEditMode ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(2px) brightness(0.95)',
            }}
          />
        ) : null}
      </AnimatePresence>

      {ui.showStatusBar ? <StatusBar /> : null}

      <div
        className="relative z-[2] min-h-0 flex flex-1 items-stretch justify-center overflow-hidden px-3 pb-0"
        style={{ paddingTop: `calc(${contentSafeTop} + 0.25rem)` }}
        onPointerDown={(event) => {
          if (!isEditMode || activeDrag || activeWidgetDrag) return
          const target = event.target as HTMLElement | null
          if (!target) return
          if (target.closest('[data-desktop-tile="true"]')) return
          if (target.closest('[data-desktop-static="true"]')) return
          if (target.closest('[data-wheel-widget="true"]')) return
          if (target.closest('[data-dock-root="true"]')) return
          exitEditMode()
        }}
      >
        <div
          ref={gridRef}
          className="grid h-full w-full max-w-[360px] items-stretch gap-2.5 pb-5"
          style={{
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
          }}
        >
          {(() => {
            const profileArea = widgetLayout.profile
            return (
              <div
                key={`profile-active-${profileAnchorState}`}
                className="relative min-h-0"
                style={{
                  gridColumn: `${profileArea.colStart} / ${profileArea.colEnd}`,
                  gridRow: `${profileArea.rowStart} / ${profileArea.rowEnd}`,
                }}
              >
                <motion.div
                  ref={profileNodeRef}
                  layout
                  className="h-full w-full touch-none select-none"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: 'none',
                    opacity: activeWidgetDrag?.widget === 'profile' ? 0.04 : 1,
                  }}
                  animate={
                    isEditMode && activeWidgetDrag?.widget !== 'profile'
                      ? { y: [-1, 1.4, -1], rotate: [-0.25, 0.35, -0.2] }
                      : { y: 0, rotate: 0, scale: primedStaticWidget === 'profile' ? 1.02 : 1 }
                  }
                  transition={
                    isEditMode && activeWidgetDrag?.widget !== 'profile'
                      ? FLOAT_TRANSITION
                      : { duration: 0.18, ease: 'easeOut' }
                  }
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={isEditMode ? (event) => handleStaticWidgetPointerDragStart('profile', event) : profileLongPressHandlers.onPointerDown}
                  onPointerMove={!isEditMode ? profileLongPressHandlers.onPointerMove : undefined}
                  onPointerUp={!isEditMode ? profileLongPressHandlers.onPointerUp : undefined}
                  onPointerCancel={!isEditMode ? profileLongPressHandlers.onPointerCancel : undefined}
                  onPointerLeave={!isEditMode ? profileLongPressHandlers.onPointerLeave : undefined}
                >
                  <PersonalCard interactive={!isEditMode} onOpenUserAccount={onOpenUserAccount} />
                </motion.div>
              </div>
            )
          })()}

          {(() => {
            const musicArea = widgetLayout.music
            return (
              <div
                key="home-widget-music"
                className="relative z-[5] min-h-0"
                style={{
                  gridColumn: `${musicArea.colStart} / ${musicArea.colEnd}`,
                  gridRow: `${musicArea.rowStart} / ${musicArea.rowEnd}`,
                }}
              >
                <motion.div
                  ref={musicNodeRef}
                  layout={false}
                  className="h-full w-full touch-none select-none"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: 'none',
                    opacity: activeWidgetDrag?.widget === 'music' ? 0.04 : 1,
                  }}
                  animate={
                    isEditMode && activeWidgetDrag?.widget !== 'music'
                      ? { y: [-1, 1.4, -1], rotate: [-0.25, 0.35, -0.2] }
                      : {
                          y: 0,
                          rotate: 0,
                          scale: primedStaticWidget === 'music' ? 1.02 : 1,
                        }
                  }
                  transition={
                    isEditMode && activeWidgetDrag?.widget !== 'music'
                      ? FLOAT_TRANSITION
                      : { duration: 0.18, ease: 'easeOut' }
                  }
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDownCapture={
                    isEditMode ? (event) => handleStaticWidgetPointerDragStart('music', event) : undefined
                  }
                  onPointerDown={!isEditMode ? musicLongPressHandlers.onPointerDown : undefined}
                  onPointerMove={!isEditMode ? musicLongPressHandlers.onPointerMove : undefined}
                  onPointerUp={!isEditMode ? musicLongPressHandlers.onPointerUp : undefined}
                  onPointerCancel={!isEditMode ? musicLongPressHandlers.onPointerCancel : undefined}
                  onPointerLeave={!isEditMode ? musicLongPressHandlers.onPointerLeave : undefined}
                >
                  <MusicWidget isEditMode={isEditMode} />
                </motion.div>
              </div>
            )
          })()}

          <div
            key="home-widget-wheel"
            className="relative z-[5]"
            style={{
              gridColumn: `${widgetLayout.wheel.colStart} / ${widgetLayout.wheel.colEnd}`,
              gridRow: `${widgetLayout.wheel.rowStart} / ${widgetLayout.wheel.rowEnd}`,
            }}
          >
            <motion.div
              ref={wheelNodeRef}
              layout={false}
              className="h-full w-full touch-none select-none"
              style={{
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'none',
                opacity: activeWidgetDrag?.widget === 'wheel' ? 0.04 : 1,
              }}
              animate={
                isEditMode && activeWidgetDrag?.widget !== 'wheel'
                  ? { y: [-1, 1.4, -1], rotate: [-0.25, 0.35, -0.2] }
                  : { y: 0, rotate: 0, scale: primedStaticWidget === 'wheel' ? 1.02 : 1 }
              }
              transition={
                isEditMode && activeWidgetDrag?.widget !== 'wheel'
                  ? FLOAT_TRANSITION
                  : { duration: 0.18, ease: 'easeOut' }
              }
              onPointerDownCapture={
                isEditMode ? (event) => handleStaticWidgetPointerDragStart('wheel', event) : undefined
              }
            >
              <WheelWidget
                open={isWheelModalOpen}
                onOpenChange={setIsWheelModalOpen}
                isEditMode={isEditMode}
                isActiveDrag={activeWidgetDrag?.widget === 'wheel'}
                isLongPressPrimed={primedStaticWidget === 'wheel'}
                disableOpen={isEditMode}
                onLongPressStartDrag={(event) => {
                  handleEnterStaticWidgetEditMode('wheel')
                  handleStaticWidgetPointerDragStart('wheel', event)
                }}
              />
            </motion.div>
          </div>

          {desktopSlots.map((slot, slotIndex) => {
            const appId = desktopLayoutState[slotIndex]
            const app = appId ? appMap.get(appId) ?? null : null
            const isHighlighted = isEditMode && hoverSlotIndex === slotIndex
            return (
              <div
                key={`slot-${slotIndex}`}
                className="relative"
                style={{
                  gridColumn: `${slot.col} / ${slot.col + 1}`,
                  gridRow: `${slot.row} / ${slot.row + 1}`,
                }}
              >
                <AnimatePresence>
                  {isHighlighted ? (
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
                  <SortableDesktopTile
                    key={app.id}
                    app={app}
                    slotIndex={slotIndex}
                    slot={slot}
                    compact={compactDesktop}
                    isEditMode={isEditMode}
                    isActiveDrag={activeDrag?.id === app.id}
                    isLongPressPrimed={primedAppId === app.id}
                    onOpenApp={handleAppOpen}
                    onEnterEditMode={handleEnterEditMode}
                    registerNode={registerTileNode}
                    onPointerDragStart={(id, event) => handlePointerDragStart(id, { zone: 'desktop', index: slotIndex }, event)}
                  />
                ) : null}
              </div>
            )
          })}
        </div>

        <AnimatePresence>
          {activeDrag ? (
            <motion.div
              className="pointer-events-none fixed z-[60]"
              initial={false}
              animate={{
                opacity: 1,
                scale: 1.08,
                width: activeDrag.width,
                height: activeDrag.height,
                left: activeDrag.x,
                top: activeDrag.y,
              }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={DRAG_GHOST_TRANSITION}
            >
              <DesktopAppTile
                app={appMap.get(activeDrag.id) ?? apps[0]!}
                onOpen={handleAppOpen}
                compact={compactDesktop}
                isEditMode
                isActiveDrag
                className="h-full w-full"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {activeWidgetDrag ? (
            <motion.div
              className="pointer-events-none fixed z-[61]"
              initial={false}
              animate={{
                opacity: 1,
                scale: 1.04,
                width: activeWidgetDrag.width,
                height: activeWidgetDrag.height,
                left: activeWidgetDrag.x,
                top: activeWidgetDrag.y,
              }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={DRAG_GHOST_TRANSITION}
            >
              {activeWidgetDrag.widget === 'profile' ? (
                <PersonalCard interactive={false} />
              ) : activeWidgetDrag.widget === 'music' ? (
                <MusicWidget isEditMode />
              ) : (
                <WheelWidget isEditMode disableOpen open={false} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <Dock
        apps={dockIdsState.map((id) => appMap.get(id) ?? null)}
        onOpen={handleAppOpen}
        compact={compactDesktop}
        wechatBadgeCount={wechatUnread}
        isEditMode={isEditMode}
        onRequestEditMode={handleEnterEditMode}
        activeDragId={activeDrag?.id ?? null}
        hoverIndex={hoverDockIndex}
        registerNode={registerTileNode}
        dockNavRef={dockNavRef}
        onPointerDragStart={(id, event) => {
          const dockIndex = dockIdsRef.current.findIndex((dockId) => dockId === id)
          if (dockIndex < 0) return
          handlePointerDragStart(id, { zone: 'dock', index: dockIndex }, event)
        }}
      />
    </div>
  )
}
