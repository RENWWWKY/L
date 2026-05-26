import { useMemo, useRef, useState } from 'react'
import { Pressable } from './Pressable'
import { SettingToggle } from './SettingToggle'
import { useCustomization } from '../CustomizationContext'
import { AppIconTile } from './AppIconTile'
import { ImageCropperModal } from './ImageCropperModal'
import { DockStyleSection } from './DockStyleSection'
import { migrateLegacyRootPublicUrl, resolvePublicImageUrl } from '../../publicAssetUrl'
import { DEFAULT_CUSTOMIZATION, DEFAULT_WALLPAPER_PATH, type AppSlot } from '../types'

type Props = {
  onBack: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.16em] opacity-75">
      {children}
    </label>
  )
}

type SectionKey =
  | 'nav'
  | 'layout'
  | 'theme'
  | 'font'
  | 'profile'
  | 'music'
  | 'pageStyles'
  | 'gestureEffects'
  | 'appIcons'

type StyleCropTarget =
  | { kind: 'headerBg'; appId: AppSlot['id'] }
  | { kind: 'pageBg'; appId: AppSlot['id'] }
  | { kind: 'cardBg'; appId: AppSlot['id'] }
  | { kind: 'dockBg' }

const FONT_PRESETS = [
  {
    id: 'otome-default',
    label: '乙女柔美',
    value:
      '"Cormorant Garamond", "ZCOOL XiaoWei", "Noto Serif SC", "LXGW WenKai", "PingFang SC", "STKaiti", "KaiTi", "Georgia", "Garamond", "Times New Roman", serif',
  },
  {
    id: 'lumi-story',
    label: 'Lumi',
    value:
      '"Noto Serif SC", "Noto Sans SC", "PingFang SC", "PingFang TC", "Hiragino Sans GB", "STSong", "STKaiti", "FangSong", "KaiTi", "Georgia", "Garamond", "Times New Roman", serif',
  },
  {
    id: 'art-serif',
    label: '艺术衬线（默认）',
    value:
      '"Cormorant Garamond", "Noto Serif SC", "STKaiti", "KaiTi", "Times New Roman", serif',
  },
  {
    id: 'clean-ui',
    label: '简洁',
    value:
      '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, "Segoe UI", sans-serif',
  },
] as const

function NavCard({
  title,
  desc,
  onClick,
}: {
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <Pressable
      onClick={onClick}
      className="w-full rounded-[18px] border px-4 py-4 text-left"
      style={{
        borderColor: 'var(--phone-border)',
        background: 'var(--phone-surface)',
        boxShadow: 'var(--phone-shadow)',
      }}
    >
      <p className="text-[14px] font-semibold" style={{ color: 'var(--phone-text)' }}>
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--phone-text-muted)' }}>
        {desc}
      </p>
    </Pressable>
  )
}

export function CustomizeScreen({ onBack }: Props) {
  const {
    state,
    setTheme,
    setPersonalCardProfile,
    setMusic,
    setUi,
    setAppLabel,
    setAppIconImageUrl,
    setAppIconRadius,
    setAllAppIconRadius,
    setAppPageStyle,
    setDockStyle,
    setCustomCss,
    setGestureEffects,
    resetDefaults,
  } = useCustomization()
  const {
    theme,
    personalCardProfile: profile,
    music,
    apps,
    ui,
    appPageStyles,
    dockStyle,
    customCss,
    gestureEffects,
  } = state
  const appearanceStyle = appPageStyles.appearance

  const [section, setSection] = useState<SectionKey>('nav')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null)
  const styleImageInputRef = useRef<HTMLInputElement | null>(null)
  const cssInputRef = useRef<HTMLInputElement | null>(null)
  const gestureCssInputRef = useRef<HTMLInputElement | null>(null)
  const [cropTarget, setCropTarget] = useState<AppSlot['id'] | null>(null)
  const [cropSrc, setCropSrc] = useState<string>('')
  const [wallpaperCropSrc, setWallpaperCropSrc] = useState<string>('')
  const [styleCropSrc, setStyleCropSrc] = useState<string>('')
  const [styleCropTarget, setStyleCropTarget] = useState<StyleCropTarget | null>(null)
  const [activeStyleApp, setActiveStyleApp] = useState<AppSlot['id']>('wechat')
  const [styleAppOpen, setStyleAppOpen] = useState(false)
  const [showLayoutResetToast, setShowLayoutResetToast] = useState(false)

  const title = useMemo(() => {
    switch (section) {
      case 'layout':
        return '布局与状态栏'
      case 'theme':
        return '主题色'
      case 'font':
        return '全局字体'
      case 'profile':
        return '桌面个人名片'
      case 'music':
        return '桌面组件'
      case 'pageStyles':
        return '页面样式'
      case 'gestureEffects':
        return '点击动效和拖尾'
      case 'appIcons':
        return '应用名称与图标'
      case 'nav':
      default:
        return '外观与文案'
    }
  }, [section])

  const globalRadius = useMemo(() => {
    const first = apps[0]?.iconRadius ?? 18
    const same = apps.every((a) => a.iconRadius === first)
    return same ? first : first
  }, [apps])

  function openUploadFor(appId: AppSlot['id']) {
    setCropTarget(appId)
    fileInputRef.current?.click()
  }

  async function onPickFile(file: File | null) {
    if (!file || !cropTarget) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  async function onPickWallpaper(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setWallpaperCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  async function onPickCssFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    setCustomCss(text)
  }

  async function onPickGestureCssFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    setGestureEffects({ customCss: text })
  }

  function openStyleImageUpload(target: StyleCropTarget) {
    setStyleCropTarget(target)
    styleImageInputRef.current?.click()
  }

  async function onPickStyleImage(file: File | null) {
    if (!file || !styleCropTarget) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setStyleCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        backgroundColor: appearanceStyle.pageBg || 'var(--phone-bg)',
        backgroundImage: appearanceStyle.pageBgImageUrl ? `url(${appearanceStyle.pageBgImageUrl})` : 'none',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2"
        style={{
          borderBottom: `1px solid ${theme.border}`,
          paddingTop: ui.fullScreen ? 'max(0px, env(safe-area-inset-top, 0px))' : 0,
          backgroundColor: appearanceStyle.headerBg || theme.surface,
          backgroundImage: appearanceStyle.headerBgImageUrl ? `url(${appearanceStyle.headerBgImageUrl})` : 'none',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      >
        <Pressable
          onClick={() => {
            if (section === 'nav') onBack()
            else setSection('nav')
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: theme.text }}
          aria-label="返回"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="text-[15px] font-semibold" style={{ color: theme.text }}>
          {title}
        </h1>
        <div className="w-9" />
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        style={{ color: theme.text }}
      >
        <ImageCropperModal
          open={section === 'theme' && !!wallpaperCropSrc}
          imageSrc={wallpaperCropSrc}
          title="裁剪桌面壁纸"
          aspect={9 / 19.5}
          maxSide={1440}
          objectFit="vertical-cover"
          onCancel={() => {
            setWallpaperCropSrc('')
          }}
          onConfirm={(dataUrl) => {
            setTheme({ wallpaperUrl: dataUrl })
            setWallpaperCropSrc('')
          }}
        />

        {/* 页面样式 / Dock 背景图：共用上传与裁剪弹窗（在多个分区复用） */}
        <input
          ref={styleImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            void onPickStyleImage(f)
            e.currentTarget.value = ''
          }}
        />
        <ImageCropperModal
          open={!!styleCropTarget && !!styleCropSrc}
          imageSrc={styleCropSrc}
          title="裁剪背景图"
          aspect={
            styleCropTarget?.kind === 'dockBg'
              ? 4
              : styleCropTarget?.kind === 'pageBg'
                ? 9 / 16
                : 9 / 19.5
          }
          maxSide={1440}
          objectFit="horizontal-cover"
          onCancel={() => {
            setStyleCropSrc('')
            setStyleCropTarget(null)
          }}
          onConfirm={(dataUrl) => {
            if (!styleCropTarget) return
            if (styleCropTarget.kind === 'dockBg') {
              setDockStyle({ fillMode: 'image', bgImageUrl: dataUrl })
            } else if (styleCropTarget.kind === 'headerBg') {
              setAppPageStyle(styleCropTarget.appId, { headerBgImageUrl: dataUrl })
            } else if (styleCropTarget.kind === 'pageBg') {
              setAppPageStyle(styleCropTarget.appId, { pageBgImageUrl: dataUrl })
            } else if (styleCropTarget.kind === 'cardBg') {
              setAppPageStyle(styleCropTarget.appId, { cardBgImageUrl: dataUrl })
            }
            setStyleCropSrc('')
            setStyleCropTarget(null)
          }}
        />

        {section === 'nav' ? (
          <div className="space-y-3">
            <NavCard title="布局与状态栏" desc="全屏、外壳、状态栏显示等" onClick={() => setSection('layout')} />
            <NavCard
              title="主题色"
              desc="全局背景/卡片/文字/强调色；如单独配置某个应用页面样式，则该应用优先使用自己的标题栏/页面/卡片配置，本页主题色仅作兜底。"
              onClick={() => setSection('theme')}
            />
            <NavCard title="全局字体" desc="中文/英文字体风格与字号观感" onClick={() => setSection('font')} />
            <NavCard
              title="桌面个人名片"
              desc="主屏名片头像、昵称、签名（与微信资料独立）"
              onClick={() => setSection('profile')}
            />
            <NavCard title="桌面组件" desc="播放器、Dock样式" onClick={() => setSection('music')} />
            <NavCard
              title="点击动效和拖尾"
              desc="点击反馈与滑动拖尾、颜色与自定义 CSS"
              onClick={() => setSection('gestureEffects')}
            />
            <NavCard title="页面样式" desc="应用页标题栏/背景/卡片/字体 + CSS" onClick={() => setSection('pageStyles')} />
            <NavCard title="应用名称与图标" desc="名称、图标图片、圆角、预览" onClick={() => setSection('appIcons')} />

            <Pressable
              onClick={resetDefaults}
              className="mt-2 w-full py-3 text-center text-[13px] font-medium"
              style={{
                borderRadius: '14px',
                border: `1px solid ${theme.border}`,
                background: theme.surfaceMuted,
                color: theme.textMuted,
              }}
            >
              恢复默认
            </Pressable>
          </div>
        ) : section === 'layout' ? (
          <div className="space-y-2">
            <SettingToggle
              label="显示顶部状态栏"
              description="时间、蜂窝信号与电量（已不含 Wi-Fi 图标）"
              checked={ui.showStatusBar}
              onChange={(v) => setUi({ showStatusBar: v })}
            />
            <SettingToggle
              label="全屏模式"
              description="开启后界面占满屏幕；关闭为居中「小窗」预览"
              checked={ui.fullScreen}
              onChange={(v) => setUi({ fullScreen: v })}
            />
            <SettingToggle
              label="显示手机外壳"
              description="圆角机身与阴影；关闭为贴边无框布局"
              checked={ui.showDeviceFrame}
              onChange={(v) => setUi({ showDeviceFrame: v })}
            />
            <SettingToggle
              label="关闭页面切换动画"
              description="PPT 式切换（无过渡动画），可降低部分 iOS Safari 切页闪屏"
              checked={ui.disablePageTransitions}
              onChange={(v) => setUi({ disablePageTransitions: v })}
            />
            <SettingToggle
              label="启用键盘抬升调试"
              description="开启后，可在桌面与聊天页手动调试输入栏贴键盘高度"
              checked={ui.keyboardDebugEnabled}
              onChange={(v) => setUi({ keyboardDebugEnabled: v })}
            />
            {ui.keyboardDebugEnabled ? (
              <div
                className="rounded-[14px] border p-3"
                style={{
                  borderColor: theme.border,
                  backgroundColor: appearanceStyle.cardBg || theme.surface,
                  backgroundImage: appearanceStyle.cardBgImageUrl ? `url(${appearanceStyle.cardBgImageUrl})` : 'none',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover',
                }}
              >
                <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                  键盘抬升补偿（px）
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={ui.keyboardDebugInsetPx}
                    onChange={(e) => setUi({ keyboardDebugInsetPx: Number(e.target.value) })}
                    className="w-full"
                  />
                  <input
                    type="number"
                    min={-220}
                    max={220}
                    step={1}
                    className="w-20 rounded-[12px] border px-3 py-2 text-base outline-none"
                    style={{
                      borderColor: theme.border,
                      background: theme.surfaceMuted,
                      color: theme.text,
                    }}
                    value={ui.keyboardDebugInsetPx}
                    onChange={(e) => setUi({ keyboardDebugInsetPx: Number(e.target.value) })}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#666]">
                  只在真实键盘弹出时生效；键盘收起时输入栏始终在默认底部位置。
                </p>
                <p className="mt-2 text-[11px] text-[#666]">
                  聊天室同款输入框已移到页面底部固定区域，便于对齐真实键盘位置调试。
                </p>
              </div>
            ) : null}
          </div>
        ) : section === 'theme' ? (
          <div className="space-y-4">
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                void onPickWallpaper(f)
                e.currentTarget.value = ''
              }}
            />

            <div
              className="rounded-[14px] border p-3"
              style={{
                borderColor: theme.border,
                backgroundColor: appearanceStyle.cardBg || theme.surface,
                backgroundImage: appearanceStyle.cardBgImageUrl ? `url(${appearanceStyle.cardBgImageUrl})` : 'none',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
              }}
            >
              <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                桌面壁纸
              </p>
              <div className="mt-3 flex justify-center">
                <div
                  className="relative w-full max-w-[210px] overflow-hidden rounded-[26px] border"
                  style={{
                    aspectRatio: '9 / 19.5',
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    backgroundImage: theme.wallpaperUrl
                      ? `url(${resolvePublicImageUrl(theme.wallpaperUrl)})`
                      : 'none',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: theme.wallpaperFit === 'contain' ? 'contain' : 'cover',
                    boxShadow: 'var(--phone-shadow)',
                  }}
                >
                  {ui.showStatusBar ? (
                    <div className="absolute left-0 right-0 top-0 flex h-7 items-center justify-between px-3 text-[9px] font-medium">
                      <span style={{ color: theme.text }}>09:41</span>
                      <span style={{ color: theme.textMuted }}>5G 100%</span>
                    </div>
                  ) : null}
                  <div className="absolute inset-x-2 bottom-3">
                    <div
                      className="flex items-start justify-between gap-1.5 rounded-full border px-2 pt-2 pb-1.5"
                      style={{
                        background: `${theme.surface}e6`,
                        borderColor: theme.border,
                      }}
                    >
                      {apps.slice(0, 4).map((a) => (
                        <div key={a.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                          <AppIconTile appId={a.id} bgSize={24} glyphSize={15} />
                          <span
                            className="w-full truncate text-center text-[8px] leading-none"
                            style={{ color: theme.appLabelColor }}
                          >
                            {a.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div>
                  <FieldLabel>壁纸 URL</FieldLabel>
                  <input
                    className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                    style={{
                      borderColor: theme.border,
                      background: theme.surfaceMuted,
                      color: theme.text,
                    }}
                    placeholder="https://... / data:image... /image/..."
                    value={theme.wallpaperUrl}
                    onChange={(e) => setTheme({ wallpaperUrl: e.target.value })}
                    onBlur={(e) => {
                      const next = migrateLegacyRootPublicUrl(e.target.value)
                      if (next !== e.target.value) setTheme({ wallpaperUrl: next })
                    }}
                  />
                </div>
                <div>
                  <FieldLabel>壁纸样式</FieldLabel>
                  <select
                    className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                    style={{
                      borderColor: theme.border,
                      background: theme.surfaceMuted,
                      color: theme.text,
                    }}
                    value={theme.wallpaperFit}
                    onChange={(e) =>
                      setTheme({
                        wallpaperFit: e.target.value as 'cover' | 'contain',
                      })
                    }
                  >
                    <option value="cover">铺满（cover）</option>
                    <option value="contain">完整显示（contain）</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Pressable
                    onClick={() => wallpaperInputRef.current?.click()}
                    className="flex-1 rounded-[14px] border py-2.5 text-center text-[12px] font-medium"
                    style={{
                      borderColor: theme.border,
                      background: theme.surface,
                      color: theme.text,
                    }}
                  >
                    本地上传壁纸
                  </Pressable>
                  <Pressable
                    onClick={() => setTheme({ wallpaperUrl: DEFAULT_WALLPAPER_PATH })}
                    className="rounded-[14px] border px-4 py-2.5 text-center text-[12px] font-medium"
                    style={{
                      borderColor: theme.border,
                      background: theme.surface,
                      color: theme.text,
                    }}
                  >
                    恢复默认
                  </Pressable>
                  <Pressable
                    onClick={() => setTheme({ wallpaperUrl: '' })}
                    className="rounded-[14px] border px-4 py-2.5 text-center text-[12px] font-medium"
                    style={{
                      borderColor: theme.border,
                      background: theme.surfaceMuted,
                      color: theme.textMuted,
                    }}
                  >
                    清除
                  </Pressable>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>背景</FieldLabel>
                <input
                  type="color"
                  value={theme.background}
                  onChange={(e) => setTheme({ background: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                />
              </div>
              <div>
                <FieldLabel>卡片</FieldLabel>
                <input
                  type="color"
                  value={theme.surface}
                  onChange={(e) => setTheme({ surface: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                />
                <p className="mt-1 text-[11px] opacity-70">用于名片、播放器、设置卡片底色</p>
              </div>
              <div>
                <FieldLabel>主文字</FieldLabel>
                <input
                  type="color"
                  value={theme.text}
                  onChange={(e) => setTheme({ text: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                />
              </div>
              <div>
                <FieldLabel>应用名称文字</FieldLabel>
                <input
                  type="color"
                  value={theme.appLabelColor}
                  onChange={(e) => setTheme({ appLabelColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                />
                <p className="mt-1 text-[11px] opacity-70">仅影响桌面图标下方名称颜色</p>
              </div>
              <div>
                <FieldLabel>强调色</FieldLabel>
                <input
                  type="color"
                  value={theme.accent}
                  onChange={(e) => setTheme({ accent: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                />
                <p className="mt-1 text-[11px] opacity-70">用于重点元素高亮与强调状态</p>
              </div>
            </div>

          </div>
        ) : section === 'font' ? (
          <div className="space-y-4">
            <div>
              <FieldLabel>全局字体预设</FieldLabel>
              <select
                className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={theme.fontFamily}
                onChange={(e) => setTheme({ fontFamily: e.target.value })}
              >
                {FONT_PRESETS.map((p) => (
                  <option key={p.id} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="rounded-[14px] border px-3 py-3"
              style={{ borderColor: theme.border, background: theme.surface }}
            >
              <p className="text-[12px]" style={{ color: theme.textMuted }}>
                字体预览
              </p>
              <p
                className="mt-2 text-[18px] leading-relaxed"
                style={{ color: theme.text, fontFamily: theme.fontFamily }}
              >
                与你相遇的那天，像风轻轻吹过夏末。
              </p>
              <p
                className="mt-1 text-[16px]"
                style={{ color: theme.textMuted, fontFamily: theme.fontFamily }}
              >
                The story begins with you.
              </p>
            </div>

            <div>
              <FieldLabel>自定义全局字体栈</FieldLabel>
              <textarea
                className="min-h-[86px] w-full resize-none rounded-[12px] border px-3 py-2 text-[14px] outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={theme.fontFamily}
                onChange={(e) => setTheme({ fontFamily: e.target.value })}
                placeholder='"Cormorant Garamond", "ZCOOL XiaoWei", "Noto Serif SC", serif'
              />
            </div>
          </div>
        ) : section === 'profile' ? (
          <div className="space-y-3">
            <div>
              <FieldLabel>昵称</FieldLabel>
              <input
                className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={profile.displayName}
                onChange={(e) => setPersonalCardProfile({ displayName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>个性签名</FieldLabel>
              <textarea
                className="min-h-[72px] w-full resize-none rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={profile.signature}
                onChange={(e) => setPersonalCardProfile({ signature: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>头像 Emoji（无图片时）</FieldLabel>
              <input
                className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={profile.avatarEmoji}
                onChange={(e) => setPersonalCardProfile({ avatarEmoji: e.target.value.slice(0, 4) })}
              />
            </div>
            <div>
              <FieldLabel>头像图片 URL（可空）</FieldLabel>
              <input
                className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                placeholder="https://..."
                value={profile.avatarImageUrl}
                onChange={(e) => setPersonalCardProfile({ avatarImageUrl: e.target.value })}
              />
            </div>
          </div>
        ) : section === 'music' ? (
          <div className="space-y-3">
            <SettingToggle
              label="罗盘极简模式"
              description="强制桌面罗盘使用静态样式（无动画/无滤镜），优先稳定性"
              checked={ui.forceStaticCompass}
              onChange={(v) => setUi({ forceStaticCompass: v })}
            />
            <Pressable
              onClick={() => {
                window.dispatchEvent(new Event('lumi-reset-home-widget-layout'))
                setShowLayoutResetToast(true)
                window.setTimeout(() => setShowLayoutResetToast(false), 1800)
              }}
              className="w-full rounded-[14px] border py-2.5 text-center text-[12px] font-medium"
              style={{
                borderColor: theme.border,
                background: theme.surface,
                color: theme.text,
              }}
            >
              重置桌面组件布局
            </Pressable>
            {showLayoutResetToast ? (
              <div
                className="rounded-[12px] border px-3 py-2 text-[12px]"
                style={{
                  borderColor: theme.border,
                  background: `${theme.surface}f2`,
                  color: theme.text,
                }}
              >
                已重置桌面组件布局
              </div>
            ) : null}
            <div>
              <FieldLabel>曲名</FieldLabel>
              <input
                className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={music.trackTitle}
                onChange={(e) => setMusic({ trackTitle: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>艺人</FieldLabel>
              <input
                className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
                value={music.artistName}
                onChange={(e) => setMusic({ artistName: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>封面主色</FieldLabel>
              <input
                type="color"
                value={music.coverTint}
                onChange={(e) => setMusic({ coverTint: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
              />
            </div>

            <DockStyleSection
              theme={theme}
              apps={apps}
              dockStyle={dockStyle}
              setDockStyle={setDockStyle}
              onPickDockImage={() => openStyleImageUpload({ kind: 'dockBg' })}
            />
          </div>
        ) : section === 'gestureEffects' ? (
          <div className="space-y-3">
            <input
              ref={gestureCssInputRef}
              type="file"
              accept=".css,text/css"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                void onPickGestureCssFile(f)
                e.currentTarget.value = ''
              }}
            />
            <SettingToggle
              label="点击动效"
              description="点击时的粒子爆炸反馈"
              checked={gestureEffects.clickEnabled}
              onChange={(v) => setGestureEffects({ clickEnabled: v })}
            />
            <SettingToggle
              label="拖尾"
              description="按住滑动时的轨迹点"
              checked={gestureEffects.trailEnabled}
              onChange={(v) => setGestureEffects({ trailEnabled: v })}
            />
            <div
              className="rounded-[14px] border p-3"
              style={{
                borderColor: theme.border,
                backgroundColor: appearanceStyle.cardBg || theme.surface,
                backgroundImage: appearanceStyle.cardBgImageUrl ? `url(${appearanceStyle.cardBgImageUrl})` : 'none',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
              }}
            >
              <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                颜色
              </p>
              <div className="mt-3 space-y-3">
                <div
                  className="rounded-[12px] border px-3 py-2"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium">粒子色（深）</span>
                    <input
                      type="color"
                      value={gestureEffects.burstColorDark}
                      onChange={(e) => setGestureEffects({ burstColorDark: e.target.value })}
                      className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                    />
                  </div>
                </div>
                <div
                  className="rounded-[12px] border px-3 py-2"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium">粒子色（中）</span>
                    <input
                      type="color"
                      value={gestureEffects.burstColorMid}
                      onChange={(e) => setGestureEffects({ burstColorMid: e.target.value })}
                      className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                    />
                  </div>
                </div>
                <div
                  className="rounded-[12px] border px-3 py-2"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium">粒子色（浅）</span>
                    <input
                      type="color"
                      value={gestureEffects.burstColorLight}
                      onChange={(e) => setGestureEffects({ burstColorLight: e.target.value })}
                      className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                    />
                  </div>
                </div>
                <div
                  className="rounded-[12px] border px-3 py-2"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium">拖尾色</span>
                    <input
                      type="color"
                      value={gestureEffects.trailColor}
                      onChange={(e) => setGestureEffects({ trailColor: e.target.value })}
                      className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-[14px] border p-3" style={{ borderColor: theme.border, background: theme.surface }}>
              <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                自定义 CSS（仅动效层）
              </p>
              <p className="mt-1 text-[11px] opacity-70">
                可选。可通过 <code className="text-[10px]">[data-global-gesture-effects]</code>、
                <code className="text-[10px]">[data-gesture-burst]</code>、
                <code className="text-[10px]">[data-gesture-trail]</code> 选择器覆盖样式。
              </p>
              <textarea
                className="mt-2 min-h-[100px] w-full resize-y rounded-[12px] border px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                value={gestureEffects.customCss}
                onChange={(e) => setGestureEffects({ customCss: e.target.value })}
                placeholder="/* 例如：调整粒子大小、拖尾模糊等 */"
              />
              <div className="mt-2 flex gap-2">
                <Pressable
                  onClick={() => gestureCssInputRef.current?.click()}
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                >
                  上传 CSS 文件
                </Pressable>
                <Pressable
                  onClick={() => setGestureEffects({ customCss: '' })}
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
                >
                  清空 CSS
                </Pressable>
              </div>
            </div>
          </div>
        ) : section === 'pageStyles' ? (
          <div className="space-y-4">
            <input
              ref={cssInputRef}
              type="file"
              accept=".css,text/css"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                void onPickCssFile(f)
                e.currentTarget.value = ''
              }}
            />
            <div
              className="rounded-[14px] border p-3"
              style={{
                borderColor: theme.border,
                backgroundColor: appearanceStyle.cardBg || theme.surface,
                backgroundImage: appearanceStyle.cardBgImageUrl ? `url(${appearanceStyle.cardBgImageUrl})` : 'none',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
              }}
            >
              <FieldLabel>应用页面目标</FieldLabel>
              <div className="relative">
                <button
                  type="button"
                  className="relative flex w-full items-center justify-center gap-1 rounded-[12px] border px-3 py-2 text-base outline-none transition-colors"
                  style={{
                    borderColor: theme.border,
                    background: theme.surfaceMuted,
                    color: theme.text,
                  }}
                  onClick={() => setStyleAppOpen((v) => !v)}
                >
                  <span className="pointer-events-none select-none text-center">
                    {apps.find((a) => a.id === activeStyleApp)?.label ?? '外观'}
                  </span>
                  <svg
                    className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform duration-200 ${
                      styleAppOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 10l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div
                  className={`absolute inset-x-0 top-full z-10 mt-1 origin-top rounded-[14px] border bg-[color:var(--phone-surface)] shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-[opacity,transform,max-height] duration-220 ease-out ${
                    styleAppOpen ? 'opacity-100 translate-y-0 max-h-56' : 'pointer-events-none opacity-0 -translate-y-1 max-h-0'
                  }`}
                  style={{ borderColor: theme.border, overflow: 'hidden' }}
                >
                  <div className="max-h-56 overflow-y-auto py-1">
                    {apps.map((a) => {
                      const active = a.id === activeStyleApp
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                          style={{
                            color: active ? theme.surface : theme.text,
                            background: active ? theme.text : 'transparent',
                          }}
                          onClick={() => {
                            setActiveStyleApp(a.id)
                            setStyleAppOpen(false)
                          }}
                        >
                          <span className="truncate">{a.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div
                className="rounded-[12px] border px-3 py-2"
                style={{ borderColor: theme.border, background: theme.surfaceMuted }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold uppercase tracking-[0.16em] opacity-80">
                      标题栏背景
                    </span>
                    <span className="mt-0.5 text-[12px] font-medium opacity-75">
                      {appPageStyles[activeStyleApp].headerBg?.toUpperCase() || '#FFFFFF'}
                    </span>
                  </div>
                  <input
                    type="color"
                    value={appPageStyles[activeStyleApp].headerBg}
                    onChange={(e) => setAppPageStyle(activeStyleApp, { headerBg: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                  />
                </div>
                <input
                  className="phone-input-note mt-2 w-full rounded-[10px] border px-3 py-1.5 text-[11px] outline-none"
                  style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  placeholder="标题栏背景图 URL"
                  value={appPageStyles[activeStyleApp].headerBgImageUrl}
                  onChange={(e) => setAppPageStyle(activeStyleApp, { headerBgImageUrl: e.target.value })}
                />
                <div className="mt-2 flex gap-2">
                  <Pressable
                    onClick={() => openStyleImageUpload({ kind: 'headerBg', appId: activeStyleApp })}
                    className="flex-1 rounded-[10px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  >
                    本地上传并裁剪
                  </Pressable>
                  <Pressable
                    onClick={() => setAppPageStyle(activeStyleApp, { headerBgImageUrl: '' })}
                    className="rounded-[10px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
                  >
                    清除图片
                  </Pressable>
                </div>
              </div>

              <div
                className="rounded-[12px] border px-3 py-2"
                style={{ borderColor: theme.border, background: theme.surfaceMuted }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold uppercase tracking-[0.16em] opacity-80">
                      标题栏文字
                    </span>
                    <span className="mt-0.5 text-[12px] font-medium opacity-75">
                      {appPageStyles[activeStyleApp].headerText?.toUpperCase() || '#000000'}
                    </span>
                  </div>
                  <input
                    type="color"
                    value={appPageStyles[activeStyleApp].headerText}
                    onChange={(e) => setAppPageStyle(activeStyleApp, { headerText: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                  />
                </div>
              </div>

              <div
                className="rounded-[12px] border px-3 py-2"
                style={{ borderColor: theme.border, background: theme.surfaceMuted }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold uppercase tracking-[0.16em] opacity-80">
                      页面背景
                    </span>
                    <span className="mt-0.5 text-[12px] font-medium opacity-75">
                      {appPageStyles[activeStyleApp].pageBg?.toUpperCase() || '#FFFFFF'}
                    </span>
                  </div>
                  <input
                    type="color"
                    value={appPageStyles[activeStyleApp].pageBg}
                    onChange={(e) => setAppPageStyle(activeStyleApp, { pageBg: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                  />
                </div>
                <input
                  className="phone-input-note mt-2 w-full rounded-[10px] border px-3 py-1.5 text-[11px] outline-none"
                  style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  placeholder="页面背景图 URL"
                  value={appPageStyles[activeStyleApp].pageBgImageUrl}
                  onChange={(e) => setAppPageStyle(activeStyleApp, { pageBgImageUrl: e.target.value })}
                />
                <div className="mt-2 flex gap-2">
                  <Pressable
                    onClick={() => openStyleImageUpload({ kind: 'pageBg', appId: activeStyleApp })}
                    className="flex-1 rounded-[10px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  >
                    本地上传并裁剪
                  </Pressable>
                  <Pressable
                    onClick={() => setAppPageStyle(activeStyleApp, { pageBgImageUrl: '' })}
                    className="rounded-[10px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
                  >
                    清除图片
                  </Pressable>
                </div>
              </div>

              <div
                className="rounded-[12px] border px-3 py-2"
                style={{ borderColor: theme.border, background: theme.surfaceMuted }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[15px] font-semibold uppercase tracking-[0.16em] opacity-80">
                      卡片背景
                    </span>
                    <span className="mt-0.5 text-[12px] font-medium opacity-75">
                      {appPageStyles[activeStyleApp].cardBg?.toUpperCase() || '#FFFFFF'}
                    </span>
                  </div>
                  <input
                    type="color"
                    value={appPageStyles[activeStyleApp].cardBg}
                    onChange={(e) => setAppPageStyle(activeStyleApp, { cardBg: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-[10px] border border-black/10 bg-transparent p-0"
                  />
                </div>
                <input
                  className="phone-input-note mt-2 w-full rounded-[10px] border px-3 py-1.5 text-[11px] outline-none"
                  style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  placeholder="卡片背景图 URL"
                  value={appPageStyles[activeStyleApp].cardBgImageUrl}
                  onChange={(e) => setAppPageStyle(activeStyleApp, { cardBgImageUrl: e.target.value })}
                />
                <div className="mt-2 flex gap-2">
                  <Pressable
                    onClick={() => openStyleImageUpload({ kind: 'cardBg', appId: activeStyleApp })}
                    className="flex-1 rounded-[10px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                  >
                    本地上传并裁剪
                  </Pressable>
                  <Pressable
                    onClick={() => setAppPageStyle(activeStyleApp, { cardBgImageUrl: '' })}
                    className="rounded-[10px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
                  >
                    清除图片
                  </Pressable>
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>页面字体（仅该应用页）</FieldLabel>
              <textarea
                className="min-h-[76px] w-full resize-none rounded-[12px] border px-3 py-2 text-[14px] outline-none"
                style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                value={appPageStyles[activeStyleApp].fontFamily}
                onChange={(e) => setAppPageStyle(activeStyleApp, { fontFamily: e.target.value })}
              />
              <div className="mt-2 flex gap-2">
                <Pressable
                  onClick={() =>
                    setAppPageStyle(activeStyleApp, {
                      ...DEFAULT_CUSTOMIZATION.appPageStyles[activeStyleApp],
                    })
                  }
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                >
                  恢复该应用默认
                </Pressable>
              </div>
            </div>

            <div className="rounded-[14px] border p-3" style={{ borderColor: theme.border, background: theme.surface }}>
              <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                自定义 CSS（全页面通用）
              </p>
              <p className="mt-1 text-[11px] opacity-70">
                该 CSS 会作用到所有页面。若你在代码里只写某个应用选择器（如 [data-app-id="wechat"]），则仅该应用页面生效。
              </p>
              <p className="mt-1 text-[11px] opacity-70">
                可用选择器示例：`[data-phone-page="app"]`、`[data-app-id="weibo"]`。
              </p>
              <textarea
                className="mt-2 min-h-[120px] w-full resize-y rounded-[12px] border px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.text }}
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder=".my-class { color: #333; }"
              />
              <div className="mt-2 flex gap-2">
                <Pressable
                  onClick={() => cssInputRef.current?.click()}
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
                >
                  上传 CSS 文件
                </Pressable>
                <Pressable
                  onClick={() => setCustomCss('')}
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: theme.border, background: theme.surfaceMuted, color: theme.textMuted }}
                >
                  清空 CSS
                </Pressable>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 隐藏 input：本地上传 */} 
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                void onPickFile(f)
                e.currentTarget.value = ''
              }}
            />

            <ImageCropperModal
              open={!!cropTarget && !!cropSrc}
              imageSrc={cropSrc}
              title="裁剪为正方形图标"
              onCancel={() => {
                setCropSrc('')
                setCropTarget(null)
              }}
              onConfirm={(dataUrl) => {
                if (cropTarget) setAppIconImageUrl(cropTarget, dataUrl)
                setCropSrc('')
                setCropTarget(null)
              }}
            />
            <div
              className="rounded-[14px] border p-3"
              style={{ borderColor: theme.border, background: theme.surface }}
            >
              <p className="text-[12px] font-medium" style={{ color: theme.text }}>
                全局圆角
              </p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={28}
                  step={1}
                  value={globalRadius}
                  onChange={(e) => setAllAppIconRadius(Number(e.target.value))}
                  className="w-full"
                />
                <input
                  type="number"
                  min={0}
                  max={28}
                  step={1}
                  className="w-20 rounded-[12px] border px-3 py-2 text-base outline-none"
                  style={{
                    borderColor: theme.border,
                    background: theme.surfaceMuted,
                    color: theme.text,
                  }}
                  value={globalRadius}
                  onChange={(e) => setAllAppIconRadius(Number(e.target.value))}
                />
              </div>
            </div>

            {apps.map((a) => (
              <div
                key={a.id}
                className="rounded-[14px] border p-3"
                style={{ borderColor: theme.border, background: theme.surface }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium" style={{ color: theme.text }}>
                      {a.label}
                    </p>
                    <p
                      className="mt-1 text-[15px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: theme.textMuted }}
                    >
                      {a.id}
                    </p>
                  </div>
                  {/* 预览：与桌面一致 */} 
                  <div className="shrink-0">
                    <AppIconTile appId={a.id} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <FieldLabel>应用名称</FieldLabel>
                    <input
                      className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                      style={{
                        borderColor: theme.border,
                        background: theme.surfaceMuted,
                        color: theme.text,
                      }}
                      value={a.label}
                      onChange={(e) => setAppLabel(a.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel>图标图片 URL（可空，优先于 SVG）</FieldLabel>
                    <input
                      className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
                      style={{
                        borderColor: theme.border,
                        background: theme.surfaceMuted,
                        color: theme.text,
                      }}
                      placeholder="https://... / 或本地相对路径（public/xxx.png）"
                      value={a.iconImageUrl}
                      onChange={(e) => setAppIconImageUrl(a.id, e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <Pressable
                        onClick={() => openUploadFor(a.id)}
                        className="flex-1 rounded-[14px] border py-2.5 text-center text-[12px] font-medium"
                        style={{
                          borderColor: theme.border,
                          background: theme.surface,
                          color: theme.text,
                        }}
                      >
                        本地上传并裁剪
                      </Pressable>
                      <Pressable
                        onClick={() => setAppIconImageUrl(a.id, '')}
                        className="rounded-[14px] border px-4 py-2.5 text-center text-[12px] font-medium"
                        style={{
                          borderColor: theme.border,
                          background: theme.surfaceMuted,
                          color: theme.textMuted,
                        }}
                        aria-label="清除图片"
                      >
                        清除
                      </Pressable>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>图标圆角（px）</FieldLabel>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={28}
                        step={1}
                        value={a.iconRadius}
                        onChange={(e) => setAppIconRadius(a.id, Number(e.target.value))}
                        className="w-full"
                      />
                      <input
                        type="number"
                        min={0}
                        max={28}
                        step={1}
                        className="w-20 rounded-[12px] border px-3 py-2 text-base outline-none"
                        style={{
                          borderColor: theme.border,
                          background: theme.surfaceMuted,
                          color: theme.text,
                        }}
                        value={a.iconRadius}
                        onChange={(e) => setAppIconRadius(a.id, Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
