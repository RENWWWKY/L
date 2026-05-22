import { CalendarHeart, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import { useDating } from './DatingContext'

/** 列表副标题：与简介/签名存库一致，展开 {{id:…}} / {{user}} 等为可读名 */
function DatingListSignatureLine({ characterId, text }: { characterId: string; text: string }) {
  const raw = String(text ?? '')
  const [display, setDisplay] = useState(raw)
  useEffect(() => {
    if (!raw.includes('{{') || !characterId.trim()) {
      setDisplay(raw)
      return
    }
    let cancelled = false
    void personaDb.expandCharacterFieldPlaceholderPreview(raw, characterId).then((out) => {
      if (!cancelled) setDisplay((out ?? raw).trim() || raw)
    })
    return () => {
      cancelled = true
    }
  }, [characterId, raw])
  return <p className="line-clamp-1 text-[14px] text-[#8e8e8e]">{display}</p>
}

type Props = {
  onEnterStory: () => void
  /** 无可用角色时：跳转「角色人设」管理页 */
  onOpenPersonaManager?: () => void
}

export function DatingRoleSelectPage({ onEnterStory, onOpenPersonaManager }: Props) {
  const { characters, allArchives, setCurrentCharacterId } = useDating()

  const lastPlayed = useMemo(() => {
    return characters
      .map((c) => ({ c, t: allArchives[c.id]?.lastDateAt ?? 0 }))
      .sort((a, b) => b.t - a.t)[0]
  }, [allArchives, characters])

  const hasCharacters = characters.length > 0

  return (
    <div
      className="h-full min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex justify-end px-4 pt-3">
        <button type="button" className="text-[#8e8e8e] transition-all duration-200 ease-out hover:text-[#262626]">
          <Clock className="size-5" strokeWidth={1.7} />
        </button>
      </div>

      {lastPlayed?.t ? (
        <section className="mx-4 mt-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
          <p className="text-[14px] font-medium text-[#8e8e8e]">继续上次约会</p>
          <button
            type="button"
            onClick={() => {
              setCurrentCharacterId(lastPlayed.c.id)
              onEnterStory()
            }}
            className="mt-3 flex w-full items-center transition-all duration-200 ease-out hover:opacity-90"
          >
            <img
              src={resolveCharacterAvatarUrl({ avatarUrl: lastPlayed.c.avatarUrl })}
              alt={lastPlayed.c.realName}
              className="h-[60px] w-[60px] rounded-full border-2 border-stone-200 object-cover"
            />
            <div className="ml-3 text-left">
              <p className="text-[16px] font-semibold text-[#262626]">{lastPlayed.c.realName}</p>
              <p className="text-[14px] text-[#8e8e8e]">
                上次约会：{new Date(lastPlayed.t).toLocaleString()}
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1 text-[14px] text-stone-500">
              继续
              <ChevronRight className="size-4" />
            </span>
          </button>
        </section>
      ) : null}

      {hasCharacters ? (
        <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
          {characters.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCurrentCharacterId(c.id)
                onEnterStory()
              }}
              className={`flex w-full items-center px-4 py-4 text-left transition-all duration-200 ease-out hover:bg-stone-50 ${
                idx !== characters.length - 1 ? 'border-b border-stone-100' : ''
              }`}
            >
              <img
                src={resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl })}
                alt={c.realName}
                className="h-[50px] w-[50px] rounded-full border-2 border-stone-200 object-cover"
              />
              <div className="ml-3 min-w-0">
                <p className="text-[16px] font-semibold text-[#262626]">{c.realName}</p>
                <DatingListSignatureLine characterId={c.id} text={c.signature} />
              </div>
              <ChevronRight className="ml-auto size-4 shrink-0 text-[#8e8e8e]" />
            </button>
          ))}
        </section>
      ) : (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <CalendarHeart className="size-12 text-[#8e8e8e]" strokeWidth={1.7} />
          <p className="mt-4 text-[16px] text-[#262626]">暂无可约会的AI角色</p>
          <p className="mt-2 text-[14px] text-[#8e8e8e]">创建角色人设后，即可开启专属约会剧情</p>
          <button
            type="button"
            onClick={() => onOpenPersonaManager?.()}
            className="mt-4 rounded-xl bg-neutral-900 px-6 py-2.5 text-white transition-all duration-200 ease-out hover:bg-neutral-800"
          >
            创建角色
          </button>
        </div>
      )}
    </div>
  )
}

