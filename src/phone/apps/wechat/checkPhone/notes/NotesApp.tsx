import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ChevronLeft, Sparkles, Trash2 } from 'lucide-react'
import { useCurrentApiConfig } from '../../../api/ApiSettingsContext'

import { Pressable } from '../../../../components/Pressable'
import { NoteDetail } from './NoteDetail'
import type { PrivateMemo } from './memoTypes'
import { syncPrivateMemosWithAi } from './notesAi'
import { loadNotesState, saveNotesState, type NotesState } from './notesStorage'
import { NotesDashboard } from './NotesDashboard'
import { AIGenerateModal } from './AIGenerateModal'

export function NotesApp({
  onClose,
  characterId,
  playerIdentityId,
  playerDisplayName,
  useLumiProjectAssistantPrompt,
}: {
  onClose: () => void
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [state, setState] = useState<NotesState>({ notes: [], deleted: [] })
  const [activeMemo, setActiveMemo] = useState<PrivateMemo | null>(null)
  const [tab, setTab] = useState<'notes' | 'deleted'>('notes')
  const [genPanelOpen, setGenPanelOpen] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await loadNotesState(characterId)
      if (!cancelled) setState(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [characterId])

  const onGenerate = async (params: { count: number; bias: string }) => {
    setGenBusy(true)
    setError(null)
    try {
      const sync = await syncPrivateMemosWithAi({
        apiConfig,
        characterId,
        playerIdentityId,
        playerDisplayName,
        useLumiProjectAssistantPrompt,
        count: params.count,
        bias: params.bias,
        currentNotes: state.notes,
      })
      const byId = new Map(state.notes.map((x) => [x.id, x] as const))
      for (const m of sync.update) byId.set(m.id, m)
      for (const id of sync.deleteIds) byId.delete(id)
      const deletedPicked = state.notes.filter((n) => sync.deleteIds.includes(n.id))
      const nextState: NotesState = {
        notes: [...sync.add, ...Array.from(byId.values())],
        deleted: [...state.deleted, ...deletedPicked].slice(-5),
      }
      setState(nextState)
      await saveNotesState(characterId, nextState)
      setGenPanelOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenBusy(false)
    }
  }

  const onClearAll = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认清除当前备忘录数据吗？该操作不可撤销。')
      if (!confirmed) return
    }
    const emptyState: NotesState = { notes: [], deleted: [] }
    setActiveMemo(null)
    setTab('notes')
    setState(emptyState)
    await saveNotesState(characterId, emptyState)
  }

  return (
    <motion.div
      layoutScroll
      className={`absolute inset-0 z-[1408] bg-[#FCFCFC] ${activeMemo ? 'overflow-hidden' : 'overflow-y-auto'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-md" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <Pressable
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#262626] active:scale-[0.98]"
            onClick={activeMemo ? () => setActiveMemo(null) : onClose}
            aria-label="返回"
          >
            <ChevronLeft size={18} />
          </Pressable>
          <div className="text-[14px] tracking-[0.16em] text-[#202020]">备忘录</div>
          <div className="flex items-center gap-2">
            <Pressable
              type="button"
              className="flex h-9 items-center gap-1 rounded-full border border-[#e8dede] bg-white px-3 text-[#8f4f56] shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-[0.98]"
              onClick={() => {
                void onClearAll()
              }}
            >
              <Trash2 size={14} />
              <span className="text-[12px]">清除数据</span>
            </Pressable>
            <Pressable
              type="button"
              className="flex h-9 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 text-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-[0.98]"
              onClick={() => setGenPanelOpen(true)}
            >
              <Sparkles size={14} />
              <span className="text-[12px]">AI生成</span>
            </Pressable>
          </div>
        </div>
      </div>

      <LayoutGroup>
        <div className="relative">
          <motion.div
            animate={activeMemo ? { filter: 'blur(12px)', opacity: 0.62 } : { filter: 'blur(0px)', opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.5 }}
            style={{ transformOrigin: 'center center', willChange: 'filter, opacity' }}
            className={activeMemo ? 'pointer-events-none' : ''}
          >
            <NotesDashboard
              tab={tab}
              notes={state.notes}
              deleted={state.deleted}
              onSwitchTab={setTab}
              onOpen={setActiveMemo}
            />
          </motion.div>

          <AnimatePresence mode="sync">
            {activeMemo ? (
              <motion.div
                key={`detail-overlay-${activeMemo.id}`}
                className="fixed inset-0 z-[1412] overflow-y-auto"
                initial={{ opacity: 0, backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.5 }}
                style={{ willChange: 'opacity, backdrop-filter' }}
              >
                <div
                  className="mx-auto w-full max-w-[520px]"
                  style={{
                    paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
                    paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
                  }}
                >
                  <NoteDetail memo={activeMemo} onBack={() => setActiveMemo(null)} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      <AIGenerateModal
        open={genPanelOpen}
        busy={genBusy}
        error={error}
        onClose={() => setGenPanelOpen(false)}
        onSubmit={onGenerate}
      />
    </motion.div>
  )
}

