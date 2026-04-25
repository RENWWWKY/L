import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'

export function FileBlock({
  fileType,
  fileName,
  size,
}: {
  fileType: string
  fileName: string
  size: string
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      className="my-4 flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.05] text-[#3d3d3d]">
        <FileText size={20} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[14px] text-[#1d1d1d]">{fileName}</div>
        <div className="mt-0.5 text-[12px] uppercase tracking-[0.08em] text-[#666]">
          {fileType} - {size}
        </div>
      </div>
    </motion.button>
  )
}

