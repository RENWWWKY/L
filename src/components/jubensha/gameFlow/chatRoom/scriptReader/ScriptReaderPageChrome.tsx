/**
 * 与 ThreeDPageFlipper 底部「标注工具栏 + 翻页栏」同高的占位，供分页探针共用纵向空间。
 */
export function ScriptReaderPageChromeSpacer() {
  return (
    <>
      <div
        className="jbs-script-annotate-toolbar mt-3 flex flex-wrap items-center justify-center gap-1.5 px-1 invisible pointer-events-none"
        aria-hidden
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="inline-flex size-9 shrink-0" />
        ))}
      </div>
      <div
        className="mt-4 flex shrink-0 items-center justify-between gap-3 px-1 invisible pointer-events-none"
        aria-hidden
      >
        <span className="size-10 shrink-0" />
        <span className="h-3 w-8 shrink-0" />
        <span className="size-10 shrink-0" />
      </div>
    </>
  )
}
