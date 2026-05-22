import { motion } from 'framer-motion'

import {
  jbsPlayerBubbleLabelClass,
  jbsPlayerBubbleSurfaceStyle,
  jbsPlayerBubbleTextClass,
} from './jbsPlayerBubbleSurface'

export type PlayerMsgBubbleProps = {
  body: string
  roleName: string
  isSelf: boolean
}

export function PlayerMsgBubble({ body, roleName, isSelf }: PlayerMsgBubbleProps) {
  return (
    <motion.div
      className={`mb-4 flex w-full ${isSelf ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className={`max-w-[85%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
        <span
          className={`jbs-font-kai mb-1 px-1 text-[10px] tracking-[0.12em] ${jbsPlayerBubbleLabelClass}`}
        >
          {roleName}
        </span>
        <div
          className={`jbs-font-kai jbs-gf-chat-bubble-text rounded-[18px] px-3.5 py-2.5 text-[15px] leading-relaxed ${jbsPlayerBubbleTextClass}`}
          style={jbsPlayerBubbleSurfaceStyle(isSelf)}
        >
          {body}
        </div>
      </div>
    </motion.div>
  )
}
