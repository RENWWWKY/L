import { SkipForward } from 'lucide-react'

type DmVoiceTrackSkipButtonProps = {
  onSkip: () => void
  isLastTrack?: boolean
}

/** 旁白文字打完后出现：终止当前语音并进入下一段 */
export function DmVoiceTrackSkipButton({
  onSkip,
  isLastTrack = false,
}: DmVoiceTrackSkipButtonProps) {
  return (
    <div className="jbs-gf-dm-voice-skip-row mb-3 flex justify-center">
      <button
        type="button"
        onClick={onSkip}
        className="jbs-gf-dm-voice-skip-btn jbs-font-serif inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] tracking-[0.16em]"
      >
        <SkipForward className="size-3" strokeWidth={1.25} />
        {isLastTrack ? '跳过并完成' : '跳过'}
      </button>
    </div>
  )
}
