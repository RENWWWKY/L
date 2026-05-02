import { publicAssetUrl } from '../publicAssetUrl'

export type PhoneTheme = {
  background: string
  /** 桌面壁纸（URL 或 dataURL） */
  wallpaperUrl: string
  /** 壁纸显示方式 */
  wallpaperFit: 'cover' | 'contain'
  surface: string
  surfaceMuted: string
  text: string
  textMuted: string
  /** 桌面图标名称颜色（仅图标下方文字） */
  appLabelColor: string
  accent: string
  border: string
  shadow: string
  radiusLg: string
  radiusMd: string
  radiusSm: string
  /** 全局字体栈（会映射到 CSS 变量 --phone-font） */
  fontFamily: string
}

export type Profile = {
  displayName: string
  signature: string
  /** 头像可用 emoji / 单字；若填写 imageUrl 则优先显示图片 */
  avatarEmoji: string
  avatarImageUrl: string
}

/** 音乐播放器循环 / 推荐模式（持久化到本地） */
export type MusicPlayMode = 'shuffle' | 'list-loop' | 'single-loop' | 'heartbeat'

export type MusicInfo = {
  trackTitle: string
  artistName: string
  /** 封面占位主色 */
  coverTint: string
  /** 当前播放封面（搜索或我的音乐） */
  currentArtworkUrl: string
  /** 上次正在播放的曲目 id（刷新后用于恢复 audio 与播放键） */
  playingTrackId: string
  /** 与 playingTrackId 对应的音频地址（曲库内曲目以曲库中最新 audioUrl 为准） */
  playingAudioUrl: string
  /** 与 playingTrackId 对应的来源 */
  playingSource: 'search' | 'library'
  /** 播放模式：随机 / 列表循环 / 单曲循环 / 心动 */
  playMode: MusicPlayMode
  /** 我的音乐（喜欢收藏 + 自定义导入） */
  library: Array<{
    id: string
    title: string
    artist: string
    audioUrl: string
    artworkUrl: string
    liked: boolean
    source: 'search' | 'custom'
  }>
}

export type AppPageStyle = {
  headerBg: string
  headerBgImageUrl: string
  headerText: string
  pageBg: string
  pageBgImageUrl: string
  cardBg: string
  cardBgImageUrl: string
  fontFamily: string
}

/** Dock 胶囊底色：主题默认 / 纯色 / 渐变 / 图片 */
export type DockFillMode = 'theme' | 'solid' | 'gradient' | 'image'

export type DockStyle = {
  fillMode: DockFillMode
  /** fillMode === 'solid' */
  dockSolidColor: string
  /** fillMode === 'gradient' */
  gradientFrom: string
  gradientTo: string
  /** 起点色在渐变轴上的位置（0–100，单位 %） */
  gradientFromStop: number
  /** 终点色在渐变轴上的位置（0–100，单位 %） */
  gradientToStop: number
  /**
   * 过渡自然度（0–100）。50 为均衡；偏低时终点色占比更大，偏高时起点色占比更大（常见色标 0%→100% 时）。
   * 实现为 CSS 线性渐变的插值中点（color hint）。
   */
  gradientNaturalness: number
  /** 渐变角度（deg） */
  gradientAngle: number
  bgImageUrl: string
  glass: boolean
  blur: number
}

export type AppSlot = {
  id: 'wechat' | 'takeout' | 'weibo' | 'api' | 'voiceprint' | 'dataArchive' | 'appearance'
  label: string
  /** 可选：自定义图标图片 URL（优先于线框 SVG） */
  iconImageUrl: string
  /** 图标底的圆角（px），影响桌面与 Dock */
  iconRadius: number
}

export type WeChatTimestampStyle = 'hidden' | 'subtle' | 'detailed'

export type WeChatTabId = 'messages' | 'contacts' | 'dates' | 'discover' | 'profile'

export type WxFillMode = 'solid' | 'gradient' | 'image'

export type WxFillStyle = {
  mode: WxFillMode
  /** solid */
  solidColor: string
  /** gradient */
  gradientFrom: string
  gradientTo: string
  gradientAngle: number
  /** 过渡自然度（0–100，50 为均衡；越接近 0 越偏向终点色，越接近 100 越偏向起点色） */
  gradientNaturalness: number
  /** image */
  imageUrl: string
  /**
   * 背景层透明度（0–100）
   * - 只影响“背景层”（纯色/渐变/图片），不影响内容与文字
   */
  layerOpacity: number
  /**
   * 毛玻璃（玻璃层）
   * - glassOpacity：玻璃层自身不透明度（0–100）
   * - blurPx：模糊强度（px）
   */
  glassEnabled: boolean
  glassOpacity: number
  blurPx: number
}

export type WeChatBubbleTheme = {
  /** 仅这两项先做：后续可扩展文字色/边框等 */
  selfBubbleBg: string
  otherBubbleBg: string
  selfBubbleRadiusPx: number
  otherBubbleRadiusPx: number
  showAvatar: boolean
  avatarRadiusPx: number
  /** 在头像一侧显示指向三角，三角竖直方向与头像水平中线对齐（需开启头像） */
  showBubbleTail: boolean
  /**
   * 连续同侧消息仅首条显示头像列（与常见 IM 一致）；关闭则每条都占头像位。
   * 需 `showAvatar` 为 true 时才有视觉效果。
   */
  mergeConsecutiveAvatarGroup: boolean
}

export function wechatBubbleThemesEqual(a: WeChatBubbleTheme, b: WeChatBubbleTheme): boolean {
  return (
    a.selfBubbleBg === b.selfBubbleBg &&
    a.otherBubbleBg === b.otherBubbleBg &&
    a.selfBubbleRadiusPx === b.selfBubbleRadiusPx &&
    a.otherBubbleRadiusPx === b.otherBubbleRadiusPx &&
    a.showAvatar === b.showAvatar &&
    a.avatarRadiusPx === b.avatarRadiusPx &&
    a.showBubbleTail === b.showBubbleTail &&
    a.mergeConsecutiveAvatarGroup === b.mergeConsecutiveAvatarGroup
  )
}

export type WeChatTabBarItem = {
  id: WeChatTabId
  label: string
  en: string
  /**
   * 自定义图标（URL 或 dataURL）。为空则使用内置线性图标
   * - 推荐裁剪为 1:1
   */
  iconUrl: string
  /** 单按钮字样颜色覆盖（空字符串代表使用全局设置） */
  labelActiveColor: string
  labelInactiveColor: string
}

/**
 * 微信应用主题（核心：全部映射为 --wx-* CSS 变量）
 * - 仅影响 wechat 应用内部，不影响桌面/其它应用
 */
export type WeChatTheme = {
  /** 全局（wechat app 内） */
  primary: string
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
  shadow: string
  /**
   * 微信字体覆盖（空字符串代表“跟随全局字体”）
   * - 最终会映射到 CSS 变量 --wx-font
   */
  fontFamily: string
  /**
   * 数字/时间字体覆盖（空字符串代表“跟随微信字体/全局字体”）
   * - 最终会映射到 CSS 变量 --wx-num-font
   */
  numberFontFamily: string
  fontSizeBasePx: number
  radiusPx: number

  /** 导航栏（Tab Bar） */
  tabBarBg: string
  /** 导航栏整体背景（支持纯色/渐变/图片） */
  tabBarStyle: WxFillStyle
  tabBarActive: string
  tabBarInactive: string
  /** 导航栏字样颜色（全局，优先级低于单按钮覆盖） */
  tabBarLabelActive: string
  tabBarLabelInactive: string
  /** 导航栏按钮（可排序 + 可自定义图标） */
  tabBarItems: WeChatTabBarItem[]

  /** 聊天页 */
  chatInputBg: string
  chatInputBorder: string
  /** 聊天气泡：全局 + 按角色覆盖（角色先做示例，后续可扩展真实会话） */
  bubbleGlobal: WeChatBubbleTheme
  bubbleByRole: Record<string, WeChatBubbleTheme>
  selfBubbleText: string
  otherBubbleText: string
  timestampStyle: WeChatTimestampStyle
  timestampText: string

  /** 非聊天页背景（全局 + 单页覆盖；单页优先） */
  pageBgGlobal: WxFillStyle
  pageBgByTab: Partial<Record<WeChatTabId, WxFillStyle>>

  /** 标题栏（各页面独立） */
  headerByTab: Partial<Record<WeChatTabId, WxFillStyle>>

  /** 会话卡片样式（信息页列表项背景） */
  conversationCard: WxFillStyle
}

/** 布局与系统 UI（持久化到 IndexedDB `phoneKv`，玩家可切换） */
export type UiPreferences = {
  /** 应用内顶部状态栏（时间、信号、电量），与系统状态栏无关 */
  showStatusBar: boolean
  /** 全屏：内容占满视口；关闭则为居中「小窗」预览 */
  fullScreen: boolean
  /** 显示圆角手机外壳与投影；关闭为无框贴边布局 */
  showDeviceFrame: boolean
  /** 关闭页面切换动画（PPT 式切换，减少 iOS Safari 闪屏概率） */
  disablePageTransitions: boolean
  /** 强制罗盘使用静态样式（关闭动画与高开销特效） */
  forceStaticCompass: boolean
  /** 键盘抬升调试面板（桌面与聊天页） */
  keyboardDebugEnabled: boolean
  /** 仅保留兼容字段，不再用于抬升逻辑 */
  keyboardDebugSimulateOpen: boolean
  /** 聊天输入栏抬升补偿（px，允许负值微调贴边） */
  keyboardDebugInsetPx: number
}

/** 由「人设生成联系人」写入，展示在微信通讯录（与内置示例联系人合并） */
export type WeChatPersonaContact = {
  /** 稳定键，一般为 persona-${characterId} */
  id: string
  characterId: string
  /** 通讯录展示名：优先微信昵称 */
  remarkName: string
  avatarUrl?: string
  isStarred?: boolean
}

/** 全局点击爆炸 / 滑动拖尾（`GlobalGestureEffects`） */
export type GestureEffectsSettings = {
  clickEnabled: boolean
  trailEnabled: boolean
  /** 点击粒子三色（深 / 中 / 浅灰） */
  burstColorDark: string
  burstColorMid: string
  burstColorLight: string
  trailColor: string
  /** 附加 CSS，作用于 `[data-global-gesture-effects]` 内 */
  customCss: string
}

export const DEFAULT_GESTURE_EFFECTS: GestureEffectsSettings = {
  clickEnabled: true,
  trailEnabled: true,
  burstColorDark: '#333333',
  burstColorMid: '#666666',
  burstColorLight: '#999999',
  trailColor: '#666666',
  customCss: '',
}

export function normalizeGestureEffects(raw: unknown): GestureEffectsSettings {
  const d = DEFAULT_GESTURE_EFFECTS
  if (!raw || typeof raw !== 'object') return { ...d }
  const o = raw as Record<string, unknown>
  const pickHex = (v: unknown, fallback: string) => {
    if (typeof v !== 'string') return fallback
    const s = v.trim()
    if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s
    if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
      const r = s[1]
      const g = s[2]
      const b = s[3]
      return `#${r}${r}${g}${g}${b}${b}`
    }
    return fallback
  }
  return {
    clickEnabled: typeof o.clickEnabled === 'boolean' ? o.clickEnabled : d.clickEnabled,
    trailEnabled: typeof o.trailEnabled === 'boolean' ? o.trailEnabled : d.trailEnabled,
    burstColorDark: pickHex(o.burstColorDark, d.burstColorDark),
    burstColorMid: pickHex(o.burstColorMid, d.burstColorMid),
    burstColorLight: pickHex(o.burstColorLight, d.burstColorLight),
    trailColor: pickHex(o.trailColor, d.trailColor),
    customCss: typeof o.customCss === 'string' ? o.customCss : d.customCss,
  }
}

export type CustomizationState = {
  theme: PhoneTheme
  profile: Profile
  music: MusicInfo
  apps: AppSlot[]
  desktopLayout: Array<AppSlot['id'] | null>
  ui: UiPreferences
  appPageStyles: Record<AppSlot['id'], AppPageStyle>
  dockStyle: DockStyle
  wechatTheme: WeChatTheme
  /** 人设同步到通讯录的条目 */
  wechatPersonaContacts: WeChatPersonaContact[]
  customCss: string
  gestureEffects: GestureEffectsSettings
}

export const DEFAULT_WALLPAPER_URL = publicAssetUrl('/image/手机壁纸1.png')
export const DESKTOP_LAYOUT_SLOT_COUNT = 6

/** 微信「信息」列表与聊天会话页默认背景图（放在 `public/image/`，经 {@link publicAssetUrl} 带 base） */
export const DEFAULT_WECHAT_CHAT_WALLPAPER_URL = publicAssetUrl('/image/聊天壁纸默认1.jpg')

/** 个人名片默认头像 URL（与 {@link DEFAULT_CUSTOMIZATION} 中 profile 一致，供查手机等模块复用） */
export const DEFAULT_PUBLIC_AVATAR_URL = publicAssetUrl('/image/个人名片默认头像1.png')

/** 个人名片页上半身背景图 */
export const DEFAULT_PERSONAL_CARD_BG_URL = publicAssetUrl('/image/个人名片背景图1.png')

/** 微信各 Tab 未单独覆盖时使用的默认页背景（与聊天壁纸一致） */
export const DEFAULT_WECHAT_TAB_PAGE_BG: WxFillStyle = {
  mode: 'image',
  solidColor: '#F5F6F8',
  gradientFrom: '#F5F6F8',
  gradientTo: '#FFFFFF',
  gradientAngle: 180,
  gradientNaturalness: 50,
  imageUrl: DEFAULT_WECHAT_CHAT_WALLPAPER_URL,
  layerOpacity: 100,
  glassEnabled: false,
  glassOpacity: 0,
  blurPx: 0,
}

export const DEFAULT_APP_PAGE_STYLE: AppPageStyle = {
  headerBg: '#ffffff',
  headerBgImageUrl: '',
  headerText: '#1c1c1e',
  pageBg: '#f2f2f4',
  pageBgImageUrl: '',
  cardBg: '#ffffff',
  cardBgImageUrl: '',
  fontFamily:
    '"Cormorant Garamond", "Noto Serif SC", "STKaiti", "KaiTi", "Times New Roman", serif',
}

export const DEFAULT_CUSTOMIZATION: CustomizationState = {
  theme: {
    background: '#f2f2f4',
    wallpaperUrl: DEFAULT_WALLPAPER_URL,
    wallpaperFit: 'cover',
    surface: '#ffffff',
    surfaceMuted: '#fafafa',
    text: '#1c1c1e',
    textMuted: '#8e8e93',
    appLabelColor: '#1c1c1e',
    accent: '#d4380d',
    border: 'rgba(0, 0, 0, 0.06)',
    shadow: '0 10px 40px rgba(0, 0, 0, 0.06)',
    radiusLg: '28px',
    radiusMd: '18px',
    radiusSm: '14px',
    // 默认：艺术衬线
    fontFamily:
      '"Cormorant Garamond", "Noto Serif SC", "STKaiti", "KaiTi", "Times New Roman", serif',
  },
  profile: {
    displayName: '未命名',
    signature: '心臟跳動的頻率是多少...₊⁺☆ *',
    avatarEmoji: '✦',
    avatarImageUrl: DEFAULT_PUBLIC_AVATAR_URL,
  },
  music: {
    trackTitle: '静候播放',
    artistName: '本地音乐',
    coverTint: '#dfe3ea',
    currentArtworkUrl: '',
    playingTrackId: '',
    playingAudioUrl: '',
    playingSource: 'library',
    playMode: 'list-loop',
    library: [],
  },
  apps: [
    { id: 'wechat', label: '微信', iconImageUrl: '', iconRadius: 18 },
    { id: 'takeout', label: '外卖', iconImageUrl: '', iconRadius: 18 },
    { id: 'weibo', label: '微博', iconImageUrl: '', iconRadius: 18 },
    { id: 'api', label: 'API设置', iconImageUrl: '', iconRadius: 18 },
    { id: 'voiceprint', label: '声纹档案', iconImageUrl: '', iconRadius: 18 },
    { id: 'dataArchive', label: '数据中心', iconImageUrl: '', iconRadius: 18 },
    { id: 'appearance', label: '外观', iconImageUrl: '', iconRadius: 18 },
  ],
  desktopLayout: ['voiceprint', 'dataArchive', 'appearance', null, null, null],
  ui: {
    showStatusBar: true,
    fullScreen: false,
    showDeviceFrame: true,
    disablePageTransitions: false,
    forceStaticCompass: false,
    keyboardDebugEnabled: false,
    keyboardDebugSimulateOpen: false,
    keyboardDebugInsetPx: 0,
  },
  appPageStyles: {
    wechat: {
      ...DEFAULT_APP_PAGE_STYLE,
      pageBg: '#F5F6F8',
      pageBgImageUrl: DEFAULT_WECHAT_CHAT_WALLPAPER_URL,
    },
    takeout: { ...DEFAULT_APP_PAGE_STYLE },
    weibo: { ...DEFAULT_APP_PAGE_STYLE },
    api: { ...DEFAULT_APP_PAGE_STYLE },
    voiceprint: { ...DEFAULT_APP_PAGE_STYLE, pageBg: '#ffffff' },
    dataArchive: { ...DEFAULT_APP_PAGE_STYLE, pageBg: '#f3efea' },
    /** 「外观与文案」页本身底图：与微信默认聊天壁纸一致，避免与微信 Tab 纯色底冲突观感 */
    appearance: {
      ...DEFAULT_APP_PAGE_STYLE,
      pageBg: '#F5F6F8',
      pageBgImageUrl: DEFAULT_WECHAT_CHAT_WALLPAPER_URL,
    },
  },
  dockStyle: {
    fillMode: 'theme',
    dockSolidColor: '#ffffff',
    gradientFrom: '#f8f6ff',
    gradientTo: '#e8e4f0',
    gradientFromStop: 0,
    gradientToStop: 100,
    gradientNaturalness: 50,
    gradientAngle: 135,
    bgImageUrl: '',
    glass: true,
    blur: 12,
  },
  wechatTheme: {
    // 低饱和冷调：主色占比极低，仅用于强调/自身气泡
    primary: '#7B8AA6',
    background: '#F5F6F8',
    surface: '#FFFFFF',
    text: '#1B1B1F',
    textMuted: 'rgba(27, 27, 31, 0.55)',
    border: 'rgba(0, 0, 0, 0.06)',
    shadow: '0 10px 40px rgba(0, 0, 0, 0.06)',
    // 默认：跟随全局字体（用户未覆盖时，随 theme.fontFamily 动态变化）
    fontFamily: '',
    // 默认：跟随微信字体（也就是跟随全局）
    numberFontFamily: '',
    fontSizeBasePx: 15,
    radiusPx: 16,

    tabBarBg: '#FFFFFF',
    tabBarStyle: {
      mode: 'solid',
      solidColor: '#FFFFFF',
      gradientFrom: '#FFFFFF',
      gradientTo: '#F3F4F6',
      gradientAngle: 180,
      gradientNaturalness: 50,
      imageUrl: '',
      layerOpacity: 100,
      glassEnabled: false,
      glassOpacity: 18,
      blurPx: 18,
    },
    tabBarActive: '#1B1B1F',
    tabBarInactive: 'rgba(27, 27, 31, 0.45)',
    tabBarLabelActive: '#1B1B1F',
    tabBarLabelInactive: 'rgba(27, 27, 31, 0.45)',
    tabBarItems: [
      { id: 'messages', label: '信息', en: 'Messages', iconUrl: '', labelActiveColor: '', labelInactiveColor: '' },
      { id: 'contacts', label: '通讯录', en: 'Contacts', iconUrl: '', labelActiveColor: '', labelInactiveColor: '' },
      { id: 'dates', label: '约会', en: 'Dates', iconUrl: '', labelActiveColor: '', labelInactiveColor: '' },
      { id: 'discover', label: '发现', en: 'Discover', iconUrl: '', labelActiveColor: '', labelInactiveColor: '' },
      { id: 'profile', label: '我', en: 'Profile', iconUrl: '', labelActiveColor: '', labelInactiveColor: '' },
    ],

    chatInputBg: 'rgba(255, 255, 255, 0.92)',
    chatInputBorder: 'rgba(0, 0, 0, 0.06)',
    selfBubbleText: '#1B1B1F',
    otherBubbleText: '#1B1B1F',
    bubbleGlobal: {
      selfBubbleBg: 'rgba(123, 138, 166, 0.22)',
      /** 不透明实色，避免角色侧气泡叠在聊天底上发灰透底 */
      otherBubbleBg: '#EEEFF2',
      selfBubbleRadiusPx: 18,
      otherBubbleRadiusPx: 18,
      showAvatar: true,
      avatarRadiusPx: 10,
      showBubbleTail: false,
      mergeConsecutiveAvatarGroup: true,
    },
    /** 与 bubbleGlobal 相同的角色不要写死在此，否则聊天页会优先读快照导致改全局颜色不生效 */
    bubbleByRole: {},
    timestampStyle: 'subtle',
    timestampText: 'rgba(27, 27, 31, 0.38)',

    /** 全局页背景：各 Tab 无单页覆盖时均用此（通讯录 / 约会 / 发现 / 我等与信息一致） */
    pageBgGlobal: { ...DEFAULT_WECHAT_TAB_PAGE_BG },
    pageBgByTab: {},
    headerByTab: {},
    conversationCard: {
      mode: 'solid',
      solidColor: '#FFFFFF',
      gradientFrom: '#FFFFFF',
      gradientTo: '#F3F4F6',
      gradientAngle: 135,
      gradientNaturalness: 50,
      imageUrl: '',
      layerOpacity: 100,
      glassEnabled: false,
      glassOpacity: 0,
      blurPx: 0,
    },
  },
  wechatPersonaContacts: [],
  customCss: '',
  gestureEffects: { ...DEFAULT_GESTURE_EFFECTS },
}
