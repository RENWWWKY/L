import { AnimatePresence, motion } from 'framer-motion'
import { AgentNumericText } from './AgentNumeric'
import { useAgentStore } from '../useAgentStore'

export function FloatingStatDeltaLayer() {
  const deltas = useAgentStore((s) => s.floatingDeltas)

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      <AnimatePresence>
        {deltas.map((d) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: -28, scale: 1 }}
            exit={{ opacity: 0, y: -48, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="absolute whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold shadow-lg"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: 'translate(-50%, -50%)',
              background:
                d.tone === 'gain'
                  ? 'rgba(255,255,255,0.95)'
                  : d.tone === 'loss'
                    ? 'rgba(255,245,247,0.95)'
                    : 'rgba(255,255,255,0.9)',
              color: d.tone === 'gain' ? '#059669' : d.tone === 'loss' ? '#e11d48' : '#2d2422',
              boxShadow: '0 4px 20px rgba(249,168,212,0.35)',
              border: '1px solid rgba(251,207,232,0.5)',
            }}
          >
            <AgentNumericText text={`${d.label} ${d.value}`} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
