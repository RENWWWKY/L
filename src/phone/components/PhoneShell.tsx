import type { CSSProperties, ReactNode } from 'react'
import { useCustomization } from '../CustomizationContext'

type Props = {
  children: ReactNode
}

/** 外框：根据「全屏 / 外壳」组合切换居中预览或贴边全屏 */
export function PhoneShell({ children }: Props) {
  const { state, themeStyle } = useCustomization()
  const { ui } = state
  const { fullScreen, showDeviceFrame } = ui

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

  const sizeStyle: CSSProperties = fullScreen
    ? {
        width: '100%',
        height: '100%',
        minHeight: 0,
        maxHeight: '100%',
        flex: '1 1 auto',
      }
    : {
        width: 'min(100%, 360px)',
        height: 'min(720px, calc(100svh - 48px))',
        maxHeight: 'calc(100svh - 48px)',
      }

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

  return (
    <div className={outerClass} style={safePad}>
      <div className={`${paddedFull} min-w-0`}>
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
          <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
