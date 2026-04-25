import type { ApiConfig } from '../../api/types'
import type { Character, Gender, PlayerIdentity, PlayerNetworkLink, Relationship, WorldBook, WorldBookItem } from './types'
import { daysInMonth, formatMD, uid, zodiacFromMD } from './utils'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function openAiCompatibleChat(cfg: ApiConfig, messages: ChatMessage[]): Promise<string> {
  const base = cfg.apiUrl.trim().replace(/\/+$/, '')
  const endpoint = /\/v1$/i.test(base) ? `${base}/chat/completions` : /\/v1\/chat\/completions$/i.test(base) ? base : `${base}/v1/chat/completions`
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.modelId || undefined,
      messages,
      temperature: 0.65,
    }),
  })
  const data = (await resp.json()) as { error?: { message?: string }; message?: string; choices?: { message?: { content?: string } }[] }
  if (!resp.ok) {
    const msg = data?.error?.message ?? data?.message ?? `请求失败（HTTP ${resp.status}）`
    throw new Error(typeof msg === 'string' ? msg : '请求失败')
  }
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('返回格式不符合预期')
  return text.trim()
}

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

export type NpcGenerateInput = {
  main: Character
  playerIdentity?: PlayerIdentity | null
  count: number
  relationBiases: string[]
  customNote: string
  /** 主角关联的世界背景（优先于泛化常识，次于主角世界书） */
  worldBackgroundSummary?: string
}

type AiNpcJson = {
  name: string
  gender: string
  age: number
  /** 月-日，如 "08-03"，须与 age、主角年龄时间线自洽 */
  birthdayMD: string
  /** 头像分类：由 AI 按人设智能选择 */
  avatarCategory:
    | '40岁以上长辈头像男'
    | '40岁以上长辈头像女'
    | '微信头像男E型阳光'
    | '微信头像女清冷和御姐'
    | '抽象搞笑男女通用'
    | '微信头像女可爱活泼'
  occupation: string
  interests: string[]
  painPoints: string[]
  mbti: string
  bio: string
  basicSettingEntries: { name: string; content: string }[]
  /** 世界书「当前对你的态度」条目（JSON 字段名保留以兼容旧版提示） */
  firstImpressionEntries: { name: string; content: string }[]
}

type AiRelJson = {
  fromName: string
  toName: string
  relation: string
  fromPerspective: string
  toPerspective: string
}

/** 操作者「你」与图中角色；characterName 须为主角名或某 NPC 的 name，精确匹配。只产出「对方→你」一侧，不写玩家视角。 */
type AiPlayerLinkJson = {
  characterName: string
  /** 该角色→你 的连线中间词；语义为「你是对方的 relationThemToYou」 */
  relationThemToYou: string
  /** 【该角色看你】完整一句 */
  theySeeYou: string
}

type AiPayload = { npcs: AiNpcJson[]; relationships: AiRelJson[]; playerLinks?: AiPlayerLinkJson[] }

const AVATAR_OLDER_MALE = Object.values(
  import.meta.glob('../../../../../image/40岁以上长辈头像男/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)
const AVATAR_OLDER_FEMALE = Object.values(
  import.meta.glob('../../../../../image/40岁以上长辈头像女/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)
const AVATAR_MALE_E_SUNNY = Object.values(
  import.meta.glob('../../../../../image/微信头像男E型阳光/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)
const AVATAR_FEMALE_COOL = Object.values(
  import.meta.glob('../../../../../image/微信头像女清冷和御姐/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)
const AVATAR_ABSTRACT_UNISEX = Object.values(
  import.meta.glob('../../../../../image/抽象搞笑男女通用/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)
const AVATAR_FEMALE_CUTE = Object.values(
  import.meta.glob('../../../../../image/微信头像女可爱活泼/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)

function parseGender(g: string): Gender {
  const x = (g || '').toLowerCase()
  if (x === '男' || x === 'male' || x === 'm') return 'male'
  if (x === '女' || x === 'female' || x === 'f') return 'female'
  return 'other'
}

function pickOne(list: string[]): string {
  if (!list.length) return ''
  return list[Math.floor(Math.random() * list.length)] || ''
}

const ALL_AVATAR_POOL = [
  ...AVATAR_OLDER_MALE,
  ...AVATAR_OLDER_FEMALE,
  ...AVATAR_MALE_E_SUNNY,
  ...AVATAR_FEMALE_COOL,
  ...AVATAR_ABSTRACT_UNISEX,
  ...AVATAR_FEMALE_CUTE,
]

/** 同一批生成内头像 URL 不重复；本池用尽再扩到全库，仍用尽则允许重复兜底 */
function pickFromUnused(pool: string[], used: Set<string>): string | null {
  const free = pool.filter((u) => u && !used.has(u))
  if (!free.length) return null
  const url = pickOne(free)
  if (url) used.add(url)
  return url
}

function pickNpcAvatar(npc: AiNpcJson, gender: Gender, used: Set<string>): string {
  const tryPools = (pools: string[][]): string => {
    for (const p of pools) {
      const u = pickFromUnused(p, used)
      if (u) return u
    }
    return ''
  }

  const primary: string[][] = (() => {
    switch (npc.avatarCategory) {
      case '40岁以上长辈头像男':
        return [[...AVATAR_OLDER_MALE], [...AVATAR_MALE_E_SUNNY, ...AVATAR_ABSTRACT_UNISEX]]
      case '40岁以上长辈头像女':
        return [[...AVATAR_OLDER_FEMALE], [...AVATAR_FEMALE_COOL, ...AVATAR_FEMALE_CUTE, ...AVATAR_ABSTRACT_UNISEX]]
      case '微信头像男E型阳光':
        return [[...AVATAR_MALE_E_SUNNY], [...AVATAR_ABSTRACT_UNISEX, ...AVATAR_OLDER_MALE]]
      case '微信头像女清冷和御姐':
        return [[...AVATAR_FEMALE_COOL], [...AVATAR_FEMALE_CUTE, ...AVATAR_ABSTRACT_UNISEX]]
      case '抽象搞笑男女通用':
        return [[...AVATAR_ABSTRACT_UNISEX]]
      case '微信头像女可爱活泼':
        return [[...AVATAR_FEMALE_CUTE], [...AVATAR_FEMALE_COOL, ...AVATAR_ABSTRACT_UNISEX]]
      default:
        return []
    }
  })()

  let url = tryPools(primary)
  if (url) return url

  url = pickFromUnused([...ALL_AVATAR_POOL], used) || ''
  if (url) return url

  if (gender === 'male') return pickOne(AVATAR_MALE_E_SUNNY) || pickOne(AVATAR_ABSTRACT_UNISEX) || pickOne(ALL_AVATAR_POOL)
  if (gender === 'female') return pickOne(AVATAR_FEMALE_COOL) || pickOne(AVATAR_FEMALE_CUTE) || pickOne(ALL_AVATAR_POOL)
  return pickOne(ALL_AVATAR_POOL)
}

/** 正文中不出现「玩家」，统一为「你」（修正模型偶发用词） */
function noPlayerWord(s: string): string {
  return String(s || '').replace(/玩家/g, '你')
}

/** 将 AI 返回的月日规范为 MM-DD，非法则返回空串 */
function normalizeBirthdayMD(raw: unknown): string {
  const t = String(raw ?? '').trim()
  const m = t.match(/^(\d{1,2})[-/](\d{1,2})$/)
  if (!m) return ''
  const mo = Math.min(12, Math.max(1, parseInt(m[1], 10)))
  const maxD = daysInMonth(mo)
  const day = Math.min(maxD, Math.max(1, parseInt(m[2], 10)))
  return formatMD(mo, day)
}

function buildWorldBooks(npc: AiNpcJson): WorldBook[] {
  const now = Date.now()
  const mkItem = (name: string, content: string, priority: 'before' | 'after'): WorldBookItem => ({
    id: uid('it'),
    name,
    enabled: true,
    priority,
    keywords: '',
    content,
    updatedAt: now,
    collapsed: true,
  })

  const basicItems = (npc.basicSettingEntries || []).map((e) => mkItem(noPlayerWord(e.name), noPlayerWord(e.content), 'before'))
  const firstItems = (npc.firstImpressionEntries || []).map((e) => mkItem(noPlayerWord(e.name), noPlayerWord(e.content), 'after'))

  return [
    {
      id: uid('wb'),
      name: '基础设定',
      enabled: true,
      collapsed: true,
      items: basicItems,
    },
    {
      id: uid('wb'),
      name: '当前对你的态度',
      enabled: true,
      collapsed: true,
      items: firstItems,
    },
  ]
}

function characterFromAiNpc(npc: AiNpcJson, main: Character, usedAvatarUrls: Set<string>): Character {
  const now = Date.now()
  const interests = (npc.interests || []).slice(0, 5).map(noPlayerWord)
  const painPoints = (npc.painPoints || []).slice(0, 5).map(noPlayerWord)
  const birthdayMD = normalizeBirthdayMD(npc.birthdayMD)
  const gender = parseGender(npc.gender)
  return {
    id: uid('ch'),
    createdAt: now,
    updatedAt: now,
    name: npc.name || '未命名',
    gender,
    age: Number.isFinite(npc.age) ? npc.age : null,
    birthdayMD,
    zodiac: birthdayMD ? zodiacFromMD(birthdayMD) : '',
    identity: noPlayerWord(npc.occupation || '未知'),
    mbti: npc.mbti || '',
    bio: noPlayerWord(npc.bio || ''),
    motto: '',
    avatarUrl: pickNpcAvatar(npc, gender, usedAvatarUrls),
    worldBooks: buildWorldBooks(npc),
    generatedForCharacterId: main.id,
    worldBackgroundId: main.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID,
    interests,
    painPoints,
  }
}

export async function generateNpcNetworkWithAi(
  apiConfig: ApiConfig,
  input: NpcGenerateInput,
): Promise<{ characters: Character[]; relationships: Relationship[]; playerLinks: PlayerNetworkLink[] }> {
  const cfg = apiConfig
  if (!cfg?.apiUrl || !cfg?.apiKey) throw new Error('未配置 AI API')

  const main = input.main
  const wbDump = main.worldBooks
    .filter((w) => w.enabled)
    .map((w) => {
      const lines = w.items
        .filter((it) => it.enabled && String(it.content || '').trim())
        .map((it) => `- [${it.priority === 'before' ? '聊天之前' : '聊天之后'}] ${it.name}：${String(it.content).trim()}`)
        .join('\n')
      return lines ? `${w.name}\n${lines}` : ''
    })
    .filter(Boolean)
    .join('\n\n')

  const system = `你是中文小说向角色关系设计师。必须输出且仅输出一个合法 JSON 对象，不要 markdown，不要解释。
JSON 顶层结构：{"npcs":[...],"relationships":[...],"playerLinks":[...]}。
npcs 长度必须等于用户要求的数量。

年龄与生日规则（须严格遵守，且与主角信息联动）：
- 必须阅读用户给出的主角「年龄」「生日 MM-DD」作为叙事时间线参考：为每个 NPC 设定合理的 age（整数）与 birthdayMD（字符串，格式严格为 "MM-DD"，月日各两位零填充，如 "08-03"）。
- 同一故事时间线下，age 与 birthdayMD 应自洽（可按虚构「当前年」推算年份，不必写出年份）。
- 一般应根据关系类型推导年龄差（如父母长于子女、学长略长于学弟、同事多为相近年龄段等）。
- 允许例外：若用户「补充说明」或关系设定需要「忘年交、隔代亲友、老智者与年轻学生、社区里爱聊天的忘年朋友」等，NPC 可与主角年龄差距很大；此时必须在 bio 或 basicSettingEntries 中写清相识缘由与为何关系成立，避免凭空无铺垫。

每个 npc 对象字段（缺一不可）：
- name, gender（male/female/other 或 男/女）, age（数字）, birthdayMD（"MM-DD"）, occupation（职业）,
- avatarCategory（必须从以下枚举中选择且只能选一个：["40岁以上长辈头像男","40岁以上长辈头像女","微信头像男E型阳光","微信头像女清冷和御姐","抽象搞笑男女通用","微信头像女可爱活泼"]）,
- interests（字符串数组，恰好3个）, painPoints（字符串数组，恰好2个）,
- mbti（四字母大写）,
- bio（约100字中文第三人称简介）,
- basicSettingEntries：数组，每项 {name, content}。必须覆盖并写清：固定人设、背景故事、该NPC与主角「${main.name}」的相识过程、该NPC与「你」（当前操作本项目的人）的相识过程（四个主题可分多条条目，不得遗漏后两项）。
- firstImpressionEntries：数组，每项 {name, content}。对应世界书「当前对你的态度」（priority=聊天之后）。必须至少一条，且只能描述该 NPC 对「你」的当前态度。
- 写法要求（强约束）：第三人称旁白式叙述（与基础设定条目一致）；指涉操作者时只用第二人称「你」，全文禁止出现「玩家」二字。禁止 NPC 第一人称台词、内心独白、书信体。
- 内容应概括当下关系体感，可含与主角「${main.name}」无关、仅与「你」相处状态有关的描述；自由发挥，不限定句式。可参考风格（禁止照搬）：第一次见面后就没怎么交流，感觉有点陌生；最近和你在冷战，感觉和你交流非常尴尬。

你与主角区分（强约束，禁止混写）：
- 「主角」= 角色「${main.name}」；操作者一律在正文里写作「你」，不得写「玩家」。
- firstImpressionEntries 里禁止写成 NPC 对主角「${main.name}」的态度，必须写对「你」的态度。
- basicSettingEntries 中「与主角相识」与「与你相识」须分开写、不可互相替代。

每个 relationships 对象：
- fromName, toName（必须是主角「${main.name}」或某个 npc 的 name，精确匹配）,
- relation：箭头 from→to 中间显示的词；语义表示「to 是 from 的 relation」（例：from=季靳川,to=安屿,relation=妹妹 表示安屿是季靳川的妹妹）,
- fromPerspective：【fromName看toName】的完整一句描述,
- toPerspective：【toName看fromName】的完整一句描述。

重要：关系允许不对称，且必须体现不对称。
- 对于任意一对发生联系的角色 A 与 B，必须分别给出 A→B 与 B→A 两条 relationships 记录（两条记录的 fromName/toName 方向相反）。
- 这两条记录的 relation 可以不同（例如 A→B 为「暗恋」、B→A 为「讨厌」），用来支持“不同视角中心时，连线中间显示不同关系词”。示例（仅示例，不要照抄名字）：
  - fromName=1,toName=2,relation=暗恋,fromPerspective=...,toPerspective=...
  - fromName=2,toName=1,relation=讨厌,fromPerspective=...,toPerspective=...

playerLinks 数组（必填）：只描述「图中每一名角色（主角与 NPC）如何看待操作者『你』」，禁止写「你如何看待对方」。
- 必须为「主角 ${main.name}」以及每一个 npc 各写一条 playerLinks 项（条数 = 1 + npcs 长度）。
- characterName：必须是主角「${main.name}」或某个 npc 的 name，精确匹配。
- 每项仅含字段：characterName、relationThemToYou、theySeeYou。不要输出 relationYouToThem、youSeeThem 或其它字段。
- relationThemToYou：在「该角色→你」的连线上显示的词；语义与 relationships.relation 一致（箭头从该角色指向你时，relation 表示「你是该角色的 relationThemToYou」）。
- theySeeYou：【该角色看你】的完整一句旁白描述。
- 禁止生成「你看该角色」、禁止揣测操作者对角色的态度或称呼；全文禁止「玩家」，指操作者只用「你」；不要出现真实用户姓名。

操作者身份一致性（硬性强约束，必须执行）：
- 你将收到完整的「操作者身份参考」字段：姓名、性别、年龄、生日、星座、MBTI、职业/身份、兴趣爱好、雷点、所有世界书条目。
- 生成时必须同时参考上述全部字段，不得忽略其中任意一类信息；严禁把“可选”“优先参考”当作执行策略。
- NPC 对「你」的看法必须与身份参考整体一致，不得无铺垫地反向设定（例如身份明显开朗却直接写成“你一直很高冷”）。
- 若需要出现反差评价，必须给出可自洽原因（如误会、道听途说、短期冲突、刻板印象未更新），并在 theySeeYou 或相关设定里明确写出成因。

还需包含 NPC 之间合理间接关系（朋友的朋友等），保证全员与主角人设、世界书逻辑自洽。`

  const user = `【主角人设】
姓名：${main.name}
性别：${main.gender}
年龄：${main.age != null && Number.isFinite(main.age) ? `${main.age}岁` : '未知'}
生日：${main.birthdayMD?.trim() ? main.birthdayMD : '未填写'}（未填写时仍请结合简介与世界书推断合理时间线；已填写时请作为 NPC 年龄/生日推算的重要参考）
星座：${main.zodiac?.trim() || '—'}
身份：${main.identity}
MBTI：${main.mbti || '未知'}
简介：${main.bio || '无'}
${input.worldBackgroundSummary?.trim() ? `【世界背景（次于下方世界书；NPC 与关系须与此一致）】\n${input.worldBackgroundSummary.trim()}\n` : ''}
世界书摘要：
${wbDump || '（主角暂无世界书正文，请仍基于姓名身份与世界背景自洽生成）'}

【生成参数】
数量：${input.count}
关系偏向（多选参考）：${input.relationBiases.join('、') || '无'}
补充说明：${input.customNote.trim() || '无'}

【操作者身份参考（必须完整参考以下全部字段）】
${input.playerIdentity?.name ? `姓名：${input.playerIdentity.name}` : '姓名：你'}
${input.playerIdentity?.gender ? `性别：${input.playerIdentity.gender}` : '性别：未设定'}
${input.playerIdentity?.age != null && Number.isFinite(input.playerIdentity.age) ? `年龄：${input.playerIdentity.age}岁` : '年龄：未设定'}
${input.playerIdentity?.birthdayMD ? `生日：${input.playerIdentity.birthdayMD}` : '生日：未设定'}
${input.playerIdentity?.zodiac ? `星座：${input.playerIdentity.zodiac}` : '星座：未设定'}
${input.playerIdentity?.identity ? `职业/身份：${input.playerIdentity.identity}` : '职业/身份：未设定'}
${input.playerIdentity?.mbti ? `MBTI：${input.playerIdentity.mbti}` : 'MBTI：未设定'}
${input.playerIdentity?.bio ? `简介：${input.playerIdentity.bio}` : '简介：未设定'}
${input.playerIdentity?.interests?.length ? `兴趣爱好：${input.playerIdentity.interests.join('、')}` : '兴趣爱好：未设定'}
${input.playerIdentity?.painPoints?.length ? `雷点：${input.playerIdentity.painPoints.join('、')}` : '雷点：未设定'}
${input.playerIdentity?.worldBooks?.length ? `所有世界书条目：${input.playerIdentity.worldBooks
    .map((w) => {
      const wbName = String(w?.name || '未命名世界书')
      const wbEnabled = w?.enabled ? '开启' : '关闭'
      const items = (w?.items || []).map((it) => {
        const itName = String(it?.name || '未命名条目')
        const itEnabled = it?.enabled ? '开启' : '关闭'
        const pr = it?.priority === 'after' ? '聊天之后' : '聊天之前'
        const keywords = String(it?.keywords || '')
        const content = String(it?.content || '')
        return `[${wbName}|${wbEnabled}] 条目:${itName} | 状态:${itEnabled} | 优先级:${pr} | 关键词:${keywords || '无'} | 内容:${content || '空'}`
      })
      return items.join('；')
    })
    .filter(Boolean)
    .join('；')}` : '所有世界书条目：未设定'}` 

  const raw = await openAiCompatibleChat(cfg, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])

  let payload: AiPayload
  try {
    payload = JSON.parse(stripJsonFence(raw)) as AiPayload
  } catch {
    throw new Error('AI 返回 JSON 无法解析')
  }
  if (!payload?.npcs || !Array.isArray(payload.npcs)) throw new Error('AI 返回缺少 npcs')
  if (!payload?.relationships || !Array.isArray(payload.relationships)) throw new Error('AI 返回缺少 relationships')
  const rawPlayerLinks = Array.isArray(payload.playerLinks) ? payload.playerLinks : []

  const nameToCharacter = new Map<string, Character>()
  const characters: Character[] = []
  const usedAvatarUrls = new Set<string>()
  for (const n of payload.npcs) {
    const ch = characterFromAiNpc(n, main, usedAvatarUrls)
    characters.push(ch)
    nameToCharacter.set(ch.name, ch)
  }
  if (!nameToCharacter.has(main.name)) {
    // 主角不在 npc列表，手动加入映射
    nameToCharacter.set(main.name, main)
  }

  const relationships: Relationship[] = []
  for (const r of payload.relationships) {
    const from = nameToCharacter.get(r.fromName)
    const to = nameToCharacter.get(r.toName)
    if (!from || !to) continue
    relationships.push({
      id: uid('rel'),
      fromCharacterId: from.id,
      toCharacterId: to.id,
      relation: noPlayerWord(r.relation || ''),
      fromPerspective: noPlayerWord(r.fromPerspective || ''),
      toPerspective: noPlayerWord(r.toPerspective || ''),
    })
  }

  const expectedNames = new Set<string>([main.name, ...characters.map((c) => c.name)])
  const playerLinks: PlayerNetworkLink[] = []
  for (const pl of rawPlayerLinks) {
    const name = String(pl?.characterName ?? '').trim()
    if (!name || !expectedNames.has(name)) continue
    const ch = nameToCharacter.get(name)
    if (!ch) continue
    playerLinks.push({
      id: uid('pl'),
      characterId: ch.id,
      relationYouToThem: '',
      relationThemToYou: noPlayerWord(pl.relationThemToYou || ''),
      youSeeThem: '',
      theySeeYou: noPlayerWord(pl.theySeeYou || ''),
    })
  }

  return { characters, relationships, playerLinks }
}
