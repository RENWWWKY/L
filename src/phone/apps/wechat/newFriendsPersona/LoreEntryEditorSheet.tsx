import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
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
  type PlaceholderAwareTextareaHandle,
} from './characterFieldPlaceholderPreview'
import type { Character, WorldBook, WorldBookItem } from './types'

const WB_ITEM_GENERATING_TEXT = '生成中…'

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
  forPlayerIdentity?: boolean
  networkPeersForInsert: PeerRow[]
  canUseAi: boolean
  generating: boolean
  onOpenAiLengthModal: () => void
  worldBookUserInsertContext?: WorldBookUserInsertContext | null
}) {
  const taHandleRef = useRef<PlaceholderAwareTextareaHandle | null>(null)
  const caretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })

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
      const patch = await migrateWorldBookItemUserPlaceholderLegacy(item, {})
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

  /** 关闭时若正文只有空白可选不变 — 保持简单：不关逻辑 */

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
            key="lore-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lore-entry-editor-title"
            className="fixed inset-x-0 bottom-0 z-[1160] flex max-h-[85vh] flex-col rounded-t-[26px] border border-white/70 bg-white/80 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
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

              {!forPlayerIdentity ? (
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

            <div className="mt-2 min-h-0 flex-1 overflow-hidden px-4 pb-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-stone-400">正文</p>
              <div className="h-full min-h-[200px] overflow-hidden rounded-2xl bg-stone-50/50 px-3 py-2">
                {forPlayerIdentity ? (
                  <textarea
                    value={generating ? WB_ITEM_GENERATING_TEXT : (item.content ?? '')}
                    readOnly={generating}
                    onChange={(e) => {
                      if (!generating) patchContent(e.target.value)
                    }}
                    className="h-full min-h-[220px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-stone-800 outline-none placeholder:text-stone-300 read-only:cursor-wait"
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
                    value={generating ? WB_ITEM_GENERATING_TEXT : (item.content ?? '')}
                    onChange={(v) => {
                      if (!generating) patchContent(v)
                    }}
                    characterId={character.id}
                    worldBookUserPlaceholderBindings={item.userPlaceholderBindings}
                    placeholderPreview
                    previewEditRequiresDoubleClick={false}
                    previewShellWorldBook={false}
                    rows={14}
                    className="min-h-[220px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-stone-800 outline-none placeholder:text-stone-300 read-only:cursor-wait"
                    placeholder="沉浸式书写… 占位符在预览中会展开为姓名"
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
