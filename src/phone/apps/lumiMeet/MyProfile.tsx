import { MissedConnections } from './MissedConnections'
import { MEET_ORIENTATION_OPTIONS } from './meetMatchCriteria'
import { useLumiMeetStore } from './LumiMeetStore'

export function MyProfile() {
  const { state, setMeetProfile } = useLumiMeetStore()
  const p = state.meetProfile

  return (
    <div className="meet-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-4">
      <datalist id="meet-profile-orientation-suggestions">
        <option value="不限" />
        {MEET_ORIENTATION_OPTIONS.map((o) => (
          <option key={o.id} value={o.zh} />
        ))}
      </datalist>
      <h2 className="font-elegant-serif text-[1.35rem] font-medium tracking-[0.08em] text-[#2c2a26]">我的档案</h2>
      <p className="meet-caption-en mt-1 text-[10px] uppercase tracking-[0.38em] text-[#b8b5ad]">
        Profile · 对外可见摘要
      </p>
      <p className="mt-3 text-[12px] font-light leading-relaxed text-[#9a9590]">
        以下信息用于「心动」双向判定与 NPC 聊天上下文；与手机全局名片相互独立，可随时改写。
      </p>

      <label className="mt-8 block">
        <span className="text-[12px] font-light text-[#7a756d]">
          昵称 <span className="meet-caption-en text-[9px] text-[#c4c0b8]">NAME</span>
        </span>
        <input
          value={p.displayName}
          onChange={(e) => setMeetProfile({ displayName: e.target.value })}
          className="meet-field mt-2 w-full rounded-[14px] border border-black/[0.06] bg-white px-3 py-2.5 text-[14px] font-light outline-none"
          placeholder="对外展示昵称"
        />
      </label>

      <label className="mt-5 block">
        <span className="text-[12px] font-light text-[#7a756d]">
          交友意向 <span className="meet-caption-en text-[9px] text-[#c4c0b8]">INTENT</span>
        </span>
        <input
          value={p.intent}
          onChange={(e) => setMeetProfile({ intent: e.target.value })}
          className="meet-field mt-2 w-full rounded-[14px] border border-black/[0.06] bg-white px-3 py-2.5 text-[14px] font-light outline-none"
          placeholder="例如：认真相处，慢慢来"
        />
      </label>

      <label className="mt-5 block">
        <span className="text-[12px] font-light text-[#7a756d]">
          取向标签 <span className="meet-caption-en text-[9px] text-[#c4c0b8]">TAG</span>
        </span>
        <input
          value={p.orientation}
          onChange={(e) => setMeetProfile({ orientation: e.target.value })}
          list="meet-profile-orientation-suggestions"
          className="meet-field mt-2 w-full rounded-[14px] border border-black/[0.06] bg-white px-3 py-2.5 text-[14px] font-light outline-none"
          placeholder="选常用标签或自填一句"
        />
      </label>

      <label className="mt-5 block">
        <span className="text-[12px] font-light text-[#7a756d]">
          自我介绍 <span className="meet-caption-en text-[9px] text-[#c4c0b8]">STORY</span>
        </span>
        <textarea
          value={p.bio}
          onChange={(e) => setMeetProfile({ bio: e.target.value })}
          rows={6}
          className="meet-field mt-2 w-full resize-none rounded-[16px] border border-black/[0.06] bg-white px-3 py-3 font-elegant-serif text-[14px] leading-[1.85] outline-none placeholder:text-[#b5b1aa]"
          placeholder="用两三句话写下你的节奏、底线与期待——宁可朴素，也不要套路。"
        />
      </label>

      <MissedConnections />
    </div>
  )
}
