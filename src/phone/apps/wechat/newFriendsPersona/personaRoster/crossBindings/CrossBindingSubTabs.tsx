import { motion } from 'framer-motion'
import { PERSONA_COACH_TARGET_ATTR } from '../../../memory/memoryCoachTypes'
import { CROSS_BINDING_SUB_TABS, type CrossBindingSubTabId } from './crossBindingTypes'

const PILL_LAYOUT_ID = 'cross-binding-subtab-pill'

export function CrossBindingSubTabs({
  active,
  onChange,
}: {
  active: CrossBindingSubTabId
  onChange: (id: CrossBindingSubTabId) => void
}) {
  return (
    <nav
      aria-label="关系编辑视角"
      {...{ [PERSONA_COACH_TARGET_ATTR]: 'relations-subtabs' }}
      className="rounded-full bg-gray-100/80 p-1 backdrop-blur-md"
    >
      <div className="relative flex">
        {CROSS_BINDING_SUB_TABS.map((t) => {
          const selected = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center px-0.5 py-2 transition-colors duration-300"
            >
              {selected ? (
                <motion.span
                  layoutId={PILL_LAYOUT_ID}
                  className="absolute inset-0 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative text-[7px] font-semibold uppercase tracking-[0.2em] ${
                  selected ? 'text-[#111827]' : 'text-[#9CA3AF]'
                }`}
              >
                {t.en}
              </span>
              <span
                className={`relative mt-0.5 truncate text-[10px] font-medium ${
                  selected ? 'text-[#111827]' : 'text-[#9CA3AF]'
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
