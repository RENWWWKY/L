import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { STORY_CHAPTERS } from '../agentPresets'
import { useAgentStore } from '../useAgentStore'

export function StoryModeTab() {
  const storyChapterId = useAgentStore((s) => s.storyChapterId)
  const storySceneId = useAgentStore((s) => s.storySceneId)
  const storyLineIndex = useAgentStore((s) => s.storyLineIndex)
  const advanceStoryLine = useAgentStore((s) => s.advanceStoryLine)
  const pickStoryChoice = useAgentStore((s) => s.pickStoryChoice)

  const chapter = useMemo(
    () => STORY_CHAPTERS.find((c) => c.id === storyChapterId),
    [storyChapterId],
  )
  const scene = useMemo(
    () => chapter?.scenes.find((s) => s.id === storySceneId),
    [chapter, storySceneId],
  )

  const currentLine = scene?.lines[storyLineIndex]
  const atEndOfLines = scene && storyLineIndex >= scene.lines.length - 1
  const showChoices = atEndOfLines && scene?.choices && scene.choices.length > 0

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className="absolute inset-0 bg-gradient-to-b from-rose-100/60 via-[#fff5f7] to-rose-50"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(249,168,212,0.4), transparent 50%), radial-gradient(circle at 70% 80%, rgba(251,207,232,0.35), transparent 45%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex shrink-0 flex-col px-4 pt-2">
        <p className="agent-serif text-[13px] text-rose-400/90">{chapter?.title}</p>
        <h2 className="agent-serif text-[20px] font-semibold text-stone-800">主线剧情</h2>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-end px-4 pb-4">
        <AnimatePresence mode="wait">
          {currentLine && !showChoices && (
            <motion.div
              key={`${storySceneId}-${storyLineIndex}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="agent-story-dialog agent-serif mb-3 px-5 py-4 text-[16px] leading-[1.85] text-stone-800"
            >
              {currentLine}
            </motion.div>
          )}
        </AnimatePresence>

        {showChoices ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-2"
          >
            {scene!.choices!.map((choice) => (
              <Pressable
                key={choice.id}
                onClick={() => pickStoryChoice(choice.id)}
                className="agent-rose-card flex w-full items-center justify-between px-4 py-3.5 text-left"
              >
                <span className="agent-serif text-[15px] text-stone-800">{choice.label}</span>
                <ChevronRight size={16} className="text-rose-300" />
              </Pressable>
            ))}
          </motion.div>
        ) : currentLine ? (
          <Pressable
            onClick={() => advanceStoryLine()}
            className="rounded-2xl bg-rose-400/90 py-3 text-center text-[15px] font-medium text-white shadow-lg shadow-rose-200/50"
          >
            {atEndOfLines ? '…' : '继续'}
          </Pressable>
        ) : (
          <p className="agent-serif text-center text-stone-500">本章暂告一段落，敬请期待后续篇章。</p>
        )}
      </div>
    </div>
  )
}
