import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import { DEFAULT_CUSTOMIZATION, type CustomizationState } from '../../../types'
import { loadOfflineDatingPlotsPromptBlock } from '../dating/loadOfflineDatingPlotsForWechatPrompt'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import { buildSystemContent } from '../wechatChatAi'
import { resolveWeChatCurrentTimeMs } from '../time/wechatTimeUtils'

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

function pickFromPoolAvoid(pool: string[], seed: string, forbidden: Set<string>): string | undefined {
  if (!pool.length) return undefined
  const clean = pool.filter((x) => {
    const s = (x || '').trim()
    return !!s && !forbidden.has(s)
  })
  if (!clean.length) return pickFromPool(pool, seed)
  return pickFromPool(clean, seed)
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
  generationMode?: 'generate' | 'update'
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
    /**
     * 仅「额外联系人」：与 TA 的关系统领（与 nickname/remark 同一次模型输出，供角色长期记忆；无需二次调用）。
     * NPC（有 characterId）可省略。
     */
    relationshipNote?: string
    /** 仅「额外联系人」：为何在通讯录用此备注/称呼；与上字段同次生成。 */
    remarkWhy?: string
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

function pickOfflinePlotsTopLines(input: string, maxLines = 5): string {
  const lines = String(input || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  return lines.slice(0, Math.max(1, maxLines)).join('\n')
}

function normalizeMessageTimestamps(
  messages: Array<{
    from: 'player' | 'character'
    content: string
    timestamp: number
    special?:
      | { kind: 'red_packet'; amountYuan?: number; remark?: string; opened?: boolean }
      | { kind: 'transfer'; transferId?: string; amountYuan?: number; note?: string; status?: 'pending' | 'accepted' | 'returned' }
      | { kind: 'sticker'; label?: string; imageUrl?: string }
      | { kind: 'image'; imageUrl?: string; mime?: string }
  }>,
  nowMs: number,
): Array<{
  from: 'player' | 'character'
  content: string
  timestamp: number
  special?:
    | { kind: 'red_packet'; amountYuan?: number; remark?: string; opened?: boolean }
    | { kind: 'transfer'; transferId?: string; amountYuan?: number; note?: string; status?: 'pending' | 'accepted' | 'returned' }
    | { kind: 'sticker'; label?: string; imageUrl?: string }
    | { kind: 'image'; imageUrl?: string; mime?: string }
}> {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now()
  const windowStart = safeNow - 1000 * 60 * 60 * 24 * 30
  const cleaned = (messages || [])
    .map((m) => ({
      ...m,
      content: String(m.content || '').trim(),
      timestamp: Number(m.timestamp || 0),
    }))
    .filter((m) => !!m.content || !!m.special)
  if (!cleaned.length) return []

  const allInWindow = cleaned.every((m) => Number.isFinite(m.timestamp) && m.timestamp >= windowStart && m.timestamp <= safeNow + 10 * 60 * 1000)
  if (allInWindow) return cleaned.sort((a, b) => a.timestamp - b.timestamp)

  const baseStart = safeNow - Math.max(5, cleaned.length) * 8 * 60 * 1000
  return cleaned.map((m, i) => ({ ...m, timestamp: baseStart + i * 8 * 60 * 1000 }))
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

function readCurrentWechatProfile(): { displayName: string; avatarImageUrl: string } {
  if (typeof window === 'undefined') return { displayName: '', avatarImageUrl: '' }
  const keys = ['lumi-phone-custom-v3', 'lumi-phone-custom-v2', 'lumi-phone-custom-v1']
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Partial<CustomizationState>
      const displayName = typeof parsed?.profile?.displayName === 'string' ? parsed.profile.displayName.trim() : ''
      const avatar = parsed?.profile?.avatarImageUrl
      const avatarImageUrl = typeof avatar === 'string' ? avatar.trim() : ''
      if (displayName || avatarImageUrl) {
        return {
          displayName,
          avatarImageUrl,
        }
      }
    } catch {
      // ignore broken local state and continue fallback
    }
  }
  return {
    displayName: DEFAULT_CUSTOMIZATION.profile.displayName?.trim() || '',
    avatarImageUrl: DEFAULT_CUSTOMIZATION.profile.avatarImageUrl?.trim() || '',
  }
}

function isPhoneLikeName(v: string): boolean {
  const s = (v || '').trim()
  if (!s) return false
  // 1) 中国大陆常见手机号：11位且以 1 开头
  if (/^1\d{10}$/.test(s)) return true
  // 2) 纯数字（7-20 位）或带 + / - / 空格 的号码形态
  if (/^\+?\d[\d\s-]{6,19}$/.test(s)) return true
  // 3) 含大量数字：避免把“138****”这种当昵称
  const digits = (s.match(/\d/g) || []).length
  return digits >= 7 && digits / s.length > 0.45
}

function normalizeWechatNickname(input: string, fallback: string): string {
  const s = (input || '').trim()
  if (!s) return (fallback || '').trim()
  if (isPhoneLikeName(s)) return (fallback || '').trim() || '联系人'
  return s
}

function isSentenceLikeNickname(v: string): boolean {
  const s = (v || '').trim()
  if (!s) return true
  if (s.length > 8) return true
  if (/[，。！？；、,.!?;:：]/.test(s)) return true
  if (/谢谢|别|不要|远点|滚|离我|求你|拜托|拒绝|勿扰/.test(s)) return true
  return false
}

function normalizeForCompare(v: string): string {
  return (v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** 用户未勾选关系标签时的提示语：额外联系人随机多样化；绑定 NPC 仍由固定列表约束 */
function contactBiasPromptClause(bias: string): string {
  const t = (bias || '').trim()
  if (t) return t
  return '用户未指定关系标签：请在「额外联系人」上随机、多样化地组合常见微信社交关系（如同事、朋友、家人、网友、暧昧、恋人向等），勿让所有额外联系人同质化；已绑定的人脉 NPC 必须全部出现在通讯录中，characterId 与固定列表一致、不得遗漏或替换。'
}

async function repairExtraContactsByModel(params: {
  cfg: ApiConfig
  system: string
  guard: string
  bias: string
  contacts: Array<{
    id: string
    avatarBucket?: ExtraAvatarBucket
    nickname?: string
    remarkName: string
    blocked?: boolean
  }>
}): Promise<typeof params.contacts> {
  const bad = params.contacts
    .filter((c) => {
      const nick = (c.nickname || '').trim()
      const remark = (c.remarkName || '').trim()
      return !nick || !remark || isPhoneLikeName(nick) || isPhoneLikeName(remark) || isSentenceLikeNickname(nick)
    })
    .slice(0, 80)
  if (!bad.length) return params.contacts

  const payload = await askModelJsonWithRetry<{ fixes: Array<{ id: string; nickname: string; remarkName: string }> }>(
    params.cfg,
    `${params.system}\n\n${params.guard}`,
    `
请为“额外联系人”（非绑定 NPC）修正微信昵称与备注。
背景：这些联系人是角色通讯录里的“额外联系人”，需要像真实微信一样自然。
要求：
1) 对每个 id 输出 nickname 与 remarkName。
2) nickname = 对方自己的微信昵称（简短称呼，建议 2-8 字），不要手机号、不要纯数字、不要像编号。
   - 禁止把“态度句/完整句”当昵称（如“离我远点谢谢”“别加了”这类句子）。
   - 禁止把个性签名、警告语、朋友圈文案写进 nickname。
3) remarkName = 我（角色）给对方的备注（要贴合我的人设与关系偏向：${contactBiasPromptClause(params.bias)}），不要手机号/编号。
4) 不要输出任何电话号码形态、纯数字、或像“+8613…”这类串。
5) 每条 fix 必须严格匹配输入 id。
6) remarkName 风格尽量只用以下四类，避免花哨格式：
   - 真实名字：如“张三”“李四”
   - A 开头备注：如“AAA老妈”“Aaaa大笨蛋”“AAA房产小周”
   - 称号型：如“老周”“小李”“王女士”“我的宝宝”“最爱的宝贝”“最爱的李女士”“最爱的张先生”
   - 熟人外号：如“李大头”“老烟枪”“奶茶搭子”
7) 禁止在 remarkName 里频繁使用括号；不要输出包含 ()（）[]【】 的备注。
8) 上述示例仅用于风格参考，禁止逐字照搬；也禁止只替换1-2个字的近似照搬。
9) AAA 前缀规则（严格执行）：
   - 仅当关系是家人、挚友、恋人、暧昧等亲密关系时，才允许 AAA 前缀。
   - 若关系是前任、私生、仇人、对家、竞争对手、厌恶对象等负向关系，禁止 AAA 前缀。
输入（需要修正的联系人）：
${JSON.stringify(
  bad.map((c) => ({
    id: c.id,
    avatarBucket: c.avatarBucket,
    nickname: (c.nickname || '').trim(),
    remarkName: (c.remarkName || '').trim(),
    blocked: c.blocked,
  })),
  null,
  2,
)}
返回格式：
{"fixes":[{"id":"extra:xxx","nickname":"...","remarkName":"..."}]}
`.trim(),
    1000,
  )

  const fixMap = new Map((payload.fixes || []).map((x) => [String(x.id || '').trim(), x] as const))
  return params.contacts.map((c) => {
    const f = fixMap.get(c.id)
    if (!f) return c
    const nickname = String((f as any).nickname || '').trim()
    const remarkName = String((f as any).remarkName || '').trim()
    return {
      ...c,
      nickname: nickname && !isPhoneLikeName(nickname) ? nickname : c.nickname,
      remarkName: remarkName && !isPhoneLikeName(remarkName) ? remarkName : c.remarkName,
    }
  })
}

async function removeUserDuplicateContactsByModel(params: {
  cfg: ApiConfig
  system: string
  guard: string
  playerWechatNickname: string
  playerIdentityName: string
  contacts: Array<{
    id: string
    nickname?: string
    remarkName: string
    characterId?: string
  }>
}): Promise<Set<string>> {
  const pool = params.contacts
    .filter((c) => !c.characterId?.trim())
    .map((c) => ({
      id: c.id,
      nickname: (c.nickname || '').trim(),
      remarkName: (c.remarkName || '').trim(),
    }))
  if (!pool.length) return new Set<string>()

  try {
    const payload = await askModelJsonWithRetry<{ removeIds: string[] }>(
      params.cfg,
      `${params.system}\n\n${params.guard}`,
      `
你要做一件事：找出“被误生成为用户本人分身”的联系人并删除。
规则（必须严格）：
1) 用户联系人在通讯录里只能有 1 个，且由系统固定注入，不应再出现在额外联系人里。
2) 若某联系人本质上是在影射/重复“用户本人”，其 id 必须放进 removeIds。
3) 宁可少删，也不要误删普通联系人；只删除高度确定是“用户分身”的项。
用户信息：
- 微信显示名：${params.playerWechatNickname || '你'}
- 真实姓名（参考）：${params.playerIdentityName || '（未知）'}
候选联系人：
${JSON.stringify(pool, null, 2)}
返回格式：
{"removeIds":["id1","id2"]}
`.trim(),
      900,
      2,
    )
    const out = new Set<string>()
    for (const id of payload.removeIds || []) {
      const s = String(id || '').trim()
      if (s) out.add(s)
    }
    return out
  } catch {
    return new Set<string>()
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

async function generateSingleNpcRemarkByModel(params: {
  cfg: ApiConfig
  system: string
  guard: string
  generationSeed: string
  npc: {
    characterId: string
    realName: string
    identity?: string
    relationRemark?: string
    wechatNickname?: string
    avatarUrl?: string
  }
}): Promise<{ remarkName: string; isStarred: boolean; blocked?: boolean } | null> {
  try {
    const payload = await askModelJsonWithRetry<{ remarkName: string; isStarred?: boolean; blocked?: boolean }>(
      params.cfg,
      `${params.system}\n\n${params.guard}`,
      `
只为这个绑定 NPC 生成一条通讯录结果（角色视角）：
本次生成批次标识：${params.generationSeed}
NPC:
${JSON.stringify(params.npc, null, 2)}
要求：
1) 只输出 remarkName、isStarred，可选 blocked。
2) remarkName 必须是角色对该 NPC 的称呼，不要全名复读，不要手机号，不要括号。
3) isStarred 由角色主观判断。
4) blocked 是可选项：仅当近期剧情/对话明确出现严重冲突时才可设为 true，否则可不输出。
返回格式：
{"remarkName":"...","isStarred":true,"blocked":false}
`.trim(),
      260,
      2,
    )
    const remarkName = (payload.remarkName || '').trim()
    if (!remarkName) return null
    return { remarkName, isStarred: !!payload.isStarred, blocked: typeof payload.blocked === 'boolean' ? payload.blocked : undefined }
  } catch {
    return null
  }
}

export async function generateSpyWechatData(params: {
  apiConfig: ApiConfig | null
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  options: SpyWechatGenerateOptions
  scope?: 'chats' | 'contacts' | 'moments' | 'me'
  avoidContactIds?: string[]
}): Promise<SpyWechatGeneratedData> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) throw new Error('未配置 AI API')

  const cid = params.characterId.trim()
  const piid = params.playerIdentityId.trim()
  const character = cid ? ((await personaDb.getCharacter(cid)) as Character | null) : null
  const playerIdentity =
    piid && piid !== '__none__' ? ((await personaDb.getPlayerIdentity(piid)) as PlayerIdentity | null) : null
  const currentWechatProfile = readCurrentWechatProfile()
  const playerWechatNickname =
    (currentWechatProfile.displayName || playerIdentity?.wechatNickname || params.playerDisplayName || '你').trim()
  const playerWechatAvatarUrl = currentWechatProfile.avatarImageUrl
  const playerIdentityName = (playerIdentity?.name || params.playerDisplayName || '你').trim()
  const playerContactId = `player:${piid || 'current'}`

  let worldBackgroundPrompt: string | undefined
  if (character?.worldBackgroundId?.trim()) {
    const bg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
    const block = formatWorldBackgroundForPrompt(bg)
    if (block.trim()) worldBackgroundPrompt = block
  }

  const promptMode = params.useLumiProjectAssistantPrompt ? 'lumi-assistant' : 'persona'
  const scope = params.scope ?? 'chats'
  const isContactsOnlyScope = scope === 'contacts'
  const memoryNotes = isContactsOnlyScope ? undefined : (await personaDb.formatCharacterMemoriesForPrompt(cid)).trim() || undefined
  const recentChatRows = isContactsOnlyScope ? [] : await personaDb.listWeChatChatMessagesRecentByCharacter({ characterId: cid, limit: 50 })
  const recentMsgText = recentChatRows
    .map((m) => `${m.type === 'player' ? '用户' : '角色'}: ${m.content}`)
    .join('\n')
    .slice(0, 5000)
  const offlineDatingPlotsContext =
    isContactsOnlyScope || promptMode !== 'persona' || !cid ? '' : await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null)
  const offlineDatingTop5 = pickOfflinePlotsTopLines(offlineDatingPlotsContext, 5)
  const [globalSettings, roleTimeSettings] = await Promise.all([
    personaDb.getGlobalSettings(),
    cid ? personaDb.getCharacterTimeSettings(cid) : Promise.resolve(null),
  ])
  const activeTimeConfig = roleTimeSettings?.config ?? globalSettings.globalTimeConfig
  const currentWechatNowMs = resolveWeChatCurrentTimeMs(activeTimeConfig)
  const currentWechatNowText = new Date(currentWechatNowMs).toLocaleString('zh-CN', { hour12: false })
  const activeTimeModeLabel = activeTimeConfig.mode === 'custom' ? '自定义时间' : '系统时间'

  const baseSystem = buildSystemContent({
    character,
    playerIdentity,
    playerDisplayName: playerWechatNickname || params.playerDisplayName.trim() || '朋友',
    promptMode,
    longTermMemoryNotes: memoryNotes,
    worldBackgroundPrompt,
    offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
  })
  const contactsSystem = buildSystemContent({
    character,
    playerIdentity,
    playerDisplayName: playerWechatNickname || params.playerDisplayName.trim() || '朋友',
    promptMode,
    worldBackgroundPrompt,
  })

  const o = params.options
  const generationMode = o.generationMode === 'update' ? 'update' : 'generate'
  const currentContactsSnapshot = Array.isArray(o.currentContactsSnapshot) ? o.currentContactsSnapshot.slice(0, 200) : []
  const needContacts = scope === 'chats' || scope === 'contacts'
  const needMessages = scope === 'chats'
  const needMoments = scope === 'moments'
  const needFinancial = scope === 'me'

  const boundNpcs = (await personaDb.listNpcsFor(cid)).filter((x) => x?.id && x.generatedForCharacterId === cid)
  const playerLinks = cid ? await personaDb.getPlayerNetworkLinks(cid) : []
  const playerLink = playerLinks.find((x) => x.characterId === cid)
  const boundNpcSeedList = boundNpcs.slice(0, 50).map((n) => ({
    characterId: n.id,
    realName: (n.name || '').trim(),
    identity: (n.identity || '').trim(),
    relationRemark: (n.remark || '').trim(),
    wechatNickname: (n.wechatNickname || '').trim(),
    avatarUrl: (n.avatarUrl || '').trim(),
  }))

  const strictGuard = `
输出硬性规则：
- 所有内容必须贴合角色人设、最近对话、长期记忆，不得 OOC。
- “谁给谁红包/转账/礼物”方向绝对不能写反。
- 金额风格硬约束（红包/转账/账单）：
  - 若角色设定为已工作/有稳定收入：涉及**红包**时 amountYuan **不得低于 50**；转账/账单单笔也至少 50 元档较合理，100~999 为常态。
  - **禁止**把 5.2、13.14、8.88 等「十几块还带小数」当真诚补偿或哄人手段（显得抠）；若要谐音式心意，**至少**用 52 元档或整数（66、88、188 等），不要用 5.2 这种。诚意更重时优先写**转账**三位数（如 520），不要只塞寒酸红包。
  - 道歉、哄人、补偿场景不要**反复**用同一套 66.66 等小数吉利数刷屏；可轮换整数金额以显真实。
  - 仅当角色明确为学生/拮据/低收入设定时，才允许大量 50 元以下小额。
- 用户在当前微信环境中的显示名固定为「${playerWechatNickname || '你'}」，聊天记录、朋友圈点赞、评论、提及用户时都必须统一使用这个名字，不要改用真实姓名。
- 只输出 JSON 对象，不要 markdown，不要解释。
- 本次模式：${generationMode === 'update' ? '更新模式（优先延续既有数据）' : '生成模式（可完整重建）'}。
最近对话摘录：
${recentMsgText || '（暂无）'}
线下剧情关键片段（最多5条）：
${offlineDatingTop5 || '（暂无）'}
当前微信时间模式：${activeTimeModeLabel}
当前微信时间：${currentWechatNowText}
`.trim()
  const contactsStrictGuard = `
输出硬性规则：
- 所有内容必须贴合角色人设、世界观背景与绑定 NPC 关系，不得 OOC。
- 通讯录只需要生成联系人基础信息，不需要补充聊天、事件经过或长段剧情解释。
- 用户在当前微信环境中的显示名固定为「${playerWechatNickname || '你'}」，不要改用真实姓名。
- 只输出 JSON 对象，不要 markdown，不要解释。
- 本次模式：${generationMode === 'update' ? '更新模式（总体联系人尽量保持不变，只更新备注/星标/可选拉黑）' : '生成模式'}。
`.trim()
  const contactsPromptSystem = scope === 'contacts' ? contactsSystem : baseSystem
  const contactsPromptGuard = scope === 'contacts' ? contactsStrictGuard : strictGuard

  const avoidIds = (params.avoidContactIds || []).filter((x) => typeof x === 'string' && !!x.trim()).slice(0, 120)
  const generationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const profileAndContacts = needContacts
    ? await (async () => {
        const baseSchema = {
          profile: undefined as unknown as SpyWechatGeneratedData['profile'],
          contacts: [] as Array<{
            id: string
            nickname?: string
            remarkName: string
            avatarBucket?: ExtraAvatarBucket
            isStarred?: boolean
            blocked?: boolean
            characterId?: string
            relationshipNote?: string
            remarkWhy?: string
          }>,
        }

        // contacts scope：绑定 NPC 本地注入，模型只负责两件事：
        // 1) 给绑定 NPC 生成“角色视角备注”；2) 补充额外联系人。
        if (scope === 'contacts') {
          const boundNpcIds = boundNpcSeedList.map((x) => x.characterId).filter(Boolean)
          const npcRemarkMap = new Map<string, string>()
          if (boundNpcSeedList.length) {
            const npcRemarks = await askModelJsonWithRetry<{ remarks: Array<{ characterId: string; remarkName: string; isStarred: boolean; blocked?: boolean }> }>(
              cfg,
              `${contactsPromptSystem}\n\n${contactsPromptGuard}`,
              `
只为绑定 NPC 生成“通讯录备注 remarkName + 是否星标 isStarred + 可选 blocked 更新”（角色视角）。
本次生成批次标识：${generationSeed}
要求：
1) 仅输出 remarks 数组，不要输出 contacts。
2) 每条 remarks 必须带 characterId 且来自下方列表。
3) remarkName 必须基于 NPC 的真实姓名 realName 与双方关系来生成，不要根据 wechatNickname 直接改写或照抄。
4) remarkName 必须是角色主观视角的称呼（可含关系、情绪、外号），但避免过长（建议 2-10 字）。
5) remarkName 风格尽量只用以下四类，避免花哨格式：
   - 真实名字：如“张三”“李四”
   - A 开头备注：如“AAA老妈”“Aaaa大笨蛋”“AAA房产小周”
   - 称号型：如“老周”“小李”“王女士”
   - 熟人外号：如“李大头”“老烟枪”“奶茶搭子”
6) 禁止在 remarkName 里频繁使用括号；不要输出包含 ()（）[]【】 的备注。
7) 示例仅用于风格参考，禁止逐字照搬；也禁止只替换1-2个字的近似照搬。
8) 必须读取 relationRemark / identity 判断亲疏：
   - 若关系是发小/青梅竹马/死党/闺蜜/兄弟/恋人/暧昧等亲密关系，禁止使用“全名直呼”与商务称呼（如“李总”“李老板”“王经理”）。
   - 亲密关系优先用外号、亲昵称呼、关系内梗称呼（如“阿卫”“卫崽”“奶茶搭子”“发小卫”）。
   - 仅当关系明确疏远或正式商务时，才允许“某总/某老板/全名”。
9) AAA 前缀规则（严格执行）：
   - 仅当关系是家人、挚友、恋人、暧昧等亲密关系时，才允许 AAA 前缀。
   - 若关系是前任、私生、仇人、对家、竞争对手、厌恶对象等负向关系，禁止 AAA 前缀。
10) isStarred 必须由角色主观判断：
   - 对角色非常重要/高频联系/高信任的联系人设为 true。
   - 普通关系、负向关系或低频关系通常设为 false。
11) blocked 更新规则（可选，不是必选）：
   - 只有在近期对话/线下剧情明确出现严重矛盾、决裂、拉黑语义时，才可输出 blocked=true。
   - 若无明确冲突证据，可不输出 blocked 字段，或输出 false。
绑定 NPC 列表：
${JSON.stringify(boundNpcSeedList, null, 2)}
返回格式：
{"remarks":[{"characterId":"npc_xxx","remarkName":"...","isStarred":true,"blocked":false}]}
`.trim(),
              900,
            )
            for (const row of npcRemarks.remarks || []) {
              const id = (row.characterId || '').trim()
              const remark = (row.remarkName || '').trim()
              if (id && remark) {
                npcRemarkMap.set(
                  id,
                  JSON.stringify({
                    remarkName: remark,
                    isStarred: !!(row as any).isStarred,
                    blocked: typeof (row as any).blocked === 'boolean' ? !!(row as any).blocked : undefined,
                  }),
                )
              }
            }
            const missingIds = boundNpcSeedList
              .map((x) => x.characterId)
              .filter((id) => id && !npcRemarkMap.has(id))
            if (missingIds.length) {
              const missingList = boundNpcSeedList.filter((x) => missingIds.includes(x.characterId))
              const refill = await askModelJsonWithRetry<{ remarks: Array<{ characterId: string; remarkName: string; isStarred: boolean; blocked?: boolean }> }>(
                cfg,
                `${contactsPromptSystem}\n\n${contactsPromptGuard}`,
                `
补生成“遗漏的绑定 NPC 通讯录备注 remarkName + 是否星标 isStarred + 可选 blocked”。
本次生成批次标识：${generationSeed}
要求：
1) 仅输出 remarks 数组，不要输出 contacts。
2) 每条 remarks 必须带 characterId 且来自下方遗漏列表。
3) remarkName 仍须符合前述风格规则，并严格避免手机号/编号/括号样式。
4) isStarred 仍须由角色主观判断并输出 true/false。
5) blocked 为可选项（不是必选）：仅当剧情明确冲突时才可 true。
遗漏 NPC 列表：
${JSON.stringify(missingList, null, 2)}
返回格式：
{"remarks":[{"characterId":"npc_xxx","remarkName":"...","isStarred":true,"blocked":false}]}
`.trim(),
                700,
                2,
              )
              for (const row of refill.remarks || []) {
                const id = (row.characterId || '').trim()
                const remark = (row.remarkName || '').trim()
                if (id && remark) {
                  npcRemarkMap.set(
                    id,
                    JSON.stringify({
                      remarkName: remark,
                      isStarred: !!(row as any).isStarred,
                      blocked: typeof (row as any).blocked === 'boolean' ? !!(row as any).blocked : undefined,
                    }),
                  )
                }
              }
            }
            const stillMissingIds = boundNpcSeedList
              .map((x) => x.characterId)
              .filter((id) => id && !npcRemarkMap.has(id))
            for (const id of stillMissingIds) {
              const npc = boundNpcSeedList.find((x) => x.characterId === id)
              if (!npc) continue
              const one = await generateSingleNpcRemarkByModel({
                cfg,
                system: contactsPromptSystem,
                guard: contactsPromptGuard,
                generationSeed,
                npc,
              })
              if (one?.remarkName) {
                npcRemarkMap.set(id, JSON.stringify({ remarkName: one.remarkName, isStarred: !!one.isStarred }))
              }
            }
          }

          const localBoundContacts: typeof baseSchema.contacts = boundNpcs.map((npc) => {
            const id = (npc.id || '').trim()
            const nickname = (npc.wechatNickname || npc.name || '').trim()
            const rawFromModel = npcRemarkMap.get(id)
            const parsedFromModel = rawFromModel ? tryParseJsonObject<{ remarkName: string; isStarred?: boolean; blocked?: boolean }>(rawFromModel) : null
            const remarkFromModel = (parsedFromModel?.remarkName || '').trim()
            const starredFromModel = typeof parsedFromModel?.isStarred === 'boolean' ? parsedFromModel.isStarred : undefined
            const blockedFromModel = typeof parsedFromModel?.blocked === 'boolean' ? parsedFromModel.blocked : undefined
            const fallbackRemark = (npc.name || nickname || '联系人').trim()
            return {
              id,
              nickname,
              remarkName: (remarkFromModel || fallbackRemark || npc.name || nickname || '联系人').trim(),
              isStarred: starredFromModel,
              blocked: o.includeBlocked ? (blockedFromModel ?? npc.isBlocked ?? undefined) : false,
              characterId: id,
            }
          })

          const profile: SpyWechatGeneratedData['profile'] = {
            nickname: (character?.wechatNickname || character?.name || '').trim(),
            avatarUrl: (character?.avatarUrl || '').trim() || undefined,
            signature: (character?.wechatSignature || '').trim(),
          }

          const extraTarget = Math.max(0, o.contactCount - localBoundContacts.length)
          if (!extraTarget) return { profile, contacts: localBoundContacts }

          const genExtraBatch = async (count: number, idPrefix: string, extraAvoid: string[]) =>
            askModelJsonWithRetry<{ profile: SpyWechatGeneratedData['profile']; contacts: typeof baseSchema.contacts }>(
              cfg,
              `${contactsPromptSystem}\n\n${contactsPromptGuard}`,
              `
只生成“额外联系人” contacts（不要输出绑定 NPC）。
要求：
1) 只输出 contacts；profile 字段必须存在但可为空字符串（保持 schema）。
2) 额外联系人数量约 ${count}。
3) 每个联系人 characterId 必须为空（不要绑定 NPC）。
4) nickname 必须给出，且必须像真实微信昵称（简短称呼，建议 2-8 字），严禁手机号、严禁纯数字、严禁“编号式”。
   - 禁止“态度句/完整句”昵称（如“离我远点谢谢”“别加了”）。
   - 禁止把签名文案、警告语、整句口号写作 nickname。
5) remarkName 必须给出，且必须是角色视角称呼，贴合关系偏向：${contactBiasPromptClause(o.contactBias)}；严禁手机号/编号。
5.1) 每条「额外联系人」必须与 remarkName 同一次输出、不得另起一轮补写：除 nickname/remarkName 等外，必须给出下列字符串字段（各 1-2 句，使用“我/TA”口吻；通讯录归属固定为“角色自己的手机”，严禁写成“用户/您/你的通讯录”，不要提 AI/系统/生成）：
   - relationshipNote：概括我与 TA 的大致关系、亲疏、常见场景（如同事/家人/朋友/网友/暧昧/已疏远等），便于日后对话被问及时自洽回答。
   - remarkWhy：解释我为何在通讯录里用当前这种备注风格称呼 TA（可含习惯、气话、商务简称、关系梗等），与 remarkName 强一致，能回答“为什么这样备注”。
6) remarkName 风格尽量只用以下四类，避免花哨格式：
   - 真实名字：如“张三”“李四”
   - A 开头备注：如“AAA老妈”“Aaaa大笨蛋”“AAA房产小周”
   - 称号型：如“老周”“小李”“王女士”
   - 熟人外号：如“李大头”“老烟枪”“奶茶搭子”
7) 禁止在 remarkName 里频繁使用括号；不要输出包含 ()（）[]【】 的备注。
8) AAA 前缀规则（严格执行）：
   - 仅当关系是家人、挚友、恋人、暧昧等亲密关系时，才允许 AAA 前缀。
   - 若关系是前任、私生、仇人、对家、竞争对手、厌恶对象等负向关系，禁止 AAA 前缀。
9) isStarred 必须由角色主观判断：非常重要/高频联系/高信任设为 true，其余多为 false。
10) blocked 字段遵循配置：${o.includeBlocked ? '允许少量出现 true' : '必须为 false'}。
11) 必须给出 avatarBucket，且只能取：
   abstract | maleE | elderFemale | elderMale | maleI | femaleCute | femaleCool
12) id 必须以 "${idPrefix}" 开头，且不得与禁止列表重复。
13) 若绑定 NPC 中已存在某“职业/关系位”（例如经纪人/助理/老师/家人等），额外联系人禁止重复生成同位角色；优先沿用绑定 NPC 作为该关系位唯一联系人。
14) “用户本人”在通讯录只能出现 1 次：禁止把用户再生成为额外联系人，不要新增“用户分身”。
禁止 id 列表（必须严格避开）：${JSON.stringify(extraAvoid)}
返回格式：
{
  "profile": {"nickname":"","avatarUrl":"","signature":""},
  "contacts":[{"id":"${idPrefix}xxx","nickname":"","remarkName":"","relationshipNote":"","remarkWhy":"","avatarBucket":"femaleCool","isStarred":false,"blocked":false,"characterId":""}]
}
`.trim(),
              1300,
            )

          const baseAvoid = Array.from(new Set([...avoidIds, ...boundNpcIds])).slice(0, 180)
          if (extraTarget >= 12) {
            const batch1 = Math.ceil(extraTarget / 2)
            const batch2 = extraTarget - batch1
            const first = await genExtraBatch(batch1, 'extra:b1:', baseAvoid)
            const secondAvoid = Array.from(new Set([...baseAvoid, ...(first.contacts || []).map((c) => c.id).filter(Boolean)])).slice(0, 220)
            const second = batch2 > 0 ? await genExtraBatch(batch2, 'extra:b2:', secondAvoid) : { profile, contacts: [] as typeof baseSchema.contacts }
            return {
              profile,
              contacts: [...localBoundContacts, ...(first.contacts || []), ...(second.contacts || [])],
            }
          }

          const only = await genExtraBatch(extraTarget, 'extra:c:', baseAvoid)
          return {
            profile,
            contacts: [...localBoundContacts, ...(only.contacts || [])],
          }
        }

        return await askModelJsonWithRetry<{
          profile: SpyWechatGeneratedData['profile']
          contacts: typeof baseSchema.contacts
        }>(
          cfg,
          `${contactsPromptSystem}\n\n${contactsPromptGuard}`,
          `
先只生成「profile + contacts 基础信息（不含 messages）」。
要求：
1) 必须包含我绑定的人脉 NPC（见下方固定列表），这些 NPC 的 characterId 不得修改。
2) 联系人总量约 ${o.contactCount}（在固定 NPC 之外可补充少量“额外联系人”）。
3) 有聊天记录的联系人至少准备 ${o.chatContactsCount} 个（后续会补 messages）。
4) 联系人偏向：${contactBiasPromptClause(o.contactBias)}。
5) 是否包含拉黑联系人：${o.includeBlocked ? '是' : '否'}。
6) 若为“额外联系人”（characterId 为空），必须给出 avatarBucket（用于从本地头像文件夹挑头像），avatarBucket 只能取：
   abstract | maleE | elderFemale | elderMale | maleI | femaleCute | femaleCool
7) 备注名 remarkName 必须是我（角色）视角会给对方取的称呼（可含关系/外号/情绪），且要贴合该 NPC 或该联系人人设。
7.1) nickname 必须是“对方自用昵称”，而不是角色对其态度宣言；禁止句子型昵称（如“离我远点谢谢”）。
7.2) 对「额外联系人」（characterId 为空的行）：必须与 nickname/remarkName 同一次输出，并给出 relationshipNote 与 remarkWhy（各 1-2 句、第一人称，含义与「只生成额外联系人」提示 5.1 相同）；绑定 NPC 行不要输出 relationshipNote、remarkWhy。
7.4) 视角硬约束：这里是“角色本人手机里的通讯录镜像”。描述时只允许“我给 TA 的备注/我通讯录里的联系人”语气，禁止输出“您/你的备注、您的通讯录”这类把归属指向用户的说法。
7.3) 对「绑定 NPC」行：不要输出 relationshipNote、remarkWhy，保持 characterId 与列表一致即可。
8) remarkName 风格尽量只用以下四类，避免花哨格式：
   - 真实名字：如“张三”“李四”
   - A 开头备注：如“AAA老妈”“Aaaa大笨蛋”“AAA房产小周”
   - 称号型：如“老周”“小李”“王女士”
   - 熟人外号：如“李大头”“老烟枪”“奶茶搭子”
9) 禁止在 remarkName 里频繁使用括号；不要输出包含 ()（）[]【】 的备注。
10) 示例仅用于风格参考，禁止逐字照搬；也禁止只替换1-2个字的近似照搬。
11) AAA 前缀规则（严格执行）：
   - 仅当关系是家人、挚友、恋人、暧昧等亲密关系时，才允许 AAA 前缀。
   - 若关系是前任、私生、仇人、对家、竞争对手、厌恶对象等负向关系，禁止 AAA 前缀。
12) isStarred 必须由角色主观判断：非常重要/高频联系/高信任设为 true，其余多为 false。
13) 关系强约束：
   - 若联系人与角色是发小/挚友/暧昧/恋人等亲密关系，禁止“全名直呼”和商务称呼（如“李总”“李老板”“王经理”）。
   - 亲密关系必须改用更亲近称呼（外号、昵称、关系梗）。
   - 只有明确商务/上下级关系才可使用“某总/某老板/某经理”。
14) 禁止使用这些 id（避免重复）：${JSON.stringify(avoidIds)}
15) 若绑定 NPC 中已存在某“职业/关系位”（例如经纪人/助理/老师/家人等），额外联系人禁止重复生成同位角色；优先沿用绑定 NPC 作为该关系位唯一联系人。
16) “用户本人”在通讯录只能出现 1 次：禁止把用户再生成为额外联系人，不要新增“用户分身”。
17) blocked（拉黑）为“可选更新项”：
   - 若近期剧情明确冲突升级（决裂/闹僵/拉黑语义），可把对应联系人 blocked 设为 true，并可同步调整其备注语气。
   - 若无明确冲突证据，保持原状态或输出 false，不要为了戏剧性强行大面积拉黑。
18) 若本次为更新模式（${generationMode}）：
   - 总体联系人尽量保持不变，优先更新 remarkName / isStarred / 可选 blocked。
   - 仅当剧情明确提到“新认识的人”时才可新增联系人。
   - 不得将已有联系人直接换人（例如把既有 id 对应的小明改成小红）。
现有通讯录快照（更新模式参考）：
${JSON.stringify(currentContactsSnapshot, null, 2)}
固定 NPC 列表（必须全部包含；nickname/avatarUrl 仅作参考，最终以前端数据库为准）：
${JSON.stringify(boundNpcSeedList, null, 2)}
返回格式：
{
  "profile": {"nickname":"","avatarUrl":"","signature":""},
  "contacts":[
   {"id":"","nickname":"","remarkName":"","relationshipNote":"","remarkWhy":"","avatarBucket":"femaleCool","isStarred":true,"blocked":false,"characterId":""},
   {"id":"npc_bind","nickname":"","remarkName":"","avatarBucket":"maleE","isStarred":false,"blocked":false,"characterId":"..."}
  ]
}
`.trim(),
          2200,
        )
      })()
    : { profile: undefined as unknown as SpyWechatGeneratedData['profile'], contacts: [] }

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
  const chatTargets = needMessages ? contactIds.slice(0, Math.max(1, Math.min(o.chatContactsCount, contactIds.length))) : []

  const messagesByContact = new Map<string, SpyWechatGeneratedData['contacts'][number]['messages']>()
  for (const cidOne of chatTargets) {
    if (cidOne !== playerContactId) continue
    // 用户<->角色这条会话严格复用现有私聊记录，不再额外生成，避免与用户视角聊天室对不上。
    const copied = recentChatRows
      .map((m) => ({
        from: (m.type === 'player' ? 'player' : 'character') as 'player' | 'character',
        content: String(m.content || '').trim(),
        timestamp: Number(m.timestamp || Date.now()),
        special: m.redPacket
          ? {
              kind: 'red_packet' as const,
              amountYuan: Number(m.redPacket.amountYuan || 0),
              remark: String(m.redPacket.remark || '').trim(),
              opened: !!m.redPacket.opened,
            }
          : m.transfer
            ? { kind: 'transfer' as const, transferId: m.transfer.transferId, note: String(m.content || '').trim() || '微信转账' }
            : Array.isArray(m.images) && m.images.length
              ? {
                  kind: 'image' as const,
                  imageUrl: m.images[0]?.base64 ? `data:${m.images[0].type};base64,${m.images[0].base64}` : undefined,
                  mime: m.images[0]?.type,
                }
              : /表情|动画表情|\[.+\]/.test(String(m.content || '').trim())
                ? { kind: 'sticker' as const, label: String(m.content || '').trim() || '[表情]' }
                : undefined,
      }))
      .filter((x) => !!x.content || !!x.special)
    messagesByContact.set(cidOne, normalizeMessageTimestamps(copied, currentWechatNowMs))
  }

  const aiChatTargets = chatTargets.filter((cidOne) => cidOne !== playerContactId)
  // 并发生成镜像消息，避免联系人较多时串行阻塞；限制并发=3，兼顾速度与稳定性。
  const MAX_CHAT_GEN_CONCURRENCY = 3
  for (let i = 0; i < aiChatTargets.length; i += MAX_CHAT_GEN_CONCURRENCY) {
    const batch = aiChatTargets.slice(i, i + MAX_CHAT_GEN_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (cidOne) => {
        const payload = await askModelJsonWithRetry<{ messages: Array<{ from: 'player' | 'character'; content: string; timestamp: number }> }>(
          cfg,
          `${baseSystem}\n\n${strictGuard}`,
          `
只为联系人 ${cidOne} 生成聊天记录。
要求：
1) 消息气泡不少于 ${o.minMessagesPerContact} 条。
2) from 仅允许 "player" 或 "character"。
3) 生成时必须参考：角色与NPC世界书、人脉关系、角色最近50条对话、线下剧情前5条；并符合当前用户与角色状态，不能脱离角色人设。
4) 时间戳必须基于当前微信时间模式（${activeTimeModeLabel}）与当前微信时间（${currentWechatNowText}）生成，保持近期合理分布；禁止输出陈年旧记录时间。
5) 若消息内容涉及红包/转账金额表达，遵循 strictGuard：有收入者红包>=50，禁 5.2 类抠门谐音；可 52/整数或转账 520 档。
6) 可混入少量“特殊消息”：
   - 红包：special={"kind":"red_packet","amountYuan":188,"remark":"...","opened":true}
   - 转账：special={"kind":"transfer","transferId":"t_xxx","amountYuan":188,"note":"...","status":"pending"}
   - 表情包：special={"kind":"sticker","label":"[动画表情]"}
   - 图片：special={"kind":"image","imageUrl":"..."}（无图时可省略 imageUrl）
   普通文本消息可不带 special。
返回格式：
{"messages":[{"from":"character","content":"...","timestamp":1710000000000,"special":{"kind":"sticker","label":"[动画表情]"}}]}
`.trim(),
          1800,
        )
        return [cidOne, normalizeMessageTimestamps(payload.messages || [], currentWechatNowMs)] as const
      }),
    )
    for (const [cidOne, msgs] of batchResults) messagesByContact.set(cidOne, msgs)
  }

  const momentsPayload = needMoments
    ? await askModelJsonWithRetry<{
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
    : { moments: [] as SpyWechatGeneratedData['moments'] }

  const financialPayload = needFinancial
    ? await askModelJsonWithRetry<{
        bills: SpyWechatGeneratedData['bills']
        affectionCards: SpyWechatGeneratedData['affectionCards']
      }>(
        cfg,
        `${baseSystem}\n\n${strictGuard}`,
        `
只生成财务数据：
1) 微信账单流水 bills（含日期/对象/金额/备注）
2) 亲情卡 affectionCards（给谁开通、限额与已用）
3) 金额策略必须遵循 strictGuard：有稳定收入时账单单笔多在 50 以上、100~999 常见；避免大量个位数～十几块带小数的「敷衍感」记录。
4) bills 的 amount 用 number；收入为正、支出为负；金额允许小数但不要刻意“吉利尾数泛滥”。
返回格式：
{
  "bills":[{"id":"","date":"","target":"","amount":-188,"remark":""}],
  "affectionCards":[{"id":"","holder":"","limit":3000,"spent":800}]
}
`.trim(),
        1600,
      )
    : { bills: [] as SpyWechatGeneratedData['bills'], affectionCards: [] as SpyWechatGeneratedData['affectionCards'] }

  // 额外联系人 nickname/remarkName：必须走模型生成；不再用本地回退去“糊住”
  const repairedContacts = await repairExtraContactsByModel({
    cfg,
    system: contactsPromptSystem,
    guard: contactsPromptGuard,
    bias: o.contactBias || '',
    contacts: (profileAndContacts.contacts || [])
      .filter((c) => !c.characterId?.trim())
      .map((c) => ({
        id: c.id,
        avatarBucket: normalizeBucket(c.avatarBucket),
        nickname: (c.nickname || '').trim(),
        remarkName: (c.remarkName || '').trim(),
        blocked: c.blocked,
      })),
  })

  const repairedById = new Map(repairedContacts.map((c) => [c.id, c] as const))

  const mergedContactsRaw: SpyWechatGeneratedData['contacts'] = (profileAndContacts.contacts || [])
    .map((c) => {
      const patched = !c.characterId?.trim() ? repairedById.get(c.id) : undefined
      const isExtra = !c.characterId?.trim()
      const relNote = typeof c.relationshipNote === 'string' ? c.relationshipNote.trim() : ''
      const whyNote = typeof c.remarkWhy === 'string' ? c.remarkWhy.trim() : ''
      return {
        id: c.id,
        nickname: patched?.nickname || (c.nickname || '').trim(),
        remarkName: patched?.remarkName || c.remarkName,
        avatarBucket: normalizeBucket(c.avatarBucket),
        avatarUrl: undefined,
        isStarred: c.isStarred,
        blocked: c.blocked,
        characterId: c.characterId,
        relationshipNote: isExtra && relNote ? relNote : undefined,
        remarkWhy: isExtra && whyNote ? whyNote : undefined,
        messages: messagesByContact.get(c.id) || [],
      }
    })

  const mergedContacts: SpyWechatGeneratedData['contacts'] = []
  const npcAvatarReserved = new Set<string>()
  for (const npc of boundNpcs) {
    const direct = (npc.avatarUrl || '').trim()
    if (direct && !isRemoteUrl(direct)) npcAvatarReserved.add(direct)
    const fallback = (pickFromPool(EXTRA_AVATAR_URLS, npc.id || '') || '').trim()
    if (fallback && !isRemoteUrl(fallback)) npcAvatarReserved.add(fallback)
  }
  for (const c of mergedContactsRaw) {
    let nickname = (c.nickname || '').trim()
    let avatarUrl = (c.avatarUrl || '').trim()
    if (c.characterId?.trim()) {
      const npc = (await personaDb.getCharacter(c.characterId.trim())) as Character | null
      if (npc) {
        nickname = normalizeWechatNickname(
          (npc.wechatNickname || '').trim(),
          (npc.name || nickname || c.remarkName || '联系人').trim(),
        )
        avatarUrl = (npc.avatarUrl || avatarUrl).trim()
      }
    }
    // 额外联系人：昵称已要求模型生成并修正，这里不再做本地回退（只做“手机号样式”最终拦截）
    if (!c.characterId?.trim()) {
      if (nickname && (isPhoneLikeName(nickname) || isSentenceLikeNickname(nickname))) nickname = ''
    } else {
      nickname = normalizeWechatNickname(nickname, (c.remarkName || '联系人').trim())
    }
    // 非人脉 NPC：根据 avatarBucket 选择本地头像
    if (!c.characterId?.trim()) {
      const personaText = `${c.remarkName || ''} ${c.nickname || ''}`.trim()
      const inferred = inferAvatarBucketFromPersona(personaText)
      const bucket = inferred || c.avatarBucket
      const pool = bucket ? EXTRA_AVATAR_URLS_BY_BUCKET[bucket] : EXTRA_AVATAR_URLS
      avatarUrl = pickFromPoolAvoid(pool, `${bucket || 'any'}:${c.id}`, npcAvatarReserved) || ''
    }
    // 兜底：人脉 NPC 若仍无头像（例如未设置），也用本地头像池补齐
    if (!avatarUrl) avatarUrl = pickFromPoolAvoid(EXTRA_AVATAR_URLS, c.id, npcAvatarReserved) || ''
    // 防御：无论何种情况，都不允许远程 URL 覆盖“查手机”本地头像设定
    if (avatarUrl && isRemoteUrl(avatarUrl)) avatarUrl = ''
    if (!avatarUrl) avatarUrl = '/image/个人名片默认头像1.png'
    mergedContacts.push({ ...c, nickname, avatarUrl: avatarUrl || undefined })
  }

  // 强制补齐：若模型漏掉绑定 NPC，则把它们补进通讯录（备注先用昵称兜底）
  if (needContacts) {
    const existingNpcIds = new Set(mergedContacts.map((c) => c.characterId).filter(Boolean) as string[])
    for (const npc of boundNpcs) {
      if (!npc?.id) continue
      if (existingNpcIds.has(npc.id)) continue
      mergedContacts.push({
        id: npc.id,
        characterId: npc.id,
        nickname: normalizeWechatNickname((npc.wechatNickname || '').trim(), (npc.name || '联系人').trim()),
        remarkName: (npc.wechatNickname || npc.name || '联系人').trim(),
        avatarUrl: (npc.avatarUrl || pickFromPool(EXTRA_AVATAR_URLS, npc.id) || '/image/个人名片默认头像1.png').trim(),
        isStarred: npc.isStarred ?? undefined,
        blocked: npc.isBlocked ?? undefined,
        messages: [],
      })
    }

    // 角色视角“给用户的备注”：每次现算（不默认用真实姓名）
    let userRemarkFromModel = ''
    try {
      const relationThemToYou = (playerLink?.relationThemToYou || '').trim()
      const relationYouToThem = (playerLink?.relationYouToThem || '').trim()
      const theySeeYou = (playerLink?.theySeeYou || '').trim()
      const payload = await askModelJsonWithRetry<{ remarkName: string }>(
        cfg,
        `${contactsPromptSystem}\n\n${contactsPromptGuard}`,
        `
只生成「我（角色）给用户的通讯录备注 remarkName」。
本次生成批次标识：${generationSeed}
背景：
- 用户在微信里的显示名（昵称）：${playerWechatNickname || '你'}
- 用户真实姓名（仅供参考，禁止直接照抄为备注）：${playerIdentityName || '（未知）'}
- 当前关系（对方→你）：${relationThemToYou || '未设定'}
- 当前关系（你→对方）：${relationYouToThem || '未设定'}
- 角色对用户看法：${theySeeYou || '未设定'}
要求：
1) remarkName 必须体现我与用户当前关系/情绪（亲疏、暧昧、冷战、占有欲、距离感等）。
2) 严禁把用户真实姓名原样当作备注（除非角色性格极端正式且关系疏远，也要加上关系/场景信息）。
3) 长度建议 2-10 字，可含外号/关系称呼/情绪标签，但不要像机器人编号。
4) remarkName 风格尽量只用以下四类，避免花哨格式：
   - 真实名字：如“张三”“李四”
   - A 开头备注：如“AAA老妈”“Aaaa大笨蛋”“AAA房产小周”
   - 称号型：如“老周”“小李”“王女士”
   - 熟人外号：如“李大头”“老烟枪”“奶茶搭子”
5) 禁止在 remarkName 里频繁使用括号；不要输出包含 ()（）[]【】 的备注。
6) 示例仅用于风格参考，禁止逐字照搬；也禁止只替换1-2个字的近似照搬。
7) AAA 前缀规则（严格执行）：
   - 仅当关系是家人、挚友、恋人、暧昧等亲密关系时，才允许 AAA 前缀。
   - 若关系是前任、私生、仇人、对家、竞争对手、厌恶对象等负向关系，禁止 AAA 前缀。
8) 关系强约束（高优先）：
   - 若当前关系是暧昧/恋人/情侣/亲密期，备注绝对不能是普通全名或商务称呼（如“李总”“李老板”“王经理”“李某某”）。
   - 这类亲密关系必须使用亲近称呼（如“小名、昵称、外号、关系内称呼”），体现情绪温度。
   - 只有关系明确为商务、上下级、普通合作时，才允许“某总/某老板/某经理”。
返回格式：
{"remarkName":"..."}
`.trim(),
        320,
        2,
      )
      userRemarkFromModel = (payload?.remarkName || '').trim()
    } catch {
      userRemarkFromModel = ''
    }

    // 强制校准“用户联系人”：
    // - nickname/avatarUrl 只能来自用户真实微信设置（不允许模型乱写）
    // - remarkName 必须是角色视角（不要默认真实姓名）
    // - 用户联系人只能有 1 条，其它“用户分身”要移除
    const existingIdx = mergedContacts.findIndex(
      (c) =>
        c.id === playerContactId ||
        c.id === piid ||
        c.characterId === piid ||
        c.nickname.trim() === playerWechatNickname ||
        c.remarkName.trim() === playerIdentityName ||
        c.remarkName.trim() === playerWechatNickname,
    )
    const existing = existingIdx >= 0 ? mergedContacts[existingIdx] : null
    const preferModelRemark = (userRemarkFromModel || '').trim()
    const copiedUserMessages = normalizeMessageTimestamps(
      recentChatRows
        .map((m) => ({
          from: (m.type === 'player' ? 'player' : 'character') as 'player' | 'character',
          content: String(m.content || '').trim(),
          timestamp: Number(m.timestamp || Date.now()),
          special: m.redPacket
            ? {
                kind: 'red_packet' as const,
                amountYuan: Number(m.redPacket.amountYuan || 0),
                remark: String(m.redPacket.remark || '').trim(),
                opened: !!m.redPacket.opened,
              }
          : m.transfer
            ? { kind: 'transfer' as const, transferId: m.transfer.transferId, note: String(m.content || '').trim() || '微信转账' }
              : Array.isArray(m.images) && m.images.length
                ? {
                    kind: 'image' as const,
                    imageUrl: m.images[0]?.base64 ? `data:${m.images[0].type};base64,${m.images[0].base64}` : undefined,
                    mime: m.images[0]?.type,
                  }
                : /表情|动画表情|\[.+\]/.test(String(m.content || '').trim())
                  ? { kind: 'sticker' as const, label: String(m.content || '').trim() || '[表情]' }
                  : undefined,
        }))
        .filter((x) => !!x.content || !!x.special),
      currentWechatNowMs,
    )
    const playerContact: SpyWechatGeneratedData['contacts'][number] = {
      id: playerContactId,
      characterId: undefined,
      nickname: playerWechatNickname || '你',
      remarkName: (preferModelRemark || playerWechatNickname || '你').trim(),
      avatarUrl: playerWechatAvatarUrl || '/image/个人名片默认头像1.png',
      isStarred: existing?.isStarred,
      blocked: existing?.blocked,
      // 强制以真实私聊记录覆盖，防止混入生成出来的伪“用户会话”。
      messages: copiedUserMessages,
    }
    if (existingIdx >= 0) mergedContacts[existingIdx] = playerContact
    else mergedContacts.unshift(playerContact)

    const removeByModel = await removeUserDuplicateContactsByModel({
      cfg,
      system: contactsPromptSystem,
      guard: contactsPromptGuard,
      playerWechatNickname,
      playerIdentityName,
      contacts: mergedContacts,
    })
    for (let i = mergedContacts.length - 1; i >= 0; i -= 1) {
      const c = mergedContacts[i]
      if (!c || c.id === playerContactId) continue
      if (removeByModel.has(c.id)) mergedContacts.splice(i, 1)
    }

    // 去掉“用户分身”联系人：作为最后防御，除规范用户联系人外，若其他额外联系人命中用户身份关键词则移除
    const userKeys = new Set(
      [playerWechatNickname, playerIdentityName, playerContact.nickname, playerContact.remarkName]
        .map((x) => normalizeForCompare(x || ''))
        .filter(Boolean),
    )
    const boundNpcIdSet = new Set(boundNpcs.map((x) => x.id).filter(Boolean))
    for (let i = mergedContacts.length - 1; i >= 0; i -= 1) {
      const c = mergedContacts[i]
      if (!c || c.id === playerContactId) continue
      if (c.characterId?.trim() && boundNpcIdSet.has(c.characterId.trim())) continue
      const nick = normalizeForCompare(c.nickname || '')
      const remark = normalizeForCompare(c.remarkName || '')
      const fuzzyHit = [...userKeys].some((k) => {
        if (!k || k.length < 2) return false
        return (
          (!!nick && (nick === k || nick.includes(k) || k.includes(nick))) ||
          (!!remark && (remark === k || remark.includes(k) || k.includes(remark)))
        )
      })
      if (fuzzyHit) {
        mergedContacts.splice(i, 1)
      }
    }
  }

  return {
    profile: normalizedProfile,
    contacts: needContacts ? mergedContacts : [],
    moments: momentsPayload.moments || [],
    bills: financialPayload.bills || [],
    affectionCards: financialPayload.affectionCards || [],
  }
}

