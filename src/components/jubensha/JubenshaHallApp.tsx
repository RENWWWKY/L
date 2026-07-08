import './jubensha.css'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import type { WeChatPersonaContact } from '../../phone/types'

import { buildContactDBFromWeChat } from './contactDB'
import { JUBENSHA_HALL_UNDER_DEV } from './jubenshaDevFlags'
import { JubenshaHallUnderDev } from './JubenshaHallUnderDev'
import { LibraryHome } from './LibraryHome'
import { MyJournal } from './MyJournal'
import { loadPlayRecord } from './jubenshaStorage'
import { MOCK_JUBENSHA_SCRIPTS } from './mockData'
import { JBSGameFlow } from './gameFlow/JBSGameFlow'
import { ScriptDetailPage } from './ScriptDetailPage'
import type { JubenshaScript } from './types'

export type JubenshaHallAppProps = {
  onBack: () => void
  currentUserName?: string
  personaContacts?: WeChatPersonaContact[]
}

type HallTab = 'library' | 'journal'
type Screen = 'main' | 'detail' | 'game-flow'

export function JubenshaHallApp(props: JubenshaHallAppProps) {
  if (JUBENSHA_HALL_UNDER_DEV) {
    return <JubenshaHallUnderDev onBack={props.onBack} />
  }
  return <JubenshaHallAppInner {...props} />
}

function JubenshaHallAppInner({
  onBack,
  currentUserName = '我',
  personaContacts = [],
}: JubenshaHallAppProps) {
  const [tab, setTab] = useState<HallTab>('library')
  const [screen, setScreen] = useState<Screen>('main')
  const [selected, setSelected] = useState<JubenshaScript | null>(null)

  const contactDb = useMemo(() => buildContactDBFromWeChat(personaContacts), [personaContacts])
  const characterIds = useMemo(
    () => personaContacts.map((c) => c.characterId),
    [personaContacts],
  )
  const record = useMemo(() => loadPlayRecord(characterIds), [characterIds])

  const openScript = useCallback((script: JubenshaScript) => {
    setSelected(script)
    setScreen('detail')
  }, [])

  const closeDetail = useCallback(() => {
    setScreen('main')
    window.setTimeout(() => setSelected(null), 400)
  }, [])

  const handleStartRoleplay = useCallback((script: JubenshaScript) => {
    setSelected(script)
    setScreen('game-flow')
  }, [])

  const exitGameFlow = useCallback(() => {
    setScreen('main')
    window.setTimeout(() => setSelected(null), 350)
  }, [])

  return (
    <LayoutGroup id="jubensha-hall">
      <div className="jbs-hall relative flex h-full min-h-0 flex-col">
        <AnimatePresence mode="popLayout" initial={false}>
          {screen === 'main' ? (
            <motion.div
              key="main-shell"
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <header className="jbs-safe-header relative z-10 shrink-0 border-b border-[#5c3d2e]/15 bg-[#f4f1ea]/95 backdrop-blur-sm">
                <div className="relative flex min-h-[52px] items-center justify-center px-12">
                  <button
                    type="button"
                    onClick={onBack}
                    className="absolute left-0 flex size-9 items-center justify-center rounded-full border border-[#5c3d2e]/25 text-[#5c3d2e] transition-colors hover:bg-[#5c3d2e]/8"
                    aria-label="返回发现"
                  >
                    <ArrowLeft className="size-5" strokeWidth={1.5} />
                  </button>
                  <div className="pointer-events-none w-full text-center">
                    <h1 className="jbs-font-handwriting text-[22px] leading-none text-[#1a1a1a]">
                      剧本杀馆
                    </h1>
                    <p className="jbs-font-serif mt-0.5 text-[10px] tracking-[0.2em] text-[#1a1a1a]/45">
                      Classic Library · Mystery Archives
                    </p>
                  </div>
                </div>

                <nav className="mt-3 flex justify-center gap-10" aria-label="典藏书架与推理手记">
                  {(
                    [
                      { id: 'library' as const, label: '典藏书架' },
                      { id: 'journal' as const, label: '推理手记' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`jbs-font-serif pb-2.5 text-[13px] tracking-[0.12em] transition-colors ${
                        tab === t.id ? 'jbs-tab-active' : 'text-[#1a1a1a]/40 hover:text-[#1a1a1a]/65'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </nav>
              </header>

              <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden jbs-hide-scrollbar pb-[max(8px,env(safe-area-inset-bottom,0px))]">
                <AnimatePresence mode="wait">
                  {tab === 'library' ? (
                    <motion.div
                      key="library"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28 }}
                    >
                      <LibraryHome scripts={MOCK_JUBENSHA_SCRIPTS} onSelectScript={openScript} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="journal"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28 }}
                    >
                      <MyJournal
                        record={record}
                        contactDb={contactDb}
                        scripts={MOCK_JUBENSHA_SCRIPTS}
                        onSelectScript={openScript}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>
            </motion.div>
          ) : screen === 'detail' && selected ? (
            <ScriptDetailPage
              key={`detail-${selected.id}`}
              script={selected}
              contactDb={contactDb}
              currentUserName={currentUserName}
              onBack={closeDetail}
              onStartRoleplay={handleStartRoleplay}
            />
          ) : screen === 'game-flow' && selected ? (
            <JBSGameFlow
              key={`game-${selected.id}`}
              script={selected}
              playerDisplayName={currentUserName}
              onExit={exitGameFlow}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  )
}

export default JubenshaHallApp
