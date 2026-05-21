import { Sparkles } from 'lucide-react'
import { PlaceholderAwareTextarea } from '../characterFieldPlaceholderPreview'

const CHAT_BG = '#ECECEC'
const BUBBLE = '#FFFFFF'

export function FirstMessageTab({
  editorId,
  openingLines,
  onChangeOpeningLines,
  openingGenerating,
  onRequestAiGenerate,
}: {
  editorId: string
  openingLines: string
  onChangeOpeningLines: (v: string) => void
  openingGenerating: boolean
  onRequestAiGenerate: () => void
}) {
  const lines = String(openingLines ?? '')
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
  const displayLines = lines.length && lines.some((s) => s.length > 0) ? lines.filter((s) => s.length > 0) : ['尚未填写开场白…']

  return (
    <section className="rounded-[14px] border border-neutral-200/90 bg-white px-3 pb-6 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-5 border-b border-neutral-100 pb-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">03 CHAT · 首句预览</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">开场白</h2>
        <p className="mt-1 text-[11px] font-light leading-relaxed text-neutral-500">
          无历史消息进入聊天时按行发送；上方为所见即所得的会话预览。
        </p>
      </header>

      <div className="mx-auto max-w-md overflow-hidden rounded-[18px] border border-neutral-200/80 shadow-inner">
        <div className="border-b border-neutral-200/60 bg-white/90 px-4 py-2.5 text-center">
          <span className="text-[11px] font-medium tracking-wide text-neutral-400">预览 · 透明会话壳</span>
        </div>
        <div className="max-h-[min(52vh,420px)] overflow-y-auto px-3 py-5" style={{ background: CHAT_BG }}>
          <div className="space-y-3">
            {displayLines.map((line, i) => (
              <div key={`${i}-${line.slice(0, 12)}`} className="flex justify-start">
                <div
                  className="max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-[15px] leading-snug shadow-sm"
                  style={{
                    background: BUBBLE,
                    color: '#1C1C1E',
                    borderTopLeftRadius: 4,
                  }}
                >
                  {line || '…'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">EDIT SOURCE</span>
        <button
          type="button"
          disabled={openingGenerating}
          onClick={onRequestAiGenerate}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[12px] font-medium text-[#1C1C1E] shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" strokeWidth={1.75} />
          {openingGenerating ? '生成中…' : 'AI 生成'}
        </button>
      </div>

      <PlaceholderAwareTextarea
        value={openingLines ?? ''}
        onChange={onChangeOpeningLines}
        characterId={editorId}
        className="mt-3 w-full border-0 border-b border-neutral-200 bg-transparent px-1 py-3 text-[14px] leading-relaxed text-[#1C1C1E] outline-none ring-0 transition-colors placeholder:text-neutral-300 focus:border-[#D4AF37]"
        rows={6}
        placeholder={'每行一条气泡。回车换行即下一条。'}
      />
      <p className="mt-2 text-[10px] font-light text-neutral-400">失焦时为模型预览句式；点按输入可编辑原文。</p>
    </section>
  )
}
