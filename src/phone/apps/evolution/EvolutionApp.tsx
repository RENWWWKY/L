import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import {
  getHistoricalEvolutionRecords,
  getLatestEvolutionRecord,
  type UpdateCategory,
  type UpdateDetail,
  type VersionRecord,
} from './evolutionLogData'

const SPRING = { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }
const FOLD_EASE = [0.22, 1, 0.36, 1] as const

const categoryContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

const categoryItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ...SPRING, staggerChildren: 0.08, delayChildren: 0.04 },
  },
}

const moduleCard: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: SPRING },
}

const CATEGORY_META: Record<
  UpdateCategory['type'],
  {
    label: string
    en: string
    index: string
    /** 整条章节条背景 */
    barClass: string
    /** 左侧竖条 */
    accentClass: string
    /** 右侧英文胶囊 */
    pillClass: string
    titleClass: string
    chevronClass: string
  }
> = {
  feature: {
    label: '新增',
    en: 'NEW',
    index: '01',
    barClass: 'bg-[#1C1C1E] shadow-[0_8px_24px_rgba(28,28,30,0.18)]',
    accentClass: 'bg-white',
    pillClass: 'bg-white text-[#1C1C1E]',
    titleClass: 'text-white',
    chevronClass: 'bg-white/15 text-white',
  },
  optimization: {
    label: '优化',
    en: 'OPT',
    index: '02',
    barClass: 'bg-[#E8E8ED] shadow-[0_4px_16px_rgba(0,0,0,0.04)]',
    accentClass: 'bg-[#1C1C1E]',
    pillClass: 'bg-[#1C1C1E] text-white',
    titleClass: 'text-[#1C1C1E]',
    chevronClass: 'bg-[#1C1C1E]/10 text-[#1C1C1E]',
  },
  fix: {
    label: '修复',
    en: 'FIX',
    index: '03',
    barClass: 'bg-white border border-gray-200 shadow-[0_4px_16px_rgba(0,0,0,0.03)]',
    accentClass: 'bg-gray-400',
    pillClass: 'border border-gray-300 bg-gray-50 text-gray-600',
    titleClass: 'text-[#1C1C1E]',
    chevronClass: 'bg-gray-100 text-gray-500',
  },
}

function padIndex(i: number): string {
  return String(i + 1).padStart(2, '0')
}

function countCategoryItems(cat: UpdateCategory): number {
  return cat.modules.reduce((n, m) => n + m.items.length, 0)
}

function DetailRow({ item, index }: { item: UpdateDetail; index: number }) {
  return (
    <div className="mb-4 flex items-start gap-3 last:mb-0">
      <span className="mt-0.5 shrink-0 font-mono text-[12px] tabular-nums text-gray-300">
        {padIndex(index)}
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-500">
        {item.highlight ? (
          <>
            <span className="font-medium text-gray-900">{item.highlight}</span>
            <span className="inline-block w-1" aria-hidden />
            <span>{item.text}</span>
          </>
        ) : (
          item.text
        )}
      </p>
    </div>
  )
}

function CategorySection({
  cat,
  defaultOpen,
}: {
  cat: UpdateCategory
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const meta = CATEGORY_META[cat.type]
  const itemCount = countCategoryItems(cat)
  const moduleCount = cat.modules.length

  return (
    <motion.section variants={categoryItem}>
      <div className={`overflow-hidden rounded-[20px] ${meta.barClass}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-80"
          aria-expanded={open}
        >
          <span className={`h-8 w-1 shrink-0 rounded-full ${meta.accentClass}`} aria-hidden />
          <span
            className={`shrink-0 font-mono text-[11px] tabular-nums tracking-[0.2em] ${
              cat.type === 'feature' ? 'text-white/50' : 'text-gray-400'
            }`}
          >
            {meta.index}
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={`font-serif text-[22px] font-bold tracking-[0.12em] ${meta.titleClass}`}
            >
              {meta.label}
            </h3>
            <p
              className={`mt-0.5 text-[11px] ${
                cat.type === 'feature' ? 'text-white/45' : 'text-gray-400'
              }`}
            >
              {moduleCount} 个模块 · {itemCount} 条
              {open ? '' : ' · 点此展开'}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.22em] ${meta.pillClass}`}
          >
            {meta.en}
          </span>
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
              meta.chevronClass
            } ${open ? 'rotate-180' : ''}`}
          >
            <ChevronDown className="size-4" strokeWidth={2} />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: FOLD_EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-6 pt-6">
              {cat.modules.map((mod, mi) => (
                <motion.article
                  key={`${mod.moduleName}-${mi}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: mi * 0.04 }}
                  className="rounded-[24px] border border-gray-50/50 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
                >
                  <h3 className="font-serif text-lg font-semibold tracking-wide text-[#1C1C1E]">
                    {mod.moduleName}
                  </h3>
                  {cat.type === 'feature' && mod.entryPath ? (
                    <div className="mt-3 mb-5 flex items-start gap-2.5 rounded-2xl border border-[#1C1C1E]/[0.06] bg-[#F4F4F5] px-3.5 py-2.5">
                      <span className="mt-0.5 shrink-0 rounded-full bg-[#1C1C1E] px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.16em] text-white">
                        入口
                      </span>
                      <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug tracking-wide text-[#1C1C1E]">
                        {mod.entryPath}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4" />
                  )}
                  <div>
                    {mod.items.map((item, ii) => (
                      <DetailRow key={ii} item={item} index={ii} />
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}

function CategoriesArchive({
  categories,
  /** 最新版默认展开第一类；历史版本默认全部折叠 */
  defaultOpenFirst = false,
}: {
  categories: UpdateCategory[]
  defaultOpenFirst?: boolean
}) {
  return (
    <motion.div
      className="mt-10 space-y-10"
      variants={categoryContainer}
      initial="hidden"
      animate="show"
    >
      {categories.map((cat, ci) => (
        <CategorySection
          key={`${cat.type}-${ci}`}
          cat={cat}
          defaultOpen={defaultOpenFirst && ci === 0}
        />
      ))}
    </motion.div>
  )
}

function HeroRelease({ record }: { record: VersionRecord }) {
  return (
    <section className="bg-white/80 px-6 pb-12 pt-2 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <div className="relative">
          <p className="font-mono text-5xl font-light tracking-tight text-[#1C1C1E]">
            {record.version}
          </p>
          <span className="absolute bottom-1 right-0 font-mono text-[11px] text-gray-400">
            {record.date}
          </span>
        </div>
        <h2 className="mt-4 font-serif text-xl font-bold leading-snug tracking-wide text-[#1C1C1E]">
          {record.title}
        </h2>
      </motion.div>
      <CategoriesArchive categories={record.categories} defaultOpenFirst />
    </section>
  )
}

function countRecordItems(record: VersionRecord): number {
  return record.categories.reduce((n, cat) => n + countCategoryItems(cat), 0)
}

function HistoryVersionPreviewRow({
  record,
  onOpen,
}: {
  record: VersionRecord
  onOpen: () => void
}) {
  const itemCount = countRecordItems(record)
  const catCount = record.categories.length
  return (
    <motion.li variants={moduleCard}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-[20px] border border-gray-50 bg-white px-4 py-3.5 text-left shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-opacity active:opacity-80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[16px] font-light tracking-tight text-[#1C1C1E]">
              {record.version}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-gray-400">{record.date}</span>
          </div>
          <p className="mt-1 truncate font-serif text-[14px] font-semibold leading-snug text-[#1C1C1E]">
            {record.title}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            {catCount} 个板块 · {itemCount} 条 · 点此查看
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
        </span>
      </button>
    </motion.li>
  )
}

function HistoryVersionDetail({
  record,
  onBack,
}: {
  record: VersionRecord
  onBack: () => void
}) {
  return (
    <motion.div
      key={record.version}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={SPRING}
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 rounded-full py-1 pr-2 text-[13px] text-gray-500 transition-opacity active:opacity-70"
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} />
        返回版本列表
      </button>
      <div className="rounded-[24px] border border-gray-50 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="relative">
          <p className="font-mono text-[28px] font-light tracking-tight text-[#1C1C1E]">
            {record.version}
          </p>
          <span className="absolute bottom-1 right-0 font-mono text-[11px] text-gray-400">
            {record.date}
          </span>
        </div>
        <h3 className="mt-3 font-serif text-[17px] font-bold leading-snug text-[#1C1C1E]">
          {record.title}
        </h3>
      </div>
      <CategoriesArchive categories={record.categories} defaultOpenFirst />
    </motion.div>
  )
}

function HistoryArchive({ records }: { records: VersionRecord[] }) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const selected = records.find((r) => r.version === selectedVersion) ?? null

  return (
    <section className="px-4 pt-10">
      <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
        Archive
      </p>
      <p className="mb-5 px-1 text-[12px] text-gray-400">
        {selected ? '正在查看历史版本详情' : `共 ${records.length} 个历史版本 · 点版本号查看更新`}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <HistoryVersionDetail
            key={`detail-${selected.version}`}
            record={selected}
            onBack={() => setSelectedVersion(null)}
          />
        ) : (
          <motion.ul
            key="history-list"
            className="space-y-3"
            variants={categoryContainer}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {records.map((record) => (
              <HistoryVersionPreviewRow
                key={record.version}
                record={record}
                onOpen={() => setSelectedVersion(record.version)}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}

export function EvolutionApp({ onBack }: { onBack: () => void }) {
  const { state } = useCustomization()
  const pageStyle = state.appPageStyles.evolution
  const latest = getLatestEvolutionRecord()
  const history = getHistoricalEvolutionRecords()

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      data-phone-page="app"
      data-app-id="evolution"
      style={{
        backgroundColor: pageStyle?.pageBg || '#F9FAFB',
        backgroundImage: pageStyle?.pageBgImageUrl ? `url(${pageStyle.pageBgImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: pageStyle?.fontFamily || 'var(--phone-font)',
      }}
    >
      <header
        className="relative z-20 flex shrink-0 items-center gap-1 px-2 pb-2"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
          backgroundColor: pageStyle?.headerBg || 'rgba(249,250,251,0.92)',
          color: pageStyle?.headerText || '#1C1C1E',
        }}
      >
        <Pressable
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full text-[#1C1C1E]"
          aria-label="返回桌面"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">
            Evolution
          </p>
          <h1 className="truncate font-serif text-[17px] font-semibold tracking-wide text-[#1C1C1E]">
            系统演进录
          </h1>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-[#F9FAFB] to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-[#F9FAFB] to-transparent"
          aria-hidden
        />

        <div className="h-full overflow-y-auto pb-28 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <HeroRelease record={latest} />

          {history.length > 0 ? <HistoryArchive records={history} /> : null}
        </div>
      </div>
    </div>
  )
}
