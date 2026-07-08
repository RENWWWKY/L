import { forwardRef, type ReactNode } from 'react'

type BookContainerProps = {
  children: ReactNode
  flipLayer?: ReactNode
  className?: string
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
  onPointerCancel?: (e: React.PointerEvent) => void
}

export const BookContainer = forwardRef<HTMLDivElement, BookContainerProps>(function BookContainer(
  { children, flipLayer, className = '', ...pointerHandlers },
  ref,
) {
  return (
    <div className={`memory-album-book-scene relative w-full max-w-[360px] ${className}`}>
      <div className="memory-album-book-desk-shadow pointer-events-none absolute -bottom-6 left-[8%] right-[8%] h-8 rounded-[50%]" aria-hidden />

      <div className="memory-album-book-3d relative">
        <div className="memory-album-book-back-cover pointer-events-none absolute inset-y-[2%] -left-[3%] w-[8%] rounded-l-sm" aria-hidden />
        <div className="memory-album-book-page-edge pointer-events-none absolute inset-y-[1%] -right-[2%] w-[3%] rounded-r-[1px]" aria-hidden />

        <div
          ref={ref}
          className="memory-album-book-container memory-album-paper relative aspect-[3/4] w-full overflow-x-hidden overflow-y-auto rounded-sm bg-[#FCFAF8]"
          {...pointerHandlers}
        >
          <div className="memory-album-book-spine-groove pointer-events-none absolute inset-y-0 left-0 z-20 w-5" aria-hidden />
          <div className="memory-album-book-spine-highlight pointer-events-none absolute inset-y-2 left-[3px] z-[21] w-px" aria-hidden />
          <div className="memory-album-paper-stack-edge pointer-events-none absolute inset-0 z-20" aria-hidden />
          <div className="memory-album-glossy-overlay pointer-events-none absolute inset-0 z-30" aria-hidden />

          <div className="relative z-0 h-full min-h-full">{children}</div>

          {flipLayer ? (
            <div className="memory-album-flip-viewport absolute inset-0 z-10">{flipLayer}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
})
