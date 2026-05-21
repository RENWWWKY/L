/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from './apps/wechat/newFriendsPersona/idb'
import {
  DEFAULT_CUSTOMIZATION,
  DEFAULT_APP_PAGE_STYLE,
  type CustomizationState,
  type PhoneTheme,
  type Profile,
  type MusicInfo,
  type MusicPlayMode,
  type AppSlot,
  type UiPreferences,
  type AppPageStyle,
  type DockStyle,
  type DockFillMode,
  type WeChatTheme,
  type WeChatBubbleTheme,
  wechatBubbleThemesEqual,
  type WxFillStyle,
  type WeChatTabBarItem,
  type WeChatTabId,
  type WeChatPersonaContact,
  type GestureEffectsSettings,
  normalizeGestureEffects,
  DESKTOP_LAYOUT_SLOT_COUNT,
} from './types'
import { migrateLegacyRootPublicUrl } from '../publicAssetUrl'

const STORAGE_KEY = 'lumi-phone-custom-v3'
const LEGACY_STORAGE_KEY_V2 = 'lumi-phone-custom-v2'
const LEGACY_STORAGE_KEY = 'lumi-phone-custom-v1'
const LEGACY_STORY_FONT =
  '"Noto Serif SC", "Noto Sans SC", "PingFang SC", "PingFang TC", "Hiragino Sans GB", "STSong", "STKaiti", "FangSong", "KaiTi", "Georgia", "Garamond", "Times New Roman", serif'
const LEGACY_WECHAT_FONT_INTER =
  '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, "Segoe UI", sans-serif'
const LEGACY_WECHAT_TABBAR_BG = 'rgba(255, 255, 255, 0.88)'

function normalizeMusicPlayMode(v: unknown): MusicPlayMode {
  return v === 'shuffle' || v === 'list-loop' || v === 'single-loop' || v === 'heartbeat'
    ? v
    : DEFAULT_CUSTOMIZATION.music.playMode
}

function normalizePlayingSource(v: unknown): 'search' | 'library' {
  return v === 'search' || v === 'library' ? v : DEFAULT_CUSTOMIZATION.music.playingSource
}

function normalizeWeChatPersonaContacts(v: unknown): WeChatPersonaContact[] {
  if (!Array.isArray(v)) return []
  const out: WeChatPersonaContact[] = []
  for (const it of v) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const characterId = typeof o.characterId === 'string' ? o.characterId : ''
    const remarkName = typeof o.remarkName === 'string' ? o.remarkName.trim() : ''
    const id =
      typeof o.id === 'string' && o.id.trim()
        ? o.id.trim()
        : characterId
          ? `persona-${characterId}`
          : ''
    const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl.trim() : ''
    if (!characterId || !remarkName) continue
    out.push({
      id,
      characterId,
      remarkName: remarkName.slice(0, 64),
      avatarUrl: avatarUrl.length > 400_000 ? '' : avatarUrl || undefined,
      isStarred: typeof o.isStarred === 'boolean' ? o.isStarred : false,
    })
  }
  return out
}

/** 全局气泡变更时：角色里「仍与旧全局一致」的字段跟随新全局，否则视为角色独立定制并保留 */
function syncBubbleByRoleWithNewGlobal(
  prevGlobal: WeChatBubbleTheme,
  nextGlobal: WeChatBubbleTheme,
  bubbleByRole: Record<string, WeChatBubbleTheme>,
): Record<string, WeChatBubbleTheme> {
  const out: Record<string, WeChatBubbleTheme> = { ...bubbleByRole }
  for (const [k, role] of Object.entries(bubbleByRole)) {
    out[k] = {
      selfBubbleBg: role.selfBubbleBg === prevGlobal.selfBubbleBg ? nextGlobal.selfBubbleBg : role.selfBubbleBg,
      otherBubbleBg: role.otherBubbleBg === prevGlobal.otherBubbleBg ? nextGlobal.otherBubbleBg : role.otherBubbleBg,
      selfBubbleRadiusPx:
        role.selfBubbleRadiusPx === prevGlobal.selfBubbleRadiusPx
          ? nextGlobal.selfBubbleRadiusPx
          : role.selfBubbleRadiusPx,
      otherBubbleRadiusPx:
        role.otherBubbleRadiusPx === prevGlobal.otherBubbleRadiusPx
          ? nextGlobal.otherBubbleRadiusPx
          : role.otherBubbleRadiusPx,
      showAvatar: role.showAvatar === prevGlobal.showAvatar ? nextGlobal.showAvatar : role.showAvatar,
      avatarRadiusPx:
        role.avatarRadiusPx === prevGlobal.avatarRadiusPx ? nextGlobal.avatarRadiusPx : role.avatarRadiusPx,
      showBubbleTail:
        role.showBubbleTail === prevGlobal.showBubbleTail ? nextGlobal.showBubbleTail : role.showBubbleTail,
      mergeConsecutiveAvatarGroup:
        role.mergeConsecutiveAvatarGroup === prevGlobal.mergeConsecutiveAvatarGroup
          ? nextGlobal.mergeConsecutiveAvatarGroup
          : role.mergeConsecutiveAvatarGroup,
    }
  }
  return out
}

function normalizeState(raw: Partial<CustomizationState>): CustomizationState {
  const theme = { ...DEFAULT_CUSTOMIZATION.theme, ...raw.theme }
  theme.wallpaperUrl = migrateLegacyRootPublicUrl(theme.wallpaperUrl)
  // 迁移：旧默认正文字体自动升级到更明显的乙女风默认字体
  if (theme.fontFamily === LEGACY_STORY_FONT) {
    theme.fontFamily = DEFAULT_CUSTOMIZATION.theme.fontFamily
  }
  const wechatTheme = normalizeWeChatTheme(raw.wechatTheme)
  const musicMerged = { ...DEFAULT_CUSTOMIZATION.music, ...raw.music }
  const profile = { ...DEFAULT_CUSTOMIZATION.profile, ...raw.profile }
  const apps = normalizeApps(raw.apps)
  profile.avatarImageUrl = migrateLegacyRootPublicUrl(profile.avatarImageUrl)
  return {
    theme,
    profile,
    music: {
      ...musicMerged,
      playMode: normalizeMusicPlayMode(musicMerged.playMode),
      playingSource: normalizePlayingSource(musicMerged.playingSource),
      playingTrackId:
        typeof musicMerged.playingTrackId === 'string' ? musicMerged.playingTrackId : '',
      playingAudioUrl:
        typeof musicMerged.playingAudioUrl === 'string' ? musicMerged.playingAudioUrl : '',
    },
    apps,
    desktopLayout: normalizeDesktopLayout(raw.desktopLayout, apps),
    ui: {
      ...DEFAULT_CUSTOMIZATION.ui,
      ...raw.ui,
      keyboardDebugEnabled:
        typeof raw.ui?.keyboardDebugEnabled === 'boolean'
          ? raw.ui.keyboardDebugEnabled
          : DEFAULT_CUSTOMIZATION.ui.keyboardDebugEnabled,
      keyboardDebugSimulateOpen:
        typeof raw.ui?.keyboardDebugSimulateOpen === 'boolean'
          ? raw.ui.keyboardDebugSimulateOpen
          : DEFAULT_CUSTOMIZATION.ui.keyboardDebugSimulateOpen,
      keyboardDebugInsetPx:
        typeof raw.ui?.keyboardDebugInsetPx === 'number' && Number.isFinite(raw.ui.keyboardDebugInsetPx)
          ? Math.max(-220, Math.min(220, Math.round(raw.ui.keyboardDebugInsetPx)))
          : DEFAULT_CUSTOMIZATION.ui.keyboardDebugInsetPx,
    },
    appPageStyles: normalizeAppPageStyles(raw.appPageStyles),
    dockStyle: normalizeDockStyle(raw.dockStyle),
    wechatTheme,
    wechatPersonaContacts: normalizeWeChatPersonaContacts(raw.wechatPersonaContacts),
    customCss: typeof raw.customCss === 'string' ? raw.customCss : '',
    gestureEffects: normalizeGestureEffects(raw.gestureEffects),
  }
}

function normalizeWeChatTheme(parsed: unknown): WeChatTheme {
  const base = DEFAULT_CUSTOMIZATION.wechatTheme
  if (!parsed || typeof parsed !== 'object') return base
  const raw = parsed as Partial<WeChatTheme>

  const clamp = (n: unknown, min: number, max: number, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n)
      ? Math.max(min, Math.min(max, Math.round(n)))
      : fallback
  const pick = (s: unknown, fallback: string) => (typeof s === 'string' ? s : fallback)
  const bool = (b: unknown, fallback: boolean) => (typeof b === 'boolean' ? b : fallback)

  const ts =
    raw.timestampStyle === 'hidden' ||
    raw.timestampStyle === 'subtle' ||
    raw.timestampStyle === 'detailed'
      ? raw.timestampStyle
      : base.timestampStyle

  // 迁移：历史默认 Inter 视作“未覆盖”，改为跟随全局字体
  const rawFont = typeof raw.fontFamily === 'string' ? raw.fontFamily : ''
  const normalizedFont = rawFont === LEGACY_WECHAT_FONT_INTER ? '' : rawFont

  const normalizeFill = (f: unknown, fallback: WxFillStyle): WxFillStyle => {
    if (!f || typeof f !== 'object') return fallback
    const r = f as Partial<WxFillStyle>
    const mode =
      r.mode === 'solid' || r.mode === 'gradient' || r.mode === 'image' ? r.mode : fallback.mode
    return {
      mode,
      solidColor: pick(r.solidColor, fallback.solidColor),
      gradientFrom: pick(r.gradientFrom, fallback.gradientFrom),
      gradientTo: pick(r.gradientTo, fallback.gradientTo),
      gradientAngle: clamp(r.gradientAngle, 0, 360, fallback.gradientAngle),
      gradientNaturalness: clamp(r.gradientNaturalness, 0, 100, fallback.gradientNaturalness),
      imageUrl: migrateLegacyRootPublicUrl(pick(r.imageUrl, fallback.imageUrl)),
      layerOpacity: clamp(r.layerOpacity, 0, 100, fallback.layerOpacity),
      glassEnabled: bool(r.glassEnabled, fallback.glassEnabled),
      glassOpacity: clamp(r.glassOpacity, 0, 100, fallback.glassOpacity),
      blurPx: clamp(r.blurPx, 0, 40, fallback.blurPx),
    }
  }

  const normalizeBubble = (b: unknown, fallback: WeChatBubbleTheme): WeChatBubbleTheme => {
    if (!b || typeof b !== 'object') return fallback
    const r = b as Partial<WeChatBubbleTheme>
    return {
      selfBubbleBg: pick(r.selfBubbleBg, fallback.selfBubbleBg),
      otherBubbleBg: pick(r.otherBubbleBg, fallback.otherBubbleBg),
      selfBubbleRadiusPx: clamp(r.selfBubbleRadiusPx, 10, 28, fallback.selfBubbleRadiusPx),
      otherBubbleRadiusPx: clamp(r.otherBubbleRadiusPx, 10, 28, fallback.otherBubbleRadiusPx),
      showAvatar: bool(r.showAvatar, fallback.showAvatar),
      avatarRadiusPx: clamp(r.avatarRadiusPx, 0, 18, fallback.avatarRadiusPx),
      showBubbleTail: bool(r.showBubbleTail, fallback.showBubbleTail),
      mergeConsecutiveAvatarGroup: bool(r.mergeConsecutiveAvatarGroup, fallback.mergeConsecutiveAvatarGroup),
    }
  }

  const LEGACY_OTHER_BUBBLE_SEMI = 'rgba(0, 0, 0, 0.04)'
  const OTHER_BUBBLE_SOLID_DEFAULT = '#EEEFF2'

  let bubbleGlobal = normalizeBubble(raw.bubbleGlobal, base.bubbleGlobal)
  if (bubbleGlobal.otherBubbleBg === LEGACY_OTHER_BUBBLE_SEMI) {
    bubbleGlobal = { ...bubbleGlobal, otherBubbleBg: OTHER_BUBBLE_SOLID_DEFAULT }
  }

  const bubbleByRole: Record<string, WeChatBubbleTheme> = {}
  if (raw.bubbleByRole && typeof raw.bubbleByRole === 'object') {
    for (const [k, v] of Object.entries(raw.bubbleByRole as Record<string, unknown>)) {
      if (!k) continue
      let roleBubble = normalizeBubble(v, bubbleGlobal)
      if (roleBubble.otherBubbleBg === LEGACY_OTHER_BUBBLE_SEMI) {
        roleBubble = { ...roleBubble, otherBubbleBg: OTHER_BUBBLE_SOLID_DEFAULT }
      }
      bubbleByRole[k] = roleBubble
    }
  }
  // 迁移：去掉与全局完全一致的角色快照（否则聊天页一直用 bubbleByRole 旧色）
  for (const k of Object.keys(bubbleByRole)) {
    if (wechatBubbleThemesEqual(bubbleByRole[k]!, bubbleGlobal)) delete bubbleByRole[k]
  }

  let pageBgGlobal = normalizeFill(raw.pageBgGlobal, base.pageBgGlobal)
  const pageBgByTab: WeChatTheme['pageBgByTab'] = { ...(base.pageBgByTab ?? {}) }
  if (raw.pageBgByTab && typeof raw.pageBgByTab === 'object') {
    for (const [k, v] of Object.entries(raw.pageBgByTab as Record<string, unknown>)) {
      if (!k) continue
      ;(pageBgByTab as Record<string, WxFillStyle>)[k] = normalizeFill(v, pageBgGlobal)
    }
  }

  /** 迁移：mode 为 image 但 imageUrl 为空时补默认壁纸，避免 Tab 页只剩纯色底 */
  const defaultTabBgImage = base.pageBgGlobal.imageUrl?.trim() ?? ''
  const repairPageBgImage = (f: WxFillStyle): WxFillStyle => {
    if (f.mode !== 'image') return f
    if (f.imageUrl?.trim() || !defaultTabBgImage) return f
    return { ...f, imageUrl: defaultTabBgImage }
  }
  pageBgGlobal = repairPageBgImage(pageBgGlobal)
  for (const k of Object.keys(pageBgByTab)) {
    const cur = pageBgByTab[k as keyof typeof pageBgByTab]
    if (cur) (pageBgByTab as Record<string, WxFillStyle>)[k] = repairPageBgImage(cur)
  }

  const headerByTab: WeChatTheme['headerByTab'] = {}
  if (raw.headerByTab && typeof raw.headerByTab === 'object') {
    for (const [k, v] of Object.entries(raw.headerByTab as Record<string, unknown>)) {
      ;(headerByTab as Record<string, WxFillStyle>)[k] = normalizeFill(v, base.pageBgGlobal)
    }
  }

  const normalizeTabItems = (items: unknown): WeChatTabBarItem[] => {
    const fallback = base.tabBarItems
    if (!Array.isArray(items)) return fallback
    const safe: WeChatTabBarItem[] = []
    const allowed: WeChatTabId[] = ['messages', 'contacts', 'dates', 'discover', 'profile']
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      const r = it as Partial<WeChatTabBarItem>
      if (!r.id || !allowed.includes(r.id as WeChatTabId)) continue
      safe.push({
        id: r.id as WeChatTabId,
        label: pick(r.label, fallback.find((x) => x.id === r.id)?.label ?? String(r.id)),
        en: pick(r.en, fallback.find((x) => x.id === r.id)?.en ?? ''),
        iconUrl: migrateLegacyRootPublicUrl(pick(r.iconUrl, '')),
        labelActiveColor: pick(r.labelActiveColor, ''),
        labelInactiveColor: pick(r.labelInactiveColor, ''),
      })
    }
    // 确保 5 个 tab 都存在（缺的补上，顺序跟随 fallback）
    const existing = new Set(safe.map((s) => s.id))
    for (const f of fallback) {
      if (!existing.has(f.id)) safe.push(f)
    }
    // 去重（按第一个出现）
    const seen = new Set<WeChatTabId>()
    return safe.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }

  // 迁移：旧默认半透明 TabBar 背景升级为不透明
  const rawTabBarBg =
    typeof raw.tabBarBg === 'string' && raw.tabBarBg.trim() ? raw.tabBarBg.trim() : ''
  const normalizedTabBarBg = rawTabBarBg === LEGACY_WECHAT_TABBAR_BG ? '#FFFFFF' : rawTabBarBg
  const tabBarStyle = normalizeFill(
    raw.tabBarStyle,
    rawTabBarBg
      ? { ...base.tabBarStyle, mode: 'solid', solidColor: normalizedTabBarBg || rawTabBarBg }
      : base.tabBarStyle,
  )

  return {
    primary: pick(raw.primary, base.primary),
    background: pick(raw.background, base.background),
    surface: pick(raw.surface, base.surface),
    text: pick(raw.text, base.text),
    textMuted: pick(raw.textMuted, base.textMuted),
    border: pick(raw.border, base.border),
    shadow: pick(raw.shadow, base.shadow),
    fontFamily: typeof normalizedFont === 'string' ? normalizedFont : base.fontFamily,
    numberFontFamily: pick(raw.numberFontFamily, base.numberFontFamily),
    fontSizeBasePx: clamp(raw.fontSizeBasePx, 12, 18, base.fontSizeBasePx),
    radiusPx: clamp(raw.radiusPx, 10, 24, base.radiusPx),

    tabBarBg: normalizedTabBarBg ? normalizedTabBarBg : base.tabBarBg,
    tabBarStyle,
    tabBarActive: pick(raw.tabBarActive, base.tabBarActive),
    tabBarInactive: pick(raw.tabBarInactive, base.tabBarInactive),
    tabBarLabelActive: pick(raw.tabBarLabelActive, base.tabBarLabelActive),
    tabBarLabelInactive: pick(raw.tabBarLabelInactive, base.tabBarLabelInactive),
    tabBarItems: normalizeTabItems(raw.tabBarItems),

    chatInputBg: pick(raw.chatInputBg, base.chatInputBg),
    chatInputBorder: pick(raw.chatInputBorder, base.chatInputBorder),
    bubbleGlobal,
    bubbleByRole,
    selfBubbleText: pick(raw.selfBubbleText, base.selfBubbleText),
    otherBubbleText: pick(raw.otherBubbleText, base.otherBubbleText),
    timestampStyle: ts,
    timestampText: pick(raw.timestampText, base.timestampText),

    pageBgGlobal,
    pageBgByTab,
    headerByTab,
    conversationCard: normalizeFill(raw.conversationCard, base.conversationCard),
  }
}

function normalizeAppPageStyles(parsed: unknown): CustomizationState['appPageStyles'] {
  const def = DEFAULT_CUSTOMIZATION.appPageStyles
  if (!parsed || typeof parsed !== 'object') return def
  const record = parsed as Record<string, Partial<AppPageStyle>>
  const wechatMerged = { ...def.wechat, ...record.wechat }
  if (
    typeof wechatMerged.pageBgImageUrl === 'string' &&
    !wechatMerged.pageBgImageUrl.trim() &&
    def.wechat.pageBgImageUrl
  ) {
    wechatMerged.pageBgImageUrl = def.wechat.pageBgImageUrl
  }
  const appearanceMerged = { ...def.appearance, ...record.appearance }
  if (
    typeof appearanceMerged.pageBgImageUrl === 'string' &&
    !appearanceMerged.pageBgImageUrl.trim() &&
    def.appearance.pageBgImageUrl?.trim()
  ) {
    appearanceMerged.pageBgImageUrl = def.appearance.pageBgImageUrl
  }
  const migrateAppPage = (s: AppPageStyle): AppPageStyle => ({
    ...s,
    headerBgImageUrl: migrateLegacyRootPublicUrl(
      typeof s.headerBgImageUrl === 'string' ? s.headerBgImageUrl : '',
    ),
    pageBgImageUrl: migrateLegacyRootPublicUrl(typeof s.pageBgImageUrl === 'string' ? s.pageBgImageUrl : ''),
    cardBgImageUrl: migrateLegacyRootPublicUrl(typeof s.cardBgImageUrl === 'string' ? s.cardBgImageUrl : ''),
  })
  return {
    wechat: migrateAppPage(wechatMerged),
    takeout: migrateAppPage({ ...DEFAULT_APP_PAGE_STYLE, ...record.takeout }),
    weibo: migrateAppPage({ ...DEFAULT_APP_PAGE_STYLE, ...record.weibo }),
    api: migrateAppPage({ ...DEFAULT_APP_PAGE_STYLE, ...record.api }),
    voiceprint: migrateAppPage({ ...DEFAULT_APP_PAGE_STYLE, ...record.voiceprint }),
    dataArchive: migrateAppPage({ ...def.dataArchive, ...record.dataArchive }),
    loreArchive: migrateAppPage({ ...def.loreArchive, ...record.loreArchive }),
    recycleBin: migrateAppPage({ ...DEFAULT_APP_PAGE_STYLE, ...def.recycleBin, ...record.recycleBin }),
    appearance: migrateAppPage(appearanceMerged),
    lumiMeet: migrateAppPage({ ...def.lumiMeet, ...record.lumiMeet }),
  }
}

const DOCK_FILL: DockFillMode[] = ['theme', 'solid', 'gradient', 'image']

function normalizeDockStyle(parsed: unknown): DockStyle {
  const base = DEFAULT_CUSTOMIZATION.dockStyle
  if (!parsed || typeof parsed !== 'object') return base
  const raw = parsed as Partial<DockStyle>
  let fillMode: DockFillMode =
    typeof raw.fillMode === 'string' && DOCK_FILL.includes(raw.fillMode as DockFillMode)
      ? (raw.fillMode as DockFillMode)
      : base.fillMode
  const legacyImg = typeof raw.bgImageUrl === 'string' && raw.bgImageUrl.trim()
  if (!raw.fillMode && legacyImg) fillMode = 'image'
  return {
    fillMode,
    dockSolidColor:
      typeof raw.dockSolidColor === 'string' ? raw.dockSolidColor : base.dockSolidColor,
    gradientFrom: typeof raw.gradientFrom === 'string' ? raw.gradientFrom : base.gradientFrom,
    gradientTo: typeof raw.gradientTo === 'string' ? raw.gradientTo : base.gradientTo,
    gradientFromStop:
      typeof raw.gradientFromStop === 'number' && Number.isFinite(raw.gradientFromStop)
        ? Math.max(0, Math.min(100, Math.round(raw.gradientFromStop)))
        : base.gradientFromStop,
    gradientToStop:
      typeof raw.gradientToStop === 'number' && Number.isFinite(raw.gradientToStop)
        ? Math.max(0, Math.min(100, Math.round(raw.gradientToStop)))
        : base.gradientToStop,
    gradientNaturalness:
      typeof raw.gradientNaturalness === 'number' && Number.isFinite(raw.gradientNaturalness)
        ? Math.max(0, Math.min(100, Math.round(raw.gradientNaturalness)))
        : base.gradientNaturalness,
    gradientAngle:
      typeof raw.gradientAngle === 'number' && Number.isFinite(raw.gradientAngle)
        ? Math.max(0, Math.min(360, raw.gradientAngle))
        : base.gradientAngle,
    bgImageUrl: migrateLegacyRootPublicUrl(
      typeof raw.bgImageUrl === 'string' ? raw.bgImageUrl : base.bgImageUrl,
    ),
    glass: typeof raw.glass === 'boolean' ? raw.glass : base.glass,
    blur:
      typeof raw.blur === 'number' && Number.isFinite(raw.blur)
        ? Math.max(0, Math.min(30, raw.blur))
        : base.blur,
  }
}

function normalizeApps(parsedApps: unknown): AppSlot[] {
  const base = DEFAULT_CUSTOMIZATION.apps
  if (!Array.isArray(parsedApps)) return base
  return base.map((slot) => {
    const found = parsedApps.find(
      (a: AppSlot) => a && typeof a === 'object' && a.id === slot.id,
    ) as AppSlot | undefined
    const label =
      found && typeof found.label === 'string' ? found.label : slot.label
    let iconImageUrl =
      found && typeof found.iconImageUrl === 'string'
        ? found.iconImageUrl
        : slot.iconImageUrl
    // 防止历史超大 dataURL 造成渲染与存储问题
    if (iconImageUrl.length > 350_000) {
      iconImageUrl = ''
    } else {
      iconImageUrl = migrateLegacyRootPublicUrl(iconImageUrl)
    }
    const iconRadius =
      found && typeof found.iconRadius === 'number' && Number.isFinite(found.iconRadius)
        ? found.iconRadius
        : slot.iconRadius
    const safeRadius = Math.max(0, Math.min(28, Math.round(iconRadius)))
    return { id: slot.id, label, iconImageUrl, iconRadius: safeRadius }
  })
}

function normalizeDesktopLayout(parsedLayout: unknown, apps: AppSlot[]): Array<AppSlot['id'] | null> {
  const desktopIds = apps.slice(4).map((app) => app.id)
  const desktopSet = new Set(desktopIds)
  const fallback = Array.from({ length: DESKTOP_LAYOUT_SLOT_COUNT }, (_, index) => desktopIds[index] ?? null)
  if (!Array.isArray(parsedLayout)) return fallback

  const used = new Set<AppSlot['id']>()
  const next = Array.from({ length: DESKTOP_LAYOUT_SLOT_COUNT }, (_, index) => {
    const raw = parsedLayout[index]
    if (typeof raw !== 'string') return null
    const id = raw.trim() as AppSlot['id']
    if (!desktopSet.has(id) || used.has(id)) return null
    used.add(id)
    return id
  })

  for (const id of desktopIds) {
    if (used.has(id)) continue
    const emptyIndex = next.findIndex((slot) => slot === null)
    if (emptyIndex < 0) break
    next[emptyIndex] = id
    used.add(id)
  }

  return next
}

type Ctx = {
  state: CustomizationState
  setTheme: (patch: Partial<PhoneTheme>) => void
  setProfile: (patch: Partial<Profile>) => void
  setMusic: (patch: Partial<MusicInfo>) => void
  setUi: (patch: Partial<UiPreferences>) => void
  reorderApps: (orderedIds: AppSlot['id'][]) => void
  setDesktopLayout: (layout: Array<AppSlot['id'] | null>) => void
  setAppLabel: (id: AppSlot['id'], label: string) => void
  setAppIconImageUrl: (id: AppSlot['id'], iconImageUrl: string) => void
  setAppIconRadius: (id: AppSlot['id'], iconRadius: number) => void
  setAllAppIconRadius: (iconRadius: number) => void
  setAppPageStyle: (id: AppSlot['id'], patch: Partial<AppPageStyle>) => void
  setDockStyle: (patch: Partial<DockStyle>) => void
  setWeChatTheme: (patch: Partial<WeChatTheme>) => void
  setCustomCss: (css: string) => void
  setGestureEffects: (patch: Partial<GestureEffectsSettings>) => void
  /** 先移除指定 characterId 的旧条目，再追加（用于某主角及其 NPC 整批同步通讯录） */
  replaceWeChatPersonaContacts: (removeCharacterIds: string[], add: WeChatPersonaContact[]) => void
  removeWeChatPersonaContactsByCharacterIds: (characterIds: string[]) => void
  /** 深度注销微信账号：清空通讯录缓存（不重置手机主题等） */
  clearWeChatPersonaContacts: () => void
  /** 切换微信账号：整表替换通讯录快照 */
  setWeChatPersonaContacts: (contacts: WeChatPersonaContact[]) => void
  resetDefaults: () => void
  themeStyle: React.CSSProperties
  wechatThemeStyle: React.CSSProperties
}

const CustomizationContext = createContext<Ctx | null>(null)

function themeToStyle(theme: PhoneTheme): React.CSSProperties {
  return {
    '--phone-bg': theme.background,
    '--phone-surface': theme.surface,
    '--phone-surface-muted': theme.surfaceMuted,
    '--phone-text': theme.text,
    '--phone-text-muted': theme.textMuted,
    '--phone-app-label': theme.appLabelColor,
    '--phone-accent': theme.accent,
    '--phone-border': theme.border,
    '--phone-shadow': theme.shadow,
    '--phone-radius-lg': theme.radiusLg,
    '--phone-radius-md': theme.radiusMd,
    '--phone-radius-sm': theme.radiusSm,
    '--phone-font': theme.fontFamily,
  } as React.CSSProperties
}

function wechatThemeToStyle(theme: WeChatTheme, globalFontFamily: string): React.CSSProperties {
  const resolvedFont = theme.fontFamily?.trim() ? theme.fontFamily : globalFontFamily
  const resolvedNumFont = theme.numberFontFamily?.trim()
    ? theme.numberFontFamily
    : '"Inter", system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
  return {
    '--wx-primary': theme.primary,
    '--wx-bg': theme.background,
    '--wx-surface': theme.surface,
    '--wx-text': theme.text,
    '--wx-text-muted': theme.textMuted,
    '--wx-border': theme.border,
    '--wx-shadow': theme.shadow,
    '--wx-font': resolvedFont,
    '--wx-num-font': resolvedNumFont,
    '--wx-font-size': `${theme.fontSizeBasePx}px`,
    '--wx-radius': `${theme.radiusPx}px`,

    '--wx-tabbar-bg': theme.tabBarBg,
    '--wx-tabbar-active': theme.tabBarActive,
    '--wx-tabbar-inactive': theme.tabBarInactive,

    '--wx-input-bg': theme.chatInputBg,
    '--wx-input-border': theme.chatInputBorder,
    '--wx-self-bubble-bg': theme.bubbleGlobal.selfBubbleBg,
    '--wx-self-bubble-text': theme.selfBubbleText,
    '--wx-self-bubble-radius': `${theme.bubbleGlobal.selfBubbleRadiusPx}px`,
    '--wx-other-bubble-bg': theme.bubbleGlobal.otherBubbleBg,
    '--wx-other-bubble-text': theme.otherBubbleText,
    '--wx-other-bubble-radius': `${theme.bubbleGlobal.otherBubbleRadiusPx}px`,
    '--wx-avatar-radius': `${theme.bubbleGlobal.avatarRadiusPx}px`,
    '--wx-timestamp-text': theme.timestampText,
  } as React.CSSProperties
}

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomizationState>(DEFAULT_CUSTOMIZATION)
  const [customizationHydrated, setCustomizationHydrated] = useState(false)
  const [isStandaloneRuntime, setIsStandaloneRuntime] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [
          STORAGE_KEY,
          LEGACY_STORAGE_KEY_V2,
          LEGACY_STORAGE_KEY,
        ])
        if (cancelled) return
        if (raw != null && typeof raw === 'object') {
          flushSync(() => {
            setState(normalizeState(raw as Partial<CustomizationState>))
          })
        }
      } catch (err) {
        if (!cancelled) console.warn('Load customization failed:', err)
      } finally {
        // 在 flushSync 之后再允许持久化，避免「已水合 + 仍是初始 state」时用默认值覆盖 IndexedDB
        if (!cancelled) setCustomizationHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!customizationHydrated) return
    void (async () => {
      try {
        await personaDb.setPhoneKv(STORAGE_KEY, state)
      } catch (err) {
        console.warn('外观设置写入 IndexedDB 失败:', err)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        // 壁纸/音乐等可能很大，超出 localStorage 配额时仅依赖 IndexedDB
      }
    })()
  }, [state, customizationHydrated])

  /**
   * 移动端（安卓/手机浏览器）默认应使用全屏无外壳，避免桌面预览壳在窄屏下产生“被截断”观感。
   * 仅做一次性迁移，不反复覆盖用户后续手动设置。
   */
  useEffect(() => {
    if (!customizationHydrated) return
    const migrateKey = 'lumi-mobile-layout-migrated-v1'
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(migrateKey) === '1') return
    const ua = window.navigator.userAgent.toLowerCase()
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const narrow = window.matchMedia?.('(max-width: 900px)').matches ?? false
    const isMobileUa =
      /android|iphone|ipad|ipod|harmonyos|mobile/.test(ua)
    if (!(isMobileUa || (coarse && narrow))) return
    setState((prev) => {
      if (prev.ui.fullScreen && !prev.ui.showDeviceFrame) return prev
      return {
        ...prev,
        ui: {
          ...prev.ui,
          fullScreen: true,
          showDeviceFrame: false,
        },
      }
    })
    try {
      window.localStorage.setItem(migrateKey, '1')
    } catch {
      // ignore
    }
  }, [customizationHydrated])

  useEffect(() => {
    document.documentElement.style.setProperty('--phone-bg', state.theme.background)
    document.documentElement.style.setProperty('--phone-font', state.theme.fontFamily)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', state.theme.background)
  }, [state.theme.background, state.theme.fontFamily])

  useEffect(() => {
    const id = 'lumi-user-custom-css'
    let styleEl = document.getElementById(id) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = id
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = state.customCss || ''
  }, [state.customCss])

  useEffect(() => {
    const id = 'lumi-gesture-effects-user-css'
    let styleEl = document.getElementById(id) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = id
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = state.gestureEffects.customCss || ''
  }, [state.gestureEffects.customCss])

  /**
   * 锁定文档层滚动，仅允许应用内可滚动区域滑动。
   * - 全屏：防止整页上下拖动
   * - 非全屏：防止“预览壳”整体跟随页面滚动（你期望固定容器，只缩放手机内容）
   */
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-phone-layout', state.ui.fullScreen ? 'fullscreen' : 'locked')
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      !!((navigator as Navigator & { standalone?: boolean }).standalone)
    setIsStandaloneRuntime(isStandalone)
    root.setAttribute('data-phone-runtime', isStandalone ? 'pwa' : 'browser')
    return () => {
      root.removeAttribute('data-phone-layout')
      root.removeAttribute('data-phone-runtime')
    }
  }, [state.ui.fullScreen])

  /**
   * 键盘弹出时不挤压页面：输入聚焦期间锁定高度；失焦/回到前台时重算并恢复。
   * 解决「切后台回来后底部残留内边距」问题。
   */
  useEffect(() => {
    let lockedVh = 0
    let keyboardOpen = false

    const isEditable = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      if (node instanceof HTMLTextAreaElement) return true
      if (node instanceof HTMLInputElement) {
        const t = node.type
        return !['button', 'checkbox', 'color', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(t)
      }
      return node.isContentEditable
    }

    const readVh = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight
      return Math.round(vh)
    }

    const applyVh = (vh: number) => {
      document.documentElement.style.setProperty('--app-vh', `${vh}px`)
    }

    const refresh = () => {
      const vh = readVh()
      if (!keyboardOpen) {
        lockedVh = vh
        applyVh(vh)
      } else if (lockedVh > 0) {
        applyVh(lockedVh)
      } else {
        lockedVh = vh
        applyVh(vh)
      }
    }

    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        keyboardOpen = true
        if (!lockedVh) lockedVh = readVh()
        applyVh(lockedVh)
      }
    }

    const onFocusOut = () => {
      keyboardOpen = false
      setTimeout(refresh, 180)
    }

    const onPageShow = () => {
      keyboardOpen = isEditable(document.activeElement)
      if (!keyboardOpen) lockedVh = 0
      setTimeout(refresh, 0)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onPageShow()
    }
    const forceTop = () => {
      // 软键盘弹出时浏览器会平移 visualViewport，此时禁止把 window 拉回顶部，否则会盖住正在输入的区域
      if (keyboardOpen) return
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    refresh()
    forceTop()
    window.addEventListener('resize', refresh)
    window.visualViewport?.addEventListener('resize', refresh)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('pageshow', forceTop)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    window.visualViewport?.addEventListener('scroll', forceTop)

    return () => {
      window.removeEventListener('resize', refresh)
      window.visualViewport?.removeEventListener('resize', refresh)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('pageshow', forceTop)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      window.visualViewport?.removeEventListener('scroll', forceTop)
    }
  }, [])

  const setTheme = useCallback((patch: Partial<PhoneTheme>) => {
    setState((s) => ({ ...s, theme: { ...s.theme, ...patch } }))
  }, [])

  const setProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }))
  }, [])

  const setMusic = useCallback((patch: Partial<MusicInfo>) => {
    setState((s) => ({ ...s, music: { ...s.music, ...patch } }))
  }, [])

  const setAppLabel = useCallback((id: AppSlot['id'], label: string) => {
    setState((s) => ({
      ...s,
      apps: s.apps.map((a) => (a.id === id ? { ...a, label } : a)),
    }))
  }, [])

  const setAppIconImageUrl = useCallback(
    (id: AppSlot['id'], iconImageUrl: string) => {
      setState((s) => ({
        ...s,
        apps: s.apps.map((a) => (a.id === id ? { ...a, iconImageUrl } : a)),
      }))
    },
    [],
  )

  const setAppIconRadius = useCallback((id: AppSlot['id'], iconRadius: number) => {
    setState((s) => ({
      ...s,
      apps: s.apps.map((a) => (a.id === id ? { ...a, iconRadius } : a)),
    }))
  }, [])

  const setAllAppIconRadius = useCallback((iconRadius: number) => {
    setState((s) => ({
      ...s,
      apps: s.apps.map((a) => ({ ...a, iconRadius })),
    }))
  }, [])

  const setUi = useCallback((patch: Partial<UiPreferences>) => {
    setState((s) => ({ ...s, ui: { ...s.ui, ...patch } }))
  }, [])

  const reorderApps = useCallback((orderedIds: AppSlot['id'][]) => {
    const incoming = orderedIds.map((id) => String(id || '').trim()).filter(Boolean) as AppSlot['id'][]
    setState((s) => {
      const byId = new Map(s.apps.map((app) => [app.id, app] as const))
      const next: AppSlot[] = []
      for (const id of incoming) {
        const app = byId.get(id)
        if (!app) continue
        next.push(app)
        byId.delete(id)
      }
      for (const app of s.apps) {
        if (byId.has(app.id)) next.push(app)
      }
      return next.length === s.apps.length ? { ...s, apps: next } : s
    })
  }, [])

  const setDesktopLayout = useCallback((layout: Array<AppSlot['id'] | null>) => {
    setState((s) => ({
      ...s,
      desktopLayout: normalizeDesktopLayout(layout, s.apps),
    }))
  }, [])

  const setAppPageStyle = useCallback((id: AppSlot['id'], patch: Partial<AppPageStyle>) => {
    setState((s) => ({
      ...s,
      appPageStyles: {
        ...s.appPageStyles,
        [id]: { ...s.appPageStyles[id], ...patch },
      },
    }))
  }, [])

  const setDockStyle = useCallback((patch: Partial<DockStyle>) => {
    setState((s) => ({ ...s, dockStyle: { ...s.dockStyle, ...patch } }))
  }, [])

  const setWeChatTheme = useCallback((patch: Partial<WeChatTheme>) => {
    setState((s) => {
      const prev = s.wechatTheme
      if (!patch.bubbleGlobal) {
        return { ...s, wechatTheme: { ...prev, ...patch } }
      }
      const prevGlobal = prev.bubbleGlobal
      const mergedGlobal = { ...prevGlobal, ...patch.bubbleGlobal }
      const bubbleByRole = syncBubbleByRoleWithNewGlobal(
        prevGlobal,
        mergedGlobal,
        patch.bubbleByRole ?? prev.bubbleByRole,
      )
      return {
        ...s,
        wechatTheme: {
          ...prev,
          ...patch,
          bubbleGlobal: mergedGlobal,
          bubbleByRole,
        },
      }
    })
  }, [])

  const setCustomCss = useCallback((css: string) => {
    setState((s) => ({ ...s, customCss: css }))
  }, [])

  const setGestureEffects = useCallback((patch: Partial<GestureEffectsSettings>) => {
    setState((s) => ({ ...s, gestureEffects: { ...s.gestureEffects, ...patch } }))
  }, [])

  const replaceWeChatPersonaContacts = useCallback(
    (removeCharacterIds: string[], add: WeChatPersonaContact[]) => {
      const rm = new Set(removeCharacterIds)
      setState((s) => ({
        ...s,
        wechatPersonaContacts: [...s.wechatPersonaContacts.filter((c) => !rm.has(c.characterId)), ...add],
      }))
    },
    [],
  )

  const removeWeChatPersonaContactsByCharacterIds = useCallback((characterIds: string[]) => {
    const rm = new Set(characterIds)
    setState((s) => ({
      ...s,
      wechatPersonaContacts: s.wechatPersonaContacts.filter((c) => !rm.has(c.characterId)),
    }))
  }, [])

  const clearWeChatPersonaContacts = useCallback(() => {
    setState((s) => ({ ...s, wechatPersonaContacts: [] }))
  }, [])

  const setWeChatPersonaContacts = useCallback((contacts: WeChatPersonaContact[]) => {
    setState((s) => ({ ...s, wechatPersonaContacts: contacts.map((c) => ({ ...c })) }))
  }, [])

  const resetDefaults = useCallback(() => {
    setState(DEFAULT_CUSTOMIZATION)
    void personaDb.deletePhoneKv(STORAGE_KEY)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY_V2)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  }, [])

  const themeStyle = useMemo(() => themeToStyle(state.theme), [state.theme])
  const wechatThemeStyle = useMemo(
    () => wechatThemeToStyle(state.wechatTheme, state.theme.fontFamily),
    [state.wechatTheme, state.theme.fontFamily],
  )

  const value = useMemo(
    () => ({
      state,
      setTheme,
      setProfile,
      setMusic,
      setUi,
      reorderApps,
      setDesktopLayout,
      setAppLabel,
      setAppIconImageUrl,
      setAppIconRadius,
      setAllAppIconRadius,
      setAppPageStyle,
      setDockStyle,
      setWeChatTheme,
      setCustomCss,
      setGestureEffects,
      replaceWeChatPersonaContacts,
      removeWeChatPersonaContactsByCharacterIds,
      clearWeChatPersonaContacts,
      setWeChatPersonaContacts,
      resetDefaults,
      themeStyle,
      wechatThemeStyle,
    }),
    [
      state,
      setTheme,
      setProfile,
      setMusic,
      setUi,
      reorderApps,
      setDesktopLayout,
      setAppLabel,
      setAppIconImageUrl,
      setAppIconRadius,
      setAllAppIconRadius,
      setAppPageStyle,
      setDockStyle,
      setWeChatTheme,
      setCustomCss,
      setGestureEffects,
      replaceWeChatPersonaContacts,
      removeWeChatPersonaContactsByCharacterIds,
      clearWeChatPersonaContacts,
      setWeChatPersonaContacts,
      resetDefaults,
      themeStyle,
      wechatThemeStyle,
    ],
  )

  const rootShellClass =
    state.ui.fullScreen
      ? 'fixed inset-0 z-0 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-[var(--phone-bg)]'
      : 'flex min-h-[100dvh] min-w-0 flex-1 flex-col bg-[var(--phone-bg)]'

  return (
    <CustomizationContext.Provider value={value}>
      <div
        className={rootShellClass}
        style={{
          ...themeStyle,
          fontFamily: 'var(--phone-font)',
          backgroundColor: 'var(--phone-bg)',
          minHeight:
            state.ui.fullScreen && isStandaloneRuntime
              ? '100vh'
              : state.ui.fullScreen
                ? 'var(--app-vh, 100dvh)'
                : 'var(--app-vh, 100dvh)',
          height:
            state.ui.fullScreen && isStandaloneRuntime
              ? '100vh'
              : state.ui.fullScreen
                ? 'var(--app-vh, 100dvh)'
                : 'var(--app-vh, 100dvh)',
        }}
      >
        {children}
      </div>
    </CustomizationContext.Provider>
  )
}

export function useCustomization() {
  const ctx = useContext(CustomizationContext)
  if (!ctx) throw new Error('useCustomization must be used within provider')
  return ctx
}
