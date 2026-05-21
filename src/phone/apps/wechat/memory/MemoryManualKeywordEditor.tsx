import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import type { CharacterMemoryTriggerMode } from '../newFriendsPersona/types'

const PREVIEW_KEYWORD_COUNT = 2
const EXPAND_EASE = [0.22, 1, 0.36, 1] as const

function normalizeKeyword(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

type KeywordListProps = {
  keywords: string[]
  onKeywordsChange: (next: string[]) => void
  /** 档案馆等已在外层选择触发方式时，仅展示关键词编辑 */
  keywordsOnly?: boolean
}

function KeywordListEditor({ keywords, onKeywordsChange }: KeywordListProps) {
  const [draft, setDraft] = useState('')
  const [listExpanded, setListExpanded] = useState(false)

  useEffect(() => {
    if (!keywords.length) setListExpanded(false)
  }, [keywords.length])

  const add = () => {
    const t = normalizeKeyword(draft)
    if (!t) return
    if (keywords.some((k) => normalizeKeyword(k) === t)) {
      setDraft('')
      return
    }
    onKeywordsChange([...keywords, t])
    setDraft('')
    if (keywords.length >= PREVIEW_KEYWORD_COUNT) setListExpanded(true)
  }

  const removeAt = (index: number) => {
    onKeywordsChange(keywords.filter((_, i) => i !== index))
  }

  const updateAt = (index: number, raw: string) => {
    const t = normalizeKeyword(raw)
    if (!t) {
      removeAt(index)
      return
    }
    const dupIdx = keywords.findIndex((k, i) => i !== index && normalizeKeyword(k) === t)
    if (dupIdx >= 0) {
      onKeywordsChange(keywords.filter((_, i) => i !== index))
      return
    }
    onKeywordsChange(keywords.map((k, i) => (i === index ? t : k)))
  }

  const previewText =
    keywords.length > 0
      ? keywords
          .slice(0, PREVIEW_KEYWORD_COUNT)
          .map((k) => normalizeKeyword(k))
          .filter(Boolean)
          .join('、')
      : ''

  const hiddenCount = Math.max(0, keywords.length - PREVIEW_KEYWORD_COUNT)
  const showCollapseToggle = keywords.length > PREVIEW_KEYWORD_COUNT

  return (
    <>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
        聊天上下文中出现以下任一关键词时，本条记忆会被纳入参考。可直接点进原词修改。
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="输入新关键词后点「添加」"
          className="min-w-0 flex-1 rounded-2xl bg-gray-100/80 px-3.5 py-2.5 text-[14px] text-gray-800 outline-none placeholder:text-gray-400 focus:bg-gray-100"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-2xl bg-gray-900 px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          添加
        </button>
      </div>

      {keywords.length ? (
        <div className="mt-3">
          {showCollapseToggle ? (
            <button
              type="button"
              onClick={() => setListExpanded((v) => !v)}
              className="flex w-full touch-manipulation items-center justify-between gap-2 rounded-2xl bg-gray-50/90 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-100/90"
              aria-expanded={listExpanded}
            >
              <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-gray-600">
                <span className="font-medium text-gray-800">已配置 {keywords.length} 个</span>
                {!listExpanded && previewText ? (
                  <span className="text-gray-500">
                    {' '}
                    · {previewText}
                    {hiddenCount > 0 ? ` 等 ${hiddenCount} 个` : ''}
                  </span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] tracking-wide text-gray-400">
                {listExpanded ? '收起' : '展开全部'}
                <motion.span
                  animate={{ rotate: listExpanded ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm"
                  aria-hidden
                >
                  <ChevronDown className="size-3.5" strokeWidth={1.5} />
                </motion.span>
              </span>
            </button>
          ) : (
            <p className="px-1 text-[11px] font-medium text-gray-500">
              已配置 {keywords.length} 个关键词
            </p>
          )}

          <AnimatePresence initial={false}>
            {listExpanded || !showCollapseToggle ? (
              <motion.div
                key="kw-list"
                initial={showCollapseToggle ? { height: 0, opacity: 0 } : false}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.26, ease: EXPAND_EASE }}
                className="overflow-hidden"
              >
                <ul className={`flex flex-col gap-2 ${showCollapseToggle ? 'mt-2.5' : 'mt-2'}`}>
                  {keywords.map((kw, i) => (
                    <li
                      key={`kw-${i}`}
                      className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2"
                    >
                      <input
                        type="text"
                        value={kw}
                        onChange={(e) => updateAt(i, e.target.value)}
                        onBlur={(e) => updateAt(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        aria-label={`关键词 ${i + 1}`}
                        className="min-w-0 flex-1 rounded-xl bg-white/80 px-2.5 py-1.5 text-[14px] text-gray-800 outline-none ring-0 focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.08)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-red-700"
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-gray-400">尚未添加关键词</p>
      )}
    </>
  )
}

/** 手动编辑记忆：关键词列表；完整版含注入方式（旧版记忆管理弹窗用） */
export function MemoryManualKeywordEditor(
  props:
    | (KeywordListProps & { keywordsOnly: true })
    | {
        radioGroupName?: string
        triggerMode: CharacterMemoryTriggerMode
        onTriggerMode: (m: CharacterMemoryTriggerMode) => void
        keywords: string[]
        onKeywordsChange: (next: string[]) => void
        keywordsOnly?: false
      },
) {
  if (props.keywordsOnly) {
    return (
      <div className="mt-1">
        <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">触发关键词</p>
        <KeywordListEditor keywords={props.keywords} onKeywordsChange={props.onKeywordsChange} />
      </div>
    )
  }

  const {
    radioGroupName = 'mem-kw-mode',
    triggerMode,
    onTriggerMode,
    keywords,
    onKeywordsChange,
  } = props

  return (
    <>
      <p className="mt-4 text-[13px] font-medium text-black">注入方式</p>
      <div role="radiogroup" aria-label="注入方式" className="mt-2 flex gap-2">
        <Pressable
          type="button"
          role="radio"
          aria-checked={triggerMode === 'keyword'}
          id={`${radioGroupName}-keyword`}
          onClick={() => onTriggerMode('keyword')}
          className={`min-h-[44px] flex-1 rounded-[10px] border px-3 py-2.5 text-center text-[14px] font-medium transition-colors ${
            triggerMode === 'keyword'
              ? 'border-black bg-black text-white'
              : 'border-black bg-white text-black hover:bg-neutral-100'
          }`}
        >
          关键词触发
        </Pressable>
        <Pressable
          type="button"
          role="radio"
          aria-checked={triggerMode === 'always'}
          id={`${radioGroupName}-always`}
          onClick={() => onTriggerMode('always')}
          className={`min-h-[44px] flex-1 rounded-[10px] border px-3 py-2.5 text-center text-[14px] font-medium transition-colors ${
            triggerMode === 'always'
              ? 'border-black bg-black text-white'
              : 'border-black bg-white text-black hover:bg-neutral-100'
          }`}
        >
          始终触发
        </Pressable>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
        「始终触发」：每轮参考可带上本条（受条数上限约束）。「关键词触发」：上下文中出现以下任一关键词时纳入参考。
      </p>

      {triggerMode === 'keyword' ? (
        <>
          <p className="mt-4 text-[13px] font-medium text-neutral-950">关键词</p>
          <KeywordListEditor keywords={keywords} onKeywordsChange={onKeywordsChange} />
        </>
      ) : null}
    </>
  )
}
