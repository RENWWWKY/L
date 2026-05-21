import { formatMeetMessageForAiTranscript } from './meetMessageQuote'
import type { MeetChatMessage } from './meetTypes'

export type MeetTranscriptSpeakerLabels = { user: string; npc: string }

/** 单条消息 → 模型可读叙述（含契约/真心话/盲盒等 UI 事件；无 messageId） */
export function meetMessageToContextNarrative(
  m: MeetChatMessage,
  labels?: MeetTranscriptSpeakerLabels,
): string | null {
  const who = (role: 'user' | 'npc') => (role === 'user' ? labels?.user ?? '用户' : labels?.npc ?? '对方')

  if (m.kind === 'meet_contract_user_request') {
    return `${who('user')}：【缔结契约】向对方发起交换联络方式（微信）的请求。`
  }
  if (m.kind === 'meet_contract_npc_status' && m.meetContractStatus) {
    const st = m.meetContractStatus
    return `${who('npc')}：【缔结契约·判定】${st.outcome === 'accepted' ? '同意互换联络方式' : '拒绝'}；action=${st.actionType}${st.charWechatId ? `；微信号=${st.charWechatId}` : ''}`
  }
  if (m.kind === 'meet_contract_char_request') {
    return `${who('npc')}：【缔结契约】${m.meetContractCharRequest?.resolved ? '曾发起交换申请（用户已回应）' : '发起交换联络方式申请，待用户在卡片上回应'}`
  }
  if (m.kind === 'meet_contract_user_response' && m.meetContractStatus) {
    const st = m.meetContractStatus
    return `${who('user')}：【缔结契约·用户回应】${st.outcome === 'accepted' ? '同意互换' : '暂缓互换'}`
  }
  if (m.kind === 'wechat_swap_card') return null
  if (m.kind === 'meet_echo_reveal' && m.echoReveal) {
    return `${who('user')}：【灵魂盲盒·已揭晓】题目：${m.echoReveal.question}；用户作答：${m.echoReveal.userAnswer}；对方作答：${m.echoReveal.npcAnswer}`
  }
  if (m.kind === 'meet_truth_mirror_char_request') {
    return `${who('npc')}：【交换真心话】${m.meetTruthMirrorCharRequest?.resolved ? '曾发起真心话邀约（用户已回应）' : '发起交换真心话邀约，待用户在卡片上同意或拒绝'}`
  }
  if (m.kind === 'meet_truth_mirror_user_response' && m.meetTruthMirrorUserResponse) {
    const st = m.meetTruthMirrorUserResponse
    return `${who('user')}：【交换真心话·用户回应】${st.outcome === 'accepted' ? '同意开始真心话仪式' : '暂不参与本轮真心话'}`
  }
  if (m.kind === 'meet_truth_mirror_record' && m.truthMirrorRecord) {
    return `${who('user')}：【交换真心话·已归档】题目：${m.truthMirrorRecord.question}；对方真心：${m.truthMirrorRecord.npcAnswer}；用户真心：${m.truthMirrorRecord.userAnswer}`
  }
  if (m.kind === 'meet_system') {
    return `${who('user')}：【现场播报】${m.content}`
  }
  if (m.kind === 'meet_music_share' && m.musicShare) {
    const a = m.musicShare.artist?.trim()
    return `${who('user')}：【同频共听】分享《${m.musicShare.title}》${a ? `（${a}）` : ''}`
  }
  return null
}

/** 将遇见消息转为模型用对话行（跳过纯 UI 卡、将特殊 kind 折叠为可读叙述） */
export function meetMessagesToAiTranscript(messages: MeetChatMessage[]): Array<{ role: 'user' | 'npc'; content: string }> {
  const out: Array<{ role: 'user' | 'npc'; content: string }> = []
  for (const m of messages) {
    const narrative = meetMessageToContextNarrative(m)
    if (narrative) {
      out.push({ role: m.role, content: narrative.replace(/^[^：]+：/, '').trim() })
      continue
    }
    if (m.role === 'user' && m.images?.[0]?.base64?.trim()) {
      const cap = m.content.replace(/\u200b/g, '').trim()
      out.push({
        role: 'user',
        content: cap ? `${cap}\n（附：用户发送了一张图片）` : '（发送了一张图片）',
      })
      continue
    }
    const raw = m.content.replace(/\u200b/g, '').trim()
    if (!raw && !m.replyTo) continue
    out.push({ role: m.role, content: formatMeetMessageForAiTranscript(m) })
  }
  return out
}
