import { motion } from 'framer-motion'

import { WeChatChatMixedText } from './WeChatChatMixedText'
import { Pressable } from '../../components/Pressable'

export function RecallNotice({
  text,
  onClick,
}: {
  text: string
  onClick?: () => void
}) {
  const pillClass =
    'rounded-full bg-gray-50/80 px-3 py-1 text-xs text-gray-400' + (onClick ? ' hover:bg-gray-100/90' : '')
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex justify-center"
    >
      {onClick ? (
        <Pressable type="button" className={pillClass} onClick={onClick}>
          <WeChatChatMixedText text={text} />
        </Pressable>
      ) : (
        <span className={pillClass} role="status">
          <WeChatChatMixedText text={text} />
        </span>
      )}
    </motion.div>
  )
}

