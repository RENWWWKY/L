import type { WeChatPersonaContact } from '../../types'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { LiveFeedScroller } from './LiveFeedScroller'
import { buildLiveRooms } from './liveRooms'
import { LUMI_LIVE_UNDER_DEV } from './lumiLiveDevFlags'
import { LumiLiveUnderDev } from './LumiLiveUnderDev'
import './lumiLive.css'

export type LumiLiveAppProps = {
  onBack: () => void
  personaContacts?: WeChatPersonaContact[]
  userNick?: string
  className?: string
}

export function LumiLiveApp(props: LumiLiveAppProps) {
  if (LUMI_LIVE_UNDER_DEV) {
    return <LumiLiveUnderDev onBack={props.onBack} className={props.className} />
  }
  return <LumiLiveAppInner {...props} />
}

function LumiLiveAppInner({
  onBack,
  personaContacts = [],
  userNick = '我',
  className = '',
}: LumiLiveAppProps) {
  const chatCardApi = useCurrentApiConfig('chatCard')
  const danmakuApi = useCurrentApiConfig('danmaku')
  const mainApi = useCurrentApiConfig()
  /** 聊天/画面走 chatCard，否则主 API；弹幕优先专用 danmaku 子配置 */
  const apiConfig = chatCardApi ?? mainApi
  const danmakuApiConfig = danmakuApi ?? apiConfig
  const rooms = buildLiveRooms(personaContacts)

  return (
    <LiveFeedScroller
      className={className}
      rooms={rooms}
      userNick={userNick}
      apiConfig={apiConfig}
      danmakuApiConfig={danmakuApiConfig}
      onBack={onBack}
    />
  )
}

export default LumiLiveApp
