import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { uid } from '../newFriendsPersona/utils'
import { groupMemoryBucketCharacterId } from '../wechatConversationKey'
import { resolveWorldBookUserInsertContext } from '../charUserPlaceholders'
import type { WorldBookUserInsertContext } from '../charUserPlaceholders'
import type { WorldBookUserPlaceholderBinding } from '../newFriendsPersona/types'
import { reconcileMemoryUserPlaceholdersOnSave } from '../memoryUserPlaceholderBindings'
import { tryDeleteWholePlaceholderExpressionAtCaret } from '../placeholderExpressionDelete'
import { normalizeWorldBookItemUserPlaceholders } from '../worldBookUserPlaceholderBindings'
import {
  memoryEntryToPersistPayload,
  memorySceneTagsFromRow,
} from './memoryArchiveMapper'
import type {
  MemoryArchiveKind,
  MemoryEntry,
  MemorySceneTag,
  MemorySourceIdentity,
} from './memoryArchiveTypes'
import { MemoryEditorBindingSummary } from './MemoryEditorBindingSummary'
import { MemoryEditorIdentityPicker } from './MemoryEditorIdentityPicker'
import {
  listMemoryEditorCharacterIdentityOptions,
  pickDefaultMemoryEditorIdentityKey,
  type MemoryEditorIdentityOption,
} from './memoryEditorCharacterIdentityOptions'
import { MemoryManualKeywordEditor } from './MemoryManualKeywordEditor'
import {
  MemoryManualPlaceholderToolbar,
  useMemoryDraftPlaceholderPreview,
} from './MemoryManualPlaceholderToolbar'

import { ARCHIVE_INK, ARCHIVE_MUTED, ARCHIVE_SERIF } from './memoryArchiveTheme'
import { MEMORY_EDITOR_COACH_STEPS, memoryEditorCoachTabForTarget } from './memoryEditorCoachSteps'
import { MEMORY_EDITOR_TUTORIAL_SECTIONS } from './memoryEditorTutorialCopy'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import {
  MEMORY_EDITOR_COACH_SEEN_KEY,
  readMemoryCoachSeen,
  writeMemoryCoachSeen,
} from './memoryCoachTypes'

const INK = ARCHIVE_INK
const MUTED = ARCHIVE_MUTED

const OWN_SCENE_TAGS: MemorySceneTag[] = ['私聊', '群聊', '线下', '遇见']
const LINKED_SCENE_TAGS: MemorySceneTag[] = ['私聊', '线下']

type MemoryEditorSheetTab = 'identity' | 'user' | 'content'

const MEMORY_EDITOR_SHEET_TABS: ReadonlyArray<{ id: MemoryEditorSheetTab; label: string }> = [
  { id: 'identity', label: '绑定身份' },
  { id: 'user', label: 'user 表达式' },
  { id: 'content', label: '正文与预览' },
] as const

export function MemoryEditorSheet({
  open,
  mode,
  entry,
  raw,
  contacts,
  sourceIdentity,
  editorKind = 'own',
  currentWechatAccountId,
  playerIdentityId,
  groupOptions,
  initialCharId,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: 'create' | 'edit'
  entry: MemoryEntry | null
  raw: CharacterMemory | null
  contacts: WeChatContactRow[]
  /** 档案馆角色焦点：新建时默认归属该联系人 */
  initialCharId?: string
  sourceIdentity: MemorySourceIdentity
  /** 档案馆当前 Tab：角色自有记忆 vs 线下关联记忆 */
  editorKind?: MemoryArchiveKind
  currentWechatAccountId?: string
  playerIdentityId?: string
  groupOptions: Array<{ groupId: string; title: string }>
  onClose: () => void
  onSaved: () => void
}) {
  const isLinkedEditor = editorKind === 'linked'
  const sceneTags = isLinkedEditor ? LINKED_SCENE_TAGS : OWN_SCENE_TAGS
  const [charId, setCharId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [tags, setTags] = useState<MemorySceneTag[]>(['私聊'])
  const [triggerType, setTriggerType] = useState<'always' | 'keyword'>('keyword')
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwKey, setKwKey] = useState(0)
  const [content, setContent] = useState('')
  const [userBindings, setUserBindings] = useState<WorldBookUserPlaceholderBinding[]>([])
  const [sessionInsertCtx, setSessionInsertCtx] = useState<WorldBookUserInsertContext | null>(null)
  const [identityOptions, setIdentityOptions] = useState<MemoryEditorIdentityOption[]>([])
  const [identityOptionsLoading, setIdentityOptionsLoading] = useState(false)
  const [selectedIdentityKey, setSelectedIdentityKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editorTab, setEditorTab] = useState<MemoryEditorSheetTab>('content')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const allContacts = useMemo(
    () =>
      contacts
        .filter((c) => c.id.trim())
        .sort((a, b) => a.remarkName.localeCompare(b.remarkName, 'zh-CN')),
    [contacts],
  )

  /** 编辑/已选焦点：仅展示本条记忆的归属角色，避免误以为可改挂到他人名下 */
  const attributionLocked = mode === 'edit' || Boolean(initialCharId?.trim())
  const attributionRoster = useMemo(() => {
    if (mode === 'edit' && entry) {
      const id = entry.charId.trim()
      const hit = allContacts.find((c) => c.id.trim() === id)
      if (hit) return [hit]
      return [
        {
          id,
          remarkName: entry.charDisplayName || id.slice(0, 8),
          avatarUrl: entry.charAvatarUrl,
        } as WeChatContactRow,
      ]
    }
    const seed = initialCharId?.trim()
    if (mode === 'create' && seed) {
      const hit = allContacts.find((c) => c.id.trim() === seed)
      if (hit) return [hit]
    }
    return allContacts
  }, [mode, entry, initialCharId, allContacts])

  useEffect(() => {
    if (open) setEditorTab('content')
    else {
      setTutorialOpen(false)
      setCoachOpen(false)
    }
  }, [open])

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setEditorTab('content')
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback((opts?: { openTutorial?: boolean }) => {
    writeMemoryCoachSeen(MEMORY_EDITOR_COACH_SEEN_KEY)
    setCoachOpen(false)
    setCoachStepIndex(0)
    if (opts?.openTutorial) setTutorialOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    if (readMemoryCoachSeen(MEMORY_EDITOR_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 520)
    return () => window.clearTimeout(id)
  }, [open, startLiveCoach])

  const handleCoachBeforeStep = useCallback(
    (step: { target: string | null }) => {
      const tab = memoryEditorCoachTabForTarget(step.target)
      if (tab) setEditorTab(tab)
    },
    [],
  )

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && entry && raw) {
      setCharId(entry.charId)
      setGroupId(entry.groupId ?? '')
      setTags(entry.tags.length ? [...entry.tags] : memorySceneTagsFromRow(raw))
      setTriggerType(entry.triggerType)
      setKeywords(entry.triggerKeywords ?? [])
      setContent(entry.content)
      setUserBindings(
        raw.userPlaceholderBindings?.length ? raw.userPlaceholderBindings.map((b) => ({ ...b })) : [],
      )
      setKwKey((k) => k + 1)
      return
    }
    const first = initialCharId?.trim() || attributionRoster[0]?.id || allContacts[0]?.id || ''
    setCharId(first)
    setGroupId(groupOptions[0]?.groupId ?? '')
    setTags(
      isLinkedEditor ? ['私聊'] : sourceIdentity === 'lumi_meet' ? ['遇见'] : ['私聊'],
    )
    setTriggerType('keyword')
    setKeywords([])
    setContent('')
    setUserBindings([])
    setKwKey((k) => k + 1)
  }, [open, mode, entry, raw, attributionRoster, allContacts, initialCharId, groupOptions, sourceIdentity, isLinkedEditor])

  useEffect(() => {
    if (!open) {
      setSessionInsertCtx(null)
      setIdentityOptions([])
      setSelectedIdentityKey(null)
      return
    }
    let cancelled = false
    void (async () => {
      const ctx = await resolveWorldBookUserInsertContext({
        wechatAccountId: currentWechatAccountId,
        playerIdentityId: playerIdentityId ?? undefined,
      })
      if (!cancelled) setSessionInsertCtx(ctx)
    })()
    return () => {
      cancelled = true
    }
  }, [open, currentWechatAccountId, playerIdentityId])

  const storageCharacterId = useMemo(() => {
    if (tags.includes('群聊') && groupId.trim()) {
      return groupMemoryBucketCharacterId(groupId.trim())
    }
    const pick = allContacts.find((c) => c.id === charId)?.id ?? charId
    return pick.trim()
  }, [tags, groupId, charId, allContacts])

  useEffect(() => {
    if (!open) return
    const cid = storageCharacterId.trim()
    if (!cid) {
      setIdentityOptions([])
      setSelectedIdentityKey(null)
      setIdentityOptionsLoading(false)
      return
    }
    let cancelled = false
    setIdentityOptionsLoading(true)
    void (async () => {
      const opts = await listMemoryEditorCharacterIdentityOptions(cid, {
        currentWechatAccountId,
        currentPlayerIdentityId: playerIdentityId,
      })
      if (cancelled) return
      setIdentityOptions(opts)
      setSelectedIdentityKey(
        pickDefaultMemoryEditorIdentityKey(opts, {
          currentWechatAccountId,
          currentPlayerIdentityId: playerIdentityId,
        }),
      )
      setIdentityOptionsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, storageCharacterId, currentWechatAccountId, playerIdentityId])

  const editorInsertCtx = useMemo(() => {
    if (selectedIdentityKey && identityOptions.length) {
      const hit = identityOptions.find((o) => o.key === selectedIdentityKey)
      if (hit) return hit.ctx
    }
    return sessionInsertCtx
  }, [selectedIdentityKey, identityOptions, sessionInsertCtx])

  const editorInsertLabel = editorInsertCtx?.lineLabel?.trim() || editorInsertCtx?.displayName?.trim() || null

  const bindingDraft = useMemo((): import('../newFriendsPersona/types').CharacterMemory | null => {
    if (!open) return null
    const scope = isLinkedEditor
      ? 'linked'
      : tags.includes('群聊')
        ? 'group'
        : tags.includes('遇见') && !tags.includes('私聊') && !tags.includes('群聊')
          ? 'meet'
          : 'private'
    return {
      id: raw?.id ?? '__draft__',
      characterId: storageCharacterId || '__draft__',
      content,
      createdAt: 0,
      updatedAt: 0,
      isAutoGenerated: false,
      memoryScope: scope,
      sourceWechatAccountId: raw?.sourceWechatAccountId,
      sourceSessionPlayerIdentityId: raw?.sourceSessionPlayerIdentityId,
      userPlaceholderBindings: userBindings,
    }
  }, [open, raw, content, tags, storageCharacterId, userBindings])

  const preview = useMemoryDraftPlaceholderPreview({
    draft: content,
    characterId: open ? storageCharacterId : null,
    memoryScope: tags.includes('群聊') ? 'group' : tags.includes('关联线下') ? 'linked' : 'private',
    linkedFromCharacterId: raw?.linkedFromCharacterId,
    userPlaceholderBindings: userBindings,
  })

  const applyMemoryContentChange = useCallback(
    (next: string, caret?: number) => {
      const sync = normalizeWorldBookItemUserPlaceholders(next, userBindings, editorInsertCtx)
      setContent(sync.content)
      if (sync.bindings.length !== userBindings.length || sync.changed) {
        setUserBindings(sync.bindings)
      }
      if (caret != null) {
        queueMicrotask(() => {
          const ta = textareaRef.current
          if (!ta) return
          ta.focus()
          try {
            ta.setSelectionRange(caret, caret)
          } catch {
            /* ignore */
          }
        })
      }
    },
    [userBindings, editorInsertCtx],
  )

  const handleMemoryContentKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    const chunk = tryDeleteWholePlaceholderExpressionAtCaret(
      content,
      start,
      end,
      e.key === 'Backspace' ? 'Backspace' : 'Delete',
    )
    if (!chunk) return
    e.preventDefault()
    applyMemoryContentChange(chunk.next, chunk.caret)
  }

  const toggleTag = (tag: MemorySceneTag) => {
    setTags((prev) => {
      if (prev.includes(tag)) {
        const next = prev.filter((t) => t !== tag)
        return next.length ? next : ['私聊']
      }
      return [...prev, tag]
    })
  }

  const save = async () => {
    const body = content.trim()
    if (!body || !storageCharacterId) return
    setBusy(true)
    try {
      let linkedFromCharacterId = raw?.linkedFromCharacterId
      if (isLinkedEditor) {
        const ch = await personaDb.getCharacter(storageCharacterId)
        linkedFromCharacterId =
          ch?.generatedForCharacterId?.trim() || storageCharacterId || undefined
      }
      const tagsForSave: MemorySceneTag[] = isLinkedEditor
        ? (['关联线下', ...tags.filter((t) => t === '私聊' || t === '线下')] as MemorySceneTag[])
        : tags.filter((t) => t !== '关联线下')

      const draftEntry: MemoryEntry = {
        id: entry?.id ?? uid('mem'),
        sourceIdentity,
        charId: charId.trim() || storageCharacterId,
        storageCharacterId,
        charDisplayName: allContacts.find((c) => c.id === charId)?.remarkName ?? charId,
        content: body,
        tags: tagsForSave,
        triggerType,
        triggerKeywords: triggerType === 'keyword' ? keywords : undefined,
        timestamp: Date.now(),
        groupId: !isLinkedEditor && tags.includes('群聊') ? groupId.trim() : undefined,
        memoryScope: isLinkedEditor ? 'linked' : raw?.memoryScope,
        linkedFromCharacterId,
      }

      const reconciled = await reconcileMemoryUserPlaceholdersOnSave(
        {
          content: body,
          userPlaceholderBindings: userBindings,
          sourceWechatAccountId: raw?.sourceWechatAccountId,
          sourceSessionPlayerIdentityId: raw?.sourceSessionPlayerIdentityId,
        },
        { fallback: editorInsertCtx },
      )

      const payload = memoryEntryToPersistPayload(
        {
          ...draftEntry,
          content: reconciled.content,
          storageCharacterId,
        },
        raw,
        {
          sourceWechatAccountId:
            raw?.sourceWechatAccountId ??
            (sourceIdentity === 'lumi_meet' ? undefined : currentWechatAccountId),
          sourceSessionPlayerIdentityId:
            raw?.sourceSessionPlayerIdentityId ?? playerIdentityId ?? undefined,
        },
      )

      const now = Date.now()
      if (mode === 'edit' && raw) {
        await personaDb.upsertCharacterMemory({
          ...raw,
          ...payload,
          id: raw.id,
          createdAt: raw.createdAt,
          updatedAt: now,
          isAutoGenerated: false,
          ...(reconciled.userPlaceholderBindings.length
            ? { userPlaceholderBindings: reconciled.userPlaceholderBindings }
            : {}),
        })
      } else {
        await personaDb.upsertCharacterMemory({
          id: draftEntry.id,
          ...payload,
          createdAt: now,
          updatedAt: now,
          isAutoGenerated: false,
          ...(reconciled.userPlaceholderBindings.length
            ? { userPlaceholderBindings: reconciled.userPlaceholderBindings }
            : {}),
        })
      }
      onSaved()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
    <MemoryTutorialModal
      open={tutorialOpen}
      onClose={() => setTutorialOpen(false)}
      title="记忆刻录 · 怎么编辑"
      subtitle="编辑面板说明，随时可回看"
      sections={MEMORY_EDITOR_TUTORIAL_SECTIONS}
      onStartLiveCoach={startLiveCoach}
      zIndex={60200}
    />
    <AnimatePresence>
      {open ? (
        <motion.div
          key="memory-editor-backdrop"
          className="fixed inset-0 z-[60000] flex flex-col justify-end"
          style={{ background: 'rgba(17, 24, 39, 0.28)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="memory-editor-sheet"
            data-memory-coach-root="memory-editor"
            role="dialog"
            aria-modal
            className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <div>
                <p className="text-[10px] tracking-[0.32em] uppercase" style={{ color: MUTED }}>
                  {mode === 'create' ? 'New Entry' : 'Edit Entry'}
                </p>
                <h2 className="text-[17px] font-semibold" style={{ color: INK }}>
                  {mode === 'create'
                    ? isLinkedEditor
                      ? '刻录关联记忆'
                      : '刻录新记忆'
                    : isLinkedEditor
                      ? '修订关联记忆'
                      : '修订记忆切片'}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <MemoryTutorialButton
                  compact
                  onClick={() => setTutorialOpen(true)}
                  coachTarget="editor-tutorial"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100/90 text-gray-800"
                  aria-label="关闭"
                >
                  <X className="size-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              data-memory-coach="attribution"
              className="shrink-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-3"
            >
              <label className="block text-[10px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>
                记忆归属角色
              </label>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                {isLinkedEditor
                  ? '关联记忆挂在该人脉角色名下，来自其绑定主角的线下约会剧情；注入时与上方「角色记忆」分轨，其它角色私聊不会自动看见。'
                  : attributionLocked
                    ? '本条记忆只归属下方这一位联系人；私聊注入时仅在与 TA 对话时召回，不会写入或共享到其他角色档案。正文里插入的「人脉」按钮只是指称写法，不代表把记忆挂到对方名下。'
                    : '选择本条记忆挂在哪位联系人名下；仅在与该角色私聊时注入。未选角色焦点时可在此指定归属。'}
              </p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {attributionRoster.map((c) => {
                  const active = charId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={tags.includes('群聊') || attributionLocked}
                      onClick={() => setCharId(c.id)}
                      className="flex shrink-0 flex-col items-center gap-1 disabled:opacity-40"
                    >
                      <span
                        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] transition-all ${
                          active
                            ? 'scale-110 shadow-[0_0_0_4px_rgba(243,244,246,0.6),0_6px_16px_rgba(0,0,0,0.06)]'
                            : 'shadow-[0_4px_12px_rgba(0,0,0,0.04)]'
                        }`}
                      >
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          c.remarkName.slice(0, 1)
                        )}
                      </span>
                      <span
                        className={`max-w-[56px] truncate text-[9px] ${active ? 'font-semibold' : ''}`}
                        style={{ color: active ? INK : MUTED }}
                      >
                        {c.remarkName}
                      </span>
                    </button>
                  )
                })}
              </div>

              {tags.includes('群聊') && groupOptions.length ? (
                <div className="mt-4">
                  <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>
                    群聊
                  </label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="mt-2 w-full border-0 border-b border-gray-200/80 bg-transparent py-2 text-[14px] text-gray-900 outline-none"
                  >
                    {groupOptions.map((g) => (
                      <option key={g.groupId} value={g.groupId}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>
                  场景标签
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sceneTags.map((tag) => {
                    const on = tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                          on ? 'bg-gray-900 text-white' : 'bg-gray-100/90 text-gray-600'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <nav
              data-memory-coach="tabs"
              className="mx-5 flex shrink-0 rounded-full bg-gray-100/80 p-1"
              aria-label="记忆编辑分区"
            >
              {MEMORY_EDITOR_SHEET_TABS.map((tab) => {
                const active = editorTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditorTab(tab.id)}
                    className={`relative min-w-0 flex-1 px-2 py-2 text-[11px] tracking-wide transition-colors ${
                      active ? 'font-semibold text-gray-900' : 'font-normal text-gray-400'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="memory-editor-sheet-tab-slider"
                        className="absolute inset-0 rounded-full bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <span className="relative z-10 block truncate">{tab.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <div
                data-memory-coach="tab-identity"
                className={editorTab === 'identity' ? 'space-y-4' : 'hidden'}
                aria-hidden={editorTab !== 'identity'}
              >
                    <MemoryEditorIdentityPicker
                      embedded
                      options={identityOptions}
                      selectedKey={selectedIdentityKey}
                      onSelectKey={setSelectedIdentityKey}
                      loading={identityOptionsLoading}
                    />
                    <MemoryEditorBindingSummary
                      open={open}
                      section="identity"
                      draft={bindingDraft}
                      editorInsertLabel={editorInsertLabel}
                      identityOptions={identityOptions}
                      userBindings={userBindings}
                    />
              </div>

              <div
                data-memory-coach="tab-user"
                className={editorTab === 'user' ? '' : 'hidden'}
                aria-hidden={editorTab !== 'user'}
              >
                <MemoryEditorBindingSummary
                  open={open}
                  section="user"
                  draft={bindingDraft}
                  editorInsertLabel={editorInsertLabel}
                  identityOptions={identityOptions}
                  userBindings={userBindings}
                  onUserBindingsChange={setUserBindings}
                />
              </div>

              <div
                data-memory-coach="tab-content"
                className={editorTab === 'content' ? '' : 'hidden'}
                aria-hidden={editorTab !== 'content'}
              >
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>
                        触发机制
                      </p>
                      <div className="mt-2 flex rounded-full bg-gray-100/80 p-1">
                        {(['always', 'keyword'] as const).map((t) => {
                          const active = triggerType === t
                          const label = t === 'always' ? '始终触发' : '关键词触发'
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTriggerType(t)}
                              className={`flex-1 rounded-full py-2.5 text-[12px] font-medium transition-colors ${
                                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                      <AnimatePresence initial={false}>
                        {triggerType === 'keyword' ? (
                          <motion.div
                            key="kw"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3">
                              <MemoryManualKeywordEditor
                                key={kwKey}
                                keywordsOnly
                                keywords={keywords}
                                onKeywordsChange={setKeywords}
                              />
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <div className="mt-5">
                      <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: MUTED }}>
                        记忆正文
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                        编辑表达式原文；下方「替换预览」展示注入前展开效果，与发给模型时一致。
                      </p>
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => applyMemoryContentChange(e.target.value)}
                        onKeyDown={handleMemoryContentKeyDown}
                        rows={8}
                        placeholder="记录这段羁绊的关键线索..."
                        className="mt-2 w-full resize-none border-0 bg-transparent py-2 text-[15px] leading-relaxed outline-none"
                        style={{ color: INK, fontFamily: ARCHIVE_SERIF }}
                      />
                      <MemoryManualPlaceholderToolbar
                        value={content}
                        onChange={(next) => applyMemoryContentChange(next)}
                        placeholderCharacterId={open ? storageCharacterId : null}
                        memoryScope={
                          isLinkedEditor ? 'linked' : tags.includes('群聊') ? 'group' : 'private'
                        }
                        textareaRef={textareaRef}
                        variant="neutral"
                        previewExpanded={preview.expanded}
                        previewLoading={preview.loading}
                        userInsertContext={editorInsertCtx}
                        userPlaceholderBindings={userBindings}
                        onUserPlaceholderBindingsChange={setUserBindings}
                      />
                    </div>
              </div>
            </div>
            </div>

            <div
              data-memory-coach="save"
              className="shrink-0 bg-white/95 px-5 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.04)]"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                disabled={busy || !content.trim()}
                onClick={() => void save()}
                className="w-full rounded-full bg-gray-900 py-3.5 text-[13px] font-semibold tracking-wide text-white transition-opacity disabled:opacity-40"
              >
                {busy ? '保存中…' : '写入档案库'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    <MemoryCoachPortal
      open={coachOpen && open}
      steps={MEMORY_EDITOR_COACH_STEPS}
      stepIndex={coachStepIndex}
      onStepChange={setCoachStepIndex}
      onSkip={() => finishCoach()}
      onComplete={(opts) => finishCoach(opts)}
      onBeforeStep={handleCoachBeforeStep}
      scopeRoot="memory-editor"
      layoutEpoch={editorTab}
      zIndex={60100}
    />
    </>,
    document.body,
  )
}
