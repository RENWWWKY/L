import { buildWeChatPlayerThirdPersonPronounIronRule } from './wechatChatAi'
import { personaDb } from './newFriendsPersona/idb'

async function identityDisplayName(playerIdentityId: string, cache: Map<string, string>): Promise<string> {
  const pid = playerIdentityId.trim()
  if (!pid || pid === '__none__') return ''
  const hit = cache.get(pid)
  if (hit != null) return hit
  try {
    const iden = await personaDb.getPlayerIdentity(pid)
    const name = (iden?.name || '').trim() || pid.slice(0, 10)
    cache.set(pid, name)
    return name
  } catch {
    cache.set(pid, pid.slice(0, 10))
    return cache.get(pid) ?? pid.slice(0, 10)
  }
}

/**
 * 单名 NPC：说明「群会话身份」与「人设绑定身份」是否一致，便于称呼错位与追问。
 */
export async function buildNpcIdentityAlignmentNoteForGroup(params: {
  sessionPlayerIdentityId: string
  boundPlayerIdentityId?: string | null | undefined
}): Promise<string> {
  const cache = new Map<string, string>()
  const spid = params.sessionPlayerIdentityId.trim()
  const bid = params.boundPlayerIdentityId?.trim()

  if (!bid || bid === '__none__') {
    if (!spid || spid === '__none__') return ''
    const sn = await identityDisplayName(spid, cache)
    let sessionIden = null as Awaited<ReturnType<typeof personaDb.getPlayerIdentity>>
    try {
      sessionIden = await personaDb.getPlayerIdentity(spid)
    } catch {
      sessionIden = null
    }
    const sessionPron = buildWeChatPlayerThirdPersonPronounIronRule(sessionIden).trim()
    return (
      `【身份对齐】当前群消息对应玩家身份「${sn}」（id=${spid}）。你未在人设库绑定其它玩家身份；请以该身份理解用户在群里的自称与处境。\n` +
      `【称呼硬约束】称呼用户以会话身份「${sn}」为准；勿跟风抄其它 NPC 绑定档下的称谓。\n` +
      (sessionPron ? `${sessionPron}\n` : '')
    )
  }

  const bn = await identityDisplayName(bid, cache)
  let boundIden = null as Awaited<ReturnType<typeof personaDb.getPlayerIdentity>>
  try {
    boundIden = await personaDb.getPlayerIdentity(bid)
  } catch {
    boundIden = null
  }
  const boundPron = buildWeChatPlayerThirdPersonPronounIronRule(boundIden).trim()
  if (!spid || spid === '__none__' || bid === spid) {
    return (
      `【身份对齐】当前群与会话关联玩家身份「${bn}」（id=${bid}）。\n` +
      `【称呼硬约束】凡 <<SPEAKER:你的角色ID>> 台词里称呼用户，**必须以绑定身份「${bn}」语境与人设为准**；**禁止**仅因群里另一名 NPC 叫了别的姓氏/职务就跟风照搬，除非你人设已知情。\n` +
      (boundPron ? `${boundPron}\n` : '')
    )
  }

  const sn = await identityDisplayName(spid, cache)
  let sessionIden2 = null as Awaited<ReturnType<typeof personaDb.getPlayerIdentity>>
  try {
    sessionIden2 = await personaDb.getPlayerIdentity(spid)
  } catch {
    sessionIden2 = null
  }
  const sessionPron2 = buildWeChatPlayerThirdPersonPronounIronRule(sessionIden2).trim()
  return (
    `【身份对齐】**当前微信群**发言存档绑定会话身份「${sn}」（id=${spid}）；你在人设库绑定的是「${bn}」（id=${bid}）。` +
    `你对用户的称谓与人设预期应**锚定绑定身份「${bn}」**，而不是会话登录档「${sn}」。\n` +
    `【称呼硬约束】**禁止**在台词里把用户喊成「${sn}」那条身份线下的常用姓名/绰号（典型误用：应喊卫总却喊祁）；**禁止**看见另一位 NPC 用了某种称呼就跟抄；除非你人设本就知晓多层身份或剧情已挑明。\n` +
    `群内可出现称呼错位感，**允许**你困惑、追问用户，或与另一角色交换疑问（仍用人设口吻）。\n` +
    (boundPron
      ? `【你绑定视角下的用户】以下人称以**绑定身份「${bn}」**为准（背称用户时用绑定档性别，勿与会话档混淆）：\n${boundPron}\n`
      : '') +
    (sessionPron2
      ? `【会话存档视角·补充】群内「你」发送的消息与会话身份「${sn}」关联；若剧情需区分两档身份，会话侧第三人称：\n${sessionPron2}\n`
      : '')
  )
}

export type GroupNpcIdentityBindingRow = {
  groupNickname: string
  boundPlayerIdentityId?: string | null | undefined
}

/**
 * 当多名 NPC 绑定身份与当前会话不一致时：**不再**注入完整「会话玩家身份档案」，避免全员误认成同一人（例如全员喊祁）。
 */
export function buildGroupLeanSessionIdentityPromptBlock(params: {
  sessionPlayerIdentityId: string
  userGroupNicknameInUi: string
}): string {
  const pid = params.sessionPlayerIdentityId.trim()
  const nick = params.userGroupNicknameInUi.trim() || '用户'
  if (!pid || pid === '__none__') {
    return (
      `\n\n---\n【当前微信群·会话层说明】\n` +
      `- 未绑定有效会话玩家身份（__none__）；各 NPC 仍以各自人设绑定身份理解用户。\n\n` +
      `【用户在本群的昵称】${nick}（界面展示用；**不是**你对用户的强制称谓）。\n`
    )
  }
  return (
    `\n\n---\n【当前微信群·会话层说明（技术｜勿强加给每名 NPC）】\n` +
    `- 本条会话消息存档所用玩家身份 id：\`${pid}\`。**仅为客户端登录/存档**，不等于每名 NPC 认知里用户的唯一姓名。\n` +
    `- **每名 NPC** 对用户的称呼：**仅以你自己小节内「身份对齐」、人设绑定玩家身份、私聊近况为准**。\n` +
    `- **严禁**：绑定 A 身份档的角色，因会话登录档或另一位 NPC 的称呼，就把用户当成 B 身份档的人来喊（典型错：应喊卫总却喊祁昀澈/祁社长）。\n` +
    `- **严禁**：看见他人 <<SPEAKER>> 用了某姓氏/职务就跟风照搬，除非你人设本应知晓多层身份。\n\n` +
    `【用户在本群的昵称】${nick}（群内 UI 展示；**不等于**你在台词里必须使用的称谓）。\n`
  )
}

/**
 * 群内 ≥2 名 NPC，且存在「不同人设绑定身份」或「绑定与会话身份不一致」时注入：
 * 允许 NPC 之间互相疑问、并对用户追问称呼/身份。
 */
export async function buildGroupMultiIdentityCoPresenceBlock(params: {
  sessionPlayerIdentityId: string
  members: GroupNpcIdentityBindingRow[]
}): Promise<string> {
  const rows = params.members
  if (rows.length < 2) return ''

  const spid = params.sessionPlayerIdentityId.trim()
  const binds = rows
    .map((r) => r.boundPlayerIdentityId?.trim())
    .filter((b): b is string => !!b && b !== '__none__')

  const distinctBind = new Set(binds)
  const multiBind = distinctBind.size >= 2
  const sessionMismatch =
    !!spid &&
    spid !== '__none__' &&
    binds.length > 0 &&
    binds.some((b) => b !== spid)

  if (!multiBind && !sessionMismatch) return ''

  const cache = new Map<string, string>()
  const lines: string[] = []

  lines.push('【多玩家身份同台｜称呼错位与追问（程序事实｜可作剧情资源）】')

  if (spid && spid !== '__none__') {
    const sn = await identityDisplayName(spid, cache)
    lines.push(`- **当前微信群会话**使用的玩家身份：「${sn}」（id=${spid}）——群内「你」发送的消息与此身份档关联。`)
  } else {
    lines.push('- **当前微信群会话**未绑定有效玩家身份（__none__）；仍以各角色人设绑定为准理解用户。')
  }

  lines.push('- **各 NPC 人设绑定的玩家身份**（私聊存档常用此档）：')
  for (const r of rows) {
    const nick = (r.groupNickname || '').trim() || '（未设本群昵称）'
    const bid = r.boundPlayerIdentityId?.trim()
    if (!bid || bid === '__none__') {
      lines.push(`  - 「${nick}」：未单独绑定玩家身份（沿用会话身份理解用户）。`)
      continue
    }
    const bn = await identityDisplayName(bid, cache)
    lines.push(`  - 「${nick}」：绑定玩家身份「${bn}」（id=${bid}）。`)
  }

  lines.push(
    '- **允许的情节（须符合人设与世界观）**：NPC **彼此可以**针对「用户对不同人的称呼不一样」「你到底让他喊你什么」等产生**疑问、递话、试探、阴阳**；也可以**共同或轮流追问用户**要求解释、圆场或挑衅。',
  )
  lines.push(
    '- **约束**：互不知「角色↔角色」本名规则仍适用——NPC 之间追问围绕**用户在群里的自称、口吻、称呼矛盾**展开，勿凭空读出对方人设卡真名；禁止机械全员当刑警突审，语气要有微信群真实感。',
  )

  return lines.join('\n')
}
