import { motion } from 'framer-motion'

import { NpcAsideBubble } from './NpcAsideBubble'

export type RolePortraitMsgBubbleProps = {
  body: string
  roleName: string
  isSelf: boolean
  portraitUrl?: string
  isTyping?: boolean
  /** 非语言动作（看向谁、表情等） */
  actionLine?: string
  /** 连发气泡：不重复头像/昵称 */
  bubbleContinued?: boolean
}

function RoleAvatar({
  roleName,
  portraitUrl,
}: {
  roleName: string
  portraitUrl?: string
}) {
  const initial = roleName.trim().slice(0, 1) || '？'
  return (
    <div className="jbs-gf-chat-role-avatar shrink-0" aria-hidden>
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt=""
          className="jbs-gf-chat-role-avatar-img"
          draggable={false}
        />
      ) : (
        <span className="jbs-gf-chat-role-avatar-fallback">{initial}</span>
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
  actionLine,
  bubbleContinued = false,
}: RolePortraitMsgBubbleProps) {
  const nickname = roleName.trim() || '未知'
  const action = actionLine?.trim()
  const text = body.trim()

  const dialogueBubble = (
    <div
      className={`jbs-font-serif jbs-gf-chat-dialogue-bubble jbs-gf-chat-group-bubble text-[15px] leading-[1.65] ${
        isSelf ? 'jbs-gf-chat-dialogue-bubble--self' : ''
      }${isSelf && isTyping ? ' jbs-gf-chat-dialogue-bubble--self-live' : ''}`}
    >
      {text ? <span>{text}</span> : null}
      {isTyping ? (
        <span className="jbs-gf-chat-typewriter-cursor ml-0.5 inline-block w-[2px] align-middle" />
      ) : null}
    </div>
  )

  if (!action && !text && !isTyping) return null

  return (
    <>
      {action ? (
        <NpcAsideBubble roleName={nickname} body={action} continued={bubbleContinued} />
      ) : null}
      {text || isTyping ? (
        <motion.div
          className={`jbs-gf-chat-group-row w-full shrink-0 overflow-x-visible ${
            bubbleContinued ? 'jbs-gf-chat-group-row--continued mb-1' : 'mb-3'
          }`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div
            className={`jbs-gf-chat-group-row-inner flex max-w-full flex-row items-start justify-start gap-2.5 ${
              bubbleContinued ? 'jbs-gf-chat-group-row-inner--continued' : ''
            }`}
          >
            {bubbleContinued ? (
              <div className="jbs-gf-chat-role-avatar-spacer shrink-0" aria-hidden />
            ) : (
              <RoleAvatar roleName={nickname} portraitUrl={portraitUrl} />
            )}
            <div className="flex min-w-0 max-w-[min(260px,calc(100vw-4.5rem))] flex-1 flex-col items-start gap-[3px]">
              {!bubbleContinued ? (
                <span className="jbs-gf-chat-group-nickname max-w-full truncate">{nickname}</span>
              ) : null}
              {dialogueBubble}
            </div>
          </div>
        </motion.div>
      ) : null}
    </>
  )
}
