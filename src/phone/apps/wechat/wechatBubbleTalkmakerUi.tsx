/** Talkmaker / KakaoTalk 风格气泡 UI 辅助 */

import { PhoneMixedLatinNumText } from '../../phoneMixedLatinNumText'

export const TALKMAKER_CHAT_BG = '#BACEE0'
export const TALKMAKER_SELF_BUBBLE = '#FEE500'
export const TALKMAKER_OTHER_BUBBLE = '#FFFFFF'

export function formatTalkmakerExternalTime(tsMs: number): string {
  const d = new Date(tsMs)
  if (!Number.isFinite(d.getTime())) return '00:00'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TalkmakerExternalTimestamp({ timeLabel }: { timeLabel: string }) {
  return (
    <span className="shrink-0 self-end pb-0.5 text-[10px] leading-none text-gray-500" aria-hidden>
      <PhoneMixedLatinNumText text={timeLabel} />
    </span>
  )
}
