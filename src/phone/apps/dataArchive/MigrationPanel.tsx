import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { PLATINUM } from './constants'
import {
  buildLumiArchiveDownloadFilename,
  defaultLumiArchiveBaseName,
  downloadBlob,
  exportDataToFile,
  importDataFromFile,
} from './exportImport'

const EXPORT_LINES = ['Packaging memories...', 'Compressing timelines...', 'Archive sealed.']
const IMPORT_LINES = ['Unpacking archive...', 'Rebinding local state...', 'Memory merge complete.']

function CeremonyOverlay({
  open,
  lines,
  activeLine,
}: {
  open: boolean
  lines: readonly string[]
  activeLine: number
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[2000] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            background: 'rgba(243, 239, 234, 0.72)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <div className="relative flex max-w-[320px] flex-col items-center text-center">
            <motion.div
              className="mb-8 size-[120px] rounded-full border-2"
              style={{ borderColor: `${PLATINUM.gold}55` }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
            >
              <motion.div
                className="absolute inset-2 rounded-full border border-dashed"
                style={{ borderColor: PLATINUM.gold }}
                animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.85, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
            <p className="min-h-[44px] text-[14px] font-medium leading-relaxed tracking-wide" style={{ color: PLATINUM.ink }}>
              {lines[Math.min(activeLine, lines.length - 1)] ?? ''}
            </p>
            <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-black/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${PLATINUM.ink}, ${PLATINUM.gold})` }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function MigrationPanel() {
  const [ceremonyOpen, setCeremonyOpen] = useState(false)
  const [ceremonyLines, setCeremonyLines] = useState<readonly string[]>(EXPORT_LINES)
  const [lineIdx, setLineIdx] = useState(0)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [importSuccessOpen, setImportSuccessOpen] = useState(false)
  const [importSuccessDetail, setImportSuccessDetail] = useState('')
  const [pendingImportText, setPendingImportText] = useState<string | null>(null)
  const [exportNameOpen, setExportNameOpen] = useState(false)
  const [exportNameDraft, setExportNameDraft] = useState('')
  const exportNameInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const lineTimer = useRef<number>(0)

  const clearLineTimers = () => {
    window.clearInterval(lineTimer.current)
    lineTimer.current = 0
  }

  const openExportNameDialog = useCallback(() => {
    setExportNameDraft(defaultLumiArchiveBaseName())
    setExportNameOpen(true)
  }, [])

  const runExportWithChosenName = useCallback(async (displayName: string) => {
    setExportNameOpen(false)
    setBusy('export')
    setCeremonyLines(EXPORT_LINES)
    setLineIdx(0)
    setCeremonyOpen(true)
    clearLineTimers()
    lineTimer.current = window.setInterval(() => {
      setLineIdx((i) => Math.min(i + 1, EXPORT_LINES.length - 1))
    }, 900)
    await new Promise((r) => window.setTimeout(r, 2800))
    try {
      const { blob, filename } = await exportDataToFile({ displayName })
      downloadBlob(blob, filename)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      clearLineTimers()
      setCeremonyOpen(false)
      setBusy(null)
      setLineIdx(0)
    }
  }, [])

  useEffect(() => {
    if (!exportNameOpen) return
    const t = window.setTimeout(() => {
      const el = exportNameInputRef.current
      if (el) {
        el.focus()
        el.select()
      }
    }, 50)
    return () => window.clearTimeout(t)
  }, [exportNameOpen])

  const finishImportCeremony = useCallback(async () => {
    setCeremonyLines(IMPORT_LINES)
    setLineIdx(0)
    setCeremonyOpen(true)
    clearLineTimers()
    lineTimer.current = window.setInterval(() => {
      setLineIdx((i) => Math.min(i + 1, IMPORT_LINES.length - 1))
    }, 850)
    await new Promise((r) => window.setTimeout(r, 2600))
    clearLineTimers()
    setCeremonyOpen(false)
    const flash = document.createElement('div')
    flash.style.cssText =
      'position:fixed;inset:0;z-index:3000;background:#fff;pointer-events:none;opacity:1;transition:opacity 0.45s ease'
    document.body.appendChild(flash)
    requestAnimationFrame(() => {
      flash.style.opacity = '0'
    })
    await new Promise<void>((resolve) => {
      window.setTimeout(() => {
        flash.remove()
        resolve()
      }, 480)
    })
  }, [])

  const executeImport = useCallback(async () => {
    const text = pendingImportText
    setImportConfirmOpen(false)
    setPendingImportText(null)
    if (!text) return
    setBusy('import')
    try {
      const result = await importDataFromFile(text)
      await finishImportCeremony()
      const parts = [`已恢复 ${result.keysRestored} 项本地键`]
      if (result.indexedDbRestored) parts.push('并已写入 IndexedDB 快照')
      setImportSuccessDetail(`${parts.join('，')}。相关界面将自动同步，无需重启。`)
      setImportSuccessOpen(true)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '导入失败')
    } finally {
      setBusy(null)
    }
  }, [finishImportCeremony, pendingImportText])

  useEffect(() => () => clearLineTimers(), [])

  return (
    <div id="data-archive-migration-panel" className="mt-6 space-y-3">
      <CeremonyOverlay open={ceremonyOpen} lines={ceremonyLines} activeLine={lineIdx} />

      {exportNameOpen ? (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center px-5"
          style={{ background: 'rgba(28,28,30,0.35)', backdropFilter: 'blur(10px)' }}
        >
          <form
            className="w-full max-w-[320px] rounded-2xl border px-5 py-5 shadow-xl"
            style={{
              borderColor: PLATINUM.line,
              background: 'rgba(255,255,255,0.92)',
            }}
            onSubmit={(e) => {
              e.preventDefault()
              void runExportWithChosenName(exportNameDraft)
            }}
          >
            <p className="text-[15px] font-semibold" style={{ color: PLATINUM.ink }}>
              命名备份文件
            </p>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: PLATINUM.ash }}>
              便于区分多次导出；非法字符会自动替换。下载文件名预览：
              <span className="mt-1 block font-mono text-[11px]" style={{ color: PLATINUM.ink }}>
                {buildLumiArchiveDownloadFilename(exportNameDraft)}
              </span>
            </p>
            <input
              ref={exportNameInputRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={exportNameDraft}
              onChange={(e) => setExportNameDraft(e.target.value)}
              className="mt-3 w-full rounded-xl border px-3 py-2.5 text-[14px] outline-none ring-0 focus:border-opacity-80"
              style={{ borderColor: PLATINUM.line, color: PLATINUM.ink }}
              placeholder={defaultLumiArchiveBaseName()}
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-[13px] font-medium"
                style={{ borderColor: PLATINUM.line, color: PLATINUM.ink }}
                onClick={() => {
                  setExportNameOpen(false)
                  setExportNameDraft('')
                }}
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white"
                style={{ background: PLATINUM.ink }}
              >
                开始导出
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {importConfirmOpen ? (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center px-5"
          style={{ background: 'rgba(28,28,30,0.35)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="max-w-[320px] rounded-2xl border px-5 py-5 shadow-xl"
            style={{
              borderColor: PLATINUM.line,
              background: 'rgba(255,255,255,0.92)',
            }}
          >
            <p className="text-[15px] font-semibold" style={{ color: PLATINUM.ink }}>
              检测到世界线变动
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: PLATINUM.ash }}>
              将覆盖本机 localStorage；若归档为 v2，还会按快照清空并重写已接入的 IndexedDB 主库。是否确认？
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border py-2.5 text-[13px] font-medium"
                style={{ borderColor: PLATINUM.line, color: PLATINUM.ink }}
                onClick={() => {
                  setImportConfirmOpen(false)
                  setPendingImportText(null)
                }}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white"
                style={{ background: PLATINUM.ink }}
                onClick={() => void executeImport()}
              >
                确认覆盖
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importSuccessOpen ? (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center px-5"
          style={{ background: 'rgba(28,28,30,0.35)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="max-w-[320px] rounded-2xl border px-5 py-5 shadow-xl"
            style={{
              borderColor: PLATINUM.line,
              background: 'rgba(255,255,255,0.92)',
            }}
          >
            <p className="text-[15px] font-semibold" style={{ color: PLATINUM.ink }}>
              导入数据成功
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: PLATINUM.ash }}>
              {importSuccessDetail || '备份已写入本机，无需重启系统。'}
            </p>
            <div className="mt-5">
              <button
                type="button"
                className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-white"
                style={{ background: PLATINUM.ink }}
                onClick={() => setImportSuccessOpen(false)}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy !== null || exportNameOpen}
        onClick={() => openExportNameDialog()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-[14px] font-semibold transition-opacity disabled:opacity-50"
        style={{
          borderColor: PLATINUM.gold,
          color: PLATINUM.ink,
          background: 'rgba(255,255,255,0.55)',
          boxShadow: '0 6px 24px rgba(197,168,128,0.12)',
        }}
      >
        <Download className="size-4" style={{ color: PLATINUM.gold }} />
        备份导出 · Lumi Archive
      </button>

      <label
        id="data-archive-import-restore"
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border py-3.5 text-[14px] font-semibold ${
          busy ? 'pointer-events-none opacity-50' : ''
        }`}
        style={{
          borderColor: PLATINUM.gold,
          color: PLATINUM.ink,
          background: 'rgba(255,255,255,0.55)',
          boxShadow: '0 6px 24px rgba(197,168,128,0.12)',
        }}
      >
        <Upload className="size-4" style={{ color: PLATINUM.gold }} />
        恢复导入 · Restore
        <input
          type="file"
          accept=".lumi,.json,application/json"
          className="hidden"
          onChange={(e) => {
            const input = e.currentTarget
            const f = input.files?.[0]
            input.value = ''
            if (!f) return
            void (async () => {
              try {
                const text = await f.text()
                setPendingImportText(text)
                setImportConfirmOpen(true)
              } catch {
                window.alert('无法读取所选文件。')
              }
            })()
          }}
        />
      </label>
    </div>
  )
}
