export type ChatRoomPhase = 'dm-voice' | 'role-select' | 'reading-script' | 'playing'

export const CHAT_ROOM_PHASE_LABELS: Record<ChatRoomPhase, string> = {
  'dm-voice': '主持人开场',
  'role-select': '择定卷宗',
  'reading-script': '阅览档案',
  playing: '演绎暗室',
}
