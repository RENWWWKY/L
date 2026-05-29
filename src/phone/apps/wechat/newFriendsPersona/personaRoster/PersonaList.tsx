import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, UserPlus } from 'lucide-react'
import type { Character, PlayerIdentity } from '../types'
import type { WechatAccountsBundle } from '../../wechatAccountTypes'
import { PersonaCard } from './PersonaCard'

function PersonaListRow({
  character,
  variant,
  identityList,
  identityNameById,
  mainNameById,
  mainById,
  accountsBundle,
  onOpen,
  onDelete,
  onGenerateContacts,
}: {
  character: Character
  variant: 'main' | 'npc'
  identityList: PlayerIdentity[]
  identityNameById: Record<string, string>
  mainNameById: Record<string, string>
  mainById?: Record<string, Character>
  accountsBundle: WechatAccountsBundle | null
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onGenerateContacts?: (rootId: string) => void
}) {
  const actionBtnClass =
    'rounded-full bg-[#F7F7F9] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-transform active:scale-95'
  const actionWrapClass =
    variant === 'npc' ? 'absolute right-3 top-3 z-10 flex items-center gap-1.5' : 'absolute right-5 top-5 z-10 flex items-center gap-1.5'

  return (
    <div
      className={`relative ${variant === 'npc' ? 'mb-2.5 rounded-2xl' : 'mb-4 rounded-3xl'}`}
    >
      <div className="relative">
        <button type="button" className="block w-full text-left" onClick={() => onOpen(character.id)}>
          <PersonaCard
            character={character}
            variant={variant}
            identityList={identityList}
            identityNameById={identityNameById}
            mainNameById={mainNameById}
            mainById={mainById}
            accountsBundle={accountsBundle}
          />
        </button>
        <div className={actionWrapClass}>
          {variant === 'main' && onGenerateContacts ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onGenerateContacts(character.id)
              }}
              className={`${actionBtnClass} text-[#374151]`}
              aria-label="生成微信通讯录联系人"
              title="生成通讯录联系人"
            >
              <UserPlus className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(character.id)
            }}
            className={`${actionBtnClass} text-[#EF4444]/75 hover:bg-[#FEF2F2] hover:text-[#EF4444]`}
            aria-label="删除角色"
            title="删除角色"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function PersonaList({
  variant,
  characters,
  loading,
  identityList,
  identityNameById,
  mainNameById,
  mainById,
  accountsBundle,
  onOpen,
  onDelete,
  onGenerateContacts,
  emptyTitle,
  emptyHint,
}: {
  variant: 'main' | 'npc'
  characters: Character[]
  loading: boolean
  identityList: PlayerIdentity[]
  identityNameById: Record<string, string>
  mainNameById: Record<string, string>
  mainById?: Record<string, Character>
  accountsBundle: WechatAccountsBundle | null
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onGenerateContacts?: (rootId: string) => void
  emptyTitle: string
  emptyHint: string
}) {
  if (loading && !characters.length) {
    return (
      <p className="py-12 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-[#9CA3AF]">
        LOADING ARCHIVE…
      </p>
    )
  }

  if (!characters.length) {
    return (
      <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <p className="text-[16px] font-medium text-[#111827]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          {emptyTitle}
        </p>
        <p className="mt-3 text-[13px] font-light leading-relaxed text-[#9CA3AF]">{emptyHint}</p>
      </div>
    )
  }

  return (
    <motion.ul
      key={variant}
      className="list-none p-0 m-0"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatePresence initial={false}>
        {characters.map((c) => (
          <motion.li
            key={c.id}
            layout
            exit={{ opacity: 0, x: -48, transition: { duration: 0.28 } }}
            transition={{ layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
          >
            <PersonaListRow
              character={c}
              variant={variant}
              identityList={identityList}
              identityNameById={identityNameById}
              mainNameById={mainNameById}
              mainById={mainById}
              accountsBundle={accountsBundle}
              onOpen={onOpen}
              onDelete={onDelete}
              onGenerateContacts={onGenerateContacts}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  )
}
