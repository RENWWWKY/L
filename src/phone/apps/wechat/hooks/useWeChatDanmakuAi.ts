import { useCallback } from 'react'

import type { ApiConfig } from '../../api/types'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import {
  requestWeChatDanmakuVarietyShow,
  type ChatTranscriptTurn,
  type WeChatChatPromptMode,
} from '../wechatChatAi'

/**
 * 封装综艺式弹幕的额外模型调用（不计入聊天记录）。
 */
export function useWeChatDanmakuAi() {
  const fetchDanmakuLines = useCallback(
    async (params: {
      apiConfig: ApiConfig | null
      character: Character | null
      playerIdentity: PlayerIdentity | null
      playerDisplayName: string
      transcript: ChatTranscriptTurn[]
      promptMode: WeChatChatPromptMode
      useMemory: boolean
      generateCount: number
      customRulesPrompt?: string
      longTermMemoryNotes?: string
      worldBackgroundPrompt?: string
      offlineDatingPlotsContext?: string
    }) => {
      return requestWeChatDanmakuVarietyShow(params)
    },
    [],
  )

  return { fetchDanmakuLines }
}
