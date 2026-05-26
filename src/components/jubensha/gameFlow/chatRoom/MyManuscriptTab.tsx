import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, FilePlus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { useJBSFlow } from './JBSFlowEngine'
import { formatManuscriptTime, manuscriptPreviewText } from './manuscriptStore'

export function MyManuscriptTab() {
  const {
    manuscriptMemos,
    activeManuscriptId,
    createManuscript,
    updateManuscript,
    deleteManuscript,
    setActiveManuscriptId,
  } = useJBSFlow()

  const [editing, setEditing] = useState(false)

  const sortedMemos = useMemo(
    () => [...manuscriptMemos].sort((a, b) => b.updatedAt - a.updatedAt),
    [manuscriptMemos],
  )

  const activeMemo = manuscriptMemos.find((m) => m.id === activeManuscriptId) ?? null

  const openMemo = useCallback(
    (id: string) => {
      setActiveManuscriptId(id)
      setEditing(true)
    },
    [setActiveManuscriptId],
  )

  const handleCreate = useCallback(() => {
    createManuscript()
    setEditing(true)
  }, [createManuscript])

  const backToList = useCallback(() => {
    setEditing(false)
    setActiveManuscriptId(null)
  }, [setActiveManuscriptId])

  const handleDelete = useCallback(() => {
    if (!activeMemo) return
    if (manuscriptMemos.length <= 1) return
    if (!window.confirm(`删除手稿「${activeMemo.title}」？`)) return
    deleteManuscript(activeMemo.id)
    setEditing(false)
  }, [activeMemo, deleteManuscript, manuscriptMemos.length])

  if (editing && activeMemo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-6 pt-2">
        <div className="flex shrink-0 items-center gap-2 border-b border-[#5c3d2e]/10 pb-2">
          <button
            type="button"
            onClick={backToList}
            className="jbs-manuscript-icon-btn flex size-8 items-center justify-center rounded-full"
            aria-label="返回手稿列表"
          >
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </button>
          <input
            type="text"
            value={activeMemo.title}
            onChange={(e) => updateManuscript(activeMemo.id, { title: e.target.value })}
            placeholder="手稿标题"
            className="jbs-manuscript-title-input jbs-font-serif min-w-0 flex-1 border-0 bg-transparent text-[14px] tracking-wide outline-none"
            maxLength={48}
          />
          {manuscriptMemos.length > 1 ? (
            <button
              type="button"
              onClick={handleDelete}
              className="jbs-manuscript-icon-btn jbs-manuscript-icon-btn--danger flex size-8 items-center justify-center rounded-full"
              aria-label="删除此手稿"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
        <p className="jbs-font-serif jbs-gf-text-muted shrink-0 py-2 text-center text-[9px] tracking-[0.18em]">
          更新于 {formatManuscriptTime(activeMemo.updatedAt)}
        </p>
        <textarea
          key={activeMemo.id}
          value={activeMemo.body}
          onChange={(e) => updateManuscript(activeMemo.id, { body: e.target.value })}
          placeholder="在此记录疑点、人物关系与线索推演……"
          className="jbs-gf-chat-manuscript jbs-font-kai-archive mt-1 min-h-[min(360px,48vh)] w-full flex-1 resize-none rounded-lg border border-[#5c3d2e]/12 px-4 py-3 text-[14px] leading-[2rem] text-[#1a1a1a]/88 outline-none placeholder:text-[#5c3d2e]/35"
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-8 pt-2">
      <p className="jbs-font-serif jbs-gf-text-muted text-center text-[10px] tracking-[0.24em]">
        专属手稿 · 仅本局可见
      </p>
      <button
        type="button"
        onClick={handleCreate}
        className="jbs-manuscript-new-btn jbs-font-serif mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[12px] tracking-[0.16em]"
      >
        <FilePlus className="size-4" strokeWidth={1.25} />
        新建手稿
      </button>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto jbs-hide-scrollbar">
        <AnimatePresence initial={false}>
          {sortedMemos.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="jbs-font-serif jbs-gf-text-muted py-8 text-center text-[11px] leading-relaxed tracking-wide"
            >
              尚无手稿
              <br />
              点击上方按钮开始记录
            </motion.p>
          ) : (
            sortedMemos.map((memo) => {
              const preview = manuscriptPreviewText(memo.body)
              return (
                <motion.button
                  key={memo.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onClick={() => openMemo(memo.id)}
                  className="jbs-manuscript-list-item jbs-font-serif w-full rounded-lg px-3 py-3 text-left"
                >
                  <p className="truncate text-[13px] tracking-wide text-[#3d2e24]/92">
                    {memo.title || '未命名手稿'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#5c3d2e]/62">
                    {preview || '（空白手稿）'}
                  </p>
                  <p className="mt-2 text-[9px] tracking-[0.14em] text-[#5c3d2e]/45">
                    {formatManuscriptTime(memo.updatedAt)}
                  </p>
                </motion.button>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
