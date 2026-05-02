import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { PLATINUM } from './constants'
import { MigrationPanel } from './MigrationPanel'
import { OverviewCards } from './OverviewCards'
import { StoragePieChart, type StoragePieVariant } from './StoragePieChart'
import { useStorageScanner } from './useStorageScanner'

type Props = {
  onBack: () => void
}

type StorageTab = 'idb' | 'local' | 'merged'

const STORAGE_TABS: { id: StorageTab; label: string; variant: StoragePieVariant }[] = [
  { id: 'idb', label: '索引库', variant: 'indexeddb' },
  { id: 'local', label: '本地缓存', variant: 'localstorage' },
  { id: 'merged', label: '合并', variant: 'merged' },
]

export function DataArchiveApp({ onBack }: Props) {
  const [storageTab, setStorageTab] = useState<StorageTab>('idb')
  const {
    segmentsIndexedDb,
    segmentsLocalStorage,
    segmentsMerged,
    indexedDbTotalBytes,
    localStorageTotalBytes,
    tokensTotal,
    estimate,
    refresh,
  } = useStorageScanner(6000)

  const activeTab = STORAGE_TABS.find((t) => t.id === storageTab) ?? STORAGE_TABS[0]
  const segmentForTab =
    storageTab === 'idb' ? segmentsIndexedDb : storageTab === 'local' ? segmentsLocalStorage : segmentsMerged

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(165deg, #faf9f7 0%, #f3efea 45%, #ece8e4 100%)',
        color: PLATINUM.ink,
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]"
        style={{ borderColor: PLATINUM.line, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full border transition-colors active:opacity-80"
          style={{ borderColor: PLATINUM.line, color: PLATINUM.ink }}
          aria-label="返回"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: PLATINUM.gold }}>
            Lumi Cloud
          </p>
          <h1 className="truncate text-[17px] font-semibold">数据中心</h1>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-full border px-3 py-1.5 text-[11px] font-medium"
          style={{ borderColor: PLATINUM.line, color: PLATINUM.ash }}
        >
          刷新
        </button>
      </header>

      <motion.div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="mb-4 text-center text-[11px] leading-relaxed" style={{ color: PLATINUM.ash }}>
          圆心「估算已用」为浏览器整站占用（若可用）。存储环图请用下方标签切换来源；灵感消耗为累计 tok 计数，单独展示。
        </p>

        <OverviewCards />

        <div
          className="mt-5 rounded-[22px] border px-4 py-5 shadow-[0_12px_40px_rgba(28,28,30,0.05)]"
          style={{
            borderColor: PLATINUM.line,
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <p className="text-center text-[13px] font-semibold">存储构成</p>
          <p className="mx-auto mt-1 max-w-[280px] text-center text-[11px] leading-relaxed" style={{ color: PLATINUM.ash }}>
            切换标签查看已接入的 IndexedDB、localStorage 或二者合并占比；列表为字节估算，灵感 tok 不参与切片。后续若有更多索引库，可并入本视图。
          </p>

          <div
            className="mx-auto mt-4 flex max-w-[320px] gap-1 rounded-xl border p-1"
            style={{ borderColor: PLATINUM.line, background: 'rgba(255,255,255,0.35)' }}
            role="tablist"
            aria-label="存储视图"
          >
            {STORAGE_TABS.map((t) => {
              const on = storageTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStorageTab(t.id)}
                  className="min-h-[40px] flex-1 rounded-lg px-1 text-[11px] font-medium leading-tight transition-colors"
                  style={{
                    background: on ? PLATINUM.ink : 'transparent',
                    color: on ? '#faf9f7' : PLATINUM.ash,
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            <StoragePieChart
              key={storageTab}
              variant={activeTab.variant}
              segments={segmentForTab}
              estimateUsageBytes={estimate.usageBytes}
              localStorageOutsideRingBytes={storageTab === 'idb' ? localStorageTotalBytes : 0}
              indexedDbOutsideRingBytes={storageTab === 'local' ? indexedDbTotalBytes : 0}
              tokenSummary={{ count: tokensTotal }}
            />
          </div>
        </div>

        <div
          className="mt-5 rounded-[22px] border px-4 py-5 shadow-[0_12px_40px_rgba(28,28,30,0.05)]"
          style={{
            borderColor: PLATINUM.line,
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <p className="text-center text-[13px] font-semibold">数据引流与归档</p>
          <p className="mx-auto mt-1 max-w-[300px] text-center text-[11px] leading-relaxed" style={{ color: PLATINUM.ash }}>
            导出为 <span className="font-mono text-[10px]">.lumi</span>（JSON）：含 localStorage 与当前已接入的 IndexedDB 快照；导入后整页重载。
          </p>
          <MigrationPanel />
        </div>
      </motion.div>
    </div>
  )
}
