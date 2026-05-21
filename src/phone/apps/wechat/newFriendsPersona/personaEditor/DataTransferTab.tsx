import { AnimatePresence, motion } from 'framer-motion'
import { Download, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'

export function DataTransferTab({
  ioExporting,
  onExport,
  onImportFileChange,
}: {
  ioExporting: boolean
  onExport: () => void
  onImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const fieldId = useId()

  const runWithScan = (action: () => void) => {
    setScanning(true)
    window.setTimeout(() => {
      action()
      window.setTimeout(() => setScanning(false), 700)
    }, 360)
  }

  return (
    <section className="relative overflow-hidden rounded-[14px] border border-neutral-200/90 bg-white px-4 pb-10 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-8 border-b border-neutral-100 pb-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">09 DATA · 中枢</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">导入 / 导出</h2>
        <p className="mt-2 text-[11px] font-light leading-relaxed text-neutral-500">
          完整人设包仅在此页操作；导入为追加副本，不含旧身份绑定字段。
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          disabled={ioExporting}
          onClick={() => runWithScan(() => onExport())}
          className="flex w-full items-center justify-center gap-3 rounded-[12px] border border-neutral-200 bg-[#FAFAFA] py-4 text-[14px] font-semibold tracking-wide text-[#1C1C1E] transition-colors hover:bg-neutral-100 disabled:opacity-60"
        >
          <Download className="size-5" strokeWidth={1.5} />
          {ioExporting ? '封装中…' : '封装档案 · Export'}
        </button>

        <button
          type="button"
          onClick={() => runWithScan(() => fileRef.current?.click())}
          className="flex w-full items-center justify-center gap-3 rounded-[12px] border border-neutral-200 bg-white py-4 text-[14px] font-semibold tracking-wide text-[#1C1C1E] transition-colors hover:bg-neutral-50"
        >
          <Upload className="size-5" strokeWidth={1.5} />
          记忆重载 · Import
        </button>
        <input
          ref={fileRef}
          id={fieldId}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onImportFileChange}
        />
      </div>

      <AnimatePresence>
        {scanning ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[2000] bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-[2px] bg-[#D4AF37]"
              initial={{ top: '15%' }}
              animate={{ top: ['15%', '85%', '15%'] }}
              transition={{ duration: 1.15, ease: 'easeInOut', repeat: Infinity }}
              style={{ boxShadow: '0 0 28px rgba(212,175,55,0.35)' }}
            />
            <p className="absolute bottom-24 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-[0.45em] text-white/75">
              Archive Channel · Scanning
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
