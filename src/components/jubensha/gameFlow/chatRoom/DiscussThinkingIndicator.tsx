/** 公共讨论 · NPC 接话生成中的等待提示 */
export function DiscussThinkingIndicator() {
  return (
    <div
      className="jbs-gf-discuss-thinking jbs-font-serif mb-3 flex items-center justify-center gap-2.5 py-1"
      role="status"
      aria-live="polite"
      aria-label="众人正在思考"
    >
      <span className="jbs-gf-discuss-thinking-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="text-[10px] tracking-[0.22em]">众人正在思考</span>
    </div>
  )
}
