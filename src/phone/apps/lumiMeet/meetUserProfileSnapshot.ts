import { personaDb, emitWeChatStorageChanged } from '../wechat/newFriendsPersona/idb'
import type { WorldBook, WorldBookItem } from '../wechat/newFriendsPersona/types'
import type { PlayerIdentity } from '../wechat/newFriendsPersona/types'
import type { Character, Gender } from '../wechat/newFriendsPersona/types'
import { formatMeetMasqueradeIntentions } from './meetMaskTruthPrompt'
import { MEET_DEFAULT_PUBLIC_DISPLAY_NAME } from './meetPublicProfileDisplay'
import type { EncounterNPC, MeetPublicProfile, MeetUserProfileSnapshot } from './meetTypes'
import { consolidateMeetCharacterWorldBooks } from './meetWorldbookConsolidate'
import { rewriteMeetWorldbookNamesToPlaceholders } from './meetWorldbookPlaceholders'

const VOL11_TITLE = '11 MEET MASK | 遇见对外档案快照'

/** 从当前遇见档案截取「匹配成功时对方在 App 里看到的假面」 */
export function captureMeetUserProfileSnapshot(profile: MeetPublicProfile): MeetUserProfileSnapshot {
  return {
    capturedAt: Date.now(),
    displayName: profile.displayName?.trim() || '',
    intent: profile.intent?.trim() || '',
    bio: profile.bio?.trim() || '',
    orientation: profile.orientation?.trim() || '',
    meetIntentionsPublic: [...(profile.meetIntentionsPublic ?? [])],
  }
}

export function formatMeetUserProfileSnapshotForWorldbook(
  snapshot: MeetUserProfileSnapshot,
  charNickname: string,
): string {
  const intents = formatMeetMasqueradeIntentions(snapshot.meetIntentionsPublic)
  const captured = new Date(snapshot.capturedAt).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const body = [
    '【档案性质】以下为 {{char}} 在「遇见」App 与 {{user}} 匹配成功瞬间所见的对方**对外展示档案**（假面侧）。',
    '【重要】这不等于对方之后在「微信」里使用的微信主页资料（「我」页昵称与签名）；二者可能被用户刻意设为不一致。转入微信后：称呼以微信主页为准；若与遇见假面反差明显，可写**掉马/抓马**（已认识前提下的反差），禁止写成从未在遇见认识。',
    '',
    `快照时间：${captured}`,
    `展示昵称：${snapshot.displayName?.trim() || MEET_DEFAULT_PUBLIC_DISPLAY_NAME}`,
    `交友意向（对外）：${intents}`,
    `意向摘要：${snapshot.intent || '（未填）'}`,
    `取向自述：${snapshot.orientation || '（未填）'}`,
    `自我介绍：${snapshot.bio || '（未填）'}`,
    '',
    '【演出提示】临时会话与缔结契约阶段以本档案理解 {{user}}；转入微信后为同一熟人续篇——微信主页为当前展示名。假面与微信资料不一致时，鼓励人设内的掉马、试探、抓马张力；勿把遇见假面昵称当「第一次听说」来惊叹。',
  ].join('\n')
  return rewriteMeetWorldbookNamesToPlaceholders(body, {
    nickname: charNickname,
    realName: charNickname,
  })
}

function mkVol11Item(
  npcId: string,
  nickname: string,
  _realName: string,
  content: string,
  now: number,
): WorldBookItem {
  return {
    id: `meet-wb-${npcId}-vol11-item01`,
    name: '匹配成功时见到的 {{user}} 遇见档案',
    enabled: true,
    priority: 'before',
    keywords: `遇见 ${nickname} 档案 假面`,
    content: content.trim() || '（档案待补全）',
    updatedAt: now,
    collapsed: false,
  }
}

/** 写入人设库 vol11；无快照时返回空数组 */
export function getMeetVol11WorldBookId(characterId: string): string {
  return `meet-wb-${characterId.trim()}-vol11`
}

/** 从角色人设世界书读取 vol11 遇见对外档案正文 */
export function readMeetVol11ContentFromCharacterWorldBooks(
  worldBooks: WorldBook[] | undefined,
  characterId: string,
): string {
  const wb = worldBooks?.find((w) => w.id === getMeetVol11WorldBookId(characterId))
  const item = wb?.items?.find((it) => it.enabled !== false) ?? wb?.items?.[0]
  return String(item?.content ?? '').trim()
}

export function buildMeetVol11UserMeetProfileWorldBook(
  npcId: string,
  nickname: string,
  realName: string,
  snapshot: MeetUserProfileSnapshot | undefined | null,
  now: number,
): WorldBook[] {
  if (!snapshot) return []
  const rn = realName.trim() || nickname
  const content = formatMeetUserProfileSnapshotForWorldbook(snapshot, nickname)
  return [
    {
      id: `meet-wb-${npcId.trim()}-vol11`,
      name: VOL11_TITLE,
      enabled: true,
      collapsed: false,
      items: [mkVol11Item(npcId, nickname, rn, content, now)],
    },
  ]
}

function mapMeetNpcGenderLabel(g: string): Gender {
  if (g.includes('女')) return 'female'
  if (g.includes('男')) return 'male'
  return 'other'
}

/**
 * 匹配成功：写入 vol11（匹配瞬间的用户遇见假面档案）。
 * 应在 `upsertMeetNpcAsCharacter` 之后调用，确保覆盖全量同步分册后的 vol11。
 */
export async function applyMeetUserProfileVol11AtMatch(
  npc: EncounterNPC,
  meetProfile?: MeetPublicProfile,
): Promise<void> {
  const snapshot =
    npc.meetUserProfileAtMatch ??
    (meetProfile ? captureMeetUserProfileSnapshot(meetProfile) : null) ??
    (await loadMeetUserProfileSnapshotFromKv(npc.id))
  if (!snapshot) return
  const npcWithSnap: EncounterNPC = { ...npc, meetUserProfileAtMatch: snapshot }
  const ch = await personaDb.getCharacter(npc.id)
  if (ch) {
    await mergeVol11OntoCharacterWorldBooks(npcWithSnap, ch)
  } else {
    await ensureMeetVol11OnCharacterAtMatch(npcWithSnap)
  }
  emitWeChatStorageChanged()
}

/** 合并 vol11 到现有人设 worldBooks */
async function mergeVol11OntoCharacterWorldBooks(
  npc: Pick<EncounterNPC, 'id' | 'nickname' | 'realName' | 'meetUserProfileAtMatch'>,
  existing: Character,
): Promise<void> {
  if (!npc.meetUserProfileAtMatch) return
  const now = Date.now()
  const legal = (npc.realName ?? existing.name ?? npc.nickname).trim() || npc.nickname
  const vol11 = buildMeetVol11UserMeetProfileWorldBook(
    npc.id,
    npc.nickname,
    legal,
    npc.meetUserProfileAtMatch,
    now,
  )
  if (!vol11.length) return
  const rest = (existing.worldBooks ?? []).filter((w) => !w.id.endsWith(`-vol11`))
  const worldBooks = consolidateMeetCharacterWorldBooks(npc.id, [...rest, ...vol11])
  await personaDb.upsertCharacter({ ...existing, worldBooks, updatedAt: now } as Character)
}

/**
 * 匹配成功瞬间写入 vol11（不等缔结/加微信）。
 * 角色尚未入库时写入仅含 vol11 的存根；重逢或已入库则只合并 vol11。
 */
export async function ensureMeetVol11OnCharacterAtMatch(npc: EncounterNPC): Promise<void> {
  if (!npc.meetUserProfileAtMatch) return
  const existing = await personaDb.getCharacter(npc.id)
  if (existing) {
    await mergeVol11OntoCharacterWorldBooks(npc, existing)
    emitWeChatStorageChanged()
    return
  }

  const now = Date.now()
  const base = npc.comprehensivePersona?.base
  const legalName = (npc.realName ?? base?.realName)?.trim() || npc.nickname
  const vol11 = buildMeetVol11UserMeetProfileWorldBook(
    npc.id,
    npc.nickname,
    legalName,
    npc.meetUserProfileAtMatch,
    now,
  )
  if (!vol11.length) return

  const wx =
    npc.wechatId?.trim() ||
    `meet_${npc.id.replace(/^meet_/, '').slice(0, 16)}_${Math.random().toString(36).slice(2, 6)}`
  const ageYears =
    npc.ageYears != null && Number.isFinite(npc.ageYears)
      ? Math.max(16, Math.min(99, Math.floor(npc.ageYears)))
      : 24

  const stub: Character = {
    id: npc.id,
    createdAt: now,
    updatedAt: now,
    name: legalName,
    gender: mapMeetNpcGenderLabel(npc.gender),
    age: ageYears,
    birthdayMD: npc.birthdayMD ?? base?.birthdayMD ?? '06-15',
    zodiac: (npc.zodiac ?? base?.zodiac)?.trim() || '',
    identity: npc.occupation?.trim()?.slice(0, 48) || '市民',
    bio: npc.persona.slice(0, 480),
    motto: npc.motto?.trim()?.slice(0, 80),
    avatarUrl: npc.avatarUrl,
    wechatNickname: npc.nickname,
    wechatId: wx,
    worldBooks: vol11,
    worldBackgroundEnabled: true,
    remark: npc.nickname,
  }
  await personaDb.upsertCharacter(stub)
  emitWeChatStorageChanged()
}

/** 发送好友申请时冻结当前遇见档案（可能与匹配时 vol11 不同） */
export async function loadCurrentMeetProfileSnapshotFromKv(): Promise<MeetUserProfileSnapshot | null> {
  const { LUMI_MEET_KV_KEY } = await import('./constants')
  const raw = await personaDb.getPhoneKv(LUMI_MEET_KV_KEY)
  if (!raw || typeof raw !== 'object') return null
  const profile = (raw as { meetProfile?: MeetPublicProfile }).meetProfile
  if (!profile) return null
  return captureMeetUserProfileSnapshot(profile)
}

export async function loadMeetUserProfileSnapshotFromKv(npcId: string): Promise<MeetUserProfileSnapshot | null> {
  const id = npcId.trim()
  if (!id) return null
  const { LUMI_MEET_KV_KEY } = await import('./constants')
  const raw = await personaDb.getPhoneKv(LUMI_MEET_KV_KEY)
  if (!raw || typeof raw !== 'object') return null
  const npcs = (raw as { npcs?: Array<{ id: string; meetUserProfileAtMatch?: MeetUserProfileSnapshot }> }).npcs
  return npcs?.find((n) => n.id === id)?.meetUserProfileAtMatch ?? null
}

export async function resolveMeetSnapshotForFriendRequest(params: {
  characterId: string
  meetLinkedNpcId?: string | null
  meetUserProfileAtRequest?: MeetUserProfileSnapshot | null
}): Promise<MeetUserProfileSnapshot | null> {
  if (params.meetUserProfileAtRequest) return params.meetUserProfileAtRequest
  const linked = params.meetLinkedNpcId?.trim() || params.characterId.trim()
  return loadMeetUserProfileSnapshotFromKv(linked)
}

export function isMeetSyncedCharacter(characterId: string, worldBooks: WorldBook[] | undefined): boolean {
  const cid = characterId.trim()
  if (!cid || !worldBooks?.length) return false
  return worldBooks.some((w) => w.id.startsWith(`meet-wb-${cid}-vol`))
}

/** 微信「我」页对外资料（非多身份 PlayerIdentity 卡） */
export type WeChatHomeProfile = {
  displayName: string
  signature?: string
}

export type WeChatHomeProfilePromptOptions = {
  /** 新朋友-验证申请：昵称仅作界面展示，台词禁止直呼 */
  forFriendRequest?: boolean
}

export function buildWeChatHomeProfilePromptBlock(
  profile: WeChatHomeProfile,
  opts?: WeChatHomeProfilePromptOptions,
): string {
  const nick = profile.displayName?.trim() || '未设置'
  const sig = profile.signature?.trim() || '（无个性签名）'
  if (opts?.forFriendRequest) {
    return (
      `\n\n---\n【微信主页资料 · 好友验证参考（非称呼依据）】\n` +
      `列表展示昵称：${nick}\n个性签名：${sig}\n` +
      `· 仅供你知道「通讯录里这条申请叫什么」，**不是**真名，**禁止**在验证回复或 post_accept_greeting 里用「${nick}」称呼对方。\n` +
      `· 不知真名时默认叫「你」；仅可沿用对方在验证消息里亲口写的自称（若有），且勿与上方列表昵称混用。\n`
    )
  }
  return `\n\n---\n【微信主页资料 · 当前私聊以本段为准】\n昵称：${nick}\n个性签名：${sig}\n· 即对方在微信「我」页设置的**对外展示名**，不是真名、不是身份证姓名；日常称呼用昵称即可，**禁止**问「你真的是${nick}本人吗」、禁止把昵称当实名制实名。\n· 若与遇见假面不一致，可写掉马反差，但勿把假面昵称当「第一次听说」。\n`
}

/** 遇见假面与微信主页是否存在可演出的身份反差（昵称或简介气质） */
export function hasMeetWechatProfileContrast(params: {
  meetSnapshot: MeetUserProfileSnapshot | null | undefined
  wechatProfile: WeChatHomeProfile
}): boolean {
  const snap = params.meetSnapshot
  if (!snap) return false
  const meetNick = snap.displayName?.trim() || ''
  const wxNick = params.wechatProfile.displayName?.trim() || ''
  if (meetNick && wxNick && meetNick.toLowerCase() !== wxNick.toLowerCase()) return true
  const meetBio = snap.bio?.trim() || ''
  const wxSig = params.wechatProfile.signature?.trim() || ''
  if (meetBio && wxSig && meetBio.slice(0, 48) !== wxSig.slice(0, 48)) return true
  return false
}

/**
 * 遇见转微信后的私聊/验证承接：已认识 + 微信主页为当前展示；假面不一致时可掉马抓马。
 */
export function buildMeetWechatPrivateChatContinuityBlock(params: {
  meetSnapshot: MeetUserProfileSnapshot | null | undefined
  wechatProfile: WeChatHomeProfile
  /** 好友验证栏：承接遇见亲疏，但禁止用微信主页昵称直呼 */
  forFriendRequest?: boolean
}): string {
  const snap = params.meetSnapshot
  const meetNick = snap?.displayName?.trim() || ''
  const meetBio = snap?.bio?.trim().slice(0, 120) || ''
  const wxNick = params.wechatProfile.displayName?.trim() || ''
  const wxSig = params.wechatProfile.signature?.trim() || '（无）'
  const nickMismatch =
    !!meetNick && !!wxNick && meetNick.toLowerCase() !== wxNick.toLowerCase()
  const profileContrast = hasMeetWechatProfileContrast({
    meetSnapshot: snap,
    wechatProfile: params.wechatProfile,
  })

  const lines = [
    '【遇见转微信 · 私聊承接｜必读】',
    '你与 {{user}} 已在「遇见」App 里聊过；现为**同一真人**转到微信私聊——不是陌生人初识，须承接遇见里的话题、语气与亲疏。',
    '',
    params.forFriendRequest
      ? '【当前渠道 · 微信验证栏】'
      : '【当前渠道 · 以微信主页资料为准】',
    `· 微信列表展示昵称：${wxNick || '未设置'}（${params.forFriendRequest ? '**禁止**在验证/通过后打招呼台词里直呼此名' : '私聊称呼以此为准'}）`,
    `· 个性签名：${wxSig}`,
    params.forFriendRequest
      ? '· 遇见里聊过 ≠ 已知道对方微信真名；验证阶段默认叫「你」，可用遇见假面里**已用过**的称呼，**不得**用微信主页昵称开场（如禁止「' +
        `${wxNick || '…'}好呀」）。`
      : '· 私聊里屏幕显示、称呼、@ 对方，一律以本条微信资料为准（**不是**多身份「玩家身份卡」，也不是遇见 App 假面档案）。',
  ]

  if (snap) {
    lines.push(
      '',
      '【你在遇见里记住的 {{user}} 假面档案】',
      `· 遇见展示昵称：${meetNick || '（未填）'}`,
      meetBio ? `· 遇见简介摘抄：${meetBio}` : '',
    )
  }

  if (profileContrast) {
    lines.push(
      '',
      '【掉马 / 反差 · 鼓励演出（抓马）】',
      nickMismatch
        ? `· 遇见里叫「${meetNick}」，微信主页却是「${wxNick}」——**允许**愣一下、试探、掉马感、抓马吐槽（如「等等…你在遇见里是 A，微信怎么是 B？」），符合人设即可。`
        : '· 遇见假面与微信主页在昵称或签名气质上不一致——**允许**写「原来你还有这一面」类反差，但须像**早就认识、刚发现另一张脸**，不是像第一次加好友。',
      '· 掉马写法：先承接「还是你」的熟悉感，再点出微信侧与遇见假面的落差；可好奇、可调侃、可装傻、可吃醋，禁止道德审判或审讯式逼问。',
      '· **禁止的错误掉马**：把遇见假面昵称当成「第一次听说」（遇见里你们已经用过/聊过那个名字）；勿写成完全没在微信遇见里互动过的陌生人破冰。',
    )
  } else if (meetNick) {
    lines.push(
      '',
      '【资料一致或接近】',
      `· 遇见昵称「${meetNick}」与当前微信展示相近；自然续聊即可，不必硬拗掉马，也勿装「刚认出你是谁」。`,
    )
  }

  lines.push(
    '',
    '【禁止 · 与掉马无关的初识套话】',
    '· 勿把主线写成「刚通过好友好快」「第一次看见你」而忽略遇见已聊内容（除非用户主动提）。',
    '· 勿对**遇见假面昵称本身**做初见惊叹（例如遇见里一直叫对方橘子汽水，到微信又惊讶「你叫橘子汽水？」——应惊讶的是微信名与假面不一致，而非假面名第一次出现）。',
    '· 勿 OOC 道德说教；掉马是戏剧张力，不是训诫用户撒谎。',
  )
  return lines.filter(Boolean).join('\n')
}

/** @deprecated 请用 {@link buildMeetWechatPrivateChatContinuityBlock} + 微信主页资料 */
export function buildMeetWechatIdentityContrastHint(params: {
  meetSnapshot: MeetUserProfileSnapshot | null | undefined
  wechatIdentity: PlayerIdentity | null
  wechatHomeProfile?: WeChatHomeProfile | null
}): string {
  const snap = params.meetSnapshot
  if (!snap) return ''
  const wxProfile: WeChatHomeProfile = params.wechatHomeProfile ?? {
    displayName:
      params.wechatIdentity?.wechatNickname?.trim() ||
      params.wechatIdentity?.name?.trim() ||
      '',
    signature: params.wechatIdentity?.bio?.trim(),
  }
  return buildMeetWechatPrivateChatContinuityBlock({ meetSnapshot: snap, wechatProfile: wxProfile })
}
