import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { WorldBookUserInsertContext } from '../charUserPlaceholders'
import { personaDb } from '../newFriendsPersona/idb'
import type {
  Character,
  CharacterMemoryScope,
  WorldBookUserPlaceholderBinding,
} from '../newFriendsPersona/types'
import { WECHAT_GROUP_BOT_CHARACTER_ID, WECHAT_GROUP_USER_CHAR_ID } from '../wechatConversationKey'
import { insertWorldBookUserPlaceholderInContent } from '../worldBookUserPlaceholderBindings'

/** 手动插入仍为表达式；按钮文案用中文便于识别 */
const SNIPPETS = [
  { buttonLabel: '用户', insert: '{{user}}', title: '玩家身份（{{user}}）' },
  /** 文案「主角」指本条记忆挂载的人设（表达式仍为 {{char}}） */
  { buttonLabel: '主角', insert: '{{char}}', title: '本条记忆所属人设（{{char}}）' },
] as const

type ManualRosterItem = {
  label: string
  subtitle?: string
  insert: string
}

function resolvePlaceholderAnchorCharacterId(params: {
  characterId: string | null | undefined
  memoryScope?: CharacterMemoryScope
  involvedCharIds?: string[] | null
}): string | null {
  const cid = params.characterId?.trim() ?? ''
  if (!cid) return null
  if (params.memoryScope === 'group') {
    const ids = params.involvedCharIds ?? []
    const firstReal = ids.find((x) => {
      const t = String(x ?? '').trim()
      return t && t !== WECHAT_GROUP_USER_CHAR_ID && t !== WECHAT_GROUP_BOT_CHARACTER_ID
    })
    return firstReal?.trim() || cid
  }
  return cid
}

async function loadPrivateLinkedManualPlaceholderRoster(anchor: string): Promise<ManualRosterItem[]> {
  const row = await personaDb.getCharacter(anchor.trim())
  if (!row) return []

  const rootId = (row.generatedForCharacterId || row.id).trim()
  let rootRow: Character | null = row
  if (rootId !== row.id) {
    try {
      rootRow = await personaDb.getCharacter(rootId)
    } catch {
      rootRow = null
    }
  }
  const mainName =
    String(rootRow?.name ?? rootRow?.wechatNickname ?? '').trim() || rootId.slice(0, 8)

  const items: ManualRosterItem[] = []
  const seen = new Set<string>()

  const pushId = (cid: string, label: string, subtitle: string) => {
    const id = cid.trim()
    if (!id || id === anchor.trim()) return
    const ins = `{{id:${id}}}`
    if (seen.has(ins)) return
    seen.add(ins)
    items.push({ label, subtitle, insert: ins })
  }

  if (anchor.trim() !== rootId) {
    pushId(rootId, mainName, '存档主角')
  }

  let npcs: Character[] = []
  try {
    npcs = await personaDb.listNpcsFor(rootId)
  } catch {
    npcs = []
  }
  for (const n of npcs) {
    const nid = n.id.trim()
    if (!nid || nid === rootId) continue
    const nm = String(n.name ?? n.wechatNickname ?? '').trim() || nid.slice(0, 8)
    pushId(nid, nm, '人脉 NPC')
  }

  return items
}

async function loadGroupManualPlaceholderRoster(params: {
  anchorId: string
  involvedCharIds: string[] | undefined | null
}): Promise<ManualRosterItem[]> {
  const anchor = params.anchorId.trim()
  const raw = params.involvedCharIds ?? []
  const real = raw
    .map((x) => String(x ?? '').trim())
    .filter((x) => x && x !== WECHAT_GROUP_USER_CHAR_ID && x !== WECHAT_GROUP_BOT_CHARACTER_ID)

  const items: ManualRosterItem[] = []
  const seen = new Set<string>()

  const pushId = (cid: string, label: string, subtitle: string) => {
    const id = cid.trim()
    if (!id || id === anchor) return
    const ins = `{{id:${id}}}`
    if (seen.has(ins)) return
    seen.add(ins)
    items.push({ label, subtitle, insert: ins })
  }

  const roots = new Set<string>()
  for (const cid of real) {
    const ch = await personaDb.getCharacter(cid)
    const nm = String(ch?.name ?? ch?.wechatNickname ?? '').trim() || cid.slice(0, 8)
    pushId(cid, nm, '群成员')
    const r = (ch?.generatedForCharacterId || cid).trim()
    if (r) roots.add(r)
  }

  for (const rootId of roots) {
    let rootLabel = rootId.slice(0, 8)
    try {
      const mr = await personaDb.getCharacter(rootId)
      rootLabel = String(mr?.name ?? mr?.wechatNickname ?? '').trim() || rootLabel
    } catch {
      /* keep slice */
    }
    pushId(rootId, rootLabel, '存档主角')

    let npcs: Character[] = []
    try {
      npcs = await personaDb.listNpcsFor(rootId)
    } catch {
      npcs = []
    }
    for (const n of npcs) {
      const nid = n.id.trim()
      const nm = String(n.name ?? n.wechatNickname ?? '').trim() || nid.slice(0, 8)
      pushId(nid, nm, '人脉')
    }
  }

  return items
}

export function useMemoryDraftPlaceholderPreview(opts: {
  draft: string
  characterId: string | null | undefined
  memoryScope?: CharacterMemoryScope
  linkedFromCharacterId?: string | null
  involvedCharIds?: string[] | null
  userPlaceholderBindings?: import('../newFriendsPersona/types').WorldBookUserPlaceholderBinding[] | null
  sourceWechatAccountId?: string | null
  sourceSessionPlayerIdentityId?: string | null
  debounceMs?: number
}): { expanded: string; loading: boolean } {
  const [expanded, setExpanded] = useState('')
  const [loading, setLoading] = useState(false)
  const cid = opts.characterId?.trim() ?? ''

  useEffect(() => {
    const raw = String(opts.draft ?? '')
    if (!cid || !raw.includes('{{')) {
      setExpanded('')
      setLoading(false)
      return
    }
    let cancelled = false
    const ms = opts.debounceMs ?? 320
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const out = await personaDb.expandMemoryDraftForPromptPreview({
            content: raw,
            characterId: cid,
            memoryScope: opts.memoryScope,
            linkedFromCharacterId: opts.linkedFromCharacterId ?? undefined,
            involvedCharIds: opts.involvedCharIds ?? undefined,
            userPlaceholderBindings: opts.userPlaceholderBindings ?? undefined,
            sourceWechatAccountId: opts.sourceWechatAccountId ?? undefined,
            sourceSessionPlayerIdentityId: opts.sourceSessionPlayerIdentityId ?? undefined,
          })
          if (!cancelled) setExpanded(out)
        } catch {
          if (!cancelled) setExpanded('')
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, ms)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    cid,
    opts.draft,
    opts.memoryScope,
    opts.linkedFromCharacterId,
    opts.involvedCharIds,
    opts.userPlaceholderBindings,
    opts.sourceWechatAccountId,
    opts.sourceSessionPlayerIdentityId,
    opts.debounceMs,
  ])

  return { expanded, loading }
}

function insertAtCaret(textarea: HTMLTextAreaElement | null, value: string, snippet: string, onChange: (v: string) => void) {
  if (!textarea) {
    onChange(value + snippet)
    return
  }
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const next = value.slice(0, start) + snippet + value.slice(end)
  onChange(next)
  const pos = start + snippet.length
  queueMicrotask(() => {
    textarea.focus()
    textarea.setSelectionRange(pos, pos)
  })
}

export function MemoryManualPlaceholderToolbar(props: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
  /** 展开预览（仅展示，不入库） */
  previewExpanded: string
  previewLoading: boolean
  /** 浅色卡片（PrivateMemoryList）；深色边（CharacterMemoryDetailApp） */
  variant?: 'neutral' | 'themed'
  /** 当前编辑的记忆所属 bucket（群聊为占位 characterId）；关闭弹窗时传 null */
  placeholderCharacterId: string | null
  memoryScope?: CharacterMemoryScope
  involvedCharIds?: string[] | null
  /** 插入 {{user}} 时绑定到当前登录微信 + 扮演身份（非记忆写入来源线） */
  userInsertContext?: WorldBookUserInsertContext | null
  userPlaceholderBindings?: WorldBookUserPlaceholderBinding[] | null
  onUserPlaceholderBindingsChange?: (next: WorldBookUserPlaceholderBinding[]) => void
}) {
  const {
    textareaRef,
    value,
    onChange,
    previewExpanded,
    previewLoading,
    variant = 'neutral',
    placeholderCharacterId,
    memoryScope = 'private',
    involvedCharIds = null,
    userInsertContext = null,
    userPlaceholderBindings = null,
    onUserPlaceholderBindingsChange,
  } = props

  const showPreview = value.includes('{{')
  /** 按钮含义说明：默认收起 */
  const [helpOpen, setHelpOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterItems, setRosterItems] = useState<ManualRosterItem[]>([])
  const [showArchiveChip, setShowArchiveChip] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const anchorId = useMemo(
    () =>
      resolvePlaceholderAnchorCharacterId({
        characterId: placeholderCharacterId,
        memoryScope,
        involvedCharIds,
      }),
    [placeholderCharacterId, memoryScope, involvedCharIds],
  )

  useEffect(() => {
    if (!anchorId || !placeholderCharacterId?.trim()) {
      setRosterItems([])
      setShowArchiveChip(false)
      setRosterLoading(false)
      return
    }
    let cancelled = false
    setRosterLoading(true)
    void (async () => {
      try {
        if (memoryScope === 'group') {
          const rows = await loadGroupManualPlaceholderRoster({
            anchorId,
            involvedCharIds,
          })
          if (!cancelled) {
            setRosterItems(rows)
            setShowArchiveChip(false)
          }
          return
        }

        const row = await personaDb.getCharacter(anchorId)
        const archiveEligible =
          memoryScope === 'linked' ||
          (!!row?.generatedForCharacterId?.trim() && row.generatedForCharacterId.trim() !== '__none__')
        if (!cancelled) setShowArchiveChip(archiveEligible)

        const rows = await loadPrivateLinkedManualPlaceholderRoster(anchorId)
        if (!cancelled) setRosterItems(rows)
      } catch {
        if (!cancelled) {
          setRosterItems([])
          setShowArchiveChip(false)
        }
      } finally {
        if (!cancelled) setRosterLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [anchorId, placeholderCharacterId, memoryScope, involvedCharIds])

  useEffect(() => {
    if (!rosterOpen) return
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) setRosterOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [rosterOpen])

  const chip =
    variant === 'themed'
      ? 'rounded-[8px] border px-2 py-1 text-[12px] font-medium transition-colors hover:bg-[#f5f5f5]'
      : 'rounded-[8px] border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-800 shadow-sm hover:bg-neutral-50'

  const previewBox =
    variant === 'themed'
      ? 'mt-2 rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed'
      : 'mt-2 rounded-[10px] border border-neutral-100 bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-800'

  const previewStyle =
    variant === 'themed'
      ? { borderColor: '#e5e5e5', background: '#fafafa', color: '#333333' }
      : undefined

  const rosterPanelClass =
    variant === 'themed'
      ? 'mt-1 max-h-[220px] overflow-y-auto rounded-[10px] border px-1 py-1 text-[12px]'
      : 'mt-1 max-h-[220px] overflow-y-auto rounded-[10px] border border-neutral-100 bg-white px-1 py-1 text-[11px] shadow-sm'

  const rosterBtnClass =
    variant === 'themed'
      ? 'flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[#f5f5f5]'
      : 'flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left hover:bg-neutral-50'

  const helpToggleClass =
    variant === 'themed'
      ? 'mt-1.5 w-full rounded-[8px] px-2 py-1.5 text-left text-[12px] text-neutral-600 transition-colors hover:bg-[#f5f5f5]'
      : 'mt-1.5 w-full rounded-[8px] px-2 py-1.5 text-left text-[11px] text-neutral-600 hover:bg-neutral-50'

  const helpPanelClass =
    variant === 'themed'
      ? 'rounded-[10px] border px-3 py-2 text-[12px] leading-relaxed text-neutral-700'
      : 'rounded-[10px] border border-neutral-100 bg-white px-3 py-2 text-[11px] leading-relaxed text-neutral-700 shadow-sm'

  const hasRoster = rosterItems.length > 0
  const rosterDisabled = !placeholderCharacterId?.trim() || !anchorId

  return (
    <div ref={wrapRef} className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`mr-1 shrink-0 ${variant === 'themed' ? 'text-[12px] text-neutral-500' : 'text-[11px] text-neutral-500'}`}>
          插入占位符
        </span>
        {SNIPPETS.map((s) => (
          <button
            key={s.insert}
            type="button"
            title={
              s.insert === '{{user}}' && userInsertContext
                ? `插入 {{user}}，绑定到当前编辑账号：${userInsertContext.displayName || userInsertContext.lineLabel}`
                : `${s.title} → ${s.insert}`
            }
            className={chip}
            style={variant === 'themed' ? { borderColor: '#e5e5e5', color: '#000' } : undefined}
            onClick={() => {
              if (
                s.insert === '{{user}}' &&
                userInsertContext &&
                onUserPlaceholderBindingsChange
              ) {
                const ta = textareaRef.current
                const start = ta?.selectionStart ?? value.length
                const end = ta?.selectionEnd ?? start
                const { content, bindings } = insertWorldBookUserPlaceholderInContent({
                  content: value,
                  bindings: userPlaceholderBindings ?? [],
                  caretStart: start,
                  caretEnd: end,
                  ctx: userInsertContext,
                })
                onChange(content)
                onUserPlaceholderBindingsChange(bindings)
                const pos = start + '{{user}}'.length
                queueMicrotask(() => {
                  ta?.focus()
                  ta?.setSelectionRange(pos, pos)
                })
                return
              }
              insertAtCaret(textareaRef.current, value, s.insert, onChange)
            }}
          >
            {s.buttonLabel}
          </button>
        ))}
        {showArchiveChip ? (
          <button
            type="button"
            title="线下存档主角（{{archive_char}}）"
            className={chip}
            style={variant === 'themed' ? { borderColor: '#e5e5e5', color: '#000' } : undefined}
            onClick={() => insertAtCaret(textareaRef.current, value, '{{archive_char}}', onChange)}
          >
            存档主角
          </button>
        ) : null}
        <button
          type="button"
          disabled={rosterDisabled}
          title={rosterDisabled ? '当前无可用锚点人设' : '展开：插入 {{id:人设UUID}}'}
          className={`${chip} ${rosterDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          style={variant === 'themed' ? { borderColor: '#e5e5e5', color: '#000' } : undefined}
          onClick={() => {
            if (rosterDisabled) return
            setRosterOpen((v) => !v)
          }}
        >
          {rosterLoading ? '人脉载入中…' : `其他人脉${rosterOpen ? ' ▲' : ' ▼'}`}
        </button>
      </div>

      <button
        type="button"
        className={helpToggleClass}
        aria-expanded={helpOpen}
        onClick={() => setHelpOpen((v) => !v)}
      >
        {helpOpen ? '收起说明 ▲' : '这些按钮怎么用？点开看一眼 ▼'}
      </button>
      {helpOpen ? (
        <div
          className={helpPanelClass}
          style={variant === 'themed' ? { borderColor: '#e5e5e5', background: '#fafafa' } : undefined}
        >
          <p className="mb-1.5 font-medium text-neutral-800">大白话版（保存进正文的是右边那种带花括号的「暗号」，改名后会自动对上最新名字）</p>
          <ul className="list-disc space-y-1 pl-4 marker:text-neutral-400">
            <li>
              <strong>用户</strong>：插入 <code className="text-[10px]">{'{{user}}'}</code>
              ，绑定到<strong>当前登录的微信账号与扮演身份</strong>（不是这条记忆当初总结时的来源号）；预览里会显示对应昵称。
            </li>
            <li>
              <strong>主角</strong>：
              {memoryScope === 'group'
                ? '指这条群聊记忆当前用来「对号入座」的那位群成员（一般是列表里第一位真人设）；不是群昵称那串字本身。'
                : '指这条记忆挂在谁名下的那个角色（私聊里你正在编辑通讯录的这位）；不是别的配角。'}
            </li>
            {showArchiveChip ? (
              <li>
                <strong>存档主角</strong>：线下约会那条线里的「大主角」——比如这是某个主角手下的小配角记忆，点它指的是跟那位主角挂钩的剧情身份，不是本条配角本人。
              </li>
            ) : null}
            <li>
              <strong>其他人脉</strong>：从列表里点，会插入一串带 id 的暗号，专门指「别的谁」；适合一句话里要同时提到好几个人、又怕以后改名对不上的时候用。
            </li>
            <li>
              下面有<strong>替换预览</strong>时，可以先看一眼：暗号会被换成当前真实显示名，跟发给模型的效果一致。
            </li>
            <li>
              想删掉一整段占位符时，把光标放在那段里（或紧挨在段尾后面），按一次<strong>退格</strong>或 <strong>Delete</strong>，整段表达式会一块儿删掉（含 {'{{user}}'} 的绑定槽位会同步去掉）。
            </li>
          </ul>
        </div>
      ) : null}

      {rosterOpen && !rosterDisabled ? (
        <div className={rosterPanelClass} style={variant === 'themed' ? { borderColor: '#e5e5e5' } : undefined}>
          <p className={`px-2 py-1 ${variant === 'themed' ? 'text-[11px] text-neutral-500' : 'text-[10px] text-neutral-500'}`}>
            {memoryScope === 'group'
              ? '群成员及相关人脉；点击插入 {{id:UUID}}（已排除本条视角角色）。'
              : '同档案人脉（含存档主角）；点击插入 {{id:UUID}}（已排除本条「角色」）。'}
          </p>
          {rosterLoading ? (
            <p className="px-2 py-3 text-neutral-400">载入中…</p>
          ) : !hasRoster ? (
            <p className="px-2 py-3 text-neutral-400">暂无可引用的其他人脉 id。</p>
          ) : (
            <ul className="space-y-0.5 pb-1">
              {rosterItems.map((row) => (
                <li key={row.insert}>
                  <button
                    type="button"
                    className={rosterBtnClass}
                    style={variant === 'themed' ? { color: '#000' } : undefined}
                    title={row.insert}
                    onClick={() => {
                      insertAtCaret(textareaRef.current, value, row.insert, onChange)
                      setRosterOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{row.label}</span>
                      {row.subtitle ? (
                        <span className={variant === 'themed' ? 'ml-1 text-neutral-500' : 'ml-1 text-neutral-500'}>
                          · {row.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <code className="shrink-0 text-[10px] text-neutral-400">{row.insert}</code>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showPreview ? (
        <div className={previewBox} style={previewStyle}>
          <p className={`font-semibold ${variant === 'themed' ? 'text-[12px] text-neutral-600' : 'text-[11px] text-neutral-600'}`}>
            替换预览（核对姓名）
            {previewLoading ? <span className="ml-2 font-normal text-neutral-400">解析中…</span> : null}
          </p>
          <p className={`mt-1 whitespace-pre-wrap break-words ${variant === 'themed' ? 'text-[14px]' : 'text-[13px]'}`}>
            {previewLoading && !previewExpanded ? '…' : previewExpanded || '（无占位符或无法解析）'}
          </p>
          <p className={`mt-1 ${variant === 'themed' ? 'text-[11px] text-neutral-500' : 'text-[10px] text-neutral-400'}`}>
            输入框保存表达式；预览与注入一致。若有粘贴自动总结里的其它占位符，仍会在此展开。
          </p>
        </div>
      ) : null}
    </div>
  )
}
