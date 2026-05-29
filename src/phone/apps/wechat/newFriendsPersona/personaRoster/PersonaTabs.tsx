import { motion } from 'framer-motion'
import { PERSONA_COACH_TARGET_ATTR } from '../../memory/memoryCoachTypes'
import { PERSONA_ROSTER_TABS, type PersonaRosterTabId } from './personaRosterTypes'

const TAB_LAYOUT_ID = 'persona-roster-tab-pill'

export function PersonaTabs({
  active,
  onChange,
}: {
  active: PersonaRosterTabId
  onChange: (id: PersonaRosterTabId) => void
}) {
  return (
    <nav
      aria-label="人物名册分区"
      className="mx-4 mt-3 rounded-full bg-white/55 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl"
    >
      <div className="relative flex">
        {PERSONA_ROSTER_TABS.map((t) => {
          const selected = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              {...(t.id === 'relations' ? { [PERSONA_COACH_TARGET_ATTR]: 'roster-tab-relations' } : {})}
              onClick={() => onChange(t.id)}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center px-1 py-2.5 transition-colors duration-300"
            >
              {selected ? (
                <motion.span
                  layoutId={TAB_LAYOUT_ID}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative text-[8px] font-semibold uppercase tracking-[0.28em] ${
                  selected ? 'text-[#1C1C1E]' : 'text-[#9CA3AF]'
                }`}
              >
                {t.en}
              </span>
              <span
                className={`relative mt-0.5 truncate text-[11px] font-medium tracking-tight ${
                  selected ? 'text-[#1C1C1E]' : 'text-[#9CA3AF]'
                }`}
              >
                {t.zh}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
