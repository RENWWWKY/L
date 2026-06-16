import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { FloatingMusicOrb } from '../../components/discoverListen/FloatingMusicOrb'
import { DesktopLyricsWidget } from '../../components/discoverListen/DesktopLyricsWidget'
import { ListenTogetherFullscreenHost } from '../../components/discoverListen/ListenTogetherFullscreenHost'
import { ListenTogetherCommentsOverlayHost } from '../../components/discoverListen/ListenTogetherCommentsOverlayHost'
import { ListenTogetherPlayModeToastHost } from '../../components/discoverListen/ListenTogetherPlayModeToastHost'
import { useCustomization } from '../CustomizationContext'

type Props = {
  children: ReactNode
}

/** 外框：根据「全屏 / 外壳」组合切换居中预览或贴边全屏 */
export function PhoneShell({ children }: Props) {
  const { state, themeStyle } = useCustomization()
  const { ui } = state
  const { fullScreen, showDeviceFrame } = ui

  // 非全屏：把“整台手机”按比例缩放（容器 + 内部所有元素一起缩放），避免只缩容器导致内容被挤爆
  const NON_FULLSCREEN_BASE_W = 360
  const NON_FULLSCREEN_BASE_H = 720
  const nonFullscreenOuterRef = useRef<HTMLDivElement | null>(null)
  const [nonFullscreenScale, setNonFullscreenScale] = useState(1)

  useLayoutEffect(() => {
    if (fullScreen) return
    const el = nonFullscreenOuterRef.current
    if (!el) return

    const compute = () => {
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return
      }
      const rect = el.getBoundingClientRect()
      const w = Math.max(0, Math.floor(rect.width))
      const h = Math.max(0, Math.floor(rect.height))
      if (!w || !h) return
      const s = Math.min(w / NON_FULLSCREEN_BASE_W, h / NON_FULLSCREEN_BASE_H, 1)
      setNonFullscreenScale(Number.isFinite(s) ? s : 1)
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    window.addEventListener('orientationchange', compute)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', compute)
      window.removeEventListener('resize', compute)
    }
  }, [fullScreen])

  /** 不为系统状态栏 / 刘海单独留白，内容从物理顶边起算 */
  const safePad: CSSProperties = fullScreen
    ? {
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }
    : {}

  const outerClass = fullScreen
    ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden'
    : 'flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-6 sm:p-10'

  /** 无外壳：完全无描边、无圆角、无投影，避免上下左右出现「框线」 */
  const innerRadius = showDeviceFrame ? 44 : 0

  const sizeStyle: CSSProperties = useMemo(() => {
    if (fullScreen) {
      return {
        width: '100%',
        height: '100%',
        minHeight: 0,
        maxHeight: '100%',
        flex: '1 1 auto',
      }
    }
    // 非全屏：外层只负责提供可用空间（稳定的 --app-vh），内层按 baseW/baseH 渲染并整体 scale
    return {
      width: 'min(100%, 360px)',
      height: 'min(720px, calc(var(--app-vh, 100dvh) - 48px))',
      maxHeight: 'calc(var(--app-vh, 100dvh) - 48px)',
      minHeight: 'min(720px, calc(var(--app-vh, 100dvh) - 48px))',
      flex: '0 0 auto',
    }
  }, [fullScreen])

  const frameStyle: CSSProperties = showDeviceFrame
    ? {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
      }
    : {
        boxShadow: 'none',
        border: 'none',
        outline: 'none',
      }

  const paddedFull =
    fullScreen && showDeviceFrame
      ? 'box-border flex min-h-0 w-full flex-1 flex-col px-3 pb-0 pt-0 sm:px-4'
      : fullScreen && !showDeviceFrame
        ? 'box-border flex min-h-0 w-full flex-1 flex-col'
        : 'flex min-h-0 justify-center'

  const innerContent = (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {children}
      <ListenTogetherFullscreenHost />
      <ListenTogetherCommentsOverlayHost />
      <DesktopLyricsWidget />
      <ListenTogetherPlayModeToastHost />
      <FloatingMusicOrb />
    </div>
  )

  return (
    <div className={outerClass} style={safePad}>
      <div className={`${paddedFull} min-w-0`}>
        {fullScreen ? (
          <div
            className="relative flex min-h-0 flex-col overflow-hidden"
            style={{
              ...themeStyle,
              ...sizeStyle,
              ...frameStyle,
              borderRadius: innerRadius,
              background: 'var(--phone-bg)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              aria-hidden
              style={{
                backgroundImage: `radial-gradient(circle at 20% 10%, rgba(0,0,0,0.04) 0, transparent 45%),
              radial-gradient(circle at 80% 70%, rgba(0,0,0,0.03) 0, transparent 40%)`,
              }}
            />
            {innerContent}
          </div>
        ) : (
          <div
            ref={nonFullscreenOuterRef}
            className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden"
            style={{
              ...themeStyle,
              ...sizeStyle,
              // 预留给缩放舞台的空间，不让内部再参与 flex 挤压
              padding: 0,
              background: 'transparent',
            }}
          >
            <div
              className="relative"
              style={{
                width: NON_FULLSCREEN_BASE_W,
                height: NON_FULLSCREEN_BASE_H,
                transform: `scale(${nonFullscreenScale})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            >
              <div
                className="relative flex min-h-0 flex-col overflow-hidden"
                style={{
                  width: NON_FULLSCREEN_BASE_W,
                  height: NON_FULLSCREEN_BASE_H,
                  ...frameStyle,
                  borderRadius: innerRadius,
                  background: 'var(--phone-bg)',
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.35]"
                  aria-hidden
                  style={{
                    backgroundImage: `radial-gradient(circle at 20% 10%, rgba(0,0,0,0.04) 0, transparent 45%),
              radial-gradient(circle at 80% 70%, rgba(0,0,0,0.03) 0, transparent 40%)`,
                  }}
                />
                {innerContent}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
