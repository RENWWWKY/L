import type { ApiConfig } from '../api/types'
import { publishCharacterMoment } from '../../../components/moments/characterMomentPublishService'
import { scheduleCharacterMomentArchive } from '../../../components/moments/momentArchiverService'
import { isMomentsChatApiConfigured } from '../../../components/moments/momentsChatApiReady'
import { resolveMomentsChatPublishContext } from '../../../components/moments/momentsChatPublishContext'
import { upsertUserMoment } from '../../../components/moments/momentsFeedStorage'

export type CharacterMomentPublishDirective = {
  topic?: string
  hint?: string
}

const PUBLISH_DIRECTIVE_RE =
  /^\[(?:发朋友圈|POST_MOMENT|MOMENT_POST)\](?:\s*(\{[\s\S]*\}))?\s*$/i

function parseDirectivePayload(raw?: string | null): Pick<CharacterMomentPublishDirective, 'topic' | 'hint'> {
  const jsonRaw = String(raw ?? '').trim()
  if (!jsonRaw) return {}
  try {
    const j = JSON.parse(jsonRaw) as {
      topic?: unknown
      hint?: unknown
      content?: unknown
      mood?: unknown
      direction?: unknown
    }
    const topic = String(j.topic ?? j.content ?? j.direction ?? '').trim() || undefined
    const hint = String(j.hint ?? j.mood ?? '').trim() || undefined
    return { topic, hint }
  } catch {
    return {}
  }
}

export function parseCharacterMomentPublishDirective(
  line: string,
): CharacterMomentPublishDirective | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  const match = PUBLISH_DIRECTIVE_RE.exec(t)
  if (!match) return null
  return parseDirectivePayload(match[1])
}

export function filterCharacterMomentPublishDirectives(bubbles: string[]): {
  bubbles: string[]
  directives: CharacterMomentPublishDirective[]
} {
  const directives: CharacterMomentPublishDirective[] = []
  const next = bubbles.filter((line) => {
    const directive = parseCharacterMomentPublishDirective(line)
    if (!directive) return true
    directives.push(directive)
    return false
  })
  return { bubbles: next, directives }
}

function buildChatRequestHint(directive: CharacterMomentPublishDirective): string | undefined {
  const parts = [directive.topic, directive.hint].map((x) => x?.trim()).filter(Boolean)
  return parts.length ? parts.join('；') : undefined
}

export async function applyCharacterMomentPublishDirectives(params: {
  accountId: string | null | undefined
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null | undefined
  directives: CharacterMomentPublishDirective[]
}): Promise<{ published: number; pinned: boolean[] }> {
  const cid = params.characterId.trim()
  if (!cid || !params.directives.length) return { published: 0, pinned: [] }
  if (!isMomentsChatApiConfigured(params.apiConfig)) return { published: 0, pinned: [] }

  const ctx = await resolveMomentsChatPublishContext({
    accountId: params.accountId,
    characterId: cid,
    playerIdentityId: params.playerIdentityId,
    playerDisplayName: params.playerDisplayName,
    apiConfig: params.apiConfig,
  })
  if (!ctx) return { published: 0, pinned: [] }

  const pinned: boolean[] = []
  let published = 0

  for (const directive of params.directives) {
    try {
      const result = await publishCharacterMoment({
        wechatCtx: ctx.wechatCtx,
        characterId: cid,
        characterContact: ctx.characterContact,
        momentContacts: ctx.momentContacts,
        blockedCharacterIds: ctx.blockedCharacterIds,
        imageGenSettings: ctx.imageGenSettings,
        chatRequestHint: buildChatRequestHint(directive),
        triggeredByUserRequest: true,
      })
      await upsertUserMoment(params.accountId, result.item)
      scheduleCharacterMomentArchive({
        moment: result.item,
        apiConfig: params.apiConfig,
        wechatAccountId: params.accountId,
        playerIdentityId: params.playerIdentityId,
        playerDisplayName: params.playerDisplayName,
        contactDirectory: ctx.contactDirectory,
      })
      published += 1
      pinned.push(!!result.item.isPinned)
    } catch {
      // 单条失败不阻断后续指令
    }
  }

  return { published, pinned }
}

export async function stripAndApplyCharacterMomentPublishDirectives(params: {
  accountId: string | null | undefined
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  apiConfig: ApiConfig | null | undefined
  bubbles: string[]
}): Promise<string[]> {
  const filtered = filterCharacterMomentPublishDirectives(params.bubbles)
  if (filtered.directives.length) {
    await applyCharacterMomentPublishDirectives({
      accountId: params.accountId,
      characterId: params.characterId,
      playerIdentityId: params.playerIdentityId,
      playerDisplayName: params.playerDisplayName,
      apiConfig: params.apiConfig,
      directives: filtered.directives,
    })
  }
  return filtered.bubbles
}

export const WECHAT_CHARACTER_MOMENT_PUBLISH_APPENDIX = `
---------------------
【发朋友圈（可选）】
---------------------
意图由你根据对话**自行判断**。当用户要你发一条**你自己的**朋友圈动态，或你经过对话后**自己决定**要发一条时：
- 先像真人一样用 **1～2 句**口语回应（可答应、犹豫、调侃、傲娇），**不要**写成教程。
- 若你**同意**发布：在可见回复中**另起一行**，整行**只**输出：
  - \`[发朋友圈]\` — 按你的人设与本轮对话自行撰写
  - 或带方向：\`[发朋友圈]{"topic":"主题","hint":"情绪/细节"}\`（topic/hint 可选，供生成时参考）
- 客户端会**静默生成并发布**实际动态；你**不要**在聊天里写出完整朋友圈正文，也**不要**用 \`[图片]\` 假装已发。
- **置顶**：是否在发布时置顶由生成逻辑根据内容重要性与你的人设**自行决定**；用户没提置顶时你也应自己判断，普通日常**不要**每条都置顶。若需置顶**已存在**的旧动态，才用 \`[置顶朋友圈]\` 指令。
- 若你不愿、觉得不合适、或用户指的是**用户自己**的朋友圈：只文字回应，**禁止**输出 \`[发朋友圈]\`。
- **务必区分（高频误用）**：换头像 / 换朋友圈背景（主页封面）≠ 发朋友圈动态。
  - 「背景换成我 / 用这张当背景 / 封面改一下」→ \`[换朋友圈背景]\`，**禁止** \`[发朋友圈]\`。
  - 「发条圈 / 晒一下 / 官宣发圈」→ 才用 \`[发朋友圈]\`。
  - 禁止口头说「背景换好了」却输出 \`[发朋友圈]\`；也不要把用户刚发来的换背景图当成发圈配图。
- 没有发动态意愿时，**不要**主动输出该指令（除非人设/剧情强烈驱动你此刻就要发）。
`.trim()
