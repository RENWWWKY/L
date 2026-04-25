function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 关键词黑底白字高亮（与微信一致） */
export function HighlightKeyword({ text, keyword }: { text: string; keyword: string }) {
  const k = keyword.trim()
  if (!k) {
    return <span>{text}</span>
  }
  const parts = text.split(new RegExp(`(${escapeRegExp(k)})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === k.toLowerCase() ? (
          <span key={i} className="rounded-[2px] bg-black px-0.5 text-[14px] font-normal text-white">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
