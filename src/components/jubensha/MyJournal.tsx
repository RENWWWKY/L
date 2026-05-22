import { BookmarkSlipCard } from './BookmarkSlipCard'
import { CountUp } from './CountUp'
import type { ContactDB } from './contactDB'
import { useJubenshaBookmarks } from './jubenshaBookmarks'
import type { JubenshaScript, PlayRecord } from './types'

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h} 小时`
  return `${h} 小时`
}

function CompanionAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  return (
    <div
      className="relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-[#8b6914]/40 bg-[#1a1a1a]"
      title={name}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center jbs-font-serif text-[14px] text-[#f4f1ea]">
          {name.slice(0, 1)}
        </span>
      )}
    </div>
  )
}

export type MyJournalProps = {
  record: PlayRecord
  contactDb: ContactDB
  scripts: JubenshaScript[]
  onSelectScript: (script: JubenshaScript) => void
}

export function MyJournal({ record, contactDb, scripts, onSelectScript }: MyJournalProps) {
  const { bookmarkedIds } = useJubenshaBookmarks()
  const bookmarkedScripts = scripts.filter((s) => bookmarkedIds.includes(s.id))
  return (
    <div className="jbs-paper-texture min-h-full px-4 pb-14 pt-4">
      <h2 className="jbs-font-handwriting text-center text-[28px] text-[#1a1a1a]">
        我的入局记录
      </h2>
      <p className="jbs-font-serif mt-1 text-center text-[11px] tracking-[0.28em] text-[#1a1a1a]/45">
        My Chronicles
      </p>

      <section className="mt-8 rounded-lg border border-[#5c3d2e]/20 bg-[#fffef9]/80 px-5 py-5 shadow-sm">
        <p className="jbs-font-serif text-[13px] leading-[2] text-[#1a1a1a]/85">
          游玩过{' '}
          <span className="jbs-font-handwriting text-[26px] text-[#5c3d2e]">
            [ <CountUp value={record.scriptsCompleted} /> ]
          </span>{' '}
          个剧本，解锁{' '}
          <span className="jbs-font-handwriting text-[26px] text-[#5c3d2e]">
            [ <CountUp value={record.endingsUnlocked} /> ]
          </span>{' '}
          个结局。
        </p>
        <p className="mt-2 jbs-font-serif text-[11px] text-[#1a1a1a]/50">
          累计入局时长约 {Math.round(record.totalPlayMinutes / 60)} 小时
        </p>
      </section>

      <section className="mt-8">
        <h3 className="jbs-font-handwriting text-[22px] text-[#5c3d2e]">收藏的残卷</h3>
        <p className="jbs-font-serif mt-0.5 text-[10px] tracking-[0.2em] text-[#1a1a1a]/40">
          Bookmarked Chapters
        </p>
        <div className="jbs-marginalia-rule mt-2" />
        {bookmarkedScripts.length === 0 ? (
          <p className="mt-4 jbs-font-serif text-[12px] italic leading-relaxed text-[#1a1a1a]/45">
            书架空空如也，尚无打动灵魂的剧本。
          </p>
        ) : (
          <div className="jbs-hide-scrollbar mt-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {bookmarkedScripts.map((script) => (
              <BookmarkSlipCard key={script.id} script={script} onSelect={onSelectScript} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="jbs-font-handwriting text-[22px] text-[#5c3d2e]">同行羁绊</h3>
        <div className="jbs-marginalia-rule mt-2" />
        {record.companions.length === 0 ? (
          <p className="mt-4 jbs-font-serif text-[12px] italic text-[#1a1a1a]/45">
            尚无同行记录——去典藏书架择一卷，邀好友入局。
          </p>
        ) : (
          <ul className="mt-4 space-y-5">
            {record.companions.map((comp) => {
              const name = contactDb.getDisplayName(comp.characterId, '神秘旅伴')
              const avatar = contactDb.getAvatarUrl(comp.characterId)
              return (
                <li
                  key={comp.characterId}
                  className="flex items-start gap-4 rounded-lg border border-[#5c3d2e]/12 bg-[#fffef9]/60 p-4"
                >
                  <CompanionAvatar avatarUrl={avatar} name={name} />
                  <p className="jbs-font-serif flex-1 text-[13px] leading-[1.75] text-[#1a1a1a]/88">
                    与{' '}
                    <span className="font-medium text-[#5c3d2e]">{name}</span> 共同入局{' '}
                    <span className="text-[#8b6914]">{comp.scriptsPlayedTogether}</span> 次，累计沉沦时长：
                    <span className="italic"> {formatHours(comp.sharedHours)}</span>。
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h3 className="jbs-font-handwriting text-[22px] text-[#5c3d2e]">角色履历</h3>
        <div className="jbs-marginalia-rule mt-2" />
        {record.roleHistory.length === 0 && record.achievements.length === 0 ? (
          <p className="mt-4 jbs-font-serif text-[12px] italic text-[#1a1a1a]/45">尚无扮演记录。</p>
        ) : (
          <ul className="mt-4 columns-2 gap-x-3 space-y-3">
            {(record.roleHistory.length > 0
              ? record.roleHistory
              : record.achievements.map((a) => ({
                  id: a.id,
                  roleName: a.label.replace(/^扮演 · /, ''),
                  scriptTitle: a.scriptTitle,
                  scriptId: a.scriptId,
                }))
            ).map((entry) => (
              <li
                key={entry.id}
                className="break-inside-avoid rounded border border-[#5c3d2e]/15 bg-[#faf8f5] px-3 py-2.5"
              >
                <p className="jbs-font-serif text-[13px] font-medium text-[#1a1a1a]">
                  {entry.roleName}
                </p>
                <p className="mt-0.5 jbs-font-serif text-[10px] italic text-[#5c3d2e]/75">
                  《{entry.scriptTitle}》
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="jbs-font-handwriting mt-10 text-right text-[14px] text-[#1a1a1a]/35">
        — 私人调查笔记 · 密存 —
      </p>
    </div>
  )
}
