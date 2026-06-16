import { ListenNumericText, ListenPlainNum } from '../../../components/discoverListen/ListenNum'
import { PhoneMixedLatinNumText } from '../../phoneMixedLatinNumText'

export function wechatUnreadCountLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/** 红底角标：未读数 / 99+，走全局衬线数字字体 */
export function WeChatUnreadBadgeText({
  count,
  className = '',
}: {
  count: number
  className?: string
}) {
  const text = wechatUnreadCountLabel(count)
  if (/^\d+$/.test(text)) {
    return <ListenPlainNum className={className}>{text}</ListenPlainNum>
  }
  return <PhoneMixedLatinNumText text={text} className={className} />
}

/** 「信息」页标题旁 （3） 未读提示 */
export function WeChatTitleUnreadText({
  count,
  className,
}: {
  count: number
  className?: string
}) {
  return <ListenNumericText text={`（${wechatUnreadCountLabel(count)}）`} className={className} />
}

/** 信息页会话列表：末条预览（语音秒数、纯数字消息等） */
export function WeChatThreadPreviewText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return <PhoneMixedLatinNumText text={text} className={className} />
}

/** 信息页会话列表：右侧时间（09:41、6/16 等） */
export function WeChatThreadTimeText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return <PhoneMixedLatinNumText text={text} className={className} />
}
