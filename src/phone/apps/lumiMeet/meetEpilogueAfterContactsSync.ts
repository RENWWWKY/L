import type { ApiConfig } from '../api/types'
import { aiMeetEncounterEpilogueLore } from './lumiMeetAi'
import { syncMeetEpilogueImpressionToWorldbookLore } from './meetPersonaWorldbookSync'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'
import { patchMeetCharacterVol10Epilogue } from './syncMeetNpcToWechat'

/**
 * 遇见角色已写入镜像微信通讯录后：生成并写入（1）档案法则「初印象」条目（2）人设库 worldBooks 之 **vol10 尾声延展分册**（与微信「人设 · 世界书」同一数据层）。
 */
export async function syncMeetEpilogueAfterContactsAdded(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  transcript: Array<{ role: 'user' | 'npc'; content: string }>
}): Promise<void> {
  let lore: string
  try {
    lore = await aiMeetEncounterEpilogueLore({
      apiConfig: params.apiConfig,
      npc: params.npc,
      userProfile: params.userProfile,
      transcript: params.transcript,
    })
  } catch {
    lore = `${params.npc.nickname}这边把临时会话先收个尾：摘录若因异常未完整送达，只能做粗线条小结——印象里对方节奏还算清楚。对用户的当前态度：先保持礼貌与适度距离，愿意在微信里把话续上，具体观感等私聊里再对齐。`
  }
  syncMeetEpilogueImpressionToWorldbookLore({
    characterId: params.npc.id,
    playerDisplayName: params.userProfile.displayName,
    content: lore,
    charNickname: params.npc.nickname,
    charRealName: params.npc.realName ?? params.npc.comprehensivePersona?.base.realName,
  })
  await patchMeetCharacterVol10Epilogue({
    characterId: params.npc.id,
    nickname: params.npc.nickname,
    charRealName: params.npc.realName ?? params.npc.comprehensivePersona?.base.realName,
    playerDisplayName: params.userProfile.displayName,
    rawLore: lore,
  })
}
