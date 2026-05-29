import { personaDb } from './newFriendsPersona/idb'
import type { Character, PlayerNetworkLink, Relationship } from './newFriendsPersona/types'
import type {
  MemoryTraceNetworkCharEdge,
  MemoryTraceNetworkIdentityEdge,
  MemoryTraceNetworkPlayerLink,
  MemoryTraceNetworkRelationships,
} from './memoryTraceTypes'
import {
  characterRelVisibleInChatPrompt,
  hasReverseCharacterRelationship,
} from './newFriendsPersona/personaRoster/crossBindings/crossBindingEngine'
import { getCharacterBoundPlayerIdentityId } from './wechatCharacterPlayerIdentity'
import { resolvePrivateChatNetworkRootId } from './privateChatNetworkNpcPronoun'

const DEFAULT_MAX_CHARS = 3800

function clip(s: string, max: number): string {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export type NetworkRelationshipsPromptOpts = {
  rootId: string
  /** 当前私聊对象（标注「你」并优先展示相关边） */
  focusCharacterId: string
  /** 约会线下：仅主角↔NPC；私聊默认 false = 圈内全部角色↔角色边 */
  mainToNpcOnly?: boolean
  maxChars?: number
}

type CliqueLoaded = {
  focusId: string
  focusName: string
  rootLabel: string
  idToName: Map<string, string>
  charRels: Relationship[]
  involvingFocus: Relationship[]
  otherRels: Relationship[]
  playerLinks: PlayerNetworkLink[]
}

function formatCharCharEdge(
  r: Relationship,
  idToName: Map<string, string>,
  focusId: string,
  charRels: Relationship[],
): string {
  const a = idToName.get(r.fromCharacterId)
  const b = idToName.get(r.toCharacterId)
  if (!a || !b) return ''
  const rel = (r.relation || '').trim() || '关系'
  const call = (r.fromCallsTo || '').trim()
  const callBit = call ? ` · ${a}称${b}「${call}」` : ''
  const fp = clip(r.fromPerspective, 120)
  const tp = clip(r.toPerspective, 120)
  const mutual = hasReverseCharacterRelationship(charRels, r)
  const focusIsFrom = r.fromCharacterId === focusId
  const tailParts: string[] = []
  if (mutual) {
    if (fp) tailParts.push(`（${a}看：${fp}）`)
    if (tp) tailParts.push(`（${b}看：${tp}）`)
  } else if (focusIsFrom && fp) {
    tailParts.push(`（你看：${fp}）`)
  } else if (fp) {
    tailParts.push(`（${a}看：${fp}）`)
  }
  const tail = tailParts.join(' ')
  const involvesFocus = r.fromCharacterId === focusId || r.toCharacterId === focusId
  const focusTag = involvesFocus ? ' · **与你直接相关**' : ''
  const oneWayNote = !mutual && focusIsFrom ? ' · **单方面认识（对方不知）**' : ''
  return `- ${a} —「${rel}」→ ${b}${callBit}${tail ? ` ${tail}` : ''}${focusTag}${oneWayNote}`
}

function relToTraceCharEdge(
  r: Relationship,
  idToName: Map<string, string>,
  focusId: string,
  charRels: Relationship[],
): MemoryTraceNetworkCharEdge | null {
  const fromName = idToName.get(r.fromCharacterId)
  const toName = idToName.get(r.toCharacterId)
  if (!fromName || !toName) return null
  const call = (r.fromCallsTo || '').trim()
  const mutual = hasReverseCharacterRelationship(charRels, r)
  const focusIsFrom = r.fromCharacterId === focusId
  return {
    fromName,
    toName,
    relation: (r.relation || '').trim() || '关系',
    fromCallsTo: call || undefined,
    fromPerspective: clip(r.fromPerspective, 200),
    toPerspective: mutual || !focusIsFrom ? clip(r.toPerspective, 200) : '',
    involvesFocus: r.fromCharacterId === focusId || r.toCharacterId === focusId,
  }
}

function playerLinkToTraceRow(
  pl: PlayerNetworkLink,
  nm: string,
  focusId: string,
): MemoryTraceNetworkPlayerLink | null {
  const row: MemoryTraceNetworkPlayerLink = {
    targetName: nm,
    isFocusCharacter: pl.characterId === focusId,
    relationThemToYou: pl.relationThemToYou?.trim() || undefined,
    theySeeYou: pl.theySeeYou?.trim() || undefined,
    relationYouToThem: pl.relationYouToThem?.trim() || undefined,
    youSeeThem: pl.youSeeThem?.trim() || undefined,
    theyCallYou: pl.theyCallYou?.trim() || undefined,
    youCallThem: pl.youCallThem?.trim() || undefined,
  }
  const hasAny =
    row.relationThemToYou ||
    row.theySeeYou ||
    row.relationYouToThem ||
    row.youSeeThem ||
    row.theyCallYou ||
    row.youCallThem
  return hasAny ? row : null
}

function formatPlayerLinkRow(pl: PlayerNetworkLink, nm: string, focusId: string): string {
  const isSelf = pl.characterId === focusId
  const tag = isSelf ? '（**你**对玩家的站位）' : ''
  const bits = [
    pl.relationThemToYou ? `TA对你的关系：${clip(pl.relationThemToYou, 80)}` : '',
    pl.theySeeYou ? `TA怎么看你：${clip(pl.theySeeYou, 100)}` : '',
    pl.relationYouToThem ? `你对TA的关系词：${clip(pl.relationYouToThem, 60)}` : '',
    pl.youSeeThem ? `你怎么看TA：${clip(pl.youSeeThem, 100)}` : '',
    pl.theyCallYou ? `TA称呼你：${clip(pl.theyCallYou, 40)}` : '',
    pl.youCallThem ? `你称呼TA：${clip(pl.youCallThem, 40)}` : '',
  ]
    .filter(Boolean)
    .join('；')
  if (!bits) return ''
  return `- 「${nm}」${tag}：${bits.slice(0, 320)}`
}

function formatPlayerIdentityEdge(r: Relationship, focusId: string, idenName: string): string {
  const rel = (r.relation || '').trim() || '关系'
  if (r.toCharacterId === focusId) {
    return `- 玩家身份「${idenName}」—「${rel}」→ 你：${clip(r.fromPerspective, 140)}；你怎么看TA：${clip(r.toPerspective, 140)}`
  }
  if (r.fromCharacterId === focusId) {
    return `- 你 —「${rel}」→ 玩家身份「${idenName}」：${clip(r.fromPerspective, 140)}；TA怎么看你：${clip(r.toPerspective, 140)}`
  }
  return `- 玩家身份「${idenName}」：${clip(r.fromPerspective, 100)}／${clip(r.toPerspective, 100)}`
}

function identityEdgeToTrace(
  r: Relationship,
  focusId: string,
  idenName: string,
  scopeLabel: string,
): MemoryTraceNetworkIdentityEdge {
  const rel = (r.relation || '').trim() || '关系'
  return {
    scopeLabel,
    identityName: idenName,
    relation: rel,
    summary: formatPlayerIdentityEdge(r, focusId, idenName).replace(/^- /, ''),
  }
}

async function loadCliqueNetwork(opts: NetworkRelationshipsPromptOpts): Promise<CliqueLoaded | null> {
  const rootId = opts.rootId.trim()
  const focusId = opts.focusCharacterId.trim()
  if (!rootId || !focusId) return null

  try {
    const [root, npcRows, playerLinks] = await Promise.all([
      personaDb.getCharacter(rootId),
      personaDb.listNpcsFor(rootId),
      personaDb.getPlayerNetworkLinks(rootId),
    ])
    const npcs = npcRows as Character[]
    const idToName = new Map<string, string>()
    const rootLabel = (root?.name || root?.wechatNickname || '').trim() || '档案主角'
    idToName.set(rootId, rootLabel)
    for (const n of npcs) {
      idToName.set(n.id, (n.name || n.wechatNickname || '').trim() || '未命名')
    }

    const cliqueIds = [rootId, ...npcs.map((n) => n.id)]
    const rels = (await personaDb.listRelationshipsInNetwork(cliqueIds)).filter((r) => !r.isPlayerIdentity)

    let charRels = rels
    if (opts.mainToNpcOnly) {
      charRels = rels.filter((r) => {
        const fromMain = r.fromCharacterId === rootId && r.toCharacterId !== rootId
        const toMain = r.toCharacterId === rootId && r.fromCharacterId !== rootId
        return fromMain || toMain
      })
    }

    const focusName = idToName.get(focusId) || '你'
    const involvingFocus = charRels.filter(
      (r) =>
        (r.fromCharacterId === focusId || r.toCharacterId === focusId) &&
        characterRelVisibleInChatPrompt(r, focusId, charRels),
    )
    const otherRels = charRels.filter(
      (r) =>
        r.fromCharacterId !== focusId &&
        r.toCharacterId !== focusId &&
        characterRelVisibleInChatPrompt(r, focusId, charRels),
    )

    if (charRels.length === 0 && !playerLinks.length) return null

    return {
      focusId,
      focusName,
      rootLabel,
      idToName,
      charRels,
      involvingFocus,
      otherRels,
      playerLinks,
    }
  } catch {
    return null
  }
}

function buildCliquePromptFromLoaded(loaded: CliqueLoaded, cap: number): string {
  const { focusId, focusName, charRels, involvingFocus, otherRels, playerLinks, idToName } = loaded
  const lines: string[] = []
  lines.push(
    `【人脉圈内 · 角色关系与看法】你是「${focusName}」。下列来自人设「人脉」配置；提及圈内姓名时须符合关系与双方视角，**禁止**与表内明显矛盾。`,
  )

  if (involvingFocus.length) {
    lines.push('\n【与你直接相关】')
    for (const r of involvingFocus.slice(0, 32)) {
      const line = formatCharCharEdge(r, idToName, focusId, charRels)
      if (line) lines.push(line)
    }
  }

  if (otherRels.length) {
    lines.push('\n【圈内其他人际（你了解或可能提及）】')
    for (const r of otherRels.slice(0, 36)) {
      const line = formatCharCharEdge(r, idToName, focusId, charRels)
      if (line) lines.push(line)
    }
  }

  const selfLink = playerLinks.find((pl) => pl.characterId === focusId)
  const otherLinks = playerLinks.filter((pl) => pl.characterId !== focusId)
  if (selfLink || otherLinks.length) {
    lines.push('\n【玩家与圈内角色（人脉 · 玩家视角配置）】')
    if (selfLink) {
      const row = formatPlayerLinkRow(selfLink, focusName, focusId)
      if (row) lines.push(row)
    }
    for (const pl of otherLinks.slice(0, 16)) {
      const nm = idToName.get(pl.characterId)
      if (!nm) continue
      const row = formatPlayerLinkRow(pl, nm, focusId)
      if (row) lines.push(row)
    }
  }

  const body = lines.join('\n').slice(0, cap)
  return (
    `\n\n---\n${body}\n` +
    `（↑ 私聊中谈到圈内人时：关系档位、称呼、${focusName}对TA/TA对${focusName}的看法须与上表一致；勿凭空编造表外亲密关系。）\n`
  )
}

function buildCliqueTraceFromLoaded(loaded: CliqueLoaded): Omit<
  MemoryTraceNetworkRelationships,
  'identityEdges' | 'promptExcerpt' | 'injected'
> {
  const { focusId, focusName, rootLabel, charRels, involvingFocus, otherRels, playerLinks, idToName } = loaded
  const involvingFocusTrace: MemoryTraceNetworkCharEdge[] = []
  for (const r of involvingFocus.slice(0, 32)) {
    const edge = relToTraceCharEdge(r, idToName, focusId, charRels)
    if (edge) involvingFocusTrace.push(edge)
  }
  const otherInClique: MemoryTraceNetworkCharEdge[] = []
  for (const r of otherRels.slice(0, 36)) {
    const edge = relToTraceCharEdge(r, idToName, focusId, charRels)
    if (edge) otherInClique.push(edge)
  }
  const playerLinkRows: MemoryTraceNetworkPlayerLink[] = []
  const selfLink = playerLinks.find((pl) => pl.characterId === focusId)
  if (selfLink) {
    const row = playerLinkToTraceRow(selfLink, focusName, focusId)
    if (row) playerLinkRows.push(row)
  }
  for (const pl of playerLinks.filter((p) => p.characterId !== focusId).slice(0, 16)) {
    const nm = idToName.get(pl.characterId)
    if (!nm) continue
    const row = playerLinkToTraceRow(pl, nm, focusId)
    if (row) playerLinkRows.push(row)
  }
  return {
    focusCharacterName: focusName,
    rootCharacterName: rootLabel,
    involvingFocus: involvingFocusTrace,
    otherInClique,
    playerLinks: playerLinkRows,
  }
}

/**
 * 人脉圈内角色↔角色关系、双方看法、称呼；供私聊/约会模型遵守，勿乱造圈内关系。
 */
export async function buildNetworkRelationshipsPromptBlock(
  opts: NetworkRelationshipsPromptOpts,
): Promise<string> {
  const loaded = await loadCliqueNetwork(opts)
  if (!loaded) return ''
  return buildCliquePromptFromLoaded(loaded, opts.maxChars ?? DEFAULT_MAX_CHARS)
}

/** 私聊：人脉关系 + 当前会话玩家身份↔本角色绑定边 */
export async function loadPrivateChatNetworkRelationshipsBlock(params: {
  character: Character | null | undefined
  sessionPlayerIdentityId?: string | null
}): Promise<string> {
  const ch = params.character
  if (!ch?.id?.trim()) return ''

  const rootId = await resolvePrivateChatNetworkRootId(ch)
  if (!rootId) return ''

  const focusId = ch.id.trim()
  const sessionPid = params.sessionPlayerIdentityId?.trim() || ''
  const boundPid = getCharacterBoundPlayerIdentityId(ch) || ''

  const chunks: string[] = []

  const relBlock = await buildNetworkRelationshipsPromptBlock({
    rootId,
    focusCharacterId: focusId,
    mainToNpcOnly: false,
    maxChars: 3200,
  })
  if (relBlock.trim()) chunks.push(relBlock.trim())

  const identityIds: string[] = []
  if (sessionPid && sessionPid !== '__none__' && sessionPid !== boundPid) identityIds.push(sessionPid)
  if (boundPid && boundPid !== '__none__' && !identityIds.includes(boundPid)) identityIds.push(boundPid)

  if (identityIds.length) {
    const idenLines: string[] = []
    for (const pid of identityIds) {
      let rels: Relationship[] = []
      try {
        rels = await personaDb.listRelationshipsForIdentity(pid)
      } catch {
        continue
      }
      const edges = rels.filter(
        (r) =>
          r.isPlayerIdentity &&
          (r.fromCharacterId === pid || r.toCharacterId === pid) &&
          (r.fromCharacterId === focusId || r.toCharacterId === focusId),
      )
      if (!edges.length) continue
      const iden = await personaDb.getPlayerIdentity(pid)
      const idenName = (iden?.name || iden?.wechatNickname || '').trim() || '玩家身份'
      const heading =
        pid === boundPid && pid !== sessionPid
          ? '【玩家身份 · 档案主绑定】'
          : '【玩家身份 · 当前会话】'
      idenLines.push(heading)
      for (const r of edges) {
        idenLines.push(formatPlayerIdentityEdge(r, focusId, idenName))
      }
    }
    if (idenLines.length) {
      chunks.push(
        `\n\n---\n【玩家身份与人设关系边】\n${idenLines.join('\n')}\n（↑ 与上表圈内角色关系一并参考；勿与绑定信息矛盾。）\n`,
      )
    }
  }

  return chunks.join('')
}

/** 思维溯源：与私聊注入同源的圈内关系 + 玩家身份边（`promptExcerpt` 由发布端做占位符展开） */
export async function buildPrivateChatNetworkRelationshipsTrace(params: {
  character: Character | null | undefined
  sessionPlayerIdentityId?: string | null
}): Promise<MemoryTraceNetworkRelationships | null> {
  const ch = params.character
  if (!ch?.id?.trim()) return null

  const rootId = await resolvePrivateChatNetworkRootId(ch)
  if (!rootId) return null

  const focusId = ch.id.trim()
  const sessionPid = params.sessionPlayerIdentityId?.trim() || ''
  const boundPid = getCharacterBoundPlayerIdentityId(ch) || ''

  const loaded = await loadCliqueNetwork({
    rootId,
    focusCharacterId: focusId,
    mainToNpcOnly: false,
  })

  const identityEdges: MemoryTraceNetworkIdentityEdge[] = []
  const identityIds: string[] = []
  if (sessionPid && sessionPid !== '__none__' && sessionPid !== boundPid) identityIds.push(sessionPid)
  if (boundPid && boundPid !== '__none__' && !identityIds.includes(boundPid)) identityIds.push(boundPid)

  const idenPromptChunks: string[] = []
  for (const pid of identityIds) {
    let rels: Relationship[] = []
    try {
      rels = await personaDb.listRelationshipsForIdentity(pid)
    } catch {
      continue
    }
    const edges = rels.filter(
      (r) =>
        r.isPlayerIdentity &&
        (r.fromCharacterId === pid || r.toCharacterId === pid) &&
        (r.fromCharacterId === focusId || r.toCharacterId === focusId),
    )
    if (!edges.length) continue
    const iden = await personaDb.getPlayerIdentity(pid)
    const idenName = (iden?.name || iden?.wechatNickname || '').trim() || '玩家身份'
    const scopeLabel =
      pid === boundPid && pid !== sessionPid ? '档案主绑定' : '当前会话'
    idenPromptChunks.push(`【玩家身份 · ${scopeLabel}】`)
    for (const r of edges) {
      identityEdges.push(identityEdgeToTrace(r, focusId, idenName, scopeLabel))
      idenPromptChunks.push(formatPlayerIdentityEdge(r, focusId, idenName))
    }
  }

  const promptParts: string[] = []
  if (loaded) {
    const relBlock = buildCliquePromptFromLoaded(loaded, 3200)
    if (relBlock.trim()) promptParts.push(relBlock.trim())
  }
  if (idenPromptChunks.length) {
    promptParts.push(
      `\n\n---\n【玩家身份与人设关系边】\n${idenPromptChunks.join('\n')}\n（↑ 与上表圈内角色关系一并参考；勿与绑定信息矛盾。）\n`,
    )
  }

  const promptRaw = promptParts.join('')
  if (!promptRaw.trim() && !loaded) return null

  const cliqueTrace = loaded
    ? buildCliqueTraceFromLoaded(loaded)
    : {
        focusCharacterName: (ch.name || ch.wechatNickname || '').trim() || '你',
        rootCharacterName: '档案主角',
        involvingFocus: [] as MemoryTraceNetworkCharEdge[],
        otherInClique: [] as MemoryTraceNetworkCharEdge[],
        playerLinks: [] as MemoryTraceNetworkPlayerLink[],
      }

  const hasStructured =
    cliqueTrace.involvingFocus.length > 0 ||
    cliqueTrace.otherInClique.length > 0 ||
    cliqueTrace.playerLinks.length > 0 ||
    identityEdges.length > 0

  if (!promptRaw.trim() && !hasStructured) return null

  return {
    injected: Boolean(promptRaw.trim()),
    ...cliqueTrace,
    identityEdges,
    /** 发布思维溯源前须经 `expandTraceTextForCharacter` 展开占位符 */
    promptExcerpt: promptRaw,
  }
}
