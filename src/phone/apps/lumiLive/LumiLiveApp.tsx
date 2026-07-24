import type { WeChatPersonaContact } from '../../types'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { LiveFeedScroller } from './LiveFeedScroller'
import { buildLiveRooms } from './liveRooms'
import './lumiLive.css'

export function LumiLiveApp({
  onBack,
  personaContacts = [],
  userNick = '我',
  className = '',
}: {
  onBack: () => void
  personaContacts?: WeChatPersonaContact[]
  userNick?: string
  className?: string
}) {
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
