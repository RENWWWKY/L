export function ConnectionsTab({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="border-b border-neutral-100 px-4 py-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">06 NET · 关系拓扑</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">人脉关系</h2>
        <p className="mt-1 max-w-prose text-[11px] font-light leading-relaxed text-neutral-500">
          首屏为关系图谱仪表盘；AI 生成与手动录入收纳于折叠卡片；已收录 NPC 在下方档案库中维护。
        </p>
      </header>
      <div className="px-3 pb-5 pt-4">{children}</div>
    </div>
  )
}
