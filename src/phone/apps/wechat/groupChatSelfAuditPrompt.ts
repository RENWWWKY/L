import type { Character, GroupChatRow, GroupMember, Relationship } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import { WECHAT_GROUP_BOT_CHARACTER_ID, WECHAT_GROUP_USER_CHAR_ID } from './wechatConversationKey'
import { buildGroupStrangerPairDisplayLines } from './groupChatUtils'

function roleZh(role: GroupMember['role']): string {
  if (role === 'owner') return '群主'
  if (role === 'admin') return '管理员'
  return '成员'
}

function memberDisplayName(m: GroupMember): string {
  if (m.charId === WECHAT_GROUP_BOT_CHARACTER_ID) return (m.groupNickname || '').trim() || '群管家'
  return (m.groupNickname || '').trim() || m.charId.slice(0, 12)
}

/**
 * 群聊 AI 调用前的「后台自检」Markdown：列出成员、职务、禁言/警告、群名可见性、人脉边、玩家身份绑定，
 * 以及群管家规则快照、本轮编演自问（改名/管人/违禁词与禁止替用户做决定）。
 * 供模型作为唯一事实源，避免臆造矛盾信息。
 */
export async function buildGroupChatSelfAuditPromptSection(params: {
  group: GroupChatRow | null | undefined
  sessionPlayerIdentityId: string
}): Promise<string> {
  const g = params.group
  if (!g?.members?.length) return ''

  const pid = params.sessionPlayerIdentityId.trim()
  const members = g.members.filter((m) => m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID)
  if (!members.length) return ''

  const npcIds = members
    .map((m) => m.charId.trim())
    .filter((id) => id && id !== WECHAT_GROUP_USER_CHAR_ID)

  let rels: Relationship[] = []
  try {
    rels = npcIds.length ? await personaDb.listRelationshipsInNetwork(npcIds) : []
  } catch {
    rels = []
  }

  const charEdges = rels.filter((r) => !r.isPlayerIdentity)

  const lines: string[] = []

  lines.push(
    '【术语】「本群昵称」＝**仅在本群生效的群内称呼**（如「干饭大王」「叫我大人」「我是舔狗」「群主是猪」一类口语化、有梗、好玩的马甲），**不是**把通讯录里的**微信昵称**抄一遍；二者在数据上是独立字段，禁止混为一谈。',
  )
  lines.push('')

  lines.push('### 0. 客户端职务权限（产品规则｜用户与 NPC 均以成员表 `role` 为准）')
  lines.push(
    '- **群主（`owner`）**：可编辑群公告；可编辑**任意成员**的本群昵称；可编辑群聊名称；可**设置/修改/删除**群机器人**触发敏感词与规则**（与管理员共享）；可 @所有人；可从**本角色**通讯录邀请已在列表中的角色入群；可移除成员；可禁言成员；可设置/撤销群管理员；可转让群主；可解散群聊。',
  )
  lines.push(
    '- **群管理员（`admin`）**：可编辑群聊名称；可**设置/修改/删除**群机器人**触发敏感词与规则**；可 @所有人；可从本角色通讯录邀请成员；可禁言成员；可移除成员；可退出群聊。**不可**：编辑群公告；代改他人本群昵称（仅成员本人或群主）；任免管理员；转让群主；解散群聊。',
  )
  lines.push(
    '- **普通成员（`member`）**：可从本角色通讯录邀请成员；**仅**可编辑**自己**的本群昵称；可退出群聊。其余管理项不可用。',
  )
  lines.push(
    '- **补充**：群头像任意成员均可编辑；群管家敏感词（触发规则）与**群公告**同为**全员公开可查看**（群资料页有与公告同款的入口与预览）；**规则的增删改及群管家头像由群主或管理员负责**。',
  )
  lines.push('')

  lines.push('### 1. 群内成员（不含群管家系统号）')
  for (const m of members) {
    const id = m.charId.trim()
    const nick = (m.groupNickname || '').trim() || '（空）'
    lines.push(
      `- \`${id}\`｜群内称呼「${nick}」（本群昵称）｜${roleZh(m.role)}｜警告 ${m.warnings ?? 0} 次｜${m.isMuted ? '**禁言中**' : '可发言'}`,
    )
  }

  const owner = members.find((x) => x.role === 'owner')
  const admins = members.filter((x) => x.role === 'admin')
  lines.push('### 2. 群主与管理员')
  lines.push(
    `- 群主：${owner ? `「${memberDisplayName(owner)}」(\`${owner.charId.trim()}\`)` : '（未指定）'}`,
  )
  lines.push(
    `- 管理员：${admins.length ? admins.map((a) => `「${memberDisplayName(a)}」(\`${a.charId.trim()}\`)`).join('、') : '无'}`,
  )
  if (owner && owner.charId.trim() !== WECHAT_GROUP_USER_CHAR_ID) {
    lines.push(
      '- **注**：当前群主为 **NPC 角色**（非用户占位）。客户端以**用户占位**在成员表中的 `role` 为准（见 **§0**）：用户为群主/管理员时可用的管理项见 §0；用户为普通成员时，公告、任免管理员、踢人禁言、转让群主、解散等**均不可用**（群头像仍可改；机器人规则**全员可查看**，**编辑仅群主或管理员**）。编演可写冲突，勿声称用户已落库未开放项。详见 **§10**。',
    )
  }

  lines.push('### 3. 彼此是否知晓对方的「本群昵称」（群内称呼）')
  lines.push(
    '- 群内列表里大家互相看到的是上表的**群内称呼**，即本群昵称；这是群内梗名/外号向的展示，**请勿默认等于该成员的微信昵称**。',
  )
  lines.push(
    '- **全员彼此可见**上表中的群内称呼（除非剧情刻意设定某人隐瞒）。互怼、玩梗、@人时优先用这些称呼，才符合真实群聊语感。',
  )
  lines.push(
    '- 人设**本名**能否直呼：仍取决于人脉「角色↔角色」关系边（不含玩家身份线）；互无边时见下文「互不知本名」成员对。',
  )

  lines.push('### 4. 当前群聊名称（全员可见）')
  lines.push(`- 「${(g.name || '').trim() || '群聊'}」`)

  const muted = members.filter((m) => m.isMuted)
  const warned = members.filter((m) => (m.warnings ?? 0) > 0)
  lines.push('### 5. 禁言与警告')
  lines.push(
    `- 禁言中：${muted.length ? muted.map((m) => `「${memberDisplayName(m)}」(\`${m.charId.trim()}\`)`).join('、') : '无'}`,
  )
  lines.push(
    `- 曾被警告（warnings>0）：${warned.length ? warned.map((m) => `「${memberDisplayName(m)}」×${m.warnings ?? 0}`).join('；') : '无'}`,
  )
  lines.push(
    '- **客户端事实｜禁言仍发言与公屏一致**：被禁言角色仍可由模型输出 `<<SPEAKER>>` 台词并落库，但**全员**在聊天气泡侧**均不展示**该原文；**仅**展示居中灰条，文案固定为「本群昵称因被禁言已自动隐藏这条消息」；**仅群主与管理员**（用户占位 `owner`/`admin`）在灰条末有「查看」可点读本地存档原文，**普通成员**无「查看」、界面不知原文。被禁言者本人仍「心里知道」自己发了什么，可接「真给我禁言了？」等对白。其他 NPC 与用户（member）不得声称从界面读过他人被隐藏句子的原文。',
  )

  lines.push('### 6. 成员之间的「角色↔角色」人脉绑定（非玩家身份线）')
  if (!charEdges.length) {
    lines.push('- 当前群内 NPC 之间**没有**已存储的「角色↔角色」人脉边（`isPlayerIdentity=false`）。')
  } else {
    for (const r of charEdges) {
      const label = (r.relation || '').trim() || '有关系'
      lines.push(`- \`${r.fromCharacterId.trim()}\` ↔ \`${r.toCharacterId.trim()}\`：${label}`)
    }
  }

  const strangerLines = buildGroupStrangerPairDisplayLines(npcIds, g.members ?? [], rels)
  if (strangerLines.length) {
    lines.push('- 下列 NPC 两两组合**无人脉角色↔角色关系**，互不宜直呼对方人设本名：')
    for (const s of strangerLines) lines.push(`  ${s}`)
  }

  lines.push('### 7. 各成员绑定的「用户身份」（玩家身份卡）')
  const userMem = members.find((m) => m.charId === WECHAT_GROUP_USER_CHAR_ID)
  if (userMem) {
    if (pid && pid !== '__none__') {
      try {
        const iden = await personaDb.getPlayerIdentity(pid)
        lines.push(
          `- 用户占位「${memberDisplayName(userMem)}」(\`${WECHAT_GROUP_USER_CHAR_ID}\`) → 当前会话玩家身份：**${(iden?.name || '').trim() || pid}**（id=\`${pid}\`）`,
        )
      } catch {
        lines.push(
          `- 用户占位「${memberDisplayName(userMem)}」(\`${WECHAT_GROUP_USER_CHAR_ID}\`) → 当前会话玩家身份 id：\`${pid}\`（读取详情失败）`,
        )
      }
    } else {
      lines.push(
        `- 用户占位「${memberDisplayName(userMem)}」(\`${WECHAT_GROUP_USER_CHAR_ID}\`) → 未绑定有效玩家身份`,
      )
    }
  }

  for (const m of members) {
    if (m.charId === WECHAT_GROUP_USER_CHAR_ID) continue
    const cid = m.charId.trim()
    let ch: Character | null = null
    try {
      ch = await personaDb.getCharacter(cid)
    } catch {
      ch = null
    }
    const bindPid = ch?.playerIdentityId?.trim()
    if (!bindPid || bindPid === '__none__') {
      lines.push(`- NPC「${memberDisplayName(m)}」(\`${cid}\`) → **未绑定**玩家身份`)
      continue
    }
    try {
      const iden = await personaDb.getPlayerIdentity(bindPid)
      lines.push(
        `- NPC「${memberDisplayName(m)}」(\`${cid}\`) → 绑定玩家身份：**${(iden?.name || '').trim() || bindPid}**（id=\`${bindPid}\`）`,
      )
    } catch {
      lines.push(`- NPC「${memberDisplayName(m)}」(\`${cid}\`) → 绑定玩家身份 id：\`${bindPid}\`（读取详情失败）`)
    }
  }

  lines.push('### 8. 群公告（全员可见；仅群主可改）')
  const ann = (g.announcement ?? '').trim()
  const ownerForAnn = members.find((x) => x.role === 'owner')
  lines.push(
    `- 当前群主：${ownerForAnn ? `「${memberDisplayName(ownerForAnn)}」(\`${ownerForAnn.charId.trim()}\`)` : '（未指定）'}`,
  )
  if (!ann) {
    lines.push('- 当前**未设置**群公告正文（群信息页与对白中可按「暂无公告」处理）。')
  } else {
    lines.push(`- 正文（事实源，编演时成员默认知晓下文）：\n\`\`\`\n${ann.slice(0, 4000)}${ann.length > 4000 ? '\n…(截断)' : ''}\n\`\`\``)
    lines.push(`- 前 30 字预览：「${ann.slice(0, 30)}${ann.length > 30 ? '…' : ''}」`)
  }

  lines.push('### 9. 群管家｜违禁词 / 敏感词规则（当前本地配置）')
  const robotRules = g.robotRules ?? []
  if (!robotRules.length) {
    lines.push(
      '- 当前**未配置**群管家触发规则。敏感词与触发策略的**写入**须由成员表中为**群主或管理员**的用户在本群设置里维护（见 **§0**）；勿编造「规则已写入」的假象。',
    )
  } else {
    robotRules.forEach((r, idx) => {
      const words = (r.triggerWords ?? []).map((w) => String(w).trim()).filter(Boolean)
      const wStr = words.length ? words.join('、') : '（无触发词）'
      const clipped = wStr.length > 500 ? `${wStr.slice(0, 500)}…` : wStr
      const act = r.action === 'mute' ? '触发后：禁言' : '触发后：警告'
      const tip = (r.warningText || '').trim().slice(0, 160)
      lines.push(`- 规则 ${idx + 1}：触发词：${clipped}｜${act}｜提示文案：${tip || '（空）'}`)
    })
  }

  lines.push('### 10. 本轮输出前编演自检（剧情决策｜非数据库快照）')
  lines.push(
    '- **私聊穿透与修罗场**：各成员小节中的「私聊近况摘录」为该角色与用户**群外私聊**的近期摘要（程序注入）；编演时须**承接**其中称呼、约定与情绪，勿在群里装作从未发生过。**多名 NPC 与用户关系档位不同**时，群内允许吃醋、阴阳、装不熟、抢话等张力；勿全员降智成「只对表情包起哄的路人」。',
  )
  lines.push(
    '- **关系与好感站位**：若成员小节含「与用户的关系与好感站位」，须据此校准群内反应（偏高好感时对用户关照他人更敏感；偏低则冷眼或拱火）；并与「长期记忆」「人脉连线」一致，勿无故扁平化。',
  )
  lines.push(
    '- **多玩家身份同台**：若系统注入「多玩家身份同台｜称呼错位与追问」，表明多名 NPC 的人设绑定身份不一致或与当前会话身份不一致；**允许** NPC 之间互相疑问、**允许**对用户追问称呼；追问围绕群内可见矛盾，勿凭空读出他人人设卡本名。',
  )
  lines.push(
    '- **硬边界：禁止替用户做决定**。上文「群主/管理员、改名、管人、群管家违禁词」等一律指 **NPC 角色**在剧情里的动机与台词；**严禁**输出任何等同于代替真人用户确认、代替用户保存设置、代替用户表态发言的内容。**禁止**虚构「系统已替用户改好群管家」「用户默认同意」等；用户占位（`' +
      WECHAT_GROUP_USER_CHAR_ID +
      '`）的群内昵称等**仅当剧情明确是用户本人行为**时才可用改名指令，**禁止**由 NPC 擅自替用户下发。',
  )
  lines.push(
    '- **是否要改「本群昵称」（群内称呼）**：本轮是否有人需改**自己**的本群昵称（含 NPC **可自行换个想要的、喜欢的群内马甲**，剧情合理即可），或**群主替某位成员**改群内昵称？若有，在合适节点输出独立一行 `<<GROUP_SET_NICK|角色ID|新昵称全文>>`。**替他人改名**仅**群主**在职务上合理（见 **§0**）；管理员不得代改他人本群昵称；普通成员只能改自己。',
  )
  lines.push(
    '- **群主或管理员（NPC，非用户占位）是否要「管人」**：本轮是否需要：① **禁言**某位成员；② **踢出群聊**某位成员；③ **群主**强行修改某位成员的群内昵称（\`<<GROUP_SET_NICK>>\`，**非群主不可代改他人**）？请结合 §2 的职务与 §5 的当前禁言/警告状态构思冲突或管理行为。',
  )
  lines.push(
    '- **群主或管理员（NPC）｜四项编演自问（勿与权限冲突）**：若本轮戏份涉及 **§2 中的群主或管理员角色**，输出前自问本轮叙事是否需要触及——① **群管家敏感词**：是否在剧情里讨论或主张**新增/调整**违禁词（**§9 与客户端配置为唯一事实**，勿编造已写入；实际增删仍归用户侧设置）；② **撤回消息**：是否有人要在剧情上**撤回他人「本轮对话里已出现过的可见发言」**（仅作对白与动机描写；**勿**代替真人用户执行客户端撤回；权限逻辑须与后续「与客户端能力对齐」一致——代撤回等管理行为在用户占位仅为普通成员时**不得**声称已在客户端完成）；③ **任命 / 撤销群管理员**；④ **转让群主**。③④ 的职务前提须严格符合 **§2**，且不与上文「任命/撤销管理员」「转让群主」各条及文末客户端权限说明相矛盾。',
  )
  lines.push(
    '- **当群主为 NPC 角色（非用户占位）时，是否调整「群管理员」**：本轮剧情里，该 **NPC 群主**是否需**任命或撤销**某位成员的**群管理员**身份？若剧情已成立（例如用户明确索要且群主同意），须追加**独立一行**机器指令：\`<<GROUP_SET_ADMIN|群主角色ID|目标成员角色ID|admin>>\` 或 \`<<GROUP_SET_ADMIN|群主角色ID|目标成员角色ID|member>>\`；**角色ID** 须与 §1 成员表一致，目标可为用户占位 id。勿仅用对白宣称「已给管理」而不输出该行。',
  )
  lines.push(
    '- **当群主为 NPC 角色（非用户占位）时，是否「转让群主」**：本轮是否发生或需要铺垫「群主易主」？**客户端**仅当用户占位已是群主时可使用「转让群主」；用户为普通成员时勿写用户已完成转让落库。',
  )
  lines.push(
    '- **NPC 群主/管理员与群管家（违禁词/敏感词）**：本轮剧情是否需要安排这些**角色**（**不含**真实用户占位）讨论或主张——向群管家**补充敏感词、违禁词**？若有，仅在**对白与冲突**里呈现提议、争吵、甩锅；**实际词条的增删改**在客户端**群主或管理员**可操作（见 **§0**）；用户仅为普通成员时勿声称其已写入规则。叙事中**不得**声称规则已变更，除非与 **§9 快照**一致。',
  )
  lines.push(
    '- **NPC 群主（若群主为角色 id，非用户占位）与群公告**：本轮剧情是否需要**修改群公告**？若有，可输出 `<<GROUP_SET_ANNOUNCEMENT|群主角色ID|全文>>`（仅当该 ID 在 §2 中为群主时生效）。**禁止替用户**以用户占位 id 发布公告或宣称已代用户修改。',
  )
  lines.push(
    '- **成员是否知晓群公告内容**：群公告对**全员**可见；编演时若无剧情设定某人从不看群，则成员知晓的内容须与 **§8** 正文一致，勿编造矛盾；若 §8 为空则无人读过正文。',
  )
  lines.push(
    '- **与客户端能力对齐**：当前模型输出可自动落库 **`<<GROUP_SET_TITLE>>`**（群主或管理员）、**`<<GROUP_SET_ANNOUNCEMENT>>`**（仅群主）、**`<<GROUP_SET_NICK>>`**（改自己任意成员；**代改他人仅群主**）、**`<<GROUP_SET_ADMIN|群主ID|目标ID|admin|member>>`**（任免群管理员，**仅群主**为执行者 id）。**禁言、移出群成员、转让群主**尚无专用 `<<…>>` 时以**对白**表述即可，**禁止编造**上述五种以外的假 `<<…>>` 格式。客户端职务边界以 **§0** 为准：**群机器人敏感词/规则**任意成员可**查看**，**群主或管理员可编辑**；转让群主、编辑公告、解散等**仅群主**；改群名、@所有人、邀请（通讯录内）、禁言、移除成员为**群主或管理员**；普通成员仅邀请、改自己昵称、退出（见 **§0**）。',
  )

  const body = lines.join('\n')
  return (
    `\n\n---\n【后台自检快照｜发送前核对】\n` +
    `**第 0 节**为客户端职务权限产品规则（非单条数据库字段）。**第 1～9 节**由程序根据本地数据生成。**你必须以此为事实依据**，禁止编造与这些条目矛盾的成员、职务、禁言、警告、人脉边、玩家身份绑定、群公告或群管家规则。\n` +
    `**第 10 节**为剧情编演前的自问提纲（非数据库字段），输出前应结合用户最新消息与人设逐项斟酌；**全程禁止替用户做决定**。\n\n` +
    `${body}\n`
  )
}
