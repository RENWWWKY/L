import {
  Circle,
  Highlighter,
  Pin,
  Redo2,
  StickyNote,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import {
  ANNOTATION_HISTORY_MAX,
  annotationStoresEqual,
  cloneAnnotationStore,
} from './scriptAnnotationHistory'
import {
  loadScriptAnnotations,
  saveScriptAnnotations,
} from './scriptAnnotationStore'
import type {
  ScriptAnnotationStore,
  ScriptAnnotationTool,
  ScriptStickyNote,
  ScriptTextMark,
} from './scriptAnnotationTypes'
import { offsetsFromWindowSelection, rectsForOffsets } from './scriptTextRange'

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type ScriptAnnotationContextValue = {
  pageId: string
  tool: ScriptAnnotationTool
  setTool: (tool: ScriptAnnotationTool) => void
  notes: ScriptStickyNote[]
  marks: ScriptTextMark[]
  addMarkFromSelection: (
    kind: ScriptTextMark['kind'],
    bodyRoot: HTMLElement | null,
    offsetsOverride?: { start: number; end: number } | null,
  ) => void
  removeMark: (id: string) => void
  clearPageMarks: () => void
  addStickyNote: (
    text?: string,
    anchorPct?: { x: number; y: number },
    opts?: { opaque?: boolean },
  ) => string
  updateNoteText: (id: string, text: string) => void
  toggleNoteOpaque: (id: string) => void
  setNoteOpaque: (id: string, opaque: boolean) => void
  removeNote: (id: string) => void
  updateNotePosition: (id: string, x: number, y: number) => void
  persistStickyNotes: boolean
  setPersistStickyNotes: (on: boolean) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  beginNoteEdit: () => void
  endNoteEdit: () => void
  beginNoteDrag: () => void
  endNoteDrag: (moved: boolean) => void
}

const ScriptAnnotationContext = createContext<ScriptAnnotationContextValue | null>(null)

function useScriptAnnotationCtx(): ScriptAnnotationContextValue {
  const ctx = useContext(ScriptAnnotationContext)
  if (!ctx) throw new Error('ScriptPageAnnotations requires ScriptAnnotationProvider')
  return ctx
}

export type ScriptAnnotationProviderProps = {
  scriptId: string
  roleId: string
  pageId: string
  children: ReactNode
}

export function ScriptAnnotationProvider({
  scriptId,
  roleId,
  pageId,
  children,
}: ScriptAnnotationProviderProps) {
  const [store, setStore] = useState(() => loadScriptAnnotations(scriptId, roleId))
  const [tool, setTool] = useState<ScriptAnnotationTool>('select')
  const [past, setPast] = useState<ScriptAnnotationStore[]>([])
  const [future, setFuture] = useState<ScriptAnnotationStore[]>([])
  const noteEditSnapshotRef = useRef<ScriptAnnotationStore | null>(null)
  const noteDragSnapshotRef = useRef<ScriptAnnotationStore | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    setStore(loadScriptAnnotations(scriptId, roleId))
    setPast([])
    setFuture([])
    noteEditSnapshotRef.current = null
    noteDragSnapshotRef.current = null
  }, [scriptId, roleId])

  const pushPast = useCallback((snapshot: ScriptAnnotationStore) => {
    setPast((p) => [...p, cloneAnnotationStore(snapshot)].slice(-ANNOTATION_HISTORY_MAX))
    setFuture([])
  }, [])

  const mutate = useCallback(
    (updater: (prev: ScriptAnnotationStore) => ScriptAnnotationStore, recordHistory = true) => {
      setStore((prev) => {
        if (recordHistory) pushPast(prev)
        const next = updater(prev)
        saveScriptAnnotations(scriptId, roleId, next)
        return next
      })
    },
    [pushPast, scriptId, roleId],
  )

  const mutateSilent = useCallback(
    (updater: (prev: ScriptAnnotationStore) => ScriptAnnotationStore) => {
      mutate(updater, false)
    },
    [mutate],
  )

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const snapshot = p[p.length - 1]
      setStore((current) => {
        setFuture((f) => [...f, cloneAnnotationStore(current)].slice(-ANNOTATION_HISTORY_MAX))
        saveScriptAnnotations(scriptId, roleId, snapshot)
        return snapshot
      })
      return p.slice(0, -1)
    })
  }, [scriptId, roleId])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const snapshot = f[f.length - 1]
      setStore((current) => {
        setPast((p) => [...p, cloneAnnotationStore(current)].slice(-ANNOTATION_HISTORY_MAX))
        saveScriptAnnotations(scriptId, roleId, snapshot)
        return snapshot
      })
      return f.slice(0, -1)
    })
  }, [scriptId, roleId])

  const beginNoteEdit = useCallback(() => {
    noteEditSnapshotRef.current = cloneAnnotationStore(storeRef.current)
  }, [])

  const endNoteEdit = useCallback(() => {
    const snap = noteEditSnapshotRef.current
    noteEditSnapshotRef.current = null
    if (!snap) return
    const cur = storeRef.current
    if (!annotationStoresEqual(snap, cur)) pushPast(snap)
  }, [pushPast])

  const beginNoteDrag = useCallback(() => {
    noteDragSnapshotRef.current = cloneAnnotationStore(storeRef.current)
  }, [])

  const endNoteDrag = useCallback(
    (moved: boolean) => {
      const snap = noteDragSnapshotRef.current
      noteDragSnapshotRef.current = null
      if (!moved || !snap) return
      const cur = storeRef.current
      if (!annotationStoresEqual(snap, cur)) pushPast(snap)
    },
    [pushPast],
  )

  const notes = useMemo(
    () => store.notes.filter((n) => n.pageId === pageId),
    [store.notes, pageId],
  )
  const marks = useMemo(
    () => store.marks.filter((m) => m.pageId === pageId),
    [store.marks, pageId],
  )

  const addMarkFromSelection = useCallback(
    (
      kind: ScriptTextMark['kind'],
      bodyRoot: HTMLElement | null,
      offsetsOverride?: { start: number; end: number } | null,
    ) => {
      if (!bodyRoot) return
      const offsets = offsetsOverride ?? offsetsFromWindowSelection(bodyRoot)
      if (!offsets) return
      const mark: ScriptTextMark = {
        id: uid('mark'),
        pageId,
        kind,
        start: offsets.start,
        end: offsets.end,
      }
      mutate((prev) => ({ ...prev, marks: [...prev.marks, mark] }))
      window.getSelection()?.removeAllRanges()
    },
    [pageId, mutate],
  )

  const removeMark = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, marks: prev.marks.filter((m) => m.id !== id) }))
    },
    [mutate],
  )

  const clearPageMarks = useCallback(() => {
    mutate((prev) => ({
      ...prev,
      marks: prev.marks.filter((m) => m.pageId !== pageId),
    }))
  }, [pageId, mutate])

  const addStickyNote = useCallback(
    (text = '', anchorPct = { x: 28, y: 22 }, opts?: { opaque?: boolean }) => {
      const id = uid('note')
      const note: ScriptStickyNote = {
        id,
        pageId,
        x: anchorPct.x,
        y: anchorPct.y,
        width: 152,
        height: 96,
        text,
        opaque: opts?.opaque ?? false,
      }
      mutate((prev) => ({ ...prev, notes: [...prev.notes, note] }))
      return id
    },
    [pageId, mutate],
  )

  const updateNoteText = useCallback(
    (id: string, text: string) => {
      mutateSilent((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, text } : n)),
      }))
    },
    [mutateSilent],
  )

  const toggleNoteOpaque = useCallback(
    (id: string) => {
      mutateSilent((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, opaque: !n.opaque } : n)),
      }))
    },
    [mutateSilent],
  )

  const setNoteOpaque = useCallback(
    (id: string, opaque: boolean) => {
      mutateSilent((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => {
          if (n.id === id) return { ...n, opaque }
          if (opaque) return { ...n, opaque: false }
          return n
        }),
      }))
    },
    [mutateSilent],
  )

  const removeNote = useCallback(
    (id: string) => {
      mutate((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }))
    },
    [mutate],
  )

  const updateNotePosition = useCallback(
    (id: string, x: number, y: number) => {
      mutateSilent((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id
            ? { ...n, x: Math.max(4, Math.min(88, x)), y: Math.max(6, Math.min(82, y)) }
            : n,
        ),
      }))
    },
    [mutateSilent],
  )

  const setPersistStickyNotes = useCallback(
    (on: boolean) => {
      mutate((prev) => ({ ...prev, persistStickyNotes: on }))
    },
    [mutate],
  )

  const value = useMemo(
    () => ({
      pageId,
      tool,
      setTool,
      notes,
      marks,
      addMarkFromSelection,
      removeMark,
      clearPageMarks,
      addStickyNote,
      updateNoteText,
      toggleNoteOpaque,
      setNoteOpaque,
      removeNote,
      updateNotePosition,
      persistStickyNotes: store.persistStickyNotes,
      setPersistStickyNotes,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      undo,
      redo,
      beginNoteEdit,
      endNoteEdit,
      beginNoteDrag,
      endNoteDrag,
    }),
    [
      pageId,
      tool,
      notes,
      marks,
      past.length,
      future.length,
      store.persistStickyNotes,
      addMarkFromSelection,
      removeMark,
      clearPageMarks,
      addStickyNote,
      updateNoteText,
      toggleNoteOpaque,
      setNoteOpaque,
      removeNote,
      updateNotePosition,
      setPersistStickyNotes,
      undo,
      redo,
      beginNoteEdit,
      endNoteEdit,
      beginNoteDrag,
      endNoteDrag,
    ],
  )

  return (
    <ScriptAnnotationContext.Provider value={value}>{children}</ScriptAnnotationContext.Provider>
  )
}

export function ScriptAnnotationToolbar({ bodyRootRef }: { bodyRootRef: React.RefObject<HTMLElement | null> }) {
  const {
    tool,
    setTool,
    addMarkFromSelection,
    addStickyNote,
    marks,
    clearPageMarks,
    persistStickyNotes,
    setPersistStickyNotes,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useScriptAnnotationCtx()
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    const root = bodyRootRef.current
    if (!root) return
    const sync = () => {
      const offsets = offsetsFromWindowSelection(root)
      if (offsets) lastSelectionRef.current = offsets
    }
    document.addEventListener('selectionchange', sync)
    return () => document.removeEventListener('selectionchange', sync)
  }, [bodyRootRef])

  const applyMark = (kind: ScriptTextMark['kind']) => {
    const root = bodyRootRef.current
    const offsets =
      (root ? offsetsFromWindowSelection(root) : null) ?? lastSelectionRef.current
    setTool(kind)
    addMarkFromSelection(kind, root, offsets)
  }

  const focusAnnotateLayer = () => {
    document.querySelector<HTMLElement>('.jbs-script-annotate-layer')?.focus({ preventScroll: true })
  }

  const onAddStickyNote = async () => {
    setTool('select')
    focusAnnotateLayer()
    let pasted = ''
    try {
      pasted = (await navigator.clipboard.readText()).trim()
    } catch {
      pasted = ''
    }
    addStickyNote(pasted, { x: 28, y: 22 }, { opaque: !!pasted })
  }

  return (
    <div
      className="jbs-script-annotate-toolbar mt-3 flex flex-wrap items-center justify-center gap-1.5 px-1"
      data-script-coach="toolbar"
    >
      <IconToolBtn
        label="撤回"
        title="撤回上一步（Ctrl+Z）"
        disabled={!canUndo}
        onClick={undo}
        coachTarget="toolbar-undo"
      >
        <Undo2 className="size-3.5" strokeWidth={1.5} />
      </IconToolBtn>
      <IconToolBtn
        label="重做"
        title="恢复误撤（Ctrl+Y）"
        disabled={!canRedo}
        onClick={redo}
        coachTarget="toolbar-redo"
      >
        <Redo2 className="size-3.5" strokeWidth={1.5} />
      </IconToolBtn>
      <span className="mx-0.5 h-4 w-px bg-[#c4a876]/25" aria-hidden />
      <ToolBtn
        active={tool === 'select'}
        label="选取"
        onClick={() => setTool('select')}
        title="选取文字后点下划线或画圈"
        coachTarget="toolbar-select"
      >
        <span className="text-[10px]">选取</span>
      </ToolBtn>
      <ToolBtn
        active={tool === 'underline'}
        label="下划线"
        onPointerDown={(e) => {
          e.preventDefault()
          applyMark('underline')
        }}
        title="为选中文字添加下划线"
        coachTarget="toolbar-underline"
      >
        <Highlighter className="size-3.5" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        active={tool === 'circle'}
        label="画圈"
        onPointerDown={(e) => {
          e.preventDefault()
          applyMark('circle')
        }}
        title="为选中区域画圈"
        coachTarget="toolbar-circle"
      >
        <Circle className="size-3.5" strokeWidth={1.5} />
      </ToolBtn>
      <ToolBtn
        active={false}
        label="手写便签"
        onClick={() => void onAddStickyNote()}
        title="新建便签；若剪贴板有文字会一并粘贴。页内 Ctrl+V 亦可"
        coachTarget="toolbar-sticky"
      >
        <StickyNote className="size-3.5" strokeWidth={1.5} />
        <span className="text-[10px]">便签</span>
      </ToolBtn>
      <ToolBtn
        active={persistStickyNotes}
        label="便签常驻"
        onClick={() => setPersistStickyNotes(!persistStickyNotes)}
        title={
          persistStickyNotes
            ? '已开启：收起后便签保持实色显示'
            : '已关闭：未编辑时便签为半透明（默认）'
        }
      >
        <Pin className="size-3.5" strokeWidth={1.5} />
        <span className="text-[10px]">常驻</span>
      </ToolBtn>
      {marks.length > 0 ? (
        <button
          type="button"
          className="jbs-script-annotate-tool ml-1 flex items-center gap-1 px-2 py-1.5"
          title="清除本页全部标记"
          onClick={clearPageMarks}
        >
          <Trash2 className="size-3" strokeWidth={1.5} />
          <span className="text-[9px]">清标记</span>
        </button>
      ) : null}
    </div>
  )
}

function IconToolBtn({
  label,
  title,
  disabled,
  onClick,
  coachTarget,
  children,
}: {
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
  coachTarget?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...(coachTarget ? { 'data-script-coach': coachTarget } : {})}
      className="jbs-script-annotate-tool flex size-8 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  )
}

function ToolBtn({
  active,
  label,
  title,
  onClick,
  onPointerDown,
  coachTarget,
  children,
}: {
  active: boolean
  label: string
  title: string
  onClick?: () => void
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  coachTarget?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
      onPointerDown={onPointerDown}
      {...(coachTarget ? { 'data-script-coach': coachTarget } : {})}
      className={`jbs-script-annotate-tool flex items-center gap-1 rounded-full px-2.5 py-1.5${active ? ' jbs-script-annotate-tool--active' : ''}`}
    >
      {children}
    </button>
  )
}

export type ScriptAnnotatablePageProps = {
  bodyRef: React.RefObject<HTMLParagraphElement | null>
  children: ReactNode
}

/** 页内标注层：便签 + 下划线/圈选（叠在正文之上） */
export function ScriptAnnotatablePage({ bodyRef, children }: ScriptAnnotatablePageProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const { marks, addStickyNote, undo, redo, canUndo, canRedo } = useScriptAnnotationCtx()

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        if (!canUndo) return
        e.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        if (!canRedo) return
        e.preventDefault()
        redo()
      }
    },
    [canRedo, canUndo, redo, undo],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData('text/plain').trim()
      if (!text) return
      e.preventDefault()
      const layer = layerRef.current
      if (!layer) {
        addStickyNote(text, undefined, { opaque: true })
        return
      }
      addStickyNote(text, { x: 38, y: 40 }, { opaque: true })
    },
    [addStickyNote],
  )

  return (
    <div
      ref={layerRef}
      className="jbs-script-annotate-layer relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="jbs-script-annotate-body relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <ScriptTextMarkOverlay bodyRef={bodyRef} layerRef={layerRef} marks={marks} />
    </div>
  )
}

/** 便签层：须叠在揭页热区之上，由 ThreeDPageFlipper 挂在 pageShell 顶层 */
export function ScriptStickyNotesOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null)
  const {
    notes,
    updateNoteText,
    setNoteOpaque,
    removeNote,
    updateNotePosition,
    beginNoteEdit,
    endNoteEdit,
    beginNoteDrag,
    endNoteDrag,
  } = useScriptAnnotationCtx()

  return (
    <div
      ref={overlayRef}
      className="jbs-script-sticky-notes-overlay pointer-events-none absolute inset-0 z-[8]"
    >
      <ScriptStickyNoteLayer
        layerRef={overlayRef}
        notes={notes}
        onUpdateText={updateNoteText}
        onSetOpaque={setNoteOpaque}
        onRemove={removeNote}
        onMove={updateNotePosition}
        onBeginNoteEdit={beginNoteEdit}
        onEndNoteEdit={endNoteEdit}
        onBeginNoteDrag={beginNoteDrag}
        onEndNoteDrag={endNoteDrag}
      />
    </div>
  )
}

function ScriptTextMarkOverlay({
  bodyRef,
  layerRef,
  marks,
}: {
  bodyRef: React.RefObject<HTMLParagraphElement | null>
  layerRef: React.RefObject<HTMLDivElement | null>
  marks: ScriptTextMark[]
}) {
  const [boxes, setBoxes] = useState<
    { id: string; kind: ScriptTextMark['kind']; rects: DOMRect[]; union: DOMRect | null }[]
  >([])

  const recompute = useCallback(() => {
    const root = bodyRef.current
    const layer = layerRef.current
    if (!root || !layer) {
      setBoxes([])
      return
    }
    const layerRect = layer.getBoundingClientRect()
    const next = marks.map((m) => {
      const clientRects = rectsForOffsets(root, m.start, m.end)
      const rects = clientRects.map(
        (r) =>
          new DOMRect(
            r.left - layerRect.left,
            r.top - layerRect.top,
            r.width,
            r.height,
          ),
      )
      let union: DOMRect | null = null
      for (const r of rects) {
        if (!union) union = r
        else {
          const left = Math.min(union.left, r.left)
          const top = Math.min(union.top, r.top)
          const right = Math.max(union.right, r.right)
          const bottom = Math.max(union.bottom, r.bottom)
          union = new DOMRect(left, top, right - left, bottom - top)
        }
      }
      return { id: m.id, kind: m.kind, rects, union }
    })
    setBoxes(next)
  }, [bodyRef, layerRef, marks])

  useLayoutEffect(() => {
    recompute()
    const root = bodyRef.current
    const layer = layerRef.current
    if (!root || !layer) return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(root)
    ro.observe(layer)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [bodyRef, layerRef, recompute])

  if (boxes.length === 0) return null

  return (
    <div className="jbs-script-mark-overlay pointer-events-none absolute inset-0 z-[2]" aria-hidden>
      {boxes.map(({ id, kind, rects, union }) => (
        <div key={id}>
          {kind === 'underline'
            ? rects.map((r, i) => (
                <div
                  key={`${id}-u-${i}`}
                  className="jbs-script-mark-underline"
                  style={{
                    left: r.left,
                    top: r.bottom - 3,
                    width: r.width,
                  }}
                />
              ))
            : null}
          {kind === 'circle' && union ? (
            <div
              className="jbs-script-mark-circle"
              style={{
                left: union.left - 5,
                top: union.top - 4,
                width: union.width + 10,
                height: union.height + 8,
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ScriptStickyNoteLayer({
  layerRef,
  notes,
  onUpdateText,
  onSetOpaque,
  onRemove,
  onMove,
  onBeginNoteEdit,
  onEndNoteEdit,
  onBeginNoteDrag,
  onEndNoteDrag,
}: {
  layerRef: React.RefObject<HTMLDivElement | null>
  notes: ScriptStickyNote[]
  onUpdateText: (id: string, text: string) => void
  onSetOpaque: (id: string, opaque: boolean) => void
  onRemove: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onBeginNoteEdit: () => void
  onEndNoteEdit: () => void
  onBeginNoteDrag: () => void
  onEndNoteDrag: (moved: boolean) => void
}) {
  if (notes.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[3]">
      {notes.map((note) => (
        <StickyNoteItem
          key={note.id}
          note={note}
          layerRef={layerRef}
          onUpdateText={onUpdateText}
          onSetOpaque={onSetOpaque}
          onRemove={onRemove}
          onMove={onMove}
          onBeginNoteEdit={onBeginNoteEdit}
          onEndNoteEdit={onEndNoteEdit}
          onBeginNoteDrag={onBeginNoteDrag}
          onEndNoteDrag={onEndNoteDrag}
        />
      ))}
    </div>
  )
}

function StickyNoteItem({
  note,
  layerRef,
  onUpdateText,
  onSetOpaque,
  onRemove,
  onMove,
  onBeginNoteEdit,
  onEndNoteEdit,
  onBeginNoteDrag,
  onEndNoteDrag,
}: {
  note: ScriptStickyNote
  layerRef: React.RefObject<HTMLDivElement | null>
  onUpdateText: (id: string, text: string) => void
  onSetOpaque: (id: string, opaque: boolean) => void
  onRemove: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onBeginNoteEdit: () => void
  onEndNoteEdit: () => void
  onBeginNoteDrag: () => void
  onEndNoteDrag: (moved: boolean) => void
}) {
  const { persistStickyNotes } = useScriptAnnotationCtx()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false })
  const showPersistPreview = persistStickyNotes && !note.opaque

  const style: CSSProperties = {
    left: `${note.x}%`,
    top: `${note.y}%`,
    width: note.width,
    minHeight: note.height,
  }

  useEffect(() => {
    if (note.opaque) textareaRef.current?.focus({ preventScroll: true })
  }, [note.opaque, note.id])

  const applyChromeDrag = (clientX: number, clientY: number) => {
    if (!dragRef.current.active) return
    const layer = layerRef.current
    if (!layer) return
    const rect = layer.getBoundingClientRect()
    const dx = ((clientX - dragRef.current.startX) / rect.width) * 100
    const dy = ((clientY - dragRef.current.startY) / rect.height) * 100
    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) dragRef.current.moved = true
    onMove(note.id, dragRef.current.originX + dx, dragRef.current.originY + dy)
  }

  const endChromeDrag = () => {
    if (!dragRef.current.active) return
    const moved = dragRef.current.moved
    dragRef.current.active = false
    onEndNoteDrag(moved)
    if (!moved && !note.opaque) onSetOpaque(note.id, true)
  }

  const onChromePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.jbs-script-note-delete')) return
    if (e.button !== 0) return
    e.stopPropagation()
    onBeginNoteDrag()
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: note.x,
      originY: note.y,
      moved: false,
    }
    const chrome = e.currentTarget as HTMLElement
    chrome.setPointerCapture(e.pointerId)

    const onWinMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      ev.preventDefault()
      applyChromeDrag(ev.clientX, ev.clientY)
    }
    const onWinUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      chrome.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onWinMove)
      window.removeEventListener('pointerup', onWinUp)
      window.removeEventListener('pointercancel', onWinUp)
      endChromeDrag()
    }
    window.addEventListener('pointermove', onWinMove)
    window.addEventListener('pointerup', onWinUp)
    window.addEventListener('pointercancel', onWinUp)
  }

  const onPreviewClick = () => {
    if (!note.opaque) onSetOpaque(note.id, true)
  }

  const onEditBlur = () => {
    onEndNoteEdit()
    if (note.opaque) onSetOpaque(note.id, false)
  }

  return (
    <div
      className={`jbs-script-sticky-note pointer-events-auto absolute flex flex-col${note.opaque ? ' jbs-script-sticky-note--opaque' : ''}${showPersistPreview ? ' jbs-script-sticky-note--persist' : ''}`}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="jbs-script-sticky-note-chrome flex shrink-0 cursor-grab items-center justify-between px-1.5 py-1 active:cursor-grabbing"
        onPointerDown={onChromePointerDown}
      >
        <span className="jbs-font-serif text-[8px] tracking-[0.18em] text-[#5c3d2e]/55">MEMO</span>
        <div className="flex items-center gap-0.5">
          {note.opaque ? (
            <>
              <button
                type="button"
                className="jbs-script-note-done jbs-font-serif rounded px-1.5 py-0.5 text-[8px] tracking-wide"
                onClick={(e) => {
                  e.stopPropagation()
                  onSetOpaque(note.id, false)
                }}
              >
                收起
              </button>
              <button
                type="button"
                className="jbs-script-note-delete flex items-center gap-0.5 rounded-full px-1.5 py-0.5"
                aria-label="删除便签"
                title="删除便签"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(note.id)
                }}
              >
                <Trash2 className="size-2.5 shrink-0" strokeWidth={1.5} />
                <span className="jbs-font-serif text-[8px] tracking-wide">删除</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div
        className="jbs-script-sticky-note-body min-h-0 flex-1 px-2 pb-2 pt-0.5"
        onClick={onPreviewClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {note.opaque ? (
          <textarea
            ref={textareaRef}
            value={note.text}
            onChange={(e) => onUpdateText(note.id, e.target.value)}
            onFocus={onBeginNoteEdit}
            onBlur={onEditBlur}
            placeholder="粘贴或手写记录…"
            className="jbs-script-sticky-note-text jbs-font-handwriting size-full min-h-[4.5rem] resize-none border-0 bg-transparent p-0 leading-relaxed outline-none"
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="jbs-script-sticky-note-text jbs-font-handwriting min-h-[4.5rem] whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#3d2e24]/88">
            {note.text.trim() || '点按编辑便签…'}
          </p>
        )}
      </div>
    </div>
  )
}
