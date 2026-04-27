import { motion } from 'framer-motion'

import { Pressable } from '../../components/Pressable'

export function RecallNotice({
  text,
  onClick,
}: {
  text: string
  onClick?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex justify-center"
    >
      <Pressable
        type="button"
        className="rounded-full bg-gray-50/80 px-3 py-1 text-xs text-gray-400 hover:bg-gray-100/90"
        onClick={onClick}
      >
        {text}
      </Pressable>
    </motion.div>
  )
}

