import { AnimatePresence, motion } from 'framer-motion'
import { BookmarkPlus, Check, Eye, EyeOff, Pencil, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAndroidWeb, resolveAndroidKeyboardPadPx } from '../../../hooks/keyboardInset'
import {
  WORLD_BOOK_CHAR_PLACEHOLDER,
  WORLD_BOOK_USER_PLACEHOLDER,
  linkedCharacterPlaceholder,
  type WorldBookUserInsertContext,
} from '../charUserPlaceholders'
import {
  describeWorldBookUserPlaceholderBindingState,
  insertWorldBookUserPlaceholderInContent,
  migrateWorldBookItemUserPlaceholderLegacy,
  normalizeWorldBookItemUserPlaceholders,
  worldBookItemHasLegacyScopedUserPlaceholder,
} from '../worldBookUserPlaceholderBindings'
import {
  PlaceholderAwareTextarea,
  useCharacterFieldPlaceholderPreview,
  type PlaceholderAwareTextareaHandle,
} from './characterFieldPlaceholderPreview'
import type { Character, WorldBook, WorldBookItem } from './types'

const WB_ITEM_GENERATING_TEXT = '生成中…'

const BODY_TEXTAREA_CLASS =
  'block min-h-[160px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-stone-800 outline-none placeholder:text-stone-300 read-only:cursor-wait [-webkit-overflow-scrolling:touch]'

type PeerRow = { id: string; label: string; role: 'archive_root' | 'network_npc' }

export function LoreEntryEditorSheet({
  open,
  onClose,
  character,
  worldBook: _worldBook,
  item,
  wbId,
  itemId,
  onPatchItem,
  onDeleteItem,
  onResetToInitial,
  onMarkAsInitial,
  forPlayerIdentity = false,
  networkPeersForInsert,
  canUseAi,
  generating,
  onOpenAiLengthModal,
  worldBookUserInsertContext = null,
}: {
  open: boolean
  onClose: () => void
  character: Character
  worldBook: WorldBook
  item: WorldBookItem
  wbId: string
  itemId: string
  onPatchItem: (wbId: string, itemId: string, patch: Partial<WorldBookItem>) => void
  onDeleteItem: (wbId: string, itemId: string) => void
  /** 尾声延展：恢复本条出厂稿 */
  onResetToInitial?: () => void
  /** 尾声延展：把当前正文记为出厂定点 */
  onMarkAsInitial?: () => void
  forPlayerIdentity?: boolean
  networkPeersForInsert: PeerRow[]
  canUseAi: boolean
  generating: boolean
  onOpenAiLengthModal: () => void
  worldBookUserInsertContext?: WorldBookUserInsertContext | null
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const taHandleRef = useRef<PlaceholderAwareTextareaHandle | null>(null)
  const caretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  const inputFocusedRef = useRef(false)
  const [androidKbPad, setAndroidKbPad] = useState(0)
  const [bodyEditing, setBodyEditing] = useState(false)
  const [confirmResetInitial, setConfirmResetInitial] = useState(false)
  const [confirmMarkInitial, setConfirmMarkInitial] = useState(false)
  const [showInitialPreview, setShowInitialPreview] = useState(false)

  const rawBody = String(item.content ?? '')
  const initialBody = String(item.contentInitial ?? '').trim()
  const canResetToInitial =
    item.priority === 'after' &&
    Boolean(onResetToInitial) &&
    initialBody.length > 0 &&
    initialBody !== rawBody.trim()
  const canMarkAsInitial =
    item.priority === 'after' &&
    Boolean(onMarkAsInitial) &&
    rawBody.trim().length > 0 &&
    rawBody.trim() !== initialBody
  const { expanded: expandedBody, loading: bodyPreviewLoading } = useCharacterFieldPlaceholderPreview({
    draft: rawBody,
    characterId: character.id,
    worldBookUserPlaceholderBindings: item.userPlaceholderBindings,
    enabled: open && !bodyEditing && !forPlayerIdentity && rawBody.includes('{{'),
  })
  const { expanded: expandedInitial, loading: initialPreviewLoading } = useCharacterFieldPlaceholderPreview({
    draft: initialBody,
    characterId: character.id,
    worldBookUserPlaceholderBindings: item.userPlaceholderBindings,
    enabled:
      open &&
      showInitialPreview &&
      !forPlayerIdentity &&
      initialBody.includes('{{'),
  })
  const viewBodyText =
    !forPlayerIdentity && rawBody.includes('{{') && expandedBody ? expandedBody : rawBody
  const viewInitialText =
    !forPlayerIdentity && initialBody.includes('{{') && expandedInitial ? expandedInitial : initialBody

  useEffect(() => {
    if (!open) {
      setBodyEditing(false)
      setConfirmResetInitial(false)
      setConfirmMarkInitial(false)
      setShowInitialPreview(false)
    }
  }, [open, itemId])

  useEffect(() => {
    if (!open || !bodyEditing || generating) return
    const t = window.setTimeout(() => {
      taHandleRef.current?.focusForEdit()
    }, 60)
    return () => window.clearTimeout(t)
  }, [open, bodyEditing, generating])

  /** Android：整页 bottom 抬升贴键盘，不压缩 maxHeight（避免顶栏被裁切） */
  useEffect(() => {
    if (!open || !isAndroidWeb()) {
      setAndroidKbPad(0)
      inputFocusedRef.current = false
      return
    }
    const vv = window.visualViewport
    if (!vv) return

    const syncPad = () => {
      const pad = resolveAndroidKeyboardPadPx(inputFocusedRef.current)
      setAndroidKbPad((prev) => (Math.abs(prev - pad) < 4 ? prev : pad))
    }

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return
      if (!sheetRef.current?.contains(t)) return
      inputFocusedRef.current = true
      syncPad()
    }

    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement
        if (active instanceof HTMLElement && sheetRef.current?.contains(active)) return
        inputFocusedRef.current = false
        syncPad()
      }, 80)
    }

    syncPad()
    vv.addEventListener('resize', syncPad)
    vv.addEventListener('scroll', syncPad)
    window.addEventListener('orientationchange', syncPad)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    return () => {
      vv.removeEventListener('resize', syncPad)
      vv.removeEventListener('scroll', syncPad)
      window.removeEventListener('orientationchange', syncPad)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      setAndroidKbPad(0)
      inputFocusedRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const sync = normalizeWorldBookItemUserPlaceholders(item.content ?? '', item.userPlaceholderBindings, null)
    if (!sync.changed) return
    onPatchItem(wbId, itemId, {
      content: sync.content,
      userPlaceholderBindings: sync.bindings,
    })
  }, [open, item.content, item.userPlaceholderBindings, wbId, itemId, onPatchItem])

  useEffect(() => {
    if (!open || !worldBookItemHasLegacyScopedUserPlaceholder(item)) return
    let cancelled = false
    void (async () => {
      const patch = await migrateWorldBookItemUserPlaceholderLegacy(item, {
        character,
        fallback: worldBookUserInsertContext,
      })
      if (cancelled || !patch) return
      onPatchItem(wbId, itemId, patch)
    })()
    return () => {
      cancelled = true
    }
  }, [open, item, wbId, itemId, worldBookUserInsertContext, onPatchItem])

  const patchContent = useCallback(
    (nextContent: string, bindingsOverride?: typeof item.userPlaceholderBindings) => {
      const sync = normalizeWorldBookItemUserPlaceholders(
        nextContent,
        bindingsOverride ?? item.userPlaceholderBindings,
        null,
      )
      onPatchItem(wbId, itemId, {
        content: sync.content,
        userPlaceholderBindings: sync.bindings,
      })
    },
    [item.userPlaceholderBindings, onPatchItem, wbId, itemId],
  )

  const insertToken = useCallback(
    (token: string) => {
      const cur = String(item.content ?? '')
      const keyCaret = caretRef.current
      const el = taHandleRef.current?.getTextareaElement() ?? null
      let start: number
      let end: number
      if (!el || el.value !== cur) {
        start = Math.min(Math.max(0, keyCaret.start), cur.length)
        end = Math.min(Math.max(0, keyCaret.end), cur.length)
      } else {
        start = el.selectionStart ?? cur.length
        end = el.selectionEnd ?? start
      }
      if (token === WORLD_BOOK_USER_PLACEHOLDER && worldBookUserInsertContext) {
        const { content, bindings } = insertWorldBookUserPlaceholderInContent({
          content: cur,
          bindings: item.userPlaceholderBindings,
          caretStart: start,
          caretEnd: end,
          ctx: worldBookUserInsertContext,
        })
        const pos = start + WORLD_BOOK_USER_PLACEHOLDER.length
        caretRef.current = { start: pos, end: pos }
        onPatchItem(wbId, itemId, { content, userPlaceholderBindings: bindings })
      } else {
        const next = cur.slice(0, start) + token + cur.slice(end)
        const pos = start + token.length
        caretRef.current = { start: pos, end: pos }
        patchContent(next)
      }

      queueMicrotask(() => {
        const t = taHandleRef.current?.getTextareaElement()
        if (!t) return
        const caret = caretRef.current
        t.focus()
        try {
          t.setSelectionRange(caret.start, caret.end)
        } catch {
          /* ignore */
        }
      })
    },
    [
      item.content,
      item.userPlaceholderBindings,
      onPatchItem,
      patchContent,
      wbId,
      itemId,
      worldBookUserInsertContext,
    ],
  )

  const bindingState = describeWorldBookUserPlaceholderBindingState(
    item.content ?? '',
    item.userPlaceholderBindings,
  )

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="lore-sheet-backdrop"
            type="button"
            aria-label="关闭蒙版"
            className="fixed inset-0 z-[1150] bg-stone-900/25 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            key="lore-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lore-entry-editor-title"
            className="fixed inset-x-0 z-[1160] flex h-[min(85dvh,100%)] max-h-[85dvh] flex-col overflow-hidden rounded-t-[26px] border border-white/70 bg-white/80 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
            style={{
              bottom: isAndroidWeb() && androidKbPad > 0 ? androidKbPad : 0,
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-col px-4 pt-2">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/80" aria-hidden />
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
                  aria-label="删除本条"
                  onClick={() => {
                    onDeleteItem(wbId, itemId)
                    onClose()
                  }}
                >
                  <Trash2 className="size-5 stroke-[1.5]" />
                </button>
                <p id="lore-entry-editor-title" className="flex-1 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400">
                  Lore Entry
                </p>
                <button
                  type="button"
                  className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
                  aria-label="关闭"
                  onClick={onClose}
                >
                  <X className="size-5" strokeWidth={2} />
                </button>
              </div>

              <input
                value={item.name}
                onChange={(e) => onPatchItem(wbId, itemId, { name: e.target.value })}
                className="w-full border-0 bg-transparent py-1 text-[22px] font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
                placeholder="法则标题"
              />

              <div className="mt-4">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-stone-400">生效时机</p>
                <div className="flex rounded-2xl bg-stone-100/90 p-1">
                  {(
                    [
                      { v: 'before' as const, zh: '序言介入', en: 'Before Chat' },
                      { v: 'after' as const, zh: '尾声延展', en: 'After Chat' },
                    ] as const
                  ).map(({ v, zh, en }) => {
                    const active = item.priority === v
                    return (
                      <button
                        key={v}
                        type="button"
                        className={`flex-1 rounded-xl py-2.5 text-center transition-all duration-200 ${
                          active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                        }`}
                        onClick={() => onPatchItem(wbId, itemId, { priority: v })}
                      >
                        <span className="block text-[13px] font-medium">{zh}</span>
                        <span className="mt-0.5 block text-[9px] font-normal opacity-70">{en}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {item.priority === 'after' && (onResetToInitial || onMarkAsInitial) ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    disabled={!initialBody}
                    onClick={() => setShowInitialPreview((v) => !v)}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[12px] font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                      showInitialPreview
                        ? 'border-violet-300/90 bg-violet-50 text-violet-950'
                        : 'border-stone-200/90 bg-stone-50/90 text-stone-600 hover:bg-white'
                    }`}
                  >
                    {showInitialPreview ? (
                      <EyeOff className="size-3.5 shrink-0" strokeWidth={2} />
                    ) : (
                      <Eye className="size-3.5 shrink-0" strokeWidth={2} />
                    )}
                    {showInitialPreview
                      ? '收起定点预览'
                      : initialBody
                        ? '预览最初尾声'
                        : '尚无定点可预览'}
                  </button>
                  <AnimatePresence initial={false}>
                    {showInitialPreview && initialBody ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/60 px-3.5 py-3">
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-violet-500/90">
                            定点稿预览
                            {initialBody === rawBody.trim() ? ' · 与当前正文相同' : ' · 与当前正文不同'}
                          </p>
                          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-stone-700">
                            {initialPreviewLoading ? '展开占位符中…' : viewInitialText}
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  {onMarkAsInitial ? (
                    <button
                      type="button"
                      disabled={!canMarkAsInitial && !confirmMarkInitial}
                      onClick={() => {
                        if (!canMarkAsInitial) return
                        if (!confirmMarkInitial) {
                          setConfirmMarkInitial(true)
                          window.setTimeout(() => setConfirmMarkInitial(false), 3600)
                          return
                        }
                        setConfirmMarkInitial(false)
                        onMarkAsInitial()
                      }}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[12px] font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                        confirmMarkInitial
                          ? 'border-sky-400/80 bg-sky-50 text-sky-950'
                          : 'border-stone-200/90 bg-stone-50/90 text-stone-600 hover:bg-white'
                      }`}
                    >
                      <BookmarkPlus className="size-3.5 shrink-0" strokeWidth={2} />
                      {confirmMarkInitial
                        ? initialBody
                          ? '再点确认：用当前正文覆盖定点'
                          : '再点确认：保存为最初版本'
                        : canMarkAsInitial
                          ? initialBody
                            ? '将当前正文标为最初版本'
                            : '保存当前为最初版本'
                          : rawBody.trim()
                            ? '当前已是定点稿'
                            : '正文为空，无法定点'}
                    </button>
                  ) : null}
                  {onResetToInitial ? (
                    <button
                      type="button"
                      disabled={!canResetToInitial && !confirmResetInitial}
                      onClick={() => {
                        if (!canResetToInitial) return
                        if (!confirmResetInitial) {
                          setConfirmResetInitial(true)
                          window.setTimeout(() => setConfirmResetInitial(false), 3600)
                          return
                        }
                        setConfirmResetInitial(false)
                        onResetToInitial()
                      }}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[12px] font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                        confirmResetInitial
                          ? 'border-amber-400/80 bg-amber-50 text-amber-900'
                          : 'border-stone-200/90 bg-stone-50/90 text-stone-600 hover:bg-white'
                      }`}
                    >
                      <RotateCcw className="size-3.5 shrink-0" strokeWidth={2} />
                      {confirmResetInitial
                        ? '再点确认：恢复本条最初内容'
                        : canResetToInitial
                          ? '恢复本条最初尾声'
                          : initialBody
                            ? '已是最初尾声'
                            : '尚无定点可恢复'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-stone-400">AI 灵感</p>
                <div className="rounded-2xl bg-gradient-to-r from-amber-100/70 via-stone-200/80 to-amber-50/70 p-[1px] shadow-sm">
                  <div className="flex items-center gap-2 rounded-[15px] bg-white/95 px-3 py-2.5 backdrop-blur-md">
                    <Sparkles className="size-4 shrink-0 text-amber-600/75" strokeWidth={1.8} />
                    <input
                      value={item.keywords ?? ''}
                      onChange={(e) => onPatchItem(wbId, itemId, { keywords: e.target.value })}
                      readOnly={generating}
                      className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-stone-800 outline-none placeholder:text-stone-400"
                      placeholder="输入关键词，AI 替你推演世界法则…"
                    />
                    <button
                      type="button"
                      disabled={!canUseAi || generating}
                      className="shrink-0 rounded-full bg-stone-900 px-4 py-2 text-[12px] font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
                      onClick={() => {
                        if (!canUseAi || generating) return
                        onOpenAiLengthModal()
                      }}
                    >
                      生成
                    </button>
                  </div>
                </div>
              </div>

              {!forPlayerIdentity && bodyEditing ? (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-stone-400">快捷插入</p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      disabled={generating}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertToken(WORLD_BOOK_CHAR_PLACEHOLDER)}
                      title={`插入原文：${WORLD_BOOK_CHAR_PLACEHOLDER}`}
                      className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-[11px] text-stone-700 transition-colors hover:bg-stone-200 disabled:opacity-50"
                    >
                      当前角色
                    </button>
                    <button
                      type="button"
                      disabled={generating || !worldBookUserInsertContext}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertToken(WORLD_BOOK_USER_PLACEHOLDER)}
                      title={
                        worldBookUserInsertContext
                          ? `插入 {{user}}，后台绑定 ${worldBookUserInsertContext.lineLabel}（${worldBookUserInsertContext.displayName}）`
                          : '请先选择当前微信账号与扮演身份'
                      }
                      className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-[11px] text-stone-700 transition-colors hover:bg-stone-200 disabled:opacity-50"
                    >
                      {worldBookUserInsertContext
                        ? `玩家·${worldBookUserInsertContext.displayName.length > 6 ? `${worldBookUserInsertContext.displayName.slice(0, 5)}…` : worldBookUserInsertContext.displayName}`
                        : '绑定的玩家'}
                    </button>
                    {networkPeersForInsert.map((peer) => {
                      const token = linkedCharacterPlaceholder(peer.id)
                      const zhLabel =
                        peer.role === 'archive_root'
                          ? '档案主角'
                          : `人脉·${peer.label.length > 8 ? `${peer.label.slice(0, 7)}…` : peer.label}`
                      return (
                        <button
                          key={peer.id}
                          type="button"
                          disabled={generating}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertToken(token)}
                          title={`插入原文：${token}`}
                          className="shrink-0 max-w-[148px] truncate rounded-full bg-stone-100 px-3 py-1.5 text-[11px] text-stone-700 transition-colors hover:bg-stone-200 disabled:opacity-50"
                        >
                          {zhLabel}
                        </button>
                      )
                    })}
                  </div>
                  {bindingState.slotCount > 0 ? (
                    <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
                      正文 {bindingState.slotCount} 处{' '}
                      <code className="text-stone-600">{`{{user}}`}</code>
                      {bindingState.summary ? (
                        <>
                          ，已绑定 {bindingState.boundCount} 处：{bindingState.summary}
                        </>
                      ) : (
                        <>（尚未写入绑定，保存或再点一次「玩家」插入可补齐）</>
                      )}
                      {bindingState.hasLegacyScoped ? (
                        <span className="text-amber-700"> · 检测到旧式长表达式，将自动改为裸占位符</span>
                      ) : null}
                      {bindingState.slotCount > bindingState.boundCount && !bindingState.hasLegacyScoped ? (
                        <span className="text-amber-700"> · 有槽位未绑定账号/身份</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex min-h-0 flex-1 flex-col px-4 pb-2">
              <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  正文
                  {!generating && rawBody.trim() ? (
                    <span className="ml-2 normal-case tracking-normal text-stone-400">
                      约 {String(rawBody).replace(/\s+/g, '').length} 字
                    </span>
                  ) : null}
                </p>
                {!generating ? (
                  bodyEditing ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-opacity active:opacity-90"
                      onClick={() => setBodyEditing(false)}
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                      完成
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 active:bg-stone-100"
                      onClick={() => setBodyEditing(true)}
                    >
                      <Pencil className="size-3.5" strokeWidth={2} />
                      编辑
                    </button>
                  )
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y rounded-2xl bg-stone-50/50 px-3 py-3 [-webkit-overflow-scrolling:touch]">
                {bodyEditing ? (
                  forPlayerIdentity ? (
                    <textarea
                      value={generating ? WB_ITEM_GENERATING_TEXT : rawBody}
                      readOnly={generating}
                      onChange={(e) => {
                        if (!generating) patchContent(e.target.value)
                      }}
                      className={BODY_TEXTAREA_CLASS}
                      placeholder="书写属于你的世界片段…"
                    />
                  ) : (
                    <PlaceholderAwareTextarea
                      ref={(h) => {
                        taHandleRef.current = h
                      }}
                      onCaretInRawText={(start, end) => {
                        caretRef.current = { start, end }
                      }}
                      readOnly={generating}
                      value={generating ? WB_ITEM_GENERATING_TEXT : rawBody}
                      onChange={(v) => {
                        if (!generating) patchContent(v)
                      }}
                      characterId={character.id}
                      worldBookUserPlaceholderBindings={item.userPlaceholderBindings}
                      placeholderPreview
                      previewEditRequiresDoubleClick
                      previewShellWorldBook={false}
                      rows={12}
                      className={BODY_TEXTAREA_CLASS}
                      placeholder="沉浸式书写… 占位符在预览中会展开为姓名"
                    />
                  )
                ) : (
                  <div
                    className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {generating ? (
                      WB_ITEM_GENERATING_TEXT
                    ) : bodyPreviewLoading && rawBody.includes('{{') ? (
                      <span className="text-stone-400">展开占位符预览…</span>
                    ) : viewBodyText.trim() ? (
                      viewBodyText
                    ) : (
                      <span className="text-stone-300">暂无正文，点「编辑」开始书写</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
