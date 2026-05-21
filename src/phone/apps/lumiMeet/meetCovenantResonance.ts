import type { MeetChatMessage } from './meetTypes'

/** 是否仍有待用户回应的角色主动交换申请 */
export function hasUnresolvedMeetCharContractRequest(messages: MeetChatMessage[]): boolean {
  return messages.some(
    (m) => m.kind === 'meet_contract_char_request' && !m.meetContractCharRequest?.resolved,
  )
}

/** 契约 / 联络：将 0–100 好感刻度格式化为模型可读的概率倾向说明 */
export function formatMeetCovenantResonanceGuidance(resonanceScore: number): string {
  const r = Math.max(0, Math.min(100, Math.round(Number(resonanceScore))))
  return `情感共鸣刻度（0–100）：${r}
- 刻度≈亲近基础概率：可粗视为约 ${r}% 的「愿意互换私下联络」倾向，**不是**硬性门槛。
- **人设优先于数字**：天生外向、爱交朋友、已欣赏用户 → 低刻度也可 agree；慢热防备、反感越界、对用户无感 → 高刻度也可 reject。
- 结合本轮对话质量、边界感与用户态度综合裁量；reject 时口语自然说明原因，勿复读刻度百分比。`
}

export function formatMeetChatResonanceLine(resonanceScore: number): string {
  const r = Math.max(0, Math.min(100, Math.round(Number(resonanceScore))))
  return `【当前情感共鸣刻度】${r}/100：约 ${r}% 亲近倾向；语气与人设、对话节奏一致，禁止油腻越界、土味情话、未熟先定关系。**未互换前**勿在气泡写出完整微信号（界面仪式收口）；若系统「联络」小节允许试探，可口头聊「要不要换个方式联系」。`
}
