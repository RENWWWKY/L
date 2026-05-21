import { ArrowLeft, BookOpen, Edit, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WECHAT_LUMI_ASSISTANT_CONTACT } from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory, CharacterMemoryTriggerMode } from '../newFriendsPersona/types'
import { formatMemoryTriggerSummaryLine, flattenMemoryTriggerKeywords } from './memoryTriggerUtils'
import {
  MemoryManualPlaceholderToolbar,
  useMemoryDraftPlaceholderPreview,
} from './MemoryManualPlaceholderToolbar'
import { MemoryManualKeywordEditor } from './MemoryManualKeywordEditor'
import { MemoryTriggerModeBadge } from './MemoryTriggerModeBadge'
import { uid } from '../newFriendsPersona/utils'
import { reconcileMemoryUserPlaceholdersOnSave } from '../memoryUserPlaceholderBindings'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../wechatConversationKey'
import { MemoryContentWithSourceBadgesFromRow } from './memoryContentExpanded'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
  danger: '#ff3b30',
} as const

function TopBar({
  title,
  onBack,
  right,
}: {
  title: string
  onBack: () => void
  right?: React.ReactNode
}) {
  return (
    <div
      className="sticky top-0 z-30 shrink-0 border-b"
      style={{
        borderColor: COLORS.border,
        background: COLORS.card,
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Pressable
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" color={COLORS.text} strokeWidth={1.75} />
        </Pressable>
        <p className="min-w-0 flex-1 truncate px-2 text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
          {title}
        </p>
        <div className="flex min-w-[52px] justify-end">{right}</div>
      </div>
    </div>
  )
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[50000] flex min-h-0 items-center justify-center overflow-y-auto overscroll-contain px-4 py-10 sm:py-14"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className="my-auto w-full max-w-[400px] max-h-[min(90dvh,720px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function CharacterMemoryDetailApp({
  characterId,
  titleRemark,
  playerIdentityId: _playerIdentityId,
  onBack,
}: {
  characterId: string
  /** 通讯录备注名（与列表一致） */
  titleRemark?: string
  /** 与聊天相同：null 表示身份尚未从 IndexedDB 就绪 */
  playerIdentityId: string | null
  onBack: () => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [list, setList] = useState<CharacterMemory[]>([])
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [editUserBindings, setEditUserBindings] = useState<
    import('../newFriendsPersona/types').WorldBookUserPlaceholderBinding[] | undefined
  >(undefined)
  const [editSourceAcc, setEditSourceAcc] = useState<string | undefined>(undefined)
  const [editSourceSid, setEditSourceSid] = useState<string | undefined>(undefined)
  const [editTriggerMode, setEditTriggerMode] = useState<CharacterMemoryTriggerMode>('keyword')
  const [editKeywords, setEditKeywords] = useState<string[]>([])
  const [editKwEditorKey, setEditKwEditorKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewRow, setViewRow] = useState<CharacterMemory | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CharacterMemory | null>(null)

  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previewRowForDraft = useMemo(() => {
    if (!editingId) return null
    return list.find((x) => x.id === editingId) ?? null
  }, [editingId, list])

  const draftPlaceholderPreview = useMemoryDraftPlaceholderPreview({
    draft: editDraft,
    characterId: editOpen ? characterId : null,
    memoryScope: previewRowForDraft?.memoryScope === 'linked' ? 'linked' : 'private',
    linkedFromCharacterId: previewRowForDraft?.linkedFromCharacterId,
    involvedCharIds: previewRowForDraft?.involvedCharIds,
    userPlaceholderBindings: editUserBindings ?? previewRowForDraft?.userPlaceholderBindings,
    sourceWechatAccountId: editSourceAcc ?? previewRowForDraft?.sourceWechatAccountId,
    sourceSessionPlayerIdentityId: editSourceSid ?? previewRowForDraft?.sourceSessionPlayerIdentityId,
  })

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const [memsRaw, ch] = await Promise.all([
        personaDb.listCharacterMemoriesForCharacter(characterId),
        personaDb.getCharacter(characterId),
      ])
      const mems = memsRaw.filter((m) => m.memoryScope !== 'group')
      setList(mems)

      if (titleRemark?.trim()) {
        setDisplayName(titleRemark.trim())
      } else if (characterId === WECHAT_LUMI_PEER_CHARACTER_ID) {
        setDisplayName(WECHAT_LUMI_ASSISTANT_CONTACT.remarkName)
      } else if (ch) {
        setDisplayName(ch.name || ch.wechatNickname || '未命名')
      } else {
        setDisplayName('角色')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [characterId, titleRemark])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onEvt = () => void reload({ silent: true })
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])

  const openAdd = () => {
    setEditingId(null)
    setEditDraft('')
    setEditUserBindings(undefined)
    setEditSourceAcc(undefined)
    setEditSourceSid(undefined)
    setEditTriggerMode('keyword')
    setEditKeywords([])
    setEditKwEditorKey((k) => k + 1)
    setEditOpen(true)
  }

  const openEdit = (m: CharacterMemory) => {
    setEditingId(m.id)
    setEditDraft(m.content)
    setEditUserBindings(m.userPlaceholderBindings)
    setEditSourceAcc(m.sourceWechatAccountId)
    setEditSourceSid(m.sourceSessionPlayerIdentityId)
    setEditTriggerMode(m.memoryTriggerMode === 'always' ? 'always' : 'keyword')
    setEditKeywords(flattenMemoryTriggerKeywords(m))
    setEditKwEditorKey((k) => k + 1)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    let text = editDraft.trim()
    if (!text) return
    const reconciled = await reconcileMemoryUserPlaceholdersOnSave({
      content: text,
      userPlaceholderBindings: editUserBindings,
      sourceWechatAccountId: editSourceAcc ?? (editingId ? list.find((x) => x.id === editingId)?.sourceWechatAccountId : undefined),
      sourceSessionPlayerIdentityId:
        editSourceSid ?? (editingId ? list.find((x) => x.id === editingId)?.sourceSessionPlayerIdentityId : undefined),
    })
    text = reconciled.content
    const nextBindings = reconciled.userPlaceholderBindings
    const now = Date.now()
    const mode: CharacterMemoryTriggerMode = editTriggerMode === 'always' ? 'always' : 'keyword'
    const normalized = [...new Set(editKeywords.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))]
    const kws = normalized.length ? normalized : undefined
    if (editingId) {
      const prev = list.find((x) => x.id === editingId)
      if (!prev) return
      await personaDb.upsertCharacterMemory({
        ...prev,
        content: text,
        ...(nextBindings.length ? { userPlaceholderBindings: nextBindings } : {}),
        memoryTriggerMode: mode,
        memoryTriggerCategory: undefined,
        memoryTriggerPrecise: undefined,
        memoryTriggerEmotionNeed: undefined,
        memoryKeywords: kws,
        updatedAt: now,
        isAutoGenerated: false,
      })
    } else {
      await personaDb.upsertCharacterMemory({
        id: uid('mem'),
        characterId,
        content: text,
        ...(nextBindings.length ? { userPlaceholderBindings: nextBindings } : {}),
        memoryTriggerMode: mode,
        memoryTriggerCategory: undefined,
        memoryTriggerPrecise: undefined,
        memoryTriggerEmotionNeed: undefined,
        memoryKeywords: kws,
        createdAt: now,
        updatedAt: now,
        isAutoGenerated: false,
      })
    }
    setEditOpen(false)
    await reload({ silent: true })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await personaDb.deleteCharacterMemory(deleteTarget.id)
    setDeleteTarget(null)
    await reload({ silent: true })
  }

  const title = displayName ? `${displayName}的记忆` : '记忆'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: COLORS.bg }}>
      <TopBar
        title={title}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={openAdd}
            className="rounded-[12px] px-2 py-1.5 text-[16px] font-semibold transition-all duration-200 ease-out hover:opacity-80"
            style={{ color: COLORS.text }}
          >
            添加
          </button>
        }
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom,0px))' }}
      >
        {loading ? (
          <div
            className="mx-4 mt-4 rounded-[12px] border bg-white px-5 py-8 text-center text-[14px]"
            style={{ borderColor: COLORS.border, color: COLORS.sub }}
          >
            加载中…
          </div>
        ) : (
          <>
            <p className="mx-4 mt-4 text-[16px] font-semibold" style={{ color: COLORS.text }}>
              长期记忆
            </p>
            {list.length === 0 ? (
              <div
                className="mx-4 mt-2 flex flex-col items-center rounded-[12px] border bg-white px-6 py-10"
                style={{ borderColor: COLORS.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              >
                <BookOpen className="size-10" color={COLORS.faint} strokeWidth={1.5} aria-hidden />
                <p className="mt-3 text-[15px]" style={{ color: COLORS.sub }}>
                  暂无记忆
                </p>
                <p className="mt-1 text-center text-[13px] leading-relaxed" style={{ color: COLORS.faint }}>
                  和该角色聊天后，系统会自动生成记忆
                </p>
              </div>
            ) : (
              <div
                className="mx-4 mt-2 overflow-hidden rounded-[12px] border bg-white"
                style={{ borderColor: COLORS.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              >
                <ul>
                  {list.map((m, idx) => (
                    <li key={m.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
                      <div className="flex items-stretch gap-2 px-4 py-4">
                        <Pressable
                          onClick={() => {
                            setViewRow(m)
                            setViewOpen(true)
                          }}
                          className="min-w-0 flex-1 text-left transition-opacity duration-200 ease-out hover:opacity-80"
                        >
                          <div className="flex gap-2">
                            <MemoryTriggerModeBadge mode={m.memoryTriggerMode} className="mt-0.5 shrink-0 self-start" />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-[16px] leading-snug" style={{ color: COLORS.text }}>
                                <MemoryContentWithSourceBadgesFromRow memory={m} bodyClassName="break-words" />
                              </p>
                              <p className="mt-1 line-clamp-2 text-[12px] leading-snug" style={{ color: COLORS.sub }}>
                                {formatMemoryTriggerSummaryLine(m)}
                              </p>
                            </div>
                          </div>
                        </Pressable>
                        <div className="flex shrink-0 items-center gap-2">
                          <Pressable
                            onClick={() => openEdit(m)}
                            className="flex h-9 w-9 items-center justify-center rounded-[10px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            aria-label="编辑"
                          >
                            <Edit className="size-[18px]" color={COLORS.sub} strokeWidth={1.75} />
                          </Pressable>
                          <Pressable
                            onClick={() => setDeleteTarget(m)}
                            className="flex h-9 w-9 items-center justify-center rounded-[10px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            aria-label="删除"
                          >
                            <Trash2 className="size-[18px]" color={COLORS.sub} strokeWidth={1.75} />
                          </Pressable>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </>
        )}
      </div>

      {editOpen ? (
        <ModalBackdrop onClose={() => setEditOpen(false)}>
          <div
            className="overflow-hidden rounded-[16px] bg-white px-5 pb-5 pt-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <p className="text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
              {editingId ? '编辑记忆' : '添加记忆'}
            </p>
            <textarea
              ref={editTextareaRef}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              placeholder="输入记忆内容"
              rows={5}
              className="mt-4 w-full resize-none rounded-[12px] border px-4 py-3 text-[16px] leading-relaxed outline-none transition-all duration-200 ease-out focus:border-black"
              style={{ borderColor: COLORS.border, background: COLORS.card, color: COLORS.text, minHeight: 120 }}
            />
            <MemoryManualPlaceholderToolbar
              textareaRef={editTextareaRef}
              value={editDraft}
              onChange={setEditDraft}
              previewExpanded={draftPlaceholderPreview.expanded}
              previewLoading={draftPlaceholderPreview.loading}
              variant="themed"
              placeholderCharacterId={editOpen ? characterId : null}
              memoryScope={previewRowForDraft?.memoryScope === 'linked' ? 'linked' : 'private'}
              involvedCharIds={previewRowForDraft?.involvedCharIds ?? null}
            />
            <MemoryManualKeywordEditor
              key={editKwEditorKey}
              radioGroupName="mem-detail-trigger"
              triggerMode={editTriggerMode}
              onTriggerMode={setEditTriggerMode}
              keywords={editKeywords}
              onKeywordsChange={setEditKeywords}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 rounded-[12px] border px-3 py-3 text-[16px] font-medium transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: COLORS.text, color: COLORS.text, background: COLORS.card }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="flex-1 rounded-[12px] px-3 py-3 text-[16px] font-medium text-white transition-all duration-200 ease-out hover:opacity-90"
                style={{ background: COLORS.text }}
              >
                保存
              </button>
            </div>
          </div>
        </ModalBackdrop>
      ) : null}

      {viewOpen && viewRow ? (
        <ModalBackdrop
          onClose={() => {
            setViewOpen(false)
            setViewRow(null)
          }}
        >
          <div
            className="overflow-hidden rounded-[16px] bg-white px-5 pb-5 pt-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <p className="text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
              记忆详情
            </p>
            <div className="mt-3 flex items-start gap-2">
              <MemoryTriggerModeBadge mode={viewRow.memoryTriggerMode} className="mt-0.5 shrink-0" />
              <p
                className="min-w-0 flex-1 rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed"
                style={{ borderColor: COLORS.border, color: COLORS.sub }}
              >
                {formatMemoryTriggerSummaryLine(viewRow)}
              </p>
            </div>
            <p className="mt-5 px-1 text-[16px] leading-[1.6]" style={{ color: COLORS.text }}>
              <MemoryContentWithSourceBadgesFromRow
                memory={viewRow}
                size="md"
                bodyClassName="whitespace-pre-wrap break-words"
              />
            </p>
            <button
              type="button"
              onClick={() => {
                setViewOpen(false)
                setViewRow(null)
              }}
              className="mt-6 w-full rounded-[12px] px-3 py-3 text-[16px] font-medium text-white transition-all duration-200 ease-out hover:opacity-90"
              style={{ background: COLORS.text }}
            >
              关闭
            </button>
          </div>
        </ModalBackdrop>
      ) : null}

      {deleteTarget ? (
        <ModalBackdrop onClose={() => setDeleteTarget(null)}>
          <div
            className="mx-auto w-full max-w-[350px] overflow-hidden rounded-[16px] bg-white px-5 pb-5 pt-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <p className="text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
              确认删除
            </p>
            <p className="mt-4 text-[16px] leading-relaxed" style={{ color: COLORS.sub }}>
              确定要删除这条记忆吗？删除后无法恢复
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-[12px] border px-3 py-3 text-[16px] font-medium transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: COLORS.text, color: COLORS.text, background: COLORS.card }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="flex-1 rounded-[12px] px-3 py-3 text-[16px] font-medium text-white transition-all duration-200 ease-out hover:opacity-90"
                style={{ background: COLORS.danger }}
              >
                删除
              </button>
            </div>
          </div>
        </ModalBackdrop>
      ) : null}
    </div>
  )
}
