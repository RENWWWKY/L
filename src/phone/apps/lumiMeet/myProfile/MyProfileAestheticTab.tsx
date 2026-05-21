import { Pressable } from '../../../components/Pressable'
import {
  resolveMeetDefaultEncounterChatBgUrl,
  resolveMeetEncounterChatBackgroundUrl,
} from '../constants'
import type { MeetPublicProfile } from '../meetTypes'

type Props = {
  profile: MeetPublicProfile
  setMeetProfile: (p: Partial<MeetPublicProfile>) => void
  bgUrlDraft: string
  setBgUrlDraft: (v: string) => void
  onPickBgFileClick: () => void
  onApplyBgUrl: () => void
}

export function MyProfileAestheticTab({
  profile,
  setMeetProfile,
  bgUrlDraft,
  setBgUrlDraft,
  onPickBgFileClick,
  onApplyBgUrl,
}: Props) {
  const bgSrc = resolveMeetEncounterChatBackgroundUrl(profile.chatBackground)
  const defaultUrl = resolveMeetDefaultEncounterChatBgUrl()
  const hasCustomBg = !!profile.chatBackground?.trim() && profile.chatBackground.trim() !== defaultUrl

  return (
    <div className="flex flex-col items-center px-1 pb-10 pt-2">
      <p className="meet-caption-en text-[9px] uppercase tracking-[0.36em] text-[#b8b5ad]">02 AESTHETIC | 沉浸氛围</p>
      <p className="mt-2 text-center font-elegant-serif text-[15px] font-medium tracking-[0.06em] text-[#2c2a26]">
        临时会话视觉背景
      </p>
      <p className="mt-2 max-w-sm text-center text-[11px] font-light leading-relaxed text-[#9a9590]">
        9:16 裁切 · 邂逅聊天室全屏铺满
      </p>

      <Pressable
        onClick={onPickBgFileClick}
        className="relative mt-8 w-[min(72vw,260px)] cursor-pointer overflow-hidden rounded-[16px] border border-[#ebe7e0] bg-[#faf9f7] shadow-sm"
        aria-label="选择或预览聊天背景"
      >
        <div className="aspect-[9/16] w-full">
          <img src={bgSrc} alt="" className="size-full object-cover" />
        </div>
      </Pressable>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Pressable
          onClick={onPickBgFileClick}
          className="rounded-full border border-[#1C1C1E] bg-[#1C1C1E] px-5 py-2.5 text-[11px] font-medium tracking-[0.12em] text-white transition-colors duration-300"
        >
          UPLOAD / 更改背景
        </Pressable>
        {hasCustomBg ? (
          <button
            type="button"
            onClick={() => setMeetProfile({ chatBackground: defaultUrl })}
            className="rounded-full border border-[#e4e0d8] bg-white px-4 py-2.5 text-[11px] font-light text-[#5c574f] outline-none ring-0 transition-colors duration-300 hover:border-[#d6d2ca] focus:outline-none focus:ring-0"
          >
            Reset | 恢复默认
          </button>
        ) : null}
      </div>

      <div className="mt-8 w-full max-w-sm">
        <p className="meet-caption-en text-[9px] uppercase tracking-[0.28em] text-[#b8b5ad]">Image URL · 外链</p>
        <div className="mt-2 flex gap-2">
          <input
            value={bgUrlDraft}
            onChange={(e) => setBgUrlDraft(e.target.value)}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-[12px] border border-[#ebe7e0] bg-white px-3 py-2.5 text-[12px] font-light text-[#3d3a34] outline-none ring-0 focus:border-[#D4AF37] focus:outline-none focus:ring-0"
          />
          <Pressable
            onClick={onApplyBgUrl}
            className="shrink-0 rounded-[12px] border border-[#e8e4dc] bg-white px-4 py-2.5 text-[11px] font-light text-[#1C1C1E] transition-colors duration-300 hover:border-[#D4AF37]"
          >
            Crop
          </Pressable>
        </div>
        <p className="mt-2 text-[10px] font-light leading-snug text-[#b5b0a8]">
          跨域外链可能无法在浏览器内裁切，可下载后本地上传。
        </p>
      </div>
    </div>
  )
}
