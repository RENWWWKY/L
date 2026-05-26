import { motion } from 'framer-motion'

import {
  jbsPlayerBubbleLabelClass,
  jbsPlayerBubbleSurfaceStyle,
  jbsPlayerBubbleTextClass,
} from './jbsPlayerBubbleSurface'

export type RolePortraitMsgBubbleProps = {
  body: string
  roleName: string
  isSelf: boolean
  portraitUrl?: string
  isTyping?: boolean
}

function RoleAvatar({
  roleName,
  portraitUrl,
  isSelf,
}: {
  roleName: string
  portraitUrl?: string
  isSelf: boolean
}) {
  const initial = roleName.trim().slice(0, 1) || '？'
  return (
    <div
      className={`jbs-gf-chat-role-avatar shrink-0 ${isSelf ? 'jbs-gf-chat-role-avatar--self' : ''}`}
      aria-hidden
    >
      {portraitUrl ? (
        <img src={portraitUrl} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <span className="jbs-font-kai text-[15px] leading-none">{initial}</span>
      )}
    </div>
  )
}

export function RolePortraitMsgBubble({
  body,
  roleName,
  isSelf,
  portraitUrl,
  isTyping = false,
}: RolePortraitMsgBubbleProps) {
  return (
    <motion.div
      className={`mb-4 flex w-full ${isSelf ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className={`flex max-w-[88%] items-end gap-2.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <RoleAvatar roleName={roleName} portraitUrl={portraitUrl} isSelf={isSelf} />
        <div className={`min-w-0 flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
          <span
            className={`jbs-font-kai mb-1 px-0.5 text-[10px] tracking-[0.12em] ${jbsPlayerBubbleLabelClass}`}
          >
            {roleName}
          </span>
          <div
            className={`jbs-font-kai jbs-gf-chat-bubble-text rounded-[18px] px-3.5 py-2.5 text-[15px] leading-relaxed ${jbsPlayerBubbleTextClass}`}
            style={jbsPlayerBubbleSurfaceStyle(isSelf)}
          >
            {body}
            {isTyping ? (
              <span className="jbs-gf-chat-typewriter-cursor ml-0.5 inline-block w-[2px] align-middle" />
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
