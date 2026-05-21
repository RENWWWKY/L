import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Construction, LayoutGrid, Sparkles } from 'lucide-react'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { MEET_SQUARE_UNDER_DEV, SQUARE_STYLE_LABELS } from './constants'
import { aiGenerateSquarePosts } from './lumiMeetAi'
import { useLumiMeetStore } from './LumiMeetStore'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import type { SquarePostStyle } from './meetTypes'

function DiscoverFeedUnderDev() {
  return (
    <div
      data-meet-app-coach="discover-feed"
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-28 pt-6"
    >
      <div className="meet-card flex w-full max-w-[320px] flex-col items-center rounded-[22px] border border-black/[0.04] bg-white px-6 py-10 text-center shadow-[0_12px_40px_rgba(40,36,30,0.06)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#ebe7e0] bg-[#faf8f5] text-[#b8973a]">
          <Construction className="size-7" strokeWidth={1.25} aria-hidden />
        </div>
        <h2 className="font-elegant-serif mt-5 text-[1.25rem] font-medium tracking-[0.06em] text-[#2c2a26]">
          广场开发中
        </h2>
        <p className="meet-caption-en mt-1 text-[10px] uppercase tracking-[0.32em] text-[#b8b5ad]">
          Discover · Coming soon
        </p>
        <p className="mt-4 font-dossier-serif text-[13px] leading-[1.75] tracking-[0.03em] text-[#6e6b63]">
          AI 碎片动态与偏向设定正在打磨，暂时无法浏览与生成帖子。可先使用「寻觅」「消息」继续邂逅。
        </p>
        <div className="mt-6 flex items-center gap-2 text-[#c4c0b8]">
          <LayoutGrid className="size-4 opacity-60" strokeWidth={1.25} aria-hidden />
          <span className="text-[11px] tracking-[0.12em]">敬请期待</span>
        </div>
      </div>
    </div>
  )
}

export function DiscoverFeed() {
  if (MEET_SQUARE_UNDER_DEV) return <DiscoverFeedUnderDev />

  const apiConfig = useCurrentApiConfig('chatCard')
  const { state, appendSquarePosts } = useLumiMeetStore()
  const meetPortalEl = getLumiMeetPortalTarget()
  const [styleOpen, setStyleOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pick, setPick] = useState<SquarePostStyle>('comedy')

  const styles = useMemo(() => (Object.keys(SQUARE_STYLE_LABELS) as SquarePostStyle[]), [])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await aiGenerateSquarePosts({ apiConfig, style: pick, count: 6 })
      appendSquarePosts(rows.map((r) => ({ ...r, style: pick })))
      setStyleOpen(false)
    } finally {
      setLoading(false)
    }
  }, [apiConfig, appendSquarePosts, pick])

  return (
    <div
      data-meet-app-coach="discover-feed"
      className="meet-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-28 pt-2"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-elegant-serif text-[1.35rem] font-medium tracking-[0.08em] text-[#2c2a26]">
            广场
          </h2>
          <p className="meet-caption-en mt-0.5 text-[10px] uppercase tracking-[0.35em] text-[#b8b5ad]">
            Discover · 留白阅读
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStyleOpen(true)}
          className="meet-platinum-pill flex items-center gap-1.5 px-3 py-2 text-[12px] font-light text-[#5c5953]"
        >
          <Sparkles className="size-3.5 opacity-70" strokeWidth={1.25} />
          <span>偏向设定</span>
          <span className="opacity-40">｜STYLE</span>
        </button>
      </header>

      <div className="columns-1 gap-3 sm:columns-2">
        {state.squarePosts.length === 0 ? (
          <div className="meet-card mb-3 break-inside-avoid rounded-[18px] border border-black/[0.04] bg-white p-5 shadow-[0_12px_40px_rgba(40,36,30,0.05)]">
            <p className="font-elegant-serif text-[15px] leading-relaxed text-[#6e6b63]">
              暂无动态。轻触右上角「偏向设定」，让 AI 为你写一批高质感的碎片独白。
            </p>
          </div>
        ) : null}
        {state.squarePosts.map((p) => (
          <article
            key={p.id}
            className="meet-card mb-3 break-inside-avoid rounded-[18px] border border-black/[0.04] bg-white p-4 shadow-[0_12px_40px_rgba(40,36,30,0.05)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[#3d3a34]">{p.authorAlias}</span>
              <span className="meet-caption-en text-[9px] tracking-[0.2em] text-[#c4c0b8]">
                {SQUARE_STYLE_LABELS[p.style].en}
              </span>
            </div>
            <p className="font-elegant-serif text-[14px] leading-[1.75] text-[#4a4740]">{p.body}</p>
          </article>
        ))}
      </div>

      {styleOpen && meetPortalEl
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex items-end justify-center bg-black/25 p-3 backdrop-blur-[2px]"
              role="dialog"
              onClick={() => setStyleOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setStyleOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_24px_80px_rgba(30,26,20,0.18)] backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-elegant-serif text-[17px] text-[#2c2a26]">生成偏向</p>
                <p className="meet-caption-en mt-1 text-[10px] tracking-[0.28em] text-[#b0aca4]">Bias · generation</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {styles.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPick(k)}
                      className={`rounded-[14px] border px-3 py-3 text-left transition ${
                        pick === k
                          ? 'border-[#c9b8a4] bg-[#faf8f5] shadow-inner'
                          : 'border-black/[0.06] bg-white hover:bg-[#fafafa]'
                      }`}
                    >
                      <span className="block text-[13px] text-[#3d3a34]">{SQUARE_STYLE_LABELS[k].zh}</span>
                      <span className="meet-caption-en mt-1 block text-[9px] text-[#b8b5ad]">{SQUARE_STYLE_LABELS[k].en}</span>
                      <span className="mt-1 block text-[11px] font-light leading-snug text-[#8a8680]">
                        {SQUARE_STYLE_LABELS[k].hint}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    className="meet-btn-secondary flex-1 py-3 text-[13px]"
                    onClick={() => setStyleOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    className="meet-btn-primary flex-1 py-3 text-[13px] disabled:opacity-50"
                    onClick={() => void handleGenerate()}
                  >
                    {loading ? '生成中…' : '生成帖子'}
                  </button>
                </div>
              </div>
            </div>,
            meetPortalEl,
          )
        : null}
    </div>
  )
}
