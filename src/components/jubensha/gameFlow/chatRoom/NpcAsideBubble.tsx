import { motion } from 'framer-motion'

export type NpcAsideBubbleProps = {
  roleName: string
  body: string
  /** 同组旁白续条：不重复角色名标签 */
  continued?: boolean
}

/** NPC 讨论 · 神态/动作旁白（居中宽条，与 DM 旁白同款视觉） */
export function NpcAsideBubble({ roleName, body, continued = false }: NpcAsideBubbleProps) {
  const text = body.trim()
  if (!text) return null
  const nickname = roleName.trim() || '未知'

  return (
    <motion.div
      className={`jbs-gf-chat-npc-aside-row w-full ${continued ? 'mb-1.5' : 'mb-3'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col items-center px-2">
        {!continued ? (
          <span className="jbs-gf-chat-dm-tag mb-2 font-sans text-[9px] font-extralight tracking-[0.28em]">
            {nickname}
          </span>
        ) : null}
        <div className="jbs-gf-chat-narration-bubble max-w-[94%] px-4 py-3.5">
          <p className="jbs-font-kai jbs-gf-chat-narration-bubble-text whitespace-pre-wrap text-[16px] leading-loose">
            {text}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
