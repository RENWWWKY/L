import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { PLATINUM } from './constants'
import { MigrationPanel } from './MigrationPanel'
import { WeChatLocalDataCheckPanel } from './WeChatLocalDataCheckPanel'
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
  const [storageTab, setStorageTab] = useState<StorageTab>('merged')
  const {
    segmentsIndexedDb,
    segmentsLocalStorage,
    segmentsMerged,
    indexedDbTotalBytes,
    localStorageTotalBytes,
    tokensTotal,
    refresh,
  } = useStorageScanner(6000)

  const archiveEstimateBytes = localStorageTotalBytes + indexedDbTotalBytes

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
          圆心「可打包约」为导出 <span className="font-mono">.lumi</span> 时主内容字节估算（localStorage + 微信
          IndexedDB），不含 Service Worker 离线缓存等浏览器自带占用；灵感消耗为累计 tok，单独展示。
        </p>

        <OverviewCards tokensTotal={tokensTotal} />

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
            切换标签查看分项占比；圆心在全部分栏下均为「可归档」总字节（与导出范围一致），仅环图随标签切换为库侧或本地侧明细。
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
              archiveEstimateBytes={archiveEstimateBytes}
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
            导出为 <span className="font-mono text-[10px]">.lumi</span>（JSON）：含 localStorage 与当前已接入的 IndexedDB 快照；导入成功后会提示完成，无需整页重启。
          </p>
          <MigrationPanel />
        </div>

        <WeChatLocalDataCheckPanel />
      </motion.div>
    </div>
  )
}
