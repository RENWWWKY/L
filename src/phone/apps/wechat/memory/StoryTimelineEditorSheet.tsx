import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import {
  ARCHIVE_SOFT_BTN_PRIMARY,
  ARCHIVE_SOFT_BTN_SECONDARY,
  ARCHIVE_SOFT_TEXTAREA,
  archiveSerifTextStyle,
  MEMORY_ARCHIVE_SERIF_CLASS,
} from './memoryArchiveTheme'
import {
  buildManualStoryTimelinePlotRow,
  computeStoryTimelineRowTextHash,
  hasStructuredStoryTimelineState,
  resolveStoryTimelineRowTitle,
  stripStoryTimelineTitleLine,
  upsertStoryTimelineTitleInRowText,
  normalizeStoryTimelineRowTitle,
  STORY_TIMELINE_ROW_TITLE_MAX,
  type StoryTimelineEventScope,
  type StoryTimelinePlotRow,
  type StoryTimelineState,
} from './storyTimelineTypes'

export type StoryTimelineEditorTarget =
  | { kind: 'row-create'; characterId: string; defaultScope?: StoryTimelineEventScope }
  | { kind: 'row-edit'; row: StoryTimelinePlotRow }
  | { kind: 'state-edit'; characterId: string; state: StoryTimelineState | null; initialText: string }

function resolveRowSaveScope(target: StoryTimelineEditorTarget): StoryTimelineEventScope {
  if (target.kind === 'row-edit') return target.row.sourceScope
  if (target.kind === 'row-create') return target.defaultScope ?? 'offline'
  return 'offline'
}

function resolveEditorCharacterId(target: StoryTimelineEditorTarget): string {
  if (target.kind === 'row-edit') return target.row.characterId
  if (target.kind === 'row-create') return target.characterId
  return target.characterId
}

export function StoryTimelineEditorSheet({
  open,
  target,
  onClose,
  onSaved,
}: {
  open: boolean
  target: StoryTimelineEditorTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const [text, setText] = useState('')
  const [rowTitleDraft, setRowTitleDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingDisplay, setLoadingDisplay] = useState(false)
  const [error, setError] = useState('')
  const rawPersistRef = useRef('')
  const displaySnapshotRef = useRef('')
  const loadSeqRef = useRef(0)

  const isRow = target?.kind === 'row-create' || target?.kind === 'row-edit'
  const isState = target?.kind === 'state-edit'

  useEffect(() => {
    if (!open || !target) return
    setError('')
    const seq = ++loadSeqRef.current
    if (target.kind === 'row-create') {
      rawPersistRef.current = ''
      displaySnapshotRef.current = ''
      setText('')
      setRowTitleDraft('')
      setLoadingDisplay(false)
      return
    }
    if (target.kind === 'row-edit') {
      setRowTitleDraft(resolveStoryTimelineRowTitle(target.row))
      const rawBody = stripStoryTimelineTitleLine(target.row.rowText)
      rawPersistRef.current = rawBody
      setLoadingDisplay(true)
      void personaDb
        .expandStoryTimelineTextForDisplay(target.row.characterId, rawBody)
        .then((display) => {
          if (loadSeqRef.current !== seq) return
          displaySnapshotRef.current = display
          setText(display)
        })
        .catch(() => {
          if (loadSeqRef.current !== seq) return
          displaySnapshotRef.current = rawBody
          setText(rawBody)
        })
        .finally(() => {
          if (loadSeqRef.current === seq) setLoadingDisplay(false)
        })
      return
    }
    setRowTitleDraft('')
    const rawState = target.initialText
    rawPersistRef.current = rawState
    setLoadingDisplay(true)
    void personaDb
      .expandStoryTimelineTextForDisplay(target.characterId, rawState)
      .then((display) => {
        if (loadSeqRef.current !== seq) return
        displaySnapshotRef.current = display
        setText(display)
      })
      .catch(() => {
        if (loadSeqRef.current !== seq) return
        displaySnapshotRef.current = rawState
        setText(rawState)
      })
      .finally(() => {
        if (loadSeqRef.current === seq) setLoadingDisplay(false)
      })
  }, [open, target])

  const title =
    target?.kind === 'row-create'
      ? '新增摘要行'
      : target?.kind === 'row-edit'
        ? '编辑摘要行'
        : target?.kind === 'state-edit'
          ? '编辑当前状态'
          : ''

  const handleSave = useCallback(async () => {
    if (!target || busy || loadingDisplay) return
    const trimmed = text.trim()
    if (!trimmed) {
      setError('正文不能为空')
      return
    }
    const normalizedTitle = normalizeStoryTimelineRowTitle(rowTitleDraft)
    setBusy(true)
    setError('')
    try {
      let bodyForStorage = trimmed
      if (target.kind === 'row-edit' || target.kind === 'state-edit') {
        bodyForStorage = await personaDb.normalizeStoryTimelineEditorTextForSave(
          resolveEditorCharacterId(target),
          {
            rawOriginal: rawPersistRef.current,
            displaySnapshot: displaySnapshotRef.current,
            editedText: trimmed,
          },
        )
      }
      const mergedRowText = upsertStoryTimelineTitleInRowText(bodyForStorage, normalizedTitle).slice(0, 4000)
      if (target.kind === 'row-create') {
        const row = buildManualStoryTimelinePlotRow({
          characterId: target.characterId,
          rowText: mergedRowText,
          rowTitle: normalizedTitle,
          sourceScope: resolveRowSaveScope(target),
        })
        if (!row) {
          setError('无法保存摘要行')
          return
        }
        await personaDb.appendStoryTimelinePlotRow(row)
      } else if (target.kind === 'row-edit') {
        const prev = target.row
        const textChanged = mergedRowText !== prev.rowText.trim()
        const titleChanged = normalizedTitle !== resolveStoryTimelineRowTitle(prev)
        const next: StoryTimelinePlotRow = {
          ...prev,
          rowText: mergedRowText,
          textHash: computeStoryTimelineRowTextHash(mergedRowText),
          userEdited: true,
          ...(normalizedTitle ? { rowTitle: normalizedTitle } : { rowTitle: undefined }),
          ...(textChanged
            ? {
                embedding: undefined,
                embeddingProvider: undefined,
                embeddingModelId: undefined,
                embeddingHash: undefined,
              }
            : {}),
        }
        if (!textChanged && !titleChanged) {
          setError('内容未变化')
          return
        }
        await personaDb.upsertStoryTimelinePlotRow(next)
      } else if (target.kind === 'state-edit') {
        const cid = target.characterId.trim()
        if (!cid) return
        const base: StoryTimelineState =
          target.state ??
          ({
            characterId: cid,
            updatedAt: Date.now(),
            costumes: [],
            items: [],
            foreshadows: [],
            todos: [],
            recentEvents: [],
          } satisfies StoryTimelineState)
        if (!bodyForStorage.trim()) {
          if (hasStructuredStoryTimelineState(base)) {
            await personaDb.putStoryTimelineState({
              ...base,
              updatedAt: Date.now(),
              manualAnchorBlock: undefined,
            })
          } else {
            await personaDb.deleteStoryTimelineState(cid)
          }
        } else {
          await personaDb.putStoryTimelineState({
            ...base,
            characterId: cid,
            updatedAt: Date.now(),
            manualAnchorBlock: bodyForStorage.slice(0, 8000),
          })
        }
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }, [target, busy, loadingDisplay, text, rowTitleDraft, onClose, onSaved])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && target ? (
        <motion.div
          key="story-timeline-editor"
          role="dialog"
          aria-modal="true"
          aria-labelledby="story-timeline-editor-title"
          className="fixed inset-0 flex flex-col justify-end"
          style={{ zIndex: 56000, background: 'rgba(17,24,39,0.32)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className={`max-h-[min(88vh,720px)] w-full overflow-hidden rounded-t-[28px] border border-gray-200/60 bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.12)] ${MEMORY_ARCHIVE_SERIF_CLASS}`}
            style={archiveSerifTextStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-br from-gray-50/95 via-gray-50/40 to-white px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {isState ? '状态锚点' : '线下摘要'}
                </p>
                <p id="story-timeline-editor-title" className="mt-0.5 text-[17px] font-semibold text-gray-900">
                  {title}
                </p>
              </div>
              <Pressable
                type="button"
                disabled={busy}
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 active:bg-gray-100 disabled:opacity-50"
                aria-label="关闭"
              >
                <X className="size-5" strokeWidth={1.75} />
              </Pressable>
            </div>

            <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {isRow ? (
                <>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                    摘要标题
                  </p>
                  <input
                    type="text"
                    value={rowTitleDraft}
                    onChange={(e) => setRowTitleDraft(e.target.value)}
                    disabled={busy || loadingDisplay}
                    maxLength={STORY_TIMELINE_ROW_TITLE_MAX}
                    placeholder="如：温柔瞬间、化解冲突（约 10 字内）"
                    className="mb-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[14px] text-gray-900 outline-none focus:border-gray-400 focus:bg-white disabled:opacity-60"
                  />
                </>
              ) : null}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                {isState ? '状态锚点正文' : '摘要正文'}
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy || loadingDisplay}
                rows={isState ? 12 : 10}
                placeholder={
                  loadingDisplay
                    ? '正在展开占位符…'
                    : isState
                      ? '地点、服装、物品、动机伏笔、待办等'
                      : '本轮发生了什么'
                }
                className={ARCHIVE_SOFT_TEXTAREA}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                编辑时展示真实姓名便于阅读；保存后仍按占位符规则入库，换绑身份后语义一致。
              </p>
              {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}

              <div className="mt-5 flex gap-2">
                <Pressable
                  type="button"
                  disabled={busy || loadingDisplay}
                  onClick={onClose}
                  className={`flex-1 py-3 text-center ${ARCHIVE_SOFT_BTN_SECONDARY}`}
                >
                  取消
                </Pressable>
                <Pressable
                  type="button"
                  disabled={busy || loadingDisplay}
                  onClick={() => void handleSave()}
                  className={`flex-1 py-3 text-center ${ARCHIVE_SOFT_BTN_PRIMARY}`}
                >
                  {busy ? '保存中…' : loadingDisplay ? '加载中…' : '保存'}
                </Pressable>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
