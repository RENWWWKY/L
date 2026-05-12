import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronDown, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ApiConfig } from '../../api/types'
import { generateWorldBookItemContent } from './ai'
import { LoreEntryEditorSheet } from './LoreEntryEditorSheet'
import { PlatinumSwitch } from './PlatinumSwitch'
import type { Character, PlayerIdentity, WorldBook, WorldBookItem } from './types'
import { formatWorldBookItemLineForPrompt } from './worldBookPronounGuide'
import { uid } from './utils'
import { WorldBookItemGenLengthModal } from './WorldBookItemGenLengthModal'
import { personaDb } from './idb'

const BG_PAGE = 'linear-gradient(180deg, #fafaf9 0%, #f5f5f4 48%, #f4f4f5 100%)'

export function WorldBooksEditor({
  apiConfig,
  character,
  onChange,
  forPlayerIdentity = false,
  worldBackgroundPrompt = '',
  identityContext = null,
  linkedNpcsContext = '',
}: {
  apiConfig: ApiConfig | null
  character: Character
  onChange: (next: Character) => void
  forPlayerIdentity?: boolean
  worldBackgroundPrompt?: string
  identityContext?: PlayerIdentity | null
  linkedNpcsContext?: string
}) {
  const [sheetEntry, setSheetEntry] = useState<null | { wbId: string; itemId: string }>(null)
  const [confirmDelete, setConfirmDelete] = useState<null | { kind: 'wb' | 'item'; wbId: string; itemId?: string; title: string }>(null)
  const [generatingKey, setGeneratingKey] = useState<string>('')
  const [wbItemGenPicker, setWbItemGenPicker] = useState<null | { wbId: string; itemId: string }>(null)
  const [archiveGuideOpen, setArchiveGuideOpen] = useState(false)

  const [networkPeersForInsert, setNetworkPeersForInsert] = useState<
    { id: string; label: string; role: 'archive_root' | 'network_npc' }[]
  >([])

  useEffect(() => {
    if (forPlayerIdentity) {
      setNetworkPeersForInsert([])
      return
    }
    const rootId = (character.generatedForCharacterId?.trim() || character.id || '').trim()
    if (!rootId) {
      setNetworkPeersForInsert([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const mainCh = await personaDb.getCharacter(rootId)
        const npcs = await personaDb.listNpcsFor(rootId)
        if (cancelled) return
        const isNpc = !!character.generatedForCharacterId?.trim()
        const rootLabel = String(mainCh?.name ?? mainCh?.wechatNickname ?? '').trim() || '档案主角'
        const others = npcs
          .filter((n) => n.id !== character.id)
          .map((n) => ({
            id: n.id,
            label: String(n.name ?? n.wechatNickname ?? '').trim() || n.id.slice(0, 8),
            role: 'network_npc' as const,
          }))
        const out = isNpc
          ? [{ id: rootId, label: rootLabel, role: 'archive_root' as const }, ...others]
          : others
        setNetworkPeersForInsert(out)
      } catch {
        if (!cancelled) setNetworkPeersForInsert([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [forPlayerIdentity, character.id, character.generatedForCharacterId])

  const worldBooks = character.worldBooks ?? []

  const setWorldBooks = (next: WorldBook[]) => {
    onChange({ ...character, worldBooks: next, updatedAt: Date.now() })
  }

  const addWorldBook = () => {
    const wb: WorldBook = { id: uid('wb'), name: '未命名世界书', enabled: true, items: [], collapsed: false }
    setWorldBooks([wb, ...worldBooks])
  }

  const updateWorldBook = (wbId: string, patch: Partial<WorldBook>) => {
    setWorldBooks(worldBooks.map((w) => (w.id === wbId ? { ...w, ...patch } : w)))
  }

  const addItem = (wbId: string): string => {
    const now = Date.now()
    const newId = uid('it')
    const item: WorldBookItem = {
      id: newId,
      name: '新法则',
      enabled: true,
      priority: 'before',
      keywords: '',
      content: '',
      updatedAt: now,
      collapsed: false,
    }
    setWorldBooks(
      worldBooks.map((w) =>
        w.id === wbId ? { ...w, collapsed: false, items: [item, ...(w.items ?? [])] } : w,
      ),
    )
    return newId
  }

  const updateItem = (wbId: string, itemId: string, patch: Partial<WorldBookItem>) => {
    setWorldBooks(
      worldBooks.map((w) =>
        w.id !== wbId
          ? w
          : {
              ...w,
              items: (w.items ?? []).map((it) => (it.id === itemId ? { ...it, ...patch, updatedAt: Date.now() } : it)),
            },
      ),
    )
  }

  const removeWorldBook = (wbId: string) => {
    setWorldBooks(worldBooks.filter((w) => w.id !== wbId))
    setSheetEntry((s) => (s?.wbId === wbId ? null : s))
  }

  const removeItem = (wbId: string, itemId: string) => {
    setWorldBooks(worldBooks.map((w) => (w.id === wbId ? { ...w, items: (w.items ?? []).filter((it) => it.id !== itemId) } : w)))
    setSheetEntry((s) => (s?.wbId === wbId && s?.itemId === itemId ? null : s))
  }

  const wbPromptVoice = forPlayerIdentity ? 'player_identity' : 'character_card'
  const wbSubjectName = String(character.name ?? '').trim() || (forPlayerIdentity ? '用户' : '该角色')

  const enabledBookText = useMemo(() => {
    return worldBooks
      .filter((w) => w.enabled)
      .map((w) => {
        const lines = (w.items ?? [])
          .filter((it) => it.enabled && String(it.content || '').trim())
          .map((it) =>
            formatWorldBookItemLineForPrompt({
              priority: it.priority,
              name: it.name,
              content: String(it.content).trim(),
              subjectName: wbSubjectName,
              voice: wbPromptVoice,
            }),
          )
          .join('\n')
        return lines ? `世界书「${w.name}」\n${lines}` : ''
      })
      .filter(Boolean)
      .join('\n\n')
  }, [worldBooks, wbPromptVoice, wbSubjectName])

  const canUseAi = !!apiConfig?.apiUrl && !!apiConfig?.apiKey && !!apiConfig?.modelId

  const sheetWorldBook = sheetEntry ? worldBooks.find((w) => w.id === sheetEntry.wbId) : undefined
  const sheetItem = sheetWorldBook?.items?.find((it) => it.id === sheetEntry?.itemId)

  const timingLabel = (p: WorldBookItem['priority']) =>
    p === 'before' ? '[ 序言介入 Pre-Chat ]' : '[ 尾声延展 Post-Chat ]'

  return (
    <div className="relative min-h-[min(100vh,860px)] pb-36" style={{ background: BG_PAGE }}>
      <div className="px-5 pt-8 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-stone-400">Lore Archive</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-[20px] font-semibold tracking-tight text-stone-900">世界书档案室</h2>
          <button
            type="button"
            onClick={() => setArchiveGuideOpen((v) => !v)}
            className="group flex shrink-0 items-center gap-1 rounded-full border border-stone-200/90 bg-white/80 px-3 py-1.5 text-[12px] font-medium text-stone-600 shadow-sm backdrop-blur-sm transition hover:border-stone-300 hover:bg-white active:scale-[0.98]"
            aria-expanded={archiveGuideOpen}
          >
            <BookOpen className="size-3.5 text-stone-500 group-hover:text-stone-700" strokeWidth={2} />
            编辑说明
          </button>
        </div>
        <p className="mt-2 max-w-[min(100%,22rem)] text-[13px] leading-relaxed text-stone-500">
          {forPlayerIdentity
            ? '刻画玩家本人侧设定；与通讯录人设档案无关。'
            : '双层法则：序言介入为基底，尾声延展为关系快照；轻触条目即可雕琢。'}
        </p>
        <AnimatePresence initial={false}>
          {archiveGuideOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-2xl border border-stone-200/80 bg-white/90 p-4 text-[13px] leading-relaxed text-stone-600 shadow-[0_2px_16px_rgba(0,0,0,0.04)] backdrop-blur-sm">
                {forPlayerIdentity ? (
                  <ul className="list-disc space-y-2 pl-4 marker:text-stone-400">
                    <li>这边写的是<strong>玩家本人</strong>这条线的设定，跟通讯录里单独的人设卡是两条线，别混着脑补成同一个人哦。</li>
                    <li>
                      <strong className="text-stone-800">序言</strong>
                      像开场白，聊天还没开始就先进脑子；<strong className="text-stone-800">尾声</strong>
                      像聊完后的后记，适合补一句状态或心情。
                    </li>
                    <li>
                      正文里可以用{' '}
                      <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] text-stone-700">{`{{char}}`}</code> /{' '}
                      <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] text-stone-700">{`{{user}}`}</code>
                      ，预览里会换成当前称呼，不用自己手打全名。
                    </li>
                    <li>想删掉一整段占位符时，光标挪到那段里（或紧挨在段尾后面）按一次退格或 Delete，整段表达式会一块儿删掉，不用慢慢抠字母。</li>
                    <li>关掉某一卷或某一条的开关，那一段就不会混进提示词里。</li>
                  </ul>
                ) : (
                  <ul className="list-disc space-y-2 pl-4 marker:text-stone-400">
                    <li>
                      你可以把<strong className="text-stone-800">一卷世界书</strong>想成一本设定集，里面的<strong className="text-stone-800">每条法则</strong>
                      都是一小段「进了对话就会生效」的文字。
                    </li>
                    <li>
                      <strong className="text-stone-800">序言</strong>
                      ：还没聊就先铺底，适合世界观、人设基调；<strong className="text-stone-800">尾声</strong>
                      ：聊完再叠一层，适合关系变了、刚发生的事。
                    </li>
                    <li>
                      <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] text-stone-700">{`{{char}}`}</code>{' '}
                      = 当前档案这位人设的名字；{' '}
                      <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] text-stone-700">{`{{user}}`}</code>{' '}
                      = 绑定的玩家身份名字。抽屉里点「快捷插入」会直接塞进原文式子，保存后预览会替换成真名。
                    </li>
                    <li>
                      同一条人脉里<strong className="text-stone-800">其他人</strong>用{' '}
                      <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px] text-stone-700">{`{{id:…}}`}</code>
                      （一长串 id）。预览里也会展开成对应姓名，和真正注入时是一套规则；不用对着 id 对照表抠。
                    </li>
                    <li>要删占位符同上：光标放在这段里或紧贴在整段末尾后面，按一次退格或 Delete，整段表达式一起没。</li>
                    <li>某一卷或某一条关掉开关，那一段就不会进提示词，放心试错。</li>
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4 px-4">
        {worldBooks.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-stone-200/90 bg-white/40 px-6 py-14 text-center backdrop-blur-sm">
            <p className="text-[14px] text-stone-500">尚无世界书卷轴</p>
            <p className="mt-2 text-[12px] text-stone-400">点击下方缔造新世界，开启第一条叙事线索</p>
          </div>
        ) : (
          worldBooks.map((wb) => (
            <motion.div
              key={wb.id}
              layout
              className="overflow-hidden rounded-[22px] border border-gray-50 bg-white/95 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-md"
            >
              <div
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center gap-3 p-4 outline-none"
                onClick={() => updateWorldBook(wb.id, { collapsed: !wb.collapsed })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    updateWorldBook(wb.id, { collapsed: !wb.collapsed })
                  }
                }}
              >
                <motion.span
                  animate={{ rotate: wb.collapsed ? 0 : 180 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  className="shrink-0 text-stone-400"
                >
                  <ChevronDown className="size-5" strokeWidth={2} />
                </motion.span>
                <input
                  value={wb.name}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => updateWorldBook(wb.id, { name: e.target.value })}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[17px] font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
                  placeholder="世界之名"
                  aria-label="世界书名称"
                />
                <PlatinumSwitch
                  checked={wb.enabled}
                  onChange={(v) => updateWorldBook(wb.id, { enabled: v })}
                  aria-label="启用整卷世界书"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  aria-label="删除世界书"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete({ kind: 'wb', wbId: wb.id, title: wb.name || '世界书' })
                  }}
                >
                  <Trash2 className="size-[18px]" strokeWidth={1.8} />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {!wb.collapsed ? (
                  <motion.div
                    key="entries"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 32, stiffness: 360 }}
                    className="overflow-hidden border-t border-stone-100/90"
                  >
                    <div className="ml-3 border-l border-dashed border-stone-200/90 pl-4 pr-3 pb-4 pt-2">
                      {(wb.items ?? []).length === 0 ? (
                        <p className="py-3 text-[13px] text-stone-400">暂无条目</p>
                      ) : (
                        <div className="space-y-1">
                          {(wb.items ?? []).map((it) => (
                            <div
                              key={it.id}
                              className="flex items-start justify-between gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-stone-50/90"
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => setSheetEntry({ wbId: wb.id, itemId: it.id })}
                              >
                                <p className="truncate text-[14px] font-medium text-stone-900">{it.name?.trim() || '未命名法则'}</p>
                                <p className="mt-1 font-mono text-[9px] tracking-wide text-stone-400">{timingLabel(it.priority)}</p>
                              </button>
                              <PlatinumSwitch
                                checked={it.enabled}
                                onChange={(v) => updateItem(wb.id, it.id, { enabled: v })}
                                aria-label="条目生效"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        className="mt-3 w-full rounded-2xl border border-dashed border-stone-200/90 py-3 text-[13px] font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-white/80"
                        onClick={() => {
                          const id = addItem(wb.id)
                          setSheetEntry({ wbId: wb.id, itemId: id })
                        }}
                      >
                        + 新增法则条目
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1040] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="pointer-events-auto w-full max-w-lg rounded-full bg-stone-950 py-4 text-[14px] font-medium tracking-[0.06em] text-white shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition-transform active:scale-[0.99]"
          onClick={addWorldBook}
        >
          + 缔造新世界 (New Worldbook)
        </button>
      </div>

      {sheetEntry && sheetWorldBook && sheetItem ? (
        <LoreEntryEditorSheet
          open
          onClose={() => setSheetEntry(null)}
          character={character}
          worldBook={sheetWorldBook}
          item={sheetItem}
          wbId={sheetEntry.wbId}
          itemId={sheetEntry.itemId}
          onPatchItem={updateItem}
          onDeleteItem={removeItem}
          forPlayerIdentity={forPlayerIdentity}
          networkPeersForInsert={networkPeersForInsert}
          canUseAi={canUseAi}
          generating={generatingKey === `${sheetEntry.wbId}::${sheetEntry.itemId}`}
          onOpenAiLengthModal={() => setWbItemGenPicker({ wbId: sheetEntry.wbId, itemId: sheetEntry.itemId })}
        />
      ) : null}

      <WorldBookItemGenLengthModal
        open={!!wbItemGenPicker}
        onClose={() => setWbItemGenPicker(null)}
        onConfirm={(targetChineseChars) => {
          const p = wbItemGenPicker
          setWbItemGenPicker(null)
          if (!p || !canUseAi) return
          const genKey = `${p.wbId}::${p.itemId}`
          setGeneratingKey(genKey)
          void (async () => {
            try {
              const wb = worldBooks.find((w) => w.id === p.wbId)
              const item = wb?.items.find((x) => x.id === p.itemId)
              if (!wb || !item || !apiConfig) return
              const text = await generateWorldBookItemContent({
                character,
                worldBook: wb,
                item,
                apiConfig,
                forPlayerIdentity,
                identityContext: identityContext ?? undefined,
                targetChineseChars,
                worldBackgroundPrompt: worldBackgroundPrompt.trim() || undefined,
                linkedNpcsContext: linkedNpcsContext.trim() || undefined,
              })
              updateItem(p.wbId, p.itemId, { content: text })
            } finally {
              setGeneratingKey('')
            }
          })()
        }}
      />

      {confirmDelete ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[400px] rounded-[22px] border border-white/70 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-center text-[17px] font-semibold text-stone-900">确认删除</p>
            <p className="mt-3 text-center text-[14px] leading-relaxed text-stone-500">
              将删除「{confirmDelete.title}」，此操作不可撤销。
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-full border border-stone-200 py-3 text-[14px] text-stone-700 transition-colors hover:bg-stone-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const x = confirmDelete
                  setConfirmDelete(null)
                  if (x.kind === 'wb') removeWorldBook(x.wbId)
                  else if (x.kind === 'item' && x.itemId) removeItem(x.wbId, x.itemId)
                }}
                className="flex-1 rounded-full bg-stone-900 py-3 text-[14px] font-medium text-white"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {enabledBookText ? null : null}
    </div>
  )
}

export default WorldBooksEditor
