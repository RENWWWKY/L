import type { ApiConfig } from '../../phone/apps/api/types'
import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'

import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import {
  clampMomentInteractionDelay,
  MOMENT_INTERACTION_DELAY_MAX_SECONDS,
  MOMENT_THREAD_REPLY_GAP_SECONDS,
  anchorThreadReplyDelaySeconds,
} from './momentInteractionTiming'
import {
  buildMomentCharacterRelationshipPromptBlock,
  loadMomentRelationships,
} from './momentRelationshipGraph'
import { formatUserMomentFirstCommentLine } from './momentCommentThreadContext'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import { runMomentsVisionChat } from './momentVisionChat'
import type { ResolvedUserMomentEngagementRules } from './userMomentEngagementRules'

const USER_MOMENT_THREAD_TASK = `
【朋友圈评区接话】
用户刚发了朋友圈，已有角色的首评。请模拟真实微信评区：角色之间可以互相回复、接话、抬杠，不必只对着用户说话。
必须仅输出 JSON，不要 Markdown：
{"replies":[{"charId":"角色ID","replyToCharId":"被回复者角色ID","content":"评论内容","delaySeconds":数字}, ...]}

规则：
1. charId、replyToCharId 必须来自允许名单；replyToCharId 须是已在首评里留过 comment 的角色。
2. replies 0～5 条，按时间顺序；无合适接话可输出 {"replies":[]}。
3. delaySeconds 为刷到朋友圈后的秒数（${30}～${MOMENT_INTERACTION_DELAY_MAX_SECONDS}），须晚于被回复者那条评论（建议 +${MOMENT_THREAD_REPLY_GAP_SECONDS}～120，留足刷圈与打字时间）。
4. 每项 1～2 句口语，符合人设与关系；禁止「看到了」「收到」等空话。
5. 可有多轮：A 评用户 → B 回复 A → A 再回复 B → C 插话回复 A 等。
6. **受众识别**：【已有首评】里标注「评用户」的，是角色对**发朋友圈的用户**说话；其中「你/给你/您」指用户本人，不是围观角色。回复这类评论时应理解为围观/帮腔/调侃，**禁止**把对用户说的「给你」理解成在威胁你自己。
7. **互称规则**：若提供了【角色之间的人脉关系】，回复/提及对方时必须使用其中的「当面称呼」；禁止与关系矛盾的称谓（母子不可互称学姐学长等）。
${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

function parseThreadReplyDrafts(
  payload: unknown,
  allowedCharIds: Set<string>,
  commentAuthorCharIds: Set<string>,
  maxReplies = 6,
): AiMomentInteractionDraft[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  if (!Array.isArray(obj.replies)) return []

  const out: AiMomentInteractionDraft[] = []
  for (const row of obj.replies) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const charId = typeof r.charId === 'string' ? r.charId.trim() : ''
    const replyToCharId =
      typeof r.replyToCharId === 'string' ? r.replyToCharId.trim() : ''
    const content = sanitizeMomentText(typeof r.content === 'string' ? r.content : '')
    if (!charId || !replyToCharId || !content) continue
    if (!allowedCharIds.has(charId) || !allowedCharIds.has(replyToCharId)) continue
    if (!commentAuthorCharIds.has(replyToCharId)) continue
    if (charId === replyToCharId) continue

    const delayRaw = Number(r.delaySeconds)
    const delaySeconds = Number.isFinite(delayRaw) ? clampMomentInteractionDelay(delayRaw) : 150

    out.push({
      charId,
      type: 'comment',
      content: content.slice(0, 280),
      delaySeconds,
      replyToCharId,
    })
    if (out.length >= maxReplies) break
  }
  return out
}

function buildInitialCommentCatalog(
  baseDrafts: AiMomentInteractionDraft[],
  allowedCharacters: AllowedMomentCharacter[],
  userDisplayName: string,
): { lines: string; commentAuthorCharIds: Set<string> } {
  const nameById = new Map(allowedCharacters.map((c) => [c.charId, c.displayName]))
  const lines: string[] = []
  const commentAuthorCharIds = new Set<string>()

  for (const d of baseDrafts) {
    if (d.type !== 'comment' || !d.content?.trim()) continue
    const id = d.charId.trim()
    if (!id) continue
    commentAuthorCharIds.add(id)
    const name = nameById.get(id) ?? id
    const replyToCharId = d.replyToCharId?.trim()
    if (replyToCharId) {
      const targetName = nameById.get(replyToCharId) ?? replyToCharId
      lines.push(
        `- ${name}（charId: ${id}）回复 ${targetName}（charId: ${replyToCharId}）：${d.content.trim()}`,
      )
      lines.push(`  ※ 被回复者那条多半仍是对用户说的；接话时勿把原话里的「你/给你」当成在说你`)
    } else {
      lines.push(
        formatUserMomentFirstCommentLine({
          authorName: name,
          charId: id,
          content: d.content,
          userDisplayName,
        }),
      )
    }
  }

  return { lines: lines.join('\n'), commentAuthorCharIds }
}

/** 在首评之后补充角色之间的评区接话（二级及以上评论） */
export async function supplementUserMomentCharacterThreads(params: {
  wechatCtx: AnonymousQaWechatContext
  momentContent: string
  momentImages?: string[]
  imageCount: number
  allowedCharacters: AllowedMomentCharacter[]
  baseDrafts: AiMomentInteractionDraft[]
  userDisplayName: string
  engagementRules?: ResolvedUserMomentEngagementRules
}): Promise<AiMomentInteractionDraft[]> {
  const maxThreadReplies = params.engagementRules?.maxThreadReplies ?? 4
  if (maxThreadReplies <= 0) return []
  const userDisplayName = params.userDisplayName.trim() || '用户'
  const { lines, commentAuthorCharIds } = buildInitialCommentCatalog(
    params.baseDrafts,
    params.allowedCharacters,
    userDisplayName,
  )
  if (commentAuthorCharIds.size === 0) return []
  if (params.allowedCharacters.length < 2) return []

  assertMomentsChatApiConfigured(params.wechatCtx.apiConfig)
  const cfg = params.wechatCtx.apiConfig as ApiConfig
  const allowedCharIds = new Set(params.allowedCharacters.map((c) => c.charId))
  const roster = params.allowedCharacters.map((c) => `${c.charId}（${c.displayName}）`).join('、')
  const relationships = await loadMomentRelationships()
  const relationshipBlock = buildMomentCharacterRelationshipPromptBlock(
    params.allowedCharacters,
    relationships,
  )

  const userTask = [
    `用户 ${userDisplayName} 的朋友圈正文：${params.momentContent.trim() || '（无文字）'}`,
    `配图数：${params.imageCount}`,
    `说明：一级首评默认是对用户 ${userDisplayName} 说的；评区接话时须分清「你/给你」指谁。`,
    maxThreadReplies <= 1
      ? `【频度】本动态评区接话最多 ${maxThreadReplies} 条；无合适接话请 {"replies":[]}。`
      : null,
    '',
    relationshipBlock,
    relationshipBlock ? '' : null,
    '【已有首评】',
    lines,
    '',
    '参考氛围（勿照抄，按人设与真实关系发挥；称谓须服从上方人脉关系）：',
    '用户：好累',
    '→ 角色1 评用户：怎么了？',
    '→ 角色2 回复 角色1：还能怎样？肯定是今天下午太累了呗！',
    '→ 角色1 回复 角色2：啊，有吗？',
    '',
    '反例（禁止）：顾琳评用户「给你纹黑眼圈」是对用户说的；司予回复顾琳时不应以为要给自己纹。',
    '正例：司予回复顾琳：琳姐你对社长太狠了吧 😅',
    '',
    `允许名单：${roster}`,
    '请生成 replies JSON。',
  ]
    .filter((line) => line !== null)
    .join('\n')

  const raw = await runMomentsVisionChat(cfg, {
    system: USER_MOMENT_THREAD_TASK.replace(
      '0～5 条',
      `0～${Math.min(5, maxThreadReplies)} 条`,
    ),
    userText: userTask,
    momentImages: params.momentImages,
    temperature: 0.86,
    max_tokens: 1100,
  })

  const payload = parseModelJsonPayload(raw)
  const parsed = parseThreadReplyDrafts(
    payload,
    allowedCharIds,
    commentAuthorCharIds,
    maxThreadReplies,
  )
  const prior = [...params.baseDrafts]
  const anchored: AiMomentInteractionDraft[] = []
  for (const [index, draft] of parsed.entries()) {
    const delaySeconds = anchorThreadReplyDelaySeconds({
      replyToCharId: draft.replyToCharId!,
      requestedDelay: draft.delaySeconds,
      slotIndex: index,
      priorCommentDrafts: prior,
    })
    const next = { ...draft, delaySeconds }
    anchored.push(next)
    prior.push(next)
  }
  return anchored
}
