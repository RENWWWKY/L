import type { CharacterMemory, Relationship } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'

/** 用于从长期记忆里挑出「可能含亲密/占有欲」的条目（辅助模型站位，非严谨分类） */
const ROMANCE_OR_TENSION_HINT =
  /恋爱|暧昧|好感|喜欢|爱意|心动|情侣|恋人|地下|秘密关系|吃醋|独占|宣示|表白|约会|接吻|牵手|修罗|争风|阴阳|占有欲|暗恋|告白|亲密|夜里|单独见面|别理他|别理她|滚远|我的(人|男朋友|女朋友|老婆|老公)/iu

function clip(s: string, max: number): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function edgesIdentityNpc(rels: Relationship[], identityId: string, npcId: string): Relationship[] {
  const pid = identityId.trim()
  const nid = npcId.trim()
  if (!pid || !nid) return []
  return rels.filter(
    (r) =>
      r.isPlayerIdentity &&
      ((r.fromCharacterId === pid && r.toCharacterId === nid) ||
        (r.fromCharacterId === nid && r.toCharacterId === pid)),
  )
}

function formatEdge(r: Relationship, pid: string): string {
  if (r.fromCharacterId === pid && r.toCharacterId !== pid) {
    return `- 「${r.relation.trim() || '关系'}」｜玩家身份视角：${clip(r.fromPerspective, 260)}｜该角色视角：${clip(r.toPerspective, 260)}`
  }
  if (r.fromCharacterId !== pid && r.toCharacterId === pid) {
    return `- 「${r.relation.trim() || '关系'}」｜该角色视角：${clip(r.fromPerspective, 260)}｜玩家身份视角：${clip(r.toPerspective, 260)}`
  }
  return `- 「${r.relation.trim() || '关系'}」｜${clip(r.fromPerspective, 200)}／${clip(r.toPerspective, 200)}`
}

/**
 * 汇总：人脉里「玩家身份 ↔ 本 NPC」的连线文案 + 长期记忆里偏亲密/情绪的条目；
 * 供群聊多角色提示里**仅此 NPC**使用，便于校准好感站位与群内吃醋强度。
 */
export async function buildNpcRelationshipRomanceProfileForGroupPrompt(params: {
  npcCharacterId: string
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
  /** 外层已 `listRelationshipsForIdentity(session)` 时可传入，避免重复读库 */
  sessionRelationships?: Relationship[] | null
  /** 外层已拉取绑定身份的人脉时可传入 */
  boundRelationships?: Relationship[] | null
  maxMemoryHints?: number
  maxTotalChars?: number
}): Promise<string> {
  const nid = params.npcCharacterId.trim()
  if (!nid) return ''

  const chunks: string[] = []
  const seen = new Set<string>()

  const pushPidBlock = async (pid: string, rels: Relationship[], heading: string) => {
    const p = pid.trim()
    if (!p || p === '__none__') return
    const edges = edgesIdentityNpc(rels, p, nid)
    if (!edges.length) return
    let idenName = ''
    try {
      const iden = await personaDb.getPlayerIdentity(p)
      idenName = (iden?.name || '').trim()
    } catch {
      idenName = ''
    }
    const label = idenName ? `${idenName}（id=${p}）` : `id=${p}`
    chunks.push(`${heading}${label}】`)
    for (const r of edges) {
      const line = formatEdge(r, p)
      if (seen.has(line)) continue
      seen.add(line)
      chunks.push(line)
    }
  }

  const spid = params.sessionPlayerIdentityId.trim()
  const bid = params.boundPlayerIdentityId?.trim()
  /** 绑定档与会话档不同：禁止再注入「会话身份」人脉——否则会话档姓名（如祁）会盖过绑定档（如卫），导致该 NPC 叫错人 */
  const omitSessionIdentityEdges =
    !!bid && bid !== '__none__' && !!spid && spid !== '__none__' && bid !== spid

  let sessionRels = params.sessionRelationships
  if (sessionRels === undefined && spid && spid !== '__none__') {
    try {
      sessionRels = await personaDb.listRelationshipsForIdentity(spid)
    } catch {
      sessionRels = []
    }
  }
  if (sessionRels?.length && spid && spid !== '__none__' && !omitSessionIdentityEdges) {
    await pushPidBlock(spid, sessionRels, '【玩家身份「当前会话」')
  }

  let boundRels = params.boundRelationships
  if (bid && bid !== '__none__' && bid !== spid) {
    if (boundRels === undefined) {
      try {
        boundRels = await personaDb.listRelationshipsForIdentity(bid)
      } catch {
        boundRels = []
      }
    }
    if (boundRels?.length) await pushPidBlock(bid, boundRels, '【玩家身份「人设绑定·用于私聊存档的身份」')
  }

  const hasIdentityHeader = chunks.some((l) => l.startsWith('【玩家身份'))
  if (!hasIdentityHeader) {
    chunks.push(
      '【人脉连线】当前未见「玩家身份↔本角色」绑定边（或会话身份为 __none__）。你对用户的情感档位请以人设卡、世界书、长期记忆与私聊近况摘录为准自行落定。',
    )
  }

  let memories: CharacterMemory[] = []
  try {
    memories = await personaDb.listCharacterMemoriesForCharacter(nid)
  } catch {
    memories = []
  }
  const priv = memories.filter((m) => m.memoryScope !== 'group')
  const hints = priv
    .filter((m) => ROMANCE_OR_TENSION_HINT.test(m.content))
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
    .slice(0, Math.max(2, Math.min(12, Math.floor(params.maxMemoryHints ?? 8))))

  if (hints.length) {
    chunks.push('【长期记忆中·偏亲密/吃醋/关系张力的条目（摘要用；勿在群里逐字背书）】')
    hints.forEach((m, i) => {
      chunks.push(`${i + 1}. ${clip(m.content, 200)}`)
    })
  }

  chunks.push(
    '【群内言行校准】综合人设 + 上列连线 + 记忆 + 下方「私聊近况摘录」判断：你对用户的**关系档位**、**好感大致区间**、**是否倾向推进恋爱/地下恋/暧昧**、**占有欲强弱**。在群里对用户与其他 NPC 的互动要敏感得有分寸：偏高好感/恋爱倾向时→更易吃醋、阴阳、抢话、宣示、酸两句；偏低或敌对→冷眼旁观或拱火；始终服从人设底色，禁止全员无所谓脸。',
  )

  let body = chunks.join('\n')
  const cap = Math.max(1200, Math.min(8000, Math.floor(params.maxTotalChars ?? 4200)))
  if (body.length > cap) body = `${body.slice(0, cap)}…（关系摘录过长已截断）`
  return body
}
