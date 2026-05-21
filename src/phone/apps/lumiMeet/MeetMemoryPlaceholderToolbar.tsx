import type { RefObject } from 'react'
import type { EncounterNPC, MeetPublicProfile } from './meetTypes'
import { useMeetMemoryDraftPreview } from './meetMemoryContentPreview'

const SNIPPETS = [
  { buttonLabel: '用户', insert: '{{user}}', title: '玩家身份（{{user}}）' },
  { buttonLabel: '角色', insert: '{{char}}', title: '邂逅对象人设（{{char}}）' },
] as const

function insertAtCaret(
  textarea: HTMLTextAreaElement | null,
  value: string,
  snippet: string,
  onChange: (v: string) => void,
) {
  if (!textarea) {
    onChange(value + snippet)
    return
  }
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const next = value.slice(0, start) + snippet + value.slice(end)
  onChange(next)
  const pos = start + snippet.length
  queueMicrotask(() => {
    textarea.focus()
    textarea.setSelectionRange(pos, pos)
  })
}

export function MeetMemoryPlaceholderToolbar({
  textareaRef,
  value,
  onChange,
  characterId,
  npc,
  meetProfile,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
  characterId: string | null | undefined
  npc: EncounterNPC | null
  meetProfile: MeetPublicProfile
}) {
  const { expanded, loading } = useMeetMemoryDraftPreview({
    draft: value,
    characterId,
    npc,
    meetProfile,
  })
  const showPreview = value.includes('{{')

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
          <span className="meet-caption-en mr-1 shrink-0 text-[9px] uppercase tracking-[0.2em] text-[#b8b5ad]">
            插入占位符
          </span>
          {SNIPPETS.map((s) => (
            <button
              key={s.insert}
              type="button"
              title={`${s.title} → ${s.insert}`}
              className="rounded-full border border-[#e8e4dc] bg-white px-2.5 py-1 text-[11px] font-medium text-[#5c534c] shadow-sm hover:bg-[#faf8f5]"
              onClick={() => insertAtCaret(textareaRef.current, value, s.insert, onChange)}
            >
              {s.buttonLabel}
            </button>
          ))}
      </div>
      {showPreview ? (
        <div className="rounded-[10px] border border-[#ebe7e0] bg-[#faf8f5] px-3 py-2">
          <p className="meet-caption-en text-[9px] uppercase tracking-[0.18em] text-[#b8b5ad]">
            替换预览（核对姓名）
            {loading ? <span className="ml-2 font-normal normal-case text-[#c4bfb8]">解析中…</span> : null}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap break-words font-elegant-serif text-[13px] leading-relaxed text-[#4a4540]">
            {loading && !expanded ? '…' : expanded || '（无法解析）'}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[#c4bfb8]">
            保存的是表达式；预览与注入时展开。{'{{user}}'} 姓名解析规则后续将与微信身份卡对齐优化。
          </p>
        </div>
      ) : null}
    </div>
  )
}
