import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import { loadOfflineDatingPlotsPromptBlock } from '../dating/loadOfflineDatingPlotsForWechatPrompt'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import { buildSystemContent } from '../wechatChatAi'

type GlobMod = { default: string }

const extraAvatarModules = {
  abstract: import.meta.glob<GlobMod>('../../../../../image/抽象搞笑男女通用/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  maleE: import.meta.glob<GlobMod>('../../../../../image/微信头像男E型阳光/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  elderFemale: import.meta.glob<GlobMod>('../../../../../image/40岁以上长辈头像女/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  elderMale: import.meta.glob<GlobMod>('../../../../../image/40岁以上长辈头像男/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  maleI: import.meta.glob<GlobMod>('../../../../../image/微信头像男I型清冷/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  femaleCute: import.meta.glob<GlobMod>('../../../../../image/微信头像女可爱活泼/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  femaleCool: import.meta.glob<GlobMod>('../../../../../image/微信头像女清冷和御姐/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
} as const

export type ExtraAvatarBucket = keyof typeof extraAvatarModules

const EXTRA_AVATAR_URLS_BY_BUCKET: Record<ExtraAvatarBucket, string[]> = Object.fromEntries(
  Object.entries(extraAvatarModules).map(([k, mods]) => [
    k,
    Object.values(mods)
      .map((m) => m?.default)
      .filter((x): x is string => typeof x === 'string' && !!x.trim()),
  ]),
) as Record<ExtraAvatarBucket, string[]>

const EXTRA_AVATAR_URLS = Object.values(extraAvatarModules)
  .flatMap((mods) => Object.values(mods).map((m) => m?.default))
  .filter((x): x is string => typeof x === 'string' && !!x.trim())

// 开发期校验：确保头像池确实从本地目录打包进来
if (import.meta.env?.DEV) {
  console.log('[spyWeChatAi] EXTRA_AVATAR_URLS count =', EXTRA_AVATAR_URLS.length)
  if (!EXTRA_AVATAR_URLS.length) console.warn('[spyWeChatAi] 本地头像池为空：请检查 image/ 目录与 import.meta.glob 路径是否匹配')
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickFromPool(pool: string[], seed: string): string | undefined {
  if (!pool.length) return undefined
  const idx = hashString(seed) % pool.length
  return pool[idx]
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function normalizeBucket(v: unknown): ExtraAvatarBucket | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim() as ExtraAvatarBucket
  return s in EXTRA_AVATAR_URLS_BY_BUCKET ? s : undefined
}

function includesAny(s: string, keys: string[]): boolean {
  return keys.some((k) => s.includes(k))
}

/**
 * 依据“备注/昵称里的关系与气质词”推断头像桶。
 * 目标：与你的头像文件夹命名一致，避免性别/年龄/气质 OOC。
 */
function inferAvatarBucketFromPersona(text: string): ExtraAvatarBucket | undefined {
  const s = (text || '').replace(/\\s+/g, '').toLowerCase()
  if (!s) return undefined

  // 1) 抽象搞笑（优先级最高：这类一般就是“表情包头像/搞笑号”）
  if (includesAny(s, ['抽象', '搞笑', '沙雕', '整活', '表情包', '段子', '哈哈', '梗'])) return 'abstract'

  // 2) 长辈（父母/长辈称谓优先）
  if (includesAny(s, ['妈妈', '妈', '母亲', '姨', '阿姨', '姑', '姑妈', '婶', '婶婶', '奶奶', '姥姥', '外婆'])) return 'elderFemale'
  if (includesAny(s, ['爸爸', '爸', '父亲', '叔', '叔叔', '伯', '伯伯', '舅', '舅舅', '爷爷', '外公', '姥爷'])) return 'elderMale'
  if (includesAny(s, ['老师', '主任', '校长', '班主任', '教授', '导师', '教练', '阿姨', '叔叔'])) {
    // 老师/教练不一定是长辈，但通常偏成熟；用性别词决定男女长辈池
    if (includesAny(s, ['女', '姐', '姨', '阿姨', '师姐', '女老师'])) return 'elderFemale'
    if (includesAny(s, ['男', '哥', '叔', '伯', '师兄', '男老师'])) return 'elderMale'
  }

  // 3) 性别 & 气质
  const isFemale = includesAny(s, ['女', '姐', '妹', '闺蜜', '老婆', '女友', '小姨', '阿姨', '妈'])
  const isMale = includesAny(s, ['男', '哥', '弟', '兄弟', '老公', '男友', '叔', '伯', '爸'])

  // 3.1 女：可爱/活泼 vs 清冷/御姐
  if (isFemale) {
    if (includesAny(s, ['可爱', '萌', '甜', '软', '元气', '活泼', '小可爱', '小甜', '奶', '乖'])) return 'femaleCute'
    if (includesAny(s, ['清冷', '冷', '高冷', '御姐', '姐姐', '女王', '成熟', '理性', '克制'])) return 'femaleCool'
    // 默认女：更安全选清冷御姐（轻奢风更稳）
    return 'femaleCool'
  }

  // 3.2 男：E型阳光 vs I型清冷
  if (isMale) {
    if (includesAny(s, ['阳光', '外向', '热情', '直球', '社牛', '运动', '开朗', '热血'])) return 'maleE'
    if (includesAny(s, ['清冷', '冷', '高冷', '克制', '安静', '内向', '社恐', '疏离'])) return 'maleI'
    // 默认男：更安全选清冷（减少“油腻感”）
    return 'maleI'
  }

  // 4) 兜底：根据少量关键词推断，不确定就不强推
  if (includesAny(s, ['小姐姐', '闺蜜', '宝贝', '小仙女'])) return 'femaleCute'
  if (includesAny(s, ['大哥', '兄弟', '老弟'])) return 'maleE'
  return undefined
}

export type SpyWechatGenerateOptions = {
  contactCount: number
  contactBias: string
  currentContactsSnapshot?: Array<{
    id: string
    nickname: string
    remarkName: string
    characterId?: string
    isStarred?: boolean
    blocked?: boolean
  }>
  includeBlocked: boolean
  includeMomentsHideFromUser: boolean
  includeMomentsOnlyTaVisibleWithoutUser: boolean
  minMessagesPerContact: number
  chatContactsCount: number
}

export type SpyWechatGeneratedData = {
  profile: {
    nickname: string
    avatarUrl?: string
    signature: string
  }
  contacts: Array<{
    id: string
    /** 微信昵称（来自人脉角色或生成联系人自身） */
    nickname: string
    /** 备注名（角色视角下的智能备注） */
    remarkName: string
    /** 额外生成联系人头像桶（与本地头像文件夹一一对应） */
    avatarBucket?: ExtraAvatarBucket
    avatarUrl?: string
    isStarred?: boolean
    blocked?: boolean
    characterId?: string
    messages: Array<{
      from: 'player' | 'character'
      content: string
      timestamp: number
      special?:
        | { kind: 'red_packet'; amountYuan?: number; remark?: string; opened?: boolean }
        | { kind: 'transfer'; transferId?: string; amountYuan?: number; note?: string; status?: 'pending' | 'accepted' | 'returned' }
        | { kind: 'sticker'; label?: string; imageUrl?: string }
        | { kind: 'image'; imageUrl?: string; mime?: string }
    }>
  }>
  moments: Array<{
    id: string
    content: string
    visibility: string
    likes: string[]
    comments: Array<{ from: string; content: string }>
  }>
  bills: Array<{ id: string; date: string; target: string; amount: number; remark: string }>
  affectionCards: Array<{ id: string; holder: string; limit: number; spent: number }>
}

function stripFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function tryParseJsonObject<T>(raw: string): T | null {
  const cleaned = stripFence(raw)
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}

async function askModelJsonWithRetry<T>(
  cfg: ApiConfig,
  baseSystem: string,
  userTask: string,
  maxTokens: number,
  maxRetry = 3,
): Promise<T> {
  let lastRaw = ''
  for (let i = 0; i < maxRetry; i += 1) {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: baseSystem },
        { role: 'user', content: userTask },
      ],
      { temperature: 0.72, max_tokens: maxTokens },
    )
    lastRaw = raw
    const parsed = tryParseJsonObject<T>(raw)
    if (parsed) return parsed
  }
  throw new Error(`模型输出格式不稳定（多次重试失败）：${lastRaw.slice(0, 220)}`)
}

export async function generateSpyWechatData(params: {
  apiConfig: ApiConfig | null
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  scope?: 'contacts' | 'chats' | 'moments' | 'me'
  options: SpyWechatGenerateOptions
}): Promise<SpyWechatGeneratedData> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) throw new Error('未配置 AI API')

  const cid = params.characterId.trim()
  const piid = params.playerIdentityId.trim()
  const character = cid ? ((await personaDb.getCharacter(cid)) as Character | null) : null
  const playerIdentity =
    piid && piid !== '__none__' ? ((await personaDb.getPlayerIdentity(piid)) as PlayerIdentity | null) : null
  const memoryNotes = (await personaDb.formatCharacterMemoriesForPrompt(cid)).trim() || undefined
  const recentMsgs = await personaDb.listWeChatChatMessagesRecentByCharacter({ characterId: cid, limit: 40 })
  const recentMsgText = recentMsgs
    .map((m) => `${m.type === 'player' ? '用户' : '角色'}: ${m.content}`)
    .join('\n')
    .slice(0, 5000)

  let worldBackgroundPrompt: string | undefined
  if (character?.worldBackgroundId?.trim()) {
    const bg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
    const block = formatWorldBackgroundForPrompt(bg)
    if (block.trim()) worldBackgroundPrompt = block
  }

  const promptMode = params.useLumiProjectAssistantPrompt ? 'lumi-assistant' : 'persona'
  const offlineDatingPlotsContext =
    promptMode === 'persona' && cid ? await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null) : ''

  const baseSystem = buildSystemContent({
    character,
    playerIdentity,
    playerDisplayName: params.playerDisplayName.trim() || '朋友',
    promptMode,
    longTermMemoryNotes: memoryNotes,
    worldBackgroundPrompt,
    offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
  })

  const o = params.options

  const boundNpcs = (await personaDb.listNpcsFor(cid)).filter((x) => x?.id && x.generatedForCharacterId === cid)
  const boundNpcSeedList = boundNpcs.slice(0, 50).map((n) => ({
    characterId: n.id,
    nickname: (n.wechatNickname || n.name || '').trim(),
    avatarUrl: (n.avatarUrl || '').trim(),
  }))

  const strictGuard = `
输出硬性规则：
- 所有内容必须贴合角色人设、最近对话、长期记忆，不得 OOC。
- “谁给谁红包/转账/礼物”方向绝对不能写反。
- 只输出 JSON 对象，不要 markdown，不要解释。
【重要】下文「最近对话摘录」是**角色与现实用户**在主微信单聊里的片段，仅供把握语气与剧情线索；后续若要求生成「某联系人的聊天记录」，对话双方是**角色 ↔ 该联系人本人**，**不是**角色在对现实用户说话，也**禁止**把联系人当成第三人背后议论（例如聊天对象叫「林悦」时，禁止写成「林悦她怎样」像在跟外人聊林悦；应写成对「你/林悦」直接说话）。
最近对话摘录：
${recentMsgText || '（暂无）'}
`.trim()

  const profileAndContacts = await askModelJsonWithRetry<{
    profile: SpyWechatGeneratedData['profile']
    contacts: Array<{
      id: string
      nickname?: string
      remarkName: string
      avatarBucket?: ExtraAvatarBucket
      isStarred?: boolean
      blocked?: boolean
      characterId?: string
    }>
  }>(
    cfg,
    `${baseSystem}\n\n${strictGuard}`,
    `
先只生成「profile + contacts 基础信息（不含 messages）」。
要求：
1) 必须包含我绑定的人脉 NPC（见下方固定列表），这些 NPC 的 characterId 不得修改。
2) 联系人总量约 ${o.contactCount}（在固定 NPC 之外可补充少量“额外联系人”）。
2) 有聊天记录的联系人至少准备 ${o.chatContactsCount} 个（后续会补 messages）。
3) 联系人偏向：${o.contactBias || '与近期剧情最相关的人群'}。
4) 是否包含拉黑联系人：${o.includeBlocked ? '是' : '否'}。
5) 若为“额外联系人”（characterId 为空），必须给出 avatarBucket（用于从本地头像文件夹挑头像），avatarBucket 只能取：
   abstract | maleE | elderFemale | elderMale | maleI | femaleCute | femaleCool
   桶含义：
   - elderFemale：妈妈/阿姨/姑/婶/奶奶/外婆/女长辈/女老师风格
   - elderMale：爸爸/叔叔/伯伯/舅舅/爷爷/外公/男长辈/男老师风格
   - femaleCute：可爱活泼/元气甜妹/闺蜜风
   - femaleCool：清冷御姐/成熟克制/高冷风
   - maleE：阳光外向/热情直球/运动少年感
   - maleI：清冷内向/克制疏离/冷淡感
   - abstract：抽象搞笑/表情包头像/整活号
6) 备注名 remarkName 必须是我（角色）视角会给对方取的称呼（可含关系/外号/情绪），且要贴合该 NPC 或该联系人人设。
固定 NPC 列表（必须全部包含；nickname/avatarUrl 仅作参考，最终以前端数据库为准）：
${JSON.stringify(boundNpcSeedList, null, 2)}
返回格式：
{
  "profile": {"nickname":"","avatarUrl":"","signature":""},
  "contacts":[{"id":"","nickname":"","remarkName":"","avatarBucket":"femaleCool","isStarred":true,"blocked":false,"characterId":""}]
}
`.trim(),
    2200,
  )

  const normalizedProfile: SpyWechatGeneratedData['profile'] = {
    nickname:
      (character?.wechatNickname || character?.name || profileAndContacts.profile?.nickname || '角色')
        .toString()
        .trim() || '角色',
    avatarUrl:
      (character?.avatarUrl || profileAndContacts.profile?.avatarUrl || pickFromPool(EXTRA_AVATAR_URLS, `profile:${cid}`)) ||
      undefined,
    signature: (character?.wechatSignature || profileAndContacts.profile?.signature || '').toString().trim(),
  }

  const contactIds = (profileAndContacts.contacts || []).map((c) => c.id).filter(Boolean)
  const chatTargets = contactIds.slice(0, Math.max(1, Math.min(o.chatContactsCount, contactIds.length)))

  const messagesByContact = new Map<string, SpyWechatGeneratedData['contacts'][number]['messages']>()
  for (const cidOne of chatTargets) {
    const row = (profileAndContacts.contacts || []).find((c) => c.id === cidOne)
    const rowCharacterId = row?.characterId?.trim()
    const npcMeta = rowCharacterId ? boundNpcs.find((n) => n.id === rowCharacterId) : undefined
    const peerCallName =
      (npcMeta?.name || npcMeta?.wechatNickname || row?.remarkName || row?.nickname || '该联系人').trim() || '该联系人'
    const payload = await askModelJsonWithRetry<{ messages: Array<{ from: 'player' | 'character'; content: string; timestamp: number }> }>(
      cfg,
      `${baseSystem}\n\n${strictGuard}`,
      `
只为「联系人 id = ${cidOne}」生成**其与角色本人之间的私聊记录**（模拟该联系人手机/角色手机上与「${peerCallName}」这一行的会话）。
【对话身份（必须遵守，禁止串台）】
- 这是**角色 ↔ ${peerCallName}（当前联系人）**两人的双向聊天，**不是**角色与现实 App 用户的主微信私聊。
- JSON 里 from 仅为技术标签：**character** = 被查看的手机主人（角色本人发的气泡）；**player** = 当前联系人「${peerCallName}」一侧发的气泡（**≠** 现实用户；不得按「哄用户 / 跟用户谈恋爱」来写）。
- 双方都在会话里：对对方说话用「你」或对方昵称/外号；**禁止**用第三人称指称本会话对象（错误示例：会话对象是林悦却写「她林悦估计静音了」「悦子她……」像在跟第三人八卦；正确：直接「你手机又静音了吧」「悦子你还在琴房吗」）。
- 称呼与亲密程度须符合**角色与该联系人**在世界观里的关系；默认同学/朋友/同事口吻。**禁止**对非恋人关系使用「宝宝」「宝贝」「乖乖」等恋人昵称；除非世界书明确该二人已是情侣且对彼此如此称呼，否则改用名字、外号或「你」。
- 可化用「最近对话摘录」里的剧情线索，但要把张力落在**角色与 ${peerCallName}** 之间，不要写成用户在旁听。
要求：
1) 消息气泡不少于 ${o.minMessagesPerContact} 条。
2) from 仅允许 "player" 或 "character"，含义同上，不得写反。
3) 内容贴合角色人设与关系边界，有具体生活细节（时间、地点、小事），避免空泛撩拨。
返回格式：
{"messages":[{"from":"character","content":"...","timestamp":1710000000000}]}
`.trim(),
      1800,
    )
    messagesByContact.set(cidOne, payload.messages || [])
  }

  const momentsPayload = await askModelJsonWithRetry<{
    moments: SpyWechatGeneratedData['moments']
  }>(
    cfg,
    `${baseSystem}\n\n${strictGuard}`,
    `
只生成朋友圈 moments。
要求：
1) 包含点赞 likes 与评论 comments 互动。
2) 含“屏蔽用户可见”内容：${o.includeMomentsHideFromUser ? '是' : '否'}。
3) 含“非用户仅TA可见”内容：${o.includeMomentsOnlyTaVisibleWithoutUser ? '是' : '否'}。
返回格式：
{"moments":[{"id":"","content":"","visibility":"","likes":[],"comments":[{"from":"","content":""}]}]}
`.trim(),
    1800,
  )

  const financialPayload = await askModelJsonWithRetry<{
    bills: SpyWechatGeneratedData['bills']
    affectionCards: SpyWechatGeneratedData['affectionCards']
  }>(
    cfg,
    `${baseSystem}\n\n${strictGuard}`,
    `
只生成财务数据：
1) 微信账单流水 bills（含日期/对象/金额/备注）
2) 亲情卡 affectionCards（给谁开通、限额与已用）
返回格式：
{
  "bills":[{"id":"","date":"","target":"","amount":-66,"remark":""}],
  "affectionCards":[{"id":"","holder":"","limit":3000,"spent":800}]
}
`.trim(),
    1600,
  )

  const mergedContactsRaw: SpyWechatGeneratedData['contacts'] = (profileAndContacts.contacts || []).map((c) => ({
    id: c.id,
    nickname: c.nickname || c.remarkName || '联系人',
    remarkName: c.remarkName,
    avatarBucket: normalizeBucket(c.avatarBucket),
    avatarUrl: undefined,
    isStarred: c.isStarred,
    blocked: c.blocked,
    characterId: c.characterId,
    messages: messagesByContact.get(c.id) || [],
  }))

  const mergedContacts: SpyWechatGeneratedData['contacts'] = []
  for (const c of mergedContactsRaw) {
    let nickname = (c.nickname || '').trim()
    let avatarUrl = (c.avatarUrl || '').trim()
    if (c.characterId?.trim()) {
      const npc = (await personaDb.getCharacter(c.characterId.trim())) as Character | null
      if (npc) {
        nickname = (npc.wechatNickname || npc.name || nickname || c.remarkName).trim()
        avatarUrl = (npc.avatarUrl || avatarUrl).trim()
      }
    }
    if (!nickname) nickname = (c.remarkName || '联系人').trim()
    // 非人脉 NPC：根据 avatarBucket 选择本地头像
    if (!c.characterId?.trim()) {
      const personaText = `${c.remarkName || ''} ${c.nickname || ''}`.trim()
      const inferred = inferAvatarBucketFromPersona(personaText)
      const bucket = inferred || c.avatarBucket
      const pool = bucket ? EXTRA_AVATAR_URLS_BY_BUCKET[bucket] : EXTRA_AVATAR_URLS
      avatarUrl = pickFromPool(pool, `${bucket || 'any'}:${c.id}`) || ''
    }
    // 兜底：人脉 NPC 若仍无头像（例如未设置），也用本地头像池补齐
    if (!avatarUrl) avatarUrl = pickFromPool(EXTRA_AVATAR_URLS, c.id) || ''
    // 防御：无论何种情况，都不允许远程 URL 覆盖“查手机”本地头像设定
    if (avatarUrl && isRemoteUrl(avatarUrl)) avatarUrl = ''
    if (!avatarUrl) avatarUrl = '/image/个人名片默认头像1.png'
    mergedContacts.push({ ...c, nickname, avatarUrl: avatarUrl || undefined })
  }

  // 强制补齐：若模型漏掉绑定 NPC，则把它们补进通讯录（备注先用昵称兜底）
  const existingNpcIds = new Set(mergedContacts.map((c) => c.characterId).filter(Boolean) as string[])
  for (const npc of boundNpcs) {
    if (!npc?.id) continue
    if (existingNpcIds.has(npc.id)) continue
    mergedContacts.push({
      id: npc.id,
      characterId: npc.id,
      nickname: (npc.wechatNickname || npc.name || '联系人').trim(),
      remarkName: (npc.remark || npc.wechatNickname || npc.name || '联系人').trim(),
      avatarUrl: (npc.avatarUrl || pickFromPool(EXTRA_AVATAR_URLS, npc.id) || '/image/个人名片默认头像1.png').trim(),
      isStarred: npc.isStarred ?? undefined,
      blocked: npc.isBlocked ?? undefined,
      messages: [],
    })
  }

  return {
    profile: normalizedProfile,
    contacts: mergedContacts,
    moments: momentsPayload.moments || [],
    bills: financialPayload.bills || [],
    affectionCards: financialPayload.affectionCards || [],
  }
}

