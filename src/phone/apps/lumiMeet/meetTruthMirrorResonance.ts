import type { MeetChatMessage } from './meetTypes'

/** 是否仍有待用户回应的角色主动「交换真心话」邀约 */
export function hasUnresolvedMeetTruthMirrorCharRequest(messages: MeetChatMessage[]): boolean {
  return messages.some(
    (m) => m.kind === 'meet_truth_mirror_char_request' && !m.meetTruthMirrorCharRequest?.resolved,
  )
}

export function findUnresolvedMeetTruthMirrorCharRequest(
  messages: MeetChatMessage[],
): MeetChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.kind === 'meet_truth_mirror_char_request' && !m.meetTruthMirrorCharRequest?.resolved) {
      return m
    }
  }
  return undefined
}
