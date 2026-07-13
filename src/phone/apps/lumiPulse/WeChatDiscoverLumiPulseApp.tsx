import { WEIBO_UNDER_DEV } from './lumiPulseDevFlags'
import { LumiPulseApp } from './LumiPulseApp'
import { LumiPulseUnderDev } from './LumiPulseUnderDev'

/** 微信发现 Tab · 微博广场入口 */
export function WeChatDiscoverLumiPulseApp({
  onBack,
  className = '',
}: {
  onBack: () => void
  className?: string
}) {
  if (WEIBO_UNDER_DEV) {
    return <LumiPulseUnderDev onBack={onBack} className={className} />
  }
  return <LumiPulseApp onBack={onBack} backTarget="discover" className={className} />
}
