import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'

import { isScriptSectionUnlocked, type ScriptSection } from './jbsFlowTypes'
import { useJBSFlow } from './JBSFlowEngine'

function LockedSection({ title }: { title: string }) {
  return (
    <div className="jbs-gf-chat-parchment-locked mt-3 flex items-start gap-2 rounded-lg px-4 py-3">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-[#5c3d2e]/45" strokeWidth={1.25} />
      <div>
        <p className="jbs-font-serif text-[13px] text-[#5c3d2e]/65">{title}</p>
        <p className="jbs-font-serif mt-1 text-[10px] tracking-wider text-[#5c3d2e]/45">
          锁 · 剧情尚未推进至此
        </p>
      </div>
    </div>
  )
}

function UnlockedSection({ section }: { section: ScriptSection }) {
  return (
    <motion.article
      className="jbs-gf-chat-parchment mt-4 rounded-lg px-5 py-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <h3 className="jbs-font-serif border-b border-[#5c3d2e]/20 pb-2 text-[15px] tracking-[0.12em] text-[#3d2e24]">
        {section.title}
      </h3>
      <p className="jbs-font-kai-archive mt-3 whitespace-pre-wrap text-[13px] leading-[1.85] text-[#1a1a1a]/88">
        {section.body}
      </p>
    </motion.article>
  )
}

export function MyScriptTab() {
  const { scriptSections, currentStep, loopRound } = useJBSFlow()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar px-4 pb-8 pt-2">
      <p className="jbs-font-serif jbs-gf-text-muted text-center text-[10px] tracking-[0.24em]">
        个人剧本 · 分幕解锁
      </p>
      <div className="mt-4">
        {scriptSections.map((section) => {
          const unlocked = isScriptSectionUnlocked(section.id, currentStep, loopRound)
          return (
            <AnimatePresence key={section.id} mode="wait">
              {unlocked ? (
                <UnlockedSection section={section} />
              ) : (
                <LockedSection title={section.title} />
              )}
            </AnimatePresence>
          )
        })}
      </div>
    </div>
  )
}
