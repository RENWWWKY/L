import { buildAgencyContextBlock, useAgentStore } from '../sandbox/idolProducer/useAgentStore'

/**
 * 微信私聊 AI 偏置：当对话人设与经纪人模拟器旗下艺人关联时，注入艺人上下文。
 */
export function loadStarMakerAgencyReplyBias(characterId: string): string {
  const id = characterId?.trim()
  if (!id) return ''
  const artist = useAgentStore.getState().findArtistByCharacterId(id)
  if (!artist) return ''
  return buildAgencyContextBlock(artist)
}
