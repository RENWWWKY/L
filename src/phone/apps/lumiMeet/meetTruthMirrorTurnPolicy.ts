import type { MeetReplyEvaluation } from './meetEvaluationParse'
import type { MeetChatMessage } from './meetTypes'
import { hasUnresolvedMeetTruthMirrorCharRequest } from './meetTruthMirrorResonance'

/** 内置「交换真心话」玩法邀请（应由卡片/UI 承接，不宜与口头真心话同轮） */
const TRUTH_MIRROR_GAME_INVITE_RE =
  /交换真心话|真心话仪式|双盲|抽(?:一)?张题|翻牌揭晓|来玩(?:一局|一轮)?真心话|真心话玩法|开(?:一局|一轮)?真心话|走(?:一局|一轮)?真心话/

/** 口头在聊里直接问对方的「真心话式」问句（与内置玩法二选一） */
const VERBAL_TRUTH_QUESTION_RE =
  /(?:真心话|说实话|坦白说|老实讲|敢不敢|愿不愿意).{0,24}[？?]|(?:问你|想问你|我问你).{0,20}(?:真心|实话|坦白)/

export function lineInvitesTruthMirrorGame(line: string): boolean {
  return TRUTH_MIRROR_GAME_INVITE_RE.test(String(line ?? '').trim())
}

export function lineIsVerbalTruthQuestion(line: string): boolean {
  return VERBAL_TRUTH_QUESTION_RE.test(String(line ?? '').trim())
}

export function repliesInviteTruthMirrorGame(replies: string[]): boolean {
  return replies.some((l) => lineInvitesTruthMirrorGame(l))
}

export function repliesHaveVerbalTruthQuestion(replies: string[]): boolean {
  return replies.some((l) => lineIsVerbalTruthQuestion(l))
}

export function buildMeetTruthMirrorOutputPolicy(params: {
  thread: MeetChatMessage[]
  ceremonyOpen?: boolean
}): string {
  const pendingInvite = hasUnresolvedMeetTruthMirrorCharRequest(params.thread)
  const ceremonyOpen = !!params.ceremonyOpen
  const lines: string[] = [
    '---------------------',
    '【交换真心话 · 二选一（硬性）】',
    '---------------------',
    '本 App 只有两种「真心话」形态，**同一轮回复只能选一种**，禁止同时做：',
    'A) **口头真心话**：像普通聊天，在气泡里自然问对方**一个**你想了解的问题（可用「真心话/说实话」等口语，但**不要**提「抽卡、双盲、仪式、交换真心话功能、翻牌」）；问句须具体、尊重边界，**禁止**土味情话式盘问或借机表白。',
    'B) **内置真心话玩法**：仅在 evaluation 里把 proactive_truth_mirror 设为 true；系统会弹出正式邀请卡，用户点选后才进入抽题与双盲作答。**一旦设为 true**：',
    '   - 口语里**禁止**再问真心话题、**禁止**口述「我们来玩交换真心话/双盲/抽题」；',
    '   - 最多允许 1～2 行极短铺垫（如「有个事想认真问你」），**不要**在气泡里把题目问完。',
  ]
  if (pendingInvite) {
    lines.push(
      '当前：已有你发起的「交换真心话」邀请卡待用户回应 → proactive_truth_mirror 必须为 false；勿在口语里重复邀请玩法。',
    )
  } else if (ceremonyOpen) {
    lines.push('当前：用户正在真心话仪式界面 → proactive_truth_mirror 必须为 false；勿发起新玩法。')
  } else {
    lines.push('当前：无待回应邀请、未在仪式中 → 可在 A/B 中择一；若选 B 则勿在气泡里重复玩法话术。')
  }
  return lines.join('\n')
}

/** 同轮禁止「口头真心话题 + 内置玩法卡片」并存 */
export function applyMeetTruthMirrorTurnPolicy(
  evaluation: MeetReplyEvaluation | null,
  replies: string[],
): { evaluation: MeetReplyEvaluation | null; replies: string[] } {
  let ev = evaluation
  let out = [...replies]

  const verbal = repliesHaveVerbalTruthQuestion(out)
  const gameInvite = repliesInviteTruthMirrorGame(out)

  if (ev?.proactiveTruthMirror && verbal) {
    ev = { ...ev, proactiveTruthMirror: false }
  }

  if (ev?.proactiveTruthMirror) {
    out = out.filter((line) => !lineInvitesTruthMirrorGame(line) && !lineIsVerbalTruthQuestion(line))
  } else if (gameInvite && !ev?.proactiveTruthMirror) {
    out = out.filter((line) => !lineInvitesTruthMirrorGame(line))
  }

  return { evaluation: ev, replies: out }
}
