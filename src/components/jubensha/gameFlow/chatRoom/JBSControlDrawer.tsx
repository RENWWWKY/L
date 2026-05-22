import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

import type { DrawerTab } from './jbsFlowTypes'
import { useJBSFlow } from './JBSFlowEngine'
import { MyManuscriptTab } from './MyManuscriptTab'
import { MyScriptTab } from './MyScriptTab'
import { PublicCluesTab } from './PublicCluesTab'

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'script', label: '个人剧本' },
  { id: 'manuscript', label: '专属手稿' },
  { id: 'clues', label: '公共线索' },
]

export function JBSControlDrawer() {
  const { drawerOpen, setDrawerOpen, drawerTab, setDrawerTab } = useJBSFlow()

  return (
    <AnimatePresence>
      {drawerOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭手札"
            className="jbs-gf-chat-drawer-scrim fixed inset-0 z-[75]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
          <motion.aside
            className="jbs-gf-chat-drawer fixed inset-y-0 right-0 z-[80] flex w-[70%] max-w-[320px] min-w-[240px] flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header className="shrink-0 border-b border-[#5c3d2e]/15 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between">
                <p className="jbs-font-serif text-[13px] tracking-[0.2em] text-[#5c3d2e]">手札</p>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="jbs-gf-chat-icon-btn flex size-8 items-center justify-center rounded-full"
                  aria-label="关闭"
                >
                  <X className="size-4" strokeWidth={1.25} />
                </button>
              </div>
              <nav className="mt-3 flex gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDrawerTab(tab.id)}
                    className={`jbs-font-serif flex-1 rounded-md py-2 text-[10px] tracking-[0.14em] transition-colors ${
                      drawerTab === tab.id ? 'jbs-gf-chat-drawer-tab-active' : 'jbs-gf-chat-drawer-tab'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </header>
            <div className="flex min-h-0 flex-1 flex-col">
              {drawerTab === 'script' ? <MyScriptTab /> : null}
              {drawerTab === 'manuscript' ? <MyManuscriptTab /> : null}
              {drawerTab === 'clues' ? <PublicCluesTab /> : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
