import { ChevronRight, Globe } from 'lucide-react'

export function WorldBackgroundTab({
  wbCardName,
  enabled,
  onToggleEnabled,
  onOpenPicker,
  literaturePreview,
}: {
  wbCardName: string
  enabled: boolean
  onToggleEnabled: () => void
  onOpenPicker: () => void
  /** 用于沉浸阅读的设定正文摘要（可为空） */
  literaturePreview: string
}) {
  const preview = literaturePreview.trim()

  return (
    <section className="rounded-[14px] border border-neutral-200/90 bg-white px-4 pb-8 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-6 border-b border-neutral-100 pb-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">08 WORLD · 叙事场域</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">世界背景</h2>
      </header>

      <div className="mb-6 flex items-center justify-between gap-3">
        <span className="text-[12px] text-neutral-600">注入 AI 上下文</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={onToggleEnabled}
          className={`relative h-7 w-[46px] shrink-0 rounded-full p-1 transition-colors ${enabled ? 'bg-[#1C1C1E]' : 'bg-neutral-300'}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenPicker}
        disabled={!enabled}
        className="flex w-full items-center rounded-[12px] border border-neutral-200 bg-white px-4 py-4 text-left transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Globe className="size-5 shrink-0 text-[#1C1C1E]" strokeWidth={1.5} />
        <div className="ml-3 min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[#1C1C1E]">当前世界背景</p>
          <p className="mt-0.5 truncate text-[12px] text-neutral-500">{wbCardName}</p>
        </div>
        <ChevronRight className="ml-2 size-4 shrink-0 text-neutral-400" />
      </button>

      <article
        className="mt-8 border-t border-neutral-100 pt-6 text-[14px] leading-loose text-neutral-700"
        style={{ fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Reading Room · 设定摘录</p>
        {preview ? (
          <p className="mt-4 whitespace-pre-wrap">{preview}</p>
        ) : (
          <p className="mt-4 text-neutral-400">启用世界背景并选择卡片后，此处以衬线体呈现叙事节选。</p>
        )}
      </article>
    </section>
  )
}
