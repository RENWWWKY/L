import { motion } from 'framer-motion'

import { SCRIPT_BOOK_LAYOUT_ID } from './scriptReaderTypes'

export type MiniBookAnchorProps = {
  onRestore: () => void
}

export function MiniBookAnchor({ onRestore }: MiniBookAnchorProps) {
  return (
    <motion.button
      type="button"
      layoutId={SCRIPT_BOOK_LAYOUT_ID}
      onClick={onRestore}
      className="jbs-script-mini-anchor fixed z-[68] flex size-14 flex-col items-center justify-center rounded-full"
      style={{
        right: 'max(12px, env(safe-area-inset-right))',
        bottom: 'max(88px, calc(env(safe-area-inset-bottom) + 72px))',
      }}
      initial={{ scale: 0.6, opacity: 0, rotateY: 90 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      whileTap={{ scale: 0.92 }}
      aria-label="展开剧本"
    >
      <motion.span
        className="block size-6 rounded-sm border border-[#c4a876]/40 bg-[#f4f1ea]/90"
        animate={{ rotateY: [0, 18, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      />
      <span className="jbs-script-mini-anchor-label mt-1">SCRIPT</span>
    </motion.button>
  )
}
