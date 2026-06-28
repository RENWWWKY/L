import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp } from 'lucide-react'
import { useMemo } from 'react'
import { StoryBlock } from './StoryBlock'
import { plotWithEditedCurrentVersion } from './plotVersions'
import type { BranchOption, PlotItem } from './types'

const MIN_VISIBLE = 3
const MAX_VISIBLE = 80

function clampVisible(n: number) {
  return Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, Math.round(n)))
}

type Props = {
  plots: PlotItem[]
  /** 从尾部起最多展示多少条（其余视为「已隐藏」前缀，不删数据） */
  tailVisibleCount: number
  onTailVisibleCountChange: (n: number) => void
  regeneratingPlotId: string | null
  interactionLocked?: boolean
  onUpdatePlot: (
    plotId: string,
    patch: Partial<
      Pick<
        PlotItem,
        | 'content'
        | 'logicPass'
        | 'planSummary'
        | 'versions'
        | 'versionLogicPasses'
        | 'versionTimelineSnapshots'
        | 'timelineSnapshot'
        | 'currentVersionIndex'
      >
    >,
  ) => void
  onRegeneratePlot?: (plotId: string) => void
  onSetPlotVersionIndex?: (plotId: string, index: number) => void
  onDeletePlot?: (plotId: string) => void
  /** 剧情分支：仅挂在「最后一条 AI」卡片内折叠展示 */
  branchEnabled?: boolean
  pendingBranches?: BranchOption[]
  branchesLoading?: boolean
  onBranchPick?: (option: BranchOption) => void
}

export function StoryFeed({
  plots,
  tailVisibleCount,
  onTailVisibleCountChange,
  regeneratingPlotId,
  interactionLocked,
  onUpdatePlot,
  onRegeneratePlot,
  onSetPlotVersionIndex,
  onDeletePlot,
  branchEnabled = false,
  pendingBranches = [],
  branchesLoading = false,
  onBranchPick,
}: Props) {
  const { visiblePlots, hiddenPrefixCount, lastAiPlotId } = useMemo(() => {
    const total = plots.length
    const take = Math.min(total, clampVisible(tailVisibleCount))
    const slice = plots.slice(-take)
    const lastAi = [...plots].reverse().find((p) => p.type === 'ai')
    return {
      visiblePlots: slice,
      hiddenPrefixCount: total - slice.length,
      lastAiPlotId: lastAi?.id ?? null,
    }
  }, [plots, tailVisibleCount])

  const branchListLoading = branchesLoading && pendingBranches.length === 0
  const branchChoicesSlot =
    branchEnabled &&
    (pendingBranches.length > 0 || branchesLoading) &&
    onBranchPick
      ? { loading: branchListLoading, options: pendingBranches, onPick: onBranchPick }
      : undefined

  const showExpandBar = hiddenPrefixCount > 0

  return (
    <div className="space-y-0">
      <AnimatePresence>
        {showExpandBar ? (
          <motion.button
            key="floor-cap"
            type="button"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            onClick={() => onTailVisibleCountChange(plots.length)}
            className="mb-4 flex w-full max-w-full items-center justify-center gap-2 rounded-xl border border-stone-100/90 bg-stone-50/60 py-2.5 text-[11px] font-medium text-stone-400 shadow-sm backdrop-blur-sm transition-all hover:border-stone-200 hover:bg-white/70 hover:text-stone-600"
          >
            <ChevronUp className="size-3.5 shrink-0 opacity-60" strokeWidth={1.75} />
            <span>已隐藏 {hiddenPrefixCount} 条历史剧情，点击展开</span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {visiblePlots.map((p) => {
        const canRegenerate = p.type === 'ai' && !!onRegeneratePlot && p.id === lastAiPlotId
        const branchChoices =
          p.type === 'ai' && p.id === lastAiPlotId ? branchChoicesSlot : undefined
        return (
          <StoryBlock
            key={p.id}
            plot={p}
            isRegenerating={regeneratingPlotId === p.id}
            interactionLocked={interactionLocked}
            canRegenerate={canRegenerate}
            branchChoices={branchChoices}
            onSaveBodyEdit={(body) => {
              const next = plotWithEditedCurrentVersion(p, body)
              onUpdatePlot(p.id, {
                content: next.content,
                logicPass: next.logicPass,
                versions: next.versions,
                versionLogicPasses: next.versionLogicPasses,
                versionTimelineSnapshots: next.versionTimelineSnapshots,
                timelineSnapshot: next.timelineSnapshot,
                currentVersionIndex: next.currentVersionIndex,
              })
            }}
            onRegenerate={canRegenerate && onRegeneratePlot ? () => onRegeneratePlot(p.id) : undefined}
            onDelete={onDeletePlot ? () => onDeletePlot(p.id) : undefined}
            onVersionChange={
              p.type === 'ai' && onSetPlotVersionIndex ? (idx) => onSetPlotVersionIndex(p.id, idx) : undefined
            }
          />
        )
      })}
    </div>
  )
}
