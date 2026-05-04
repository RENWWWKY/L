/** 群聊单次模型输出中的元数据指令（与 <<SPEAKER>> 同行可交错） */
export type WeChatGroupMetaAction =
  | { type: 'group_title'; actorCharacterId: string; title: string }
  | { type: 'group_announcement'; actorCharacterId: string; text: string }
  /** 任命或撤销群管理员；仅 `actorCharacterId` 在群内为群主时生效 */
  | { type: 'group_admin_role'; actorCharacterId: string; targetCharacterId: string; toRole: 'admin' | 'member' }
  | { type: 'member_nick'; characterId: string; nickname: string }

export type WeChatGroupMultiSpeakerOrderedItem =
  | { kind: 'meta'; action: WeChatGroupMetaAction }
  | { kind: 'bubble'; characterId: string; text: string }
