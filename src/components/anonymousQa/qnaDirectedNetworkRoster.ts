import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { resolvePrivateChatNetworkRootId } from '../../phone/apps/wechat/privateChatNetworkNpcPronoun'
import { resolveRelationLabelBetweenCharacters } from './qnaDirectedRelationLabel'
import {
  DIRECTED_ANONYMOUS_AUTHOR,
  isDirectedAnonymousAuthor,
  normalizeDirectedPlayerReplyToName,
} from './qnaDirectedPlayerDisplay'
import { namesMatch } from './qnaThreadReplyRouting'
import type { MockContact } from './types'

/** 答主人脉网内、与答主有直接关系边的羁绊角色（可进评论区） */
export async function pickNetworkBoundCommenters(
  contacts: MockContact[],
  target: MockContact,
  max = 4,
): Promise<MockContact[]> {
  const tid = target.characterId?.trim()
  if (!tid) return []

  const targetChar = await personaDb.getCharacter(tid)
  const rootId = await resolvePrivateChatNetworkRootId(targetChar)
  if (!rootId) return []

  const boundIds = new Set<string>()
  try {
    const npcs = await personaDb.listNpcsFor(rootId)
    const cliqueIds = [...new Set([rootId, tid, ...npcs.map((n) => n.id)])]
    const rels = await personaDb.listRelationshipsInNetwork(cliqueIds)
    for (const r of rels) {
      if (r.isPlayerIdentity) continue
      if (r.fromCharacterId === tid) boundIds.add(r.toCharacterId)
      if (r.toCharacterId === tid) boundIds.add(r.fromCharacterId)
    }
  } catch {
    return []
  }
  boundIds.delete(tid)

  return contacts
    .filter((c) => c.id !== 'self' && c.characterId && boundIds.has(c.characterId))
    .slice(0, max)
}

export function buildDirectedInteractionRosterText(
  bound: MockContact[],
  authorName: string,
  authorId: string,
  playerWechatNickname: string,
  opts?: { userCommentAnonymous?: boolean },
): string {
  const wx = playerWechatNickname.trim() || '我'
  const playerLine = opts?.userCommentAnonymous
    ? `- ${DIRECTED_ANONYMOUS_AUTHOR}（玩家 · 本条评论已匿名；replyToName 指向玩家时必须用「匿名」，禁止写微信昵称或身份档案姓名；只可凭口吻猜测，不得在文中点破真名）`
    : `- ${wx}（玩家 · 微信昵称；replyToName 指向玩家时必须用此名，禁止用身份档案姓名）`
  const lines: string[] = [playerLine, `- ${authorName}（答主 · author · id: ${authorId}）`]
  for (const c of bound) {
    if (!c.characterId) continue
    lines.push(
      `- ${c.remarkName}（羁绊 · 通讯录展示名；可与有敌对/情敌/竞争等人脉边的其他羁绊楼中楼互怼，禁止 OOC）`,
    )
  }
  return lines.join('\n')
}

type InteractionRow = {
  authorName?: string
  authorType?: string
  replyToName?: string
  content?: string
  delayInSeconds?: number
  id?: string
}

/** 剔除名单外作者；无直接人脉边的两名 NPC 互接时改为接答主 */
export async function filterDirectedInteractionReplies<T extends InteractionRow>(
  rows: T[],
  ctx: {
    authorName: string
    authorId: string
    playerWechatNickname: string
    playerIdentityName?: string
    userCommentAnonymous?: boolean
    bound: MockContact[]
  },
): Promise<T[]> {
  const allowedNpcNames = new Set(ctx.bound.map((c) => c.remarkName.trim()))
  const wx = ctx.playerWechatNickname.trim()
  const id = ctx.playerIdentityName?.trim()
  const anon = ctx.userCommentAnonymous ? DIRECTED_ANONYMOUS_AUTHOR : ''
  const defaultPlayerTarget = anon || wx

  const nameToCharId = new Map<string, string>()
  nameToCharId.set(ctx.authorName.trim(), ctx.authorId)
  if (wx) nameToCharId.set(wx, '__player__')
  if (id) nameToCharId.set(id, '__player__')
  if (anon) nameToCharId.set(anon, '__player__')
  for (const c of ctx.bound) {
    const n = c.remarkName.trim()
    if (c.characterId) nameToCharId.set(n, c.characterId)
  }

  const out: T[] = []
  for (const row of rows) {
    const isAuthor = row.authorType === 'author'
    let authorName = String(row.authorName ?? '').trim()
    if (isAuthor) {
      authorName = ctx.authorName
    } else if (!allowedNpcNames.has(authorName)) {
      continue
    }

    let replyToName = normalizeDirectedPlayerReplyToName(
      String(row.replyToName ?? defaultPlayerTarget).trim() || defaultPlayerTarget,
      {
        wechatNickname: wx,
        identityName: ctx.userCommentAnonymous ? undefined : id,
        anonymousLabel: anon,
      },
    )
    const authorCharId = isAuthor ? ctx.authorId : nameToCharId.get(authorName)
    const targetCharId = nameToCharId.get(replyToName)

    const targetIsPlayer =
      (wx.length > 0 && namesMatch(replyToName, wx)) ||
      (!ctx.userCommentAnonymous && !!id && namesMatch(replyToName, id)) ||
      (!!anon && isDirectedAnonymousAuthor(replyToName))
    const targetIsAuthor = replyToName === ctx.authorName.trim()

    if (
      !targetIsPlayer &&
      !targetIsAuthor &&
      authorCharId &&
      targetCharId &&
      targetCharId !== '__player__' &&
      authorCharId !== ctx.authorId &&
      targetCharId !== ctx.authorId
    ) {
      const edge = await resolveRelationLabelBetweenCharacters(authorCharId, targetCharId)
      if (!edge) continue
    }

    out.push({
      ...row,
      authorName: isAuthor ? ctx.authorName : authorName,
      replyToName,
    })
  }
  return out
}
