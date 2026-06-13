import type { ApiConfig } from '../../phone/apps/api/types'
import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import type { CommentCatalogEntry, ThreadParticipant } from './momentCommentThreadContext'
import { formatCommentCatalogEntryLine } from './momentCommentThreadContext'
import type { MomentComment } from './mockMoments'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'
import {
  buildMomentCharacterRelationshipPromptBlock,
} from './momentRelationshipGraph'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import { runMomentsVisionChat } from './momentVisionChat'

export type ThreadReplyDraft = {
  authorCharId: string
  replyToCommentId: string
  content: string
}

const THREAD_REPLY_TASK = `
【朋友圈评区群聊推演】
这不是私聊，而是某条朋友圈下的评论串。用户发表了普通评论（含回复非发布者角色的评论），请模拟真实微信评区：被回复者必须回应；与发布者双向认识的共同好友也可插嘴、互怼或回复用户。
角色之间若无双向绑定，则互不可见对方评论，不得替无绑定对象「接话」。

输出规则：
- 仅输出 JSON：{"replies":[{"authorCharId":"角色ID","replyToCommentId":"被回复评论的id","content":"..."}, ...]}
- replies 按时间顺序排列，2～6 条为宜
- 至少 1 条来自「被用户回复的角色」(target)，直接回应用户
- 可有多条回复同一 commentId（如多人回复用户），也可角色互怼（replyToCommentId 填对方评论 id）
- **受众识别**：目录里标注「评用户」或受众含「一级评圈」的评论，是角色对**发朋友圈的用户**说话；其中「你/给你/您」指用户本人，不是围观角色。回复这类评论时应理解为围观/帮腔/调侃「A 对用户的狠话」，**禁止**误以为 A 在威胁或训斥你自己
- 只有明确「回复 某角色」且被回复者也在对用户说话的二级评论，接话时仍须分清：原话里的「你」通常仍指用户
- 发布者 publisher 是否出场由剧情决定，可护用户、拆台、和稀泥
- 每项 1～3 句口语，禁止编号前缀
- authorCharId 必须来自参与者列表；replyToCommentId 必须来自评论目录
- **互称规则**：若提供了【角色之间的人脉关系】，提及/回复对方时必须使用其中的「当面称呼」；禁止与关系矛盾的称谓（如母子绝不可互称学姐学长）
${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

function parseThreadReplies(
  payload: unknown,
  allowedCharIds: Set<string>,
  allowedCommentIds: Set<string>,
): ThreadReplyDraft[] | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  if (!Array.isArray(obj.replies)) return null

  const out: ThreadReplyDraft[] = []
  for (const row of obj.replies) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const authorCharId = typeof r.authorCharId === 'string' ? r.authorCharId.trim() : ''
    const replyToCommentId =
      typeof r.replyToCommentId === 'string' ? r.replyToCommentId.trim() : ''
    const content = sanitizeMomentText(typeof r.content === 'string' ? r.content : '')
    if (!authorCharId || !replyToCommentId || !content) continue
    if (!allowedCharIds.has(authorCharId)) continue
    if (!allowedCommentIds.has(replyToCommentId)) continue
    out.push({ authorCharId, replyToCommentId, content })
    if (out.length >= 8) break
  }

  return out.length ? out : null
}

export async function generateMomentThreadReplies(params: {
  wechatCtx: AnonymousQaWechatContext
  momentContent: string
  momentImages?: string[]
  publisherDisplayName: string
  publisherCharacterId: string
  targetCharacterId: string
  targetDisplayName: string
  userDisplayName: string
  userComment: MomentComment
  commentCatalog: CommentCatalogEntry[]
  participants: ThreadParticipant[]
  momentRelationships?: Relationship[]
}): Promise<ThreadReplyDraft[]> {
  assertMomentsChatApiConfigured(params.wechatCtx.apiConfig)
  const cfg = params.wechatCtx.apiConfig

  const allowedCharIds = new Set(params.participants.map((p) => p.charId))
  const allowedCommentIds = new Set(params.commentCatalog.map((c) => c.id))
  allowedCommentIds.add(params.userComment.id)

  const participantLines = params.participants
    .map((p) => `- ${p.displayName}（id: ${p.charId}，${p.role}）`)
    .join('\n')

  const catalogLines = params.commentCatalog
    .map((c) => formatCommentCatalogEntryLine(c))
    .join('\n')

  const userLine = `- id: ${params.userComment.id}，${params.userDisplayName} 回复 ${params.targetDisplayName}：${params.userComment.content}`

  const relationshipBlock = buildMomentCharacterRelationshipPromptBlock(
    params.participants.map((p) => ({ charId: p.charId, displayName: p.displayName })),
    params.momentRelationships ?? [],
  )

  const userTask = [
    `朋友圈正文：${params.momentContent.trim() || '（无文字）'}`,
    `发布者：${params.publisherDisplayName}（id: ${params.publisherCharacterId}）`,
    `用户 ${params.userDisplayName} 回复了 ${params.targetDisplayName}（id: ${params.targetCharacterId}），触发了评区连锁反应。`,
    '',
    relationshipBlock,
    relationshipBlock ? '' : null,
    '【参与者】',
    participantLines,
    '',
    '【已有评论（replyToCommentId 只能填下列 id）】',
    catalogLines || '（暂无其他评论）',
    userLine,
    '',
    '参考氛围示例（勿照抄，按当前人设与剧情发挥）：',
    '用户回复角色2：我的呢？',
    '→ 角色2 回复用户：我忘了，下次一定！',
    '→ 角色3 回复角色2：下次一定？我看没有下次了',
    '→ 角色3 回复用户：这笔账一定要记下啊！',
    '→ 发布者 回复用户：他忘了，我给你补上！',
    '',
    '反例（禁止）：顾琳评用户「给你纹黑眼圈」是对用户说的；司予回复顾琳时不应以为「给你」指司予自己。',
    '正例：司予回复顾琳：琳姐你对社长太狠了吧 😅（调侃顾琳对用户的狠话）',
    '',
    '请生成 replies JSON。',
  ]
    .filter((line) => line !== null)
    .join('\n')

  const raw = await runMomentsVisionChat(cfg as ApiConfig, {
    system: THREAD_REPLY_TASK,
    userText: userTask,
    momentImages: params.momentImages,
    temperature: 0.9,
    max_tokens: 1400,
  })

  const payload = parseModelJsonPayload(raw)
  const parsed = parseThreadReplies(payload, allowedCharIds, allowedCommentIds)
  if (parsed?.length) return parsed

  throw new Error('模型未返回有效评区回复，请重试')
}
