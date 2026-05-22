import { motion } from 'framer-motion'

export type DMMsgBubbleProps = {
  body: string
}

export function DMMsgBubble({ body }: DMMsgBubbleProps) {
  return (
    <motion.div
      className="mb-5 w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col items-center px-2">
        <span className="jbs-gf-chat-dm-tag mb-2 font-sans text-[9px] font-extralight tracking-[0.28em]">
          𓋫 DM | 主持人
        </span>
        <div className="jbs-gf-chat-glass-surface jbs-gf-chat-dm-bubble max-w-[92%] px-5 py-4 text-center">
          <p className="jbs-font-kai jbs-gf-chat-dm-bubble-text whitespace-pre-wrap text-[16px] leading-loose">
            {body}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
