import { useMemo } from 'react'
import { useCustomization } from '../../../CustomizationContext'
import type { WeChatTabId } from '../../../types'
import { resolveWeChatPageBgFill, wxFillToStyle } from '../wechatThemeFillStyle'

/** 与微信 Tab 主页相同的壁纸/渐变/纯色背景层 */
export function WeChatThemePageBackdrop({ tab }: { tab?: WeChatTabId }) {
  const { state } = useCustomization()
  const style = useMemo(
    () => wxFillToStyle(resolveWeChatPageBgFill(state.wechatTheme, tab)),
    [state.wechatTheme, tab],
  )
  return <div className="pointer-events-none absolute inset-0 z-0" aria-hidden style={style} />
}
