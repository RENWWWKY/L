import { motion } from 'framer-motion'

import { SCRIPT_BOOK_LAYOUT_ID } from './scriptReaderTypes'

export type ScriptBookWidgetProps = {
  roleName: string
  onOpen: () => void
}

export function ScriptBookWidget({ roleName, onOpen }: ScriptBookWidgetProps) {
  return (
    <motion.div
      className="my-6 flex w-full justify-center px-2"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button
        type="button"
        layoutId={SCRIPT_BOOK_LAYOUT_ID}
        onClick={onOpen}
        className="jbs-script-book-widget group w-full max-w-[220px] text-left"
        whileTap={{ scale: 0.97 }}
        aria-label={`翻开${roleName}的个人剧本`}
      >
        <div className="flex aspect-[4/5] overflow-hidden rounded-r-lg rounded-l-sm">
          <div className="jbs-script-book-spine w-3 shrink-0" aria-hidden />
          <div className="jbs-script-book-cover relative flex flex-1 flex-col items-center justify-center px-4">
            <p className="jbs-script-book-tag">READING PHASE</p>
            <p className="jbs-font-handwriting mt-4 text-center text-[18px] tracking-wide text-[#e8e0d0]/92">
              {roleName}
            </p>
            <p className="jbs-font-serif mt-2 text-center text-[10px] tracking-[0.16em] text-[#c4a876]/65">
              个人剧本
            </p>
            <p className="jbs-script-book-tag mt-6">点击翻开剧本</p>
          </div>
        </div>
      </motion.button>
    </motion.div>
  )
}
