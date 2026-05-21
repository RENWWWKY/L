import { useCallback, type ChangeEvent, type RefObject } from 'react'
import { Pressable } from '../../../components/Pressable'
import { formatMeetMasqueradeIntentions } from '../meetMaskTruthPrompt'
import type { MeetMatchIntention, MeetPublicProfile } from '../meetTypes'
import { INTENT_BLOCKS, ORIENTATION_PILLS, meetProfilePillClass } from './meetProfilePills'

type Props = {
  profile: MeetPublicProfile
  setMeetProfile: (p: Partial<MeetPublicProfile>) => void
  avatarInputRef: RefObject<HTMLInputElement | null>
  onPickAvatar: () => void
  onAvatarFile: (e: ChangeEvent<HTMLInputElement>) => void
}

export function MyProfileMaskTab({ profile, setMeetProfile, avatarInputRef, onPickAvatar, onAvatarFile }: Props) {
  const toggleIntention = useCallback(
    (id: MeetMatchIntention) => {
      const cur = profile.meetIntentionsPublic
      const has = cur.includes(id)
      const next = has ? cur.filter((x) => x !== id) : [...cur, id]
      setMeetProfile({
        meetIntentionsPublic: next.length ? next : ['romance'],
        intent: formatMeetMasqueradeIntentions(next.length ? next : ['romance']),
      })
    },
    [profile.meetIntentionsPublic, setMeetProfile],
  )

  return (
    <div className="px-1 pb-8 pt-2">
      <p className="meet-caption-en text-[9px] uppercase tracking-[0.36em] text-[#b8b5ad]">01 MASK | 社交假面</p>
      <p className="mt-2 font-elegant-serif text-[15px] font-medium tracking-[0.06em] text-[#2c2a26]">
        对外可见伪装
      </p>

      <div className="mt-8 flex flex-col items-center">
        <Pressable
          onClick={onPickAvatar}
          className="relative size-[88px] shrink-0 overflow-hidden rounded-full border border-[#e0dcd4] bg-[#f6f4f0] shadow-sm"
          aria-label="上传遇见头像"
        >
          {profile.meetAvatarUrl ? (
            <img src={profile.meetAvatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-[10px] font-light tracking-wide text-[#b5b0a8]">
              Upload
            </span>
          )}
        </Pressable>
        <label className="mt-6 w-full max-w-sm">
          <span className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">Name | 昵称</span>
          <input
            value={profile.displayName}
            onChange={(e) => setMeetProfile({ displayName: e.target.value })}
            className="mt-2 w-full border-0 border-b border-[#e4e0d8] bg-transparent py-2.5 text-center text-[16px] font-light text-[#1C1C1E] outline-none ring-0 focus:border-[#D4AF37] focus:outline-none focus:ring-0"
            placeholder="Lumi Meet"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="mt-10">
        <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">
          Intentions | 交友意向
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {INTENT_BLOCKS.map((row) => {
            const on = profile.meetIntentionsPublic.includes(row.id)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => toggleIntention(row.id)}
                className={meetProfilePillClass(on)}
              >
                <span className="meet-caption-en text-[8px] uppercase tracking-[0.14em]">{row.en}</span>
                <span className="mx-1 text-[#c4c0b8]">|</span>
                <span>{row.zh}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-10">
        <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">
          Orientation | 取向标签
        </p>
        <p className="mt-1.5 text-center text-[10px] font-light leading-relaxed text-[#a39e96]">
          写入遇见公开资料；若与微信主页或联络绑定信息不一致，模型可在临时会话中试探。
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {ORIENTATION_PILLS.map((row) => {
            const active = profile.orientation === row.value
            return (
              <button
                key={row.value}
                type="button"
                onClick={() => setMeetProfile({ orientation: row.value })}
                className={meetProfilePillClass(active)}
              >
                <span className="meet-caption-en text-[8px] uppercase tracking-[0.14em]">{row.en}</span>
                <span className="mx-1 text-[#c4c0b8]">|</span>
                <span>{row.zh}</span>
              </button>
            )
          })}
        </div>
      </div>

      <label className="mt-10 block max-w-lg mx-auto">
        <span className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">Story | 自我介绍</span>
        <textarea
          value={profile.bio}
          onChange={(e) => setMeetProfile({ bio: e.target.value })}
          rows={5}
          className="mt-2 w-full resize-none border-0 border-b border-[#e4e0d8] bg-transparent py-2 font-elegant-serif text-[14px] leading-[1.85] text-[#2c2a26] outline-none ring-0 placeholder:text-[#c9c4bc] focus:border-[#D4AF37] focus:outline-none focus:ring-0"
          placeholder="两三句节奏、底线与期待。"
        />
      </label>
    </div>
  )
}
