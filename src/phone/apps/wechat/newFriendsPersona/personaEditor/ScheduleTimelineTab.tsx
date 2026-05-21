import { ChevronRight } from 'lucide-react'
import type { ScheduleTable } from '../types'

function rowLabel(row: ScheduleTable['rows'][0], rowIndex: number, headers: string[]) {
  const first = row[0]?.content?.trim() ?? ''
  const rest = row
    .slice(1)
    .map((c) => c.content?.trim())
    .filter(Boolean)
    .join(' · ')
  const title = first || `${headers[0] ?? '时段'} · ${rowIndex + 1}`
  return { title, detail: rest || '—' }
}

export function ScheduleTimelineTab({
  schedule,
  onEdit,
}: {
  schedule: ScheduleTable | undefined
  onEdit: () => void
}) {
  const headers = schedule?.headers?.length ? schedule.headers : ['时间', '事项']
  const rows = schedule?.rows ?? []

  return (
    <section className="rounded-[14px] border border-neutral-200/90 bg-white px-4 pb-8 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-6 flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">07 TIME · 行程轴</p>
          <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">日程表</h2>
          <p className="mt-1 text-[11px] font-light text-neutral-500">纵向时间轴摘要；完整表格在编辑器内修改。</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-medium text-[#1C1C1E] transition-colors hover:bg-neutral-50"
        >
          编辑
          <ChevronRight className="size-3.5 opacity-50" />
        </button>
      </header>

      {!schedule ? (
        <p className="py-10 text-center text-[13px] text-neutral-400">尚未创建日程 · 点击「编辑」开始</p>
      ) : (
        <>
          <p className="mb-6 text-[13px] font-medium text-[#1C1C1E]">{schedule.name?.trim() || '日程表'}</p>
          <div className="relative pl-7">
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-neutral-200" aria-hidden />
            <ul className="space-y-6">
              {rows.map((row, i) => {
                const { title, detail } = rowLabel(row, i, headers)
                return (
                  <li key={`${schedule.id}-r-${i}`} className="relative">
                    <span
                      className="absolute -left-7 top-1.5 size-3.5 rounded-full border-2 border-white shadow-sm"
                      style={{ background: '#D4AF37' }}
                      aria-hidden
                    />
                    <div className="rounded-[12px] bg-neutral-50/90 px-4 py-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#1C1C1E]">{detail}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
