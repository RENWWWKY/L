import { ArrowLeft, ChevronRight, Dice5, Download, Globe, Plus, Save, Upload, ChevronDown, Trash2, User, UserPlus, X } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { personaDb } from './idb'
import type { Character, Gender, PlayerIdentity, Relationship } from './types'
import { IDENTITY_POOL, daysInMonth, formatMD, randomChineseName, uid, zodiacFromMD } from './utils'
import { formatLinkedNpcsForWorldBookPrompt, generateCharacterBio, generateCharacterOpeningLines, generateWechatProfilesForPersonaCharacters } from './ai'
import { WorldBooksEditor } from './WorldBooksEditor'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { useCustomization } from '../../../CustomizationContext'
import type { WeChatPersonaContact } from '../../../types'
import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { PersonaNetworkSection } from './PersonaNetworkSection'
import { PersonaBindingsManager } from './PersonaBindingsManager'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import type { ScheduleTable } from './types'
import { ScheduleEditorScreen } from '../schedule/ScheduleEditorScreen'
import {
  buildCharacterExportBundle,
  CHARACTER_BUNDLES_LIST_KIND,
  importCharacterBundle,
  parseCharacterImportFile,
} from './characterBundleIo'
import { formatWorldBackgroundForPrompt } from './worldBackgroundFormat'
import { WorldBackgroundEditPage, WorldBackgroundPickerPage } from './WorldBackgroundScreens'
import { NewFriendsList, type FriendRequest } from './NewFriendsList'
import { RequestDetail } from './RequestDetail'
import {
  buildMbtiPersonalityWorldBook,
  buildMbtiPersonalityWorldBookItems,
  getMbtiPersonalityWorldBookName,
  isMbtiPersonalityWorldBookName,
  normalizeMbti,
} from '../mbtiPersonalityWorldBook'

const bg = '#f5f5f5'
const card = '#ffffff'
const text = '#262626'
const sub = '#8e8e8e'
const border = '#dbdbdb'

// 从项目根目录的 image/MBTI人格形象图 扫描图片（无需放到 public/）
const MBTI_IMAGE_URLS = import.meta.glob('../../../../../image/MBTI人格形象图/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function resolveMbtiImageUrl(mbti: string): string {
  const key = (mbti || '').trim().toUpperCase()
  if (!key) return ''
  for (const [path, url] of Object.entries(MBTI_IMAGE_URLS)) {
    const name = path.split('/').pop() || ''
    if (name.toUpperCase().startsWith(key)) return url
  }
  return ''
}

/** 与「我的身份」列表一致：部分 MBTI 原图留白少，用略大缩放避免显得过小 */
function isLargeMbtiAvatar(mbti?: string) {
  const key = String(mbti || '').trim().toUpperCase()
  return key === 'ISFJ' || key === 'ENTJ'
}

const MBTI_SUMMARY_4: Record<string, string> = {
  INTJ: '冷静谋略',
  INTP: '理性求真',
  ENTJ: '强势统筹',
  ENTP: '机智破局',
  INFJ: '洞察引导',
  INFP: '温柔理想',
  ENFJ: '亲和领航',
  ENFP: '热情探索',
  ISTJ: '稳重守序',
  ISFJ: '细致守护',
  ESTJ: '务实管理',
  ESFJ: '体贴社交',
  ISTP: '冷静实干',
  ISFP: '随性艺感',
  ESTP: '果断冒险',
  ESFP: '外向享乐',
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ background: card }}>{children}</div>
}

function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 bg-white px-4" style={{ paddingTop: 'max(10px, env(safe-area-inset-top,0px))', paddingBottom: 10 }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-[#fafafa]">
          <ArrowLeft className="size-5" style={{ color: text }} />
        </button>
        <p className="text-[16px] font-semibold" style={{ color: text }}>
          {title}
        </p>
        <div className="min-w-[44px] text-right">{right}</div>
      </div>
    </div>
  )
}

function InlineDropdown({
  label,
  valueText,
  open,
  onToggle,
  children,
  disabled = false,
}: {
  label: string
  valueText: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        disabled={disabled}
        className="relative flex w-full items-center justify-center gap-1 rounded-xl border bg-white px-3 py-3 text-[15px] outline-none transition-all duration-200 ease-out disabled:opacity-60"
        style={{ borderColor: border, color: text }}
        onClick={onToggle}
        aria-label={label}
      >
        <span className="pointer-events-none select-none text-center">{valueText}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 transition-transform duration-200 ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          style={{ color: sub }}
        />
      </button>
      {open && !disabled && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4"
              onMouseDown={() => onToggle()}
            >
              <div
                className="w-full max-w-[520px] overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                style={{ borderColor: border }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: '#f0f0f0' }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold" style={{ color: text }}>
                      {label}
                    </p>
                    <p className="mt-0.5 truncate text-[12px]" style={{ color: sub, fontWeight: 300 }}>
                      {valueText}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl px-3 py-1.5 text-[12px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                    style={{ color: sub }}
                    onClick={() => onToggle()}
                  >
                    关闭
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {children}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function CenterDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-[520px] rounded-2xl border bg-white p-4" style={{ borderColor: border, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
        <p className="text-center text-[16px] font-semibold" style={{ color: text }}>
          {title}
        </p>
        <p className="mt-2 text-center text-[14px]" style={{ color: sub, fontWeight: 300 }}>
          {message}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border bg-white px-4 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
            style={{ borderColor: border, color: text }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
            style={{ background: '#000000' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

function PersonaWeChatContactModal({
  open,
  onClose,
  onDirect,
  onAi,
}: {
  open: boolean
  onClose: () => void
  onDirect: () => void | Promise<void>
  onAi: () => void | Promise<void>
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4">
      <div
        className="w-full max-w-[400px] rounded-2xl border bg-white p-4"
        style={{ borderColor: border, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[16px] font-semibold" style={{ color: text }}>
          生成微信通讯录联系人
        </p>
        <p className="mt-2 text-center text-[13px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
          将该主角及其人脉中的全部 NPC 一并加入微信通讯录。备注名优先使用已填写的微信昵称，否则使用角色姓名。
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void onDirect()}
            className="rounded-xl bg-[#111827] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out hover:bg-[#0b1220]"
          >
            直接生成
          </button>
          <button
            type="button"
            onClick={() => void onAi()}
            className="rounded-xl border bg-white py-3 text-[14px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
            style={{ borderColor: border, color: text }}
          >
            AI 生成资料
          </button>
          <button type="button" onClick={onClose} className="rounded-xl py-2 text-[13px]" style={{ color: sub }}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

function OpeningBiasModal({
  open,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean
  value: string
  onChange: (v: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[520px] rounded-2xl border bg-white p-4"
        style={{ borderColor: border, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[16px] font-semibold" style={{ color: text }}>
          开场白内容偏向
        </p>
        <p className="mt-2 text-center text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
          先描述你要的语气、关系进度、禁忌词或剧情方向，AI 会按这个偏向生成。
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          maxLength={300}
          placeholder="例：偏熟人、轻松调侃、别太油腻，不要问太多问题；第一句先打招呼，第二句带一点日常关心。"
          className="mt-3 w-full rounded-xl border bg-white px-3 py-3 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
          style={{ borderColor: border, color: text }}
        />
        <p className="mt-1 text-right text-[11px]" style={{ color: sub }}>
          {value.length}/300
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border bg-white px-4 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
            style={{ borderColor: border, color: text }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
            style={{ background: '#000000' }}
          >
            开始生成
          </button>
        </div>
      </div>
    </div>
  )
}

function AiGeneratingOverlay({ open, message }: { open: boolean; message: string }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-black/45 px-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="max-w-[320px] rounded-2xl border bg-white px-6 py-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
        style={{ borderColor: border }}
      >
        <p className="text-[15px] font-semibold" style={{ color: text }}>
          {message}
        </p>
        <p className="mt-2 text-[12px]" style={{ color: sub, fontWeight: 300 }}>
          请稍候，勿关闭页面
        </p>
      </div>
    </div>
  )
}

function IdentityPickModal({
  open,
  loading,
  identities,
  onClose,
  onPick,
  onCreateNew,
}: {
  open: boolean
  loading: boolean
  identities: PlayerIdentity[]
  onClose: () => void
  onPick: (identityId: string) => void
  onCreateNew: () => void
}) {
  if (!open) return null
  const hasAny = identities.length > 0
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-[400px] rounded-[16px] bg-white"
        style={{ background: '#ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5">
          <p className="text-center text-[18px] font-bold" style={{ color: '#000000' }}>
            选择你的身份
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
            aria-label="关闭"
          >
            <X className="size-5" style={{ color: '#666666' }} />
          </button>
        </div>

        <div className="px-5 pb-5 pt-4">
          {loading ? (
            <p className="py-6 text-center text-[14px]" style={{ color: '#666666' }}>
              加载中…
            </p>
          ) : !hasAny ? (
            <div className="py-6 text-center">
              <User className="mx-auto size-12" style={{ color: '#999999' }} strokeWidth={1.5} />
              <p className="mt-4 text-[16px] font-semibold" style={{ color: '#666666' }}>
                暂无身份
              </p>
              <p className="mt-2 text-[14px]" style={{ color: '#999999' }}>
                请先创建一个身份，以便角色更好地认识你
              </p>
              <button
                type="button"
                className="mt-5 w-full rounded-[12px] px-5 py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: '#000000' }}
                onClick={onCreateNew}
              >
                去创建身份
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {identities.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-[12px] border bg-white p-4"
                  style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <div className="h-[50px] w-[50px] shrink-0 overflow-hidden rounded-full border bg-white" style={{ borderColor: '#e5e5e5' }}>
                    {it.avatarUrl?.trim() ? (
                      <img
                        src={it.avatarUrl}
                        alt=""
                        className={`h-full w-full object-contain ${isLargeMbtiAvatar(it.mbti) ? 'scale-100' : 'scale-85'}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white">
                        <User className="size-6" style={{ color: '#999999' }} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold" style={{ color: '#000000' }}>
                      {it.name?.trim() || '未命名'}
                    </p>
                    <p className="mt-1 truncate text-[14px]" style={{ color: '#666666' }}>
                      {it.identity?.trim() || '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPick(it.id)}
                    className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
                    style={{ background: '#000000' }}
                  >
                    选择
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={onCreateNew}
                className="mt-1 w-full rounded-[12px] border bg-white px-5 py-3 text-[14px] font-semibold transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: '#e5e5e5', color: '#000000' }}
              >
                创建新身份
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function pickGenderLabel(g: Gender) {
  return g === 'male' ? '男' : g === 'female' ? '女' : '其他'
}

function parseHeightCm(raw: string): number | null {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return null
  const m = t.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  // 小于 3 视作米（如 1.72）
  const cm = n < 3 ? n * 100 : n
  if (cm < 80 || cm > 260) return null
  return cm
}

function parseWeightKg(raw: string): number | null {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return null
  const m = t.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const kg = Number(m[1])
  if (!Number.isFinite(kg) || kg <= 0 || kg < 20 || kg > 300) return null
  return kg
}

function bmiLevelLabel(bmi: number): { label: string; tone: string } {
  if (bmi < 18.5) return { label: '偏瘦', tone: '#3b82f6' }
  if (bmi < 24) return { label: '正常', tone: '#16a34a' }
  if (bmi < 28) return { label: '偏胖', tone: '#f59e0b' }
  return { label: '肥胖', tone: '#ef4444' }
}

function newCharacter(): Character {
  const now = Date.now()
  return {
    id: uid('ch'),
    createdAt: now,
    updatedAt: now,
    name: '',
    gender: 'female',
    age: null,
    height: '',
    weight: '',
    birthdayMD: '',
    zodiac: '',
    identity: '学生',
    mbti: '',
    bio: '',
    openingLines: '',
    avatarUrl: '',
    wechatNickname: '',
    wechatId: '',
    wechatSignature: '',
    wechatRegion: '',
    momentsCoverUrl: '',
    worldBooks: [],
    worldBackgroundId: DEFAULT_WORLD_BACKGROUND_ID,
    worldBackgroundEnabled: true,
    schedule: undefined,
  }
}

/** 导出文件名用：去掉 Windows 非法字符，避免下载失败 */
function safeExportNameSegment(name: string, fallback: string): string {
  const raw = (name || '').trim() || fallback
  return raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 96) || fallback
}

function toJsonDownload(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type PendingNewFriendRequest = FriendRequest

export function NewFriendsPersonaApp({
  onBack,
  onOpenIdentityManager,
  initialEditCharacterId,
  pendingRequests,
  onMarkRequestsRead,
  onResolveRequest,
  onReplyRequest,
  onTriggerReplyRequest,
  replyingRequestIds,
  entrySource,
}: {
  onBack: () => void
  onOpenIdentityManager?: () => void
  /** 从聊天设置「聊天设定」等入口直达某角色编辑页 */
  initialEditCharacterId?: string
  pendingRequests?: PendingNewFriendRequest[]
  onMarkRequestsRead?: () => void
  onResolveRequest?: (requestId: string, action: 'accepted' | 'declined') => void
  onReplyRequest?: (requestId: string, replyText: string) => void | Promise<void>
  onTriggerReplyRequest?: (requestId: string) => void | Promise<void>
  replyingRequestIds?: string[]
  entrySource?: 'contacts' | 'profile'
}) {
  const [page, setPage] = useState<
    | { name: 'list' }
    | { name: 'edit'; id: string; isNew: boolean; draft?: Character }
  >(() =>
    initialEditCharacterId?.trim()
      ? { name: 'edit', id: initialEditCharacterId.trim(), isNew: false }
      : { name: 'list' },
  )

  useEffect(() => {
    const id = initialEditCharacterId?.trim()
    if (!id) return
    setPage({ name: 'edit', id, isNew: false })
  }, [initialEditCharacterId])
  const [list, setList] = useState<Character[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [identityPickOpen, setIdentityPickOpen] = useState(false)
  const [identityList, setIdentityList] = useState<PlayerIdentity[]>([])
  const [identityNameById, setIdentityNameById] = useState<Record<string, string>>({})
  const [identityLoading, setIdentityLoading] = useState(false)
  const [pendingNewDraft, setPendingNewDraft] = useState<Character | null>(null)
  const [bindingsOpen, setBindingsOpen] = useState(false)
  const [contactGenRootId, setContactGenRootId] = useState<string | null>(null)
  const [aiGeneratingWechat, setAiGeneratingWechat] = useState(false)
  const [aiRemarkCandidates, setAiRemarkCandidates] = useState<Character[] | null>(null)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const requestRows = entrySource === 'contacts' ? (pendingRequests ?? []) : []
  const activeRequest = useMemo(() => requestRows.find((r) => r.id === activeRequestId) ?? null, [activeRequestId, requestRows])

  const { replaceWeChatPersonaContacts, removeWeChatPersonaContactsByCharacterIds } = useCustomization()
  const apiConfigList = useCurrentApiConfig('chatCard')

  const refresh = async () => {
    setLoading(true)
    const [res, ids] = await Promise.all([personaDb.listRootCharacters(), personaDb.listPlayerIdentities()])
    setList(res)
    setIdentityNameById(
      Object.fromEntries(
        ids.map((it) => [it.id, (it.name || '').trim() || '未命名身份']),
      ),
    )
    setLoading(false)
  }

  const refreshIdentities = async () => {
    setIdentityLoading(true)
    const res = await personaDb.listPlayerIdentities()
    setIdentityList(res)
    setIdentityLoading(false)
  }

  useEffect(() => {
    // 避免在 effect 同步触发 setState 的 lint 警告
    const t = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (page.name !== 'list') return
    if (!requestRows.some((r) => r.unread)) return
    onMarkRequestsRead?.()
  }, [onMarkRequestsRead, page.name, requestRows])

  const buildPersonaContactEntries = useCallback((chars: Character[]): WeChatPersonaContact[] => {
    return chars.map((ch) => ({
      id: `persona-${ch.id}`,
      characterId: ch.id,
      remarkName: (ch.remark?.trim() || ch.wechatNickname?.trim() || ch.name || '未命名').slice(0, 64),
      avatarUrl: ch.avatarUrl?.trim() || undefined,
      isStarred: !!ch.isStarred,
    }))
  }, [])

  const runDirectWechatContacts = useCallback(
    async (rootId: string) => {
      const root = await personaDb.getCharacter(rootId)
      if (!root) return
      const npcs = await personaDb.listNpcsFor(rootId)
      const all = [root, ...npcs]
      const ids = all.map((x) => x.id)
      replaceWeChatPersonaContacts(ids, buildPersonaContactEntries(all))
      setContactGenRootId(null)
    },
    [buildPersonaContactEntries, replaceWeChatPersonaContacts],
  )

  const runAiWechatContacts = useCallback(
    async (rootId: string) => {
      setContactGenRootId(null)
      setAiGeneratingWechat(true)
      try {
        const root = await personaDb.getCharacter(rootId)
        if (!root) throw new Error('角色不存在')
        const npcs = await personaDb.listNpcsFor(rootId)
        const all = [root, ...npcs]
        const rows = await generateWechatProfilesForPersonaCharacters({ apiConfig: apiConfigList, characters: all })
        const now = Date.now()
        for (const row of rows) {
          const ch = all.find((x) => x.id === row.characterId)
          if (!ch) continue
          await personaDb.upsertCharacter({
            ...ch,
            wechatNickname: row.wechatNickname,
            wechatSignature: row.wechatSignature,
            wechatId: row.wechatId,
            motto: ch.motto?.trim() ? ch.motto : (row.motto ?? ''),
            updatedAt: now,
          })
        }
        const ids = all.map((x) => x.id)
        const refreshed = await Promise.all(ids.map((id) => personaDb.getCharacter(id)))
        const nextChars = refreshed.filter((x): x is Character => !!x)
        replaceWeChatPersonaContacts(ids, buildPersonaContactEntries(nextChars))
        setAiRemarkCandidates(nextChars)
        await refresh()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '生成失败')
      } finally {
        setAiGeneratingWechat(false)
      }
    },
    [apiConfigList, buildPersonaContactEntries, refresh, replaceWeChatPersonaContacts],
  )

  if (page.name === 'list') {
    const fromContactsEntry = entrySource === 'contacts'
    if (fromContactsEntry) {
      return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
          <TopBar
            title="新的朋友"
            onBack={() => {
              if (activeRequestId) {
                setActiveRequestId(null)
                return
              }
              onBack()
            }}
          />
          <div className="min-h-0 flex-1">
            <AnimatePresence mode="wait">
              {activeRequest ? (
                <RequestDetail
                  key={`request-detail-${activeRequest.id}`}
                  request={activeRequest}
                  onBack={() => setActiveRequestId(null)}
                  onReply={(text) => onReplyRequest?.(activeRequest.id, text)}
                  onTriggerReply={() => onTriggerReplyRequest?.(activeRequest.id)}
                  isReplying={!!replyingRequestIds?.includes(activeRequest.id)}
                  onAccept={() => onResolveRequest?.(activeRequest.id, 'accepted')}
                  onDecline={() => onResolveRequest?.(activeRequest.id, 'declined')}
                />
              ) : (
                <div
                  key="request-list"
                  className="h-full min-h-0 overflow-y-auto px-4 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <NewFriendsList requests={requestRows} onOpenRequest={setActiveRequestId} />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )
    }
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden" style={{ background: bg }}>
        <TopBar title="角色人设" onBack={onBack} />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none px-4 pb-4 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <>
          <Card>
            <div className="border-b px-4 py-4" style={{ borderColor: border }}>
              <p className="text-[14px] font-medium" style={{ color: text }}>
                已创建角色
              </p>
              <p className="mt-1 text-[12px]" style={{ color: sub, fontWeight: 300 }}>
                数据存储在 IndexedDB，刷新不会丢失。
              </p>
            </div>
            {list.length ? (
              <div className="divide-y" style={{ borderColor: border }}>
                {list.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setPage({ name: 'edit', id: c.id, isNew: false })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left transition-all duration-200 ease-out hover:bg-[#fafafa] rounded-xl px-2 py-2 -mx-2"
                    >
                      {c.avatarUrl?.trim() ? (
                        <img
                          src={c.avatarUrl}
                          alt=""
                          className="h-12 w-12 rounded-full border object-cover"
                          style={{ borderColor: border }}
                        />
                      ) : (
                        <div
                          className="h-12 w-12 shrink-0 rounded-full border border-dashed bg-[#fafafa]"
                          style={{ borderColor: border }}
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium" style={{ color: text }}>
                          {c.name || '未命名'}
                        </p>
                        <p className="mt-1 truncate text-[12px]" style={{ color: sub, fontWeight: 300 }}>
                          {c.identity} · {pickGenderLabel(c.gender)} · {c.zodiac || '未设置生日'}
                        </p>
                        <p className="mt-1 truncate text-[12px]" style={{ color: sub, fontWeight: 300 }}>
                          绑定身份：
                          {(() => {
                            const bindId = c.playerIdentityId?.trim()
                            if (!bindId) return '未绑定'
                            return identityNameById[bindId] || '未命名身份'
                          })()}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setContactGenRootId(c.id)}
                        className="rounded-xl border bg-white p-2 transition-all duration-200 ease-out hover:bg-[#fafafa]"
                        style={{ borderColor: border, color: text }}
                        aria-label="生成联系人"
                        title="生成联系人"
                      >
                        <UserPlus className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(c.id)}
                        className="rounded-xl border bg-white p-2 transition-all duration-200 ease-out hover:bg-[#fafafa]"
                        style={{ borderColor: border, color: sub }}
                        aria-label="删除角色"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[14px] font-medium" style={{ color: text }}>
                  还没有角色
                </p>
                <p className="mt-2 text-[12px]" style={{ color: sub, fontWeight: 300 }}>
                  点击下方按钮创建第一个角色人设。
                </p>
              </div>
            )}
          </Card>

          <div className="mt-4">
            <Card>
              <div className="px-4 py-4">
                <p className="text-[14px] font-medium" style={{ color: text }}>
                  跨角色关系与身份绑定
                </p>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                  在已创建的角色（不含 NPC）之间添加有向关系；将「我的身份」与任意根角色手动绑定或解除。
                </p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl border bg-white py-3 text-[13px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
                  style={{ borderColor: border, color: text }}
                  onClick={() => setBindingsOpen(true)}
                >
                  管理关系与绑定
                </button>
              </div>
            </Card>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
              style={{ borderColor: border, color: text }}
              onClick={() => {
                void (async () => {
                  try {
                    const bundles = await Promise.all(list.map((c) => buildCharacterExportBundle(c)))
                    toJsonDownload(
                      {
                        kind: CHARACTER_BUNDLES_LIST_KIND,
                        version: 1,
                        exportedAt: Date.now(),
                        bundles,
                      },
                      `【Lumi Phone】-人设-全部.json`,
                    )
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : '导出失败')
                  }
                })()
              }}
              disabled={!list.length}
            >
              <Download className="size-4" />
              导出全部人设包
            </button>

            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
              style={{ borderColor: border, color: text }}
            >
              <Upload className="size-4" />
              导入人设包
              <input
                type="file"
                accept=".json,application/json,text/json"
                className="hidden"
                onChange={async (e) => {
                  const input = e.currentTarget
                  const f = input.files?.[0]
                  if (!f) return
                  try {
                    const raw = await f.text()
                    const parsed: unknown = JSON.parse(raw)
                    const bundles = parseCharacterImportFile(parsed)
                    if (!bundles?.length) {
                      window.alert('无法识别：请使用「完整人设包」JSON，或列表页导出的「全部人设包」。')
                      return
                    }
                    for (const b of bundles) {
                      await importCharacterBundle(b, 'overwrite')
                    }
                    await refresh()
                    window.alert(bundles.length > 1 ? `已导入 ${bundles.length} 个人设包。` : '导入成功。')
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : '导入失败')
                  } finally {
                    input.value = ''
                  }
                }}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
            导入会按文件里的角色 id 写入本地；已存在同 id 的条目会被包内数据替换。
          </p>

          {loading ? (
            <p className="mt-4 text-center text-[12px]" style={{ color: sub }}>
              加载中...
            </p>
          ) : null}
          </>
        </div>

        <div className="shrink-0 px-4 pt-2" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom,0px))' }}>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-[15px] font-semibold text-white transition-all duration-200 ease-out hover:bg-[#0b1220]"
            onClick={async () => {
              const c = newCharacter()
              setPendingNewDraft(c)
              setIdentityPickOpen(true)
              await refreshIdentities()
            }}
          >
            <Plus className="size-5" />
            新建角色人设
          </button>
        </div>

        <CenterDialog
          open={!!deleteId}
          title="删除角色？"
          message="将从 IndexedDB 中移除该角色及其全部世界书内容。此操作不可撤销。"
          confirmText="删除"
          onCancel={() => setDeleteId(null)}
          onConfirm={async () => {
            const id = deleteId
            setDeleteId(null)
            if (!id) return
            const npcs = await personaDb.listNpcsFor(id)
            removeWeChatPersonaContactsByCharacterIds([id, ...npcs.map((n) => n.id)])
            await personaDb.deleteCharacter(id)
            await refresh()
          }}
        />

        <PersonaWeChatContactModal
          open={!!contactGenRootId}
          onClose={() => setContactGenRootId(null)}
          onDirect={() => (contactGenRootId ? runDirectWechatContacts(contactGenRootId) : undefined)}
          onAi={() => (contactGenRootId ? runAiWechatContacts(contactGenRootId) : undefined)}
        />

        <AiGeneratingOverlay open={aiGeneratingWechat} message="正在生成微信资料…" />

        <CenterDialog
          open={!!aiRemarkCandidates?.length}
          title="一键注入备注？"
          message="可将本次生成的主角与 NPC 备注名统一写为各自真实姓名，方便快速分辨谁是谁。"
          confirmText="一键注入"
          cancelText="暂不"
          onCancel={() => setAiRemarkCandidates(null)}
          onConfirm={() => {
            void (async () => {
              const listForInject = aiRemarkCandidates ?? []
              setAiRemarkCandidates(null)
              if (!listForInject.length) return
              const now = Date.now()
              const injected = listForInject.map((ch) => ({
                ...ch,
                remark: (ch.name || '').trim().slice(0, 64),
                updatedAt: now,
              }))
              for (const ch of injected) {
                await personaDb.upsertCharacter(ch)
              }
              replaceWeChatPersonaContacts(
                injected.map((x) => x.id),
                buildPersonaContactEntries(injected),
              )
              await refresh()
            })()
          }}
        />

        {bindingsOpen ? (
          <PersonaBindingsManager
            onClose={() => setBindingsOpen(false)}
            onSaved={() => void refresh()}
          />
        ) : null}

        <IdentityPickModal
          open={identityPickOpen}
          loading={identityLoading}
          identities={identityList}
          onClose={() => {
            setIdentityPickOpen(false)
            setPendingNewDraft(null)
          }}
          onCreateNew={() => {
            setIdentityPickOpen(false)
            setPendingNewDraft(null)
            onOpenIdentityManager?.()
          }}
          onPick={async (identityId) => {
            const draft = { ...(pendingNewDraft ?? newCharacter()), playerIdentityId: identityId }
            await personaDb.setCurrentIdentityId(identityId)
            setIdentityPickOpen(false)
            setPendingNewDraft(null)
            // 仅创建草稿，不写入 IndexedDB；只有点击“保存”才会持久化
            setPage({ name: 'edit', id: draft.id, isNew: true, draft })
          }}
        />
      </div>
    )
  }

  return (
    <PersonaEditPage
      key={page.id}
      id={page.id}
      isNew={page.isNew}
      draft={page.draft}
      onBack={() => setPage({ name: 'list' })}
      onSaved={() => void refresh()}
      onNavigateToCharacter={(cid, draftNpc) => {
        if (draftNpc) setPage({ name: 'edit', id: draftNpc.id, isNew: true, draft: draftNpc })
        else setPage({ name: 'edit', id: cid, isNew: false })
      }}
      onBundleImported={async ({ rootId, replacePage }) => {
        await refresh()
        const root = await personaDb.getCharacter(rootId)
        if (root) {
          const npcs = await personaDb.listNpcsFor(rootId)
          replaceWeChatPersonaContacts(
            [rootId, ...npcs.map((n) => n.id)],
            buildPersonaContactEntries([root, ...npcs]),
          )
        }
        if (replacePage) setPage({ name: 'edit', id: rootId, isNew: false })
      }}
    />
  )
}

function PersonaEditPage({
  id,
  isNew,
  draft,
  onBack,
  onSaved,
  onNavigateToCharacter,
  onBundleImported,
}: {
  id: string
  isNew: boolean
  draft?: Character
  onBack: () => void
  onSaved: () => void
  onNavigateToCharacter: (characterId: string, draftNpc?: Character) => void
  onBundleImported?: (opts: { rootId: string; replacePage: boolean }) => void | Promise<void>
}) {
  const [data, setData] = useState<Character | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bioGenerating, setBioGenerating] = useState(false)
  const [openingGenerating, setOpeningGenerating] = useState(false)
  const [openingBiasOpen, setOpeningBiasOpen] = useState(false)
  const [openingBiasText, setOpeningBiasText] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [apiMissingOpen, setApiMissingOpen] = useState(false)
  const [apiMissingMsg, setApiMissingMsg] = useState('未配置 API')
  const [characterWbPrompt, setCharacterWbPrompt] = useState('')
  const [wbIdentityCtx, setWbIdentityCtx] = useState<PlayerIdentity | null>(null)
  const [linkedNpcsWbContext, setLinkedNpcsWbContext] = useState('')
  const [wbFlow, setWbFlow] = useState<null | 'pick' | { type: 'edit'; id?: string; cloneFromPresetId?: string }>(null)
  const [wbCardName, setWbCardName] = useState('现代都市')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const momentsCoverFileRef = useRef<HTMLInputElement | null>(null)
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null)
  const [momentsCoverCropSrc, setMomentsCoverCropSrc] = useState<string | null>(null)
  const apiConfig = useCurrentApiConfig('chatCard')
  const openApiSettings = () => {
    window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'api' } }))
  }
  const [monthOpen, setMonthOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [identityCustomOpen, setIdentityCustomOpen] = useState(false)
  const [mbtiOpen, setMbtiOpen] = useState(false)
  const [editTab, setEditTab] = useState<'basic' | 'opening' | 'wechat' | 'worldbook' | 'network' | 'schedule' | 'io'>('basic')
  const [ioExporting, setIoExporting] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    void (async () => {
      if (draft) {
        setData(draft)
        setDirty(false)
        return
      }
      const c = await personaDb.getCharacter(id)
      setData(c)
      setDirty(false)
    })()
  }, [draft, id])

  useEffect(() => {
    if (!data?.worldBackgroundId) return
    void personaDb.getWorldBackground(data.worldBackgroundId).then((w) => setWbCardName(w?.name ?? '现代都市'))
  }, [data?.worldBackgroundId])

  useEffect(() => {
    if (!data) return
    if (data.worldBackgroundEnabled === false) {
      setCharacterWbPrompt('')
      return
    }
    void personaDb.getWorldBackground(data.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID).then((w) =>
      setCharacterWbPrompt(formatWorldBackgroundForPrompt(w)),
    )
  }, [data?.id, data?.worldBackgroundId, data?.worldBackgroundEnabled])

  useEffect(() => {
    if (!data) return
    void (async () => {
      const ctx = data.playerIdentityId?.trim()
        ? await personaDb.getPlayerIdentity(data.playerIdentityId)
        : await personaDb.getCurrentIdentity()
      setWbIdentityCtx(ctx)
    })()
  }, [data?.id, data?.playerIdentityId])

  /** 世界书 AI：同人脉下 NPC 摘要（进入世界书 Tab 时拉取；从人脉返回后切回 Tab 会刷新） */
  useEffect(() => {
    if (!data?.id) {
      setLinkedNpcsWbContext('')
      return
    }
    if (editTab !== 'worldbook') return
    void (async () => {
      const parentId = data.generatedForCharacterId?.trim() || data.id
      try {
        const npcs = await personaDb.listNpcsFor(parentId)
        const others = npcs.filter((c) => c.id !== data.id)
        setLinkedNpcsWbContext(formatLinkedNpcsForWorldBookPrompt(others))
      } catch {
        setLinkedNpcsWbContext('')
      }
    })()
  }, [data?.id, data?.generatedForCharacterId, editTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset((prev) => (Math.abs(prev - inset) < 1 ? prev : inset))
    }
    updateInset()
    vv.addEventListener('resize', updateInset)
    vv.addEventListener('scroll', updateInset)
    window.addEventListener('orientationchange', updateInset)
    return () => {
      vv.removeEventListener('resize', updateInset)
      vv.removeEventListener('scroll', updateInset)
      window.removeEventListener('orientationchange', updateInset)
    }
  }, [])

  /** NPC 返回所属主角编辑页，主角返回人设列表（通讯录上一页） */
  const performBack = useCallback(async () => {
    let ch = data
    if (!ch) ch = await personaDb.getCharacter(id)
    const parentId = ch?.generatedForCharacterId
    if (parentId) onNavigateToCharacter(parentId)
    else onBack()
  }, [data, id, onBack, onNavigateToCharacter])

  const setField = <K extends keyof Character>(k: K, v: Character[K]) => {
    setDirty(true)
    setData((s) => (s ? { ...s, [k]: v, updatedAt: Date.now() } : s))
  }

  const syncMbtiPersonalityWorldBooks = (prev: Character, nextMbti: string): Character => {
    const now = Date.now()
    const k = normalizeMbti(nextMbti)
    const targetName = k ? getMbtiPersonalityWorldBookName(k) : ''
    const prevBooks = Array.isArray(prev.worldBooks) ? prev.worldBooks : []

    let foundTarget = false
    const nextBooks = prevBooks.map((w) => {
      if (!isMbtiPersonalityWorldBookName(w.name)) return w
      if (k && w.name === targetName) {
        foundTarget = true
        const hasEnabledContent = (w.items ?? []).some((it) => Boolean(it.enabled) && String(it.content || '').trim())
        if (!hasEnabledContent) {
          return {
            ...w,
            enabled: true,
            collapsed: true,
            items: buildMbtiPersonalityWorldBookItems(k, now),
          }
        }
        return { ...w, enabled: true }
      }
      // 非当前 MBTI 的“人格设定”册默认关闭，避免页面/提示词里混入多种人格。
      return { ...w, enabled: false }
    })

    const books = k && !foundTarget ? [buildMbtiPersonalityWorldBook(k, now), ...nextBooks] : nextBooks
    return { ...prev, mbti: nextMbti, worldBooks: books, updatedAt: now }
  }

  const birthdayParts = useMemo(() => {
    const v = data?.birthdayMD || ''
    const m = Number(v.slice(0, 2))
    const d = Number(v.slice(3, 5))
    return {
      month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1,
      day: Number.isFinite(d) && d >= 1 && d <= 31 ? d : 1,
    }
  }, [data?.birthdayMD])

  const bmiInfo = useMemo(() => {
    const hCm = parseHeightCm(data?.height ?? '')
    const wKg = parseWeightKg(data?.weight ?? '')
    if (!hCm || !wKg) return null
    const hM = hCm / 100
    const bmi = wKg / (hM * hM)
    if (!Number.isFinite(bmi)) return null
    const level = bmiLevelLabel(bmi)
    return { bmi, ...level }
  }, [data?.height, data?.weight])

  const MBTI_LIST = useMemo(
    () =>
      [
        'INTJ',
        'INTP',
        'ENTJ',
        'ENTP',
        'INFJ',
        'INFP',
        'ENFJ',
        'ENFP',
        'ISTJ',
        'ISFJ',
        'ESTJ',
        'ESFJ',
        'ISTP',
        'ISFP',
        'ESTP',
        'ESFP',
      ] as const,
    [],
  )

  const mbtiImageSrc = (mbti: string) => resolveMbtiImageUrl(mbti)

  const save = async () => {
    if (!data) return
    if (!data.name.trim()) return
    setSaving(true)
    // 仅新建角色时才使用“当前身份”兜底，避免编辑既有角色时被全局身份误覆盖。
    const identityId = data.playerIdentityId?.trim() || (isNew ? await personaDb.getCurrentIdentityId() : '')
    const next = { ...data, playerIdentityId: identityId || undefined, updatedAt: Date.now() }
    await personaDb.upsertCharacter(next)
    if (isNew && next.generatedForCharacterId) {
      const parentId = next.generatedForCharacterId
      const inNet = await personaDb.listRelationshipsInNetwork([parentId, next.id])
      const hasAB = inNet.some((r) => r.fromCharacterId === parentId && r.toCharacterId === next.id)
      const hasBA = inNet.some((r) => r.fromCharacterId === next.id && r.toCharacterId === parentId)
      const extras: Relationship[] = []
      if (!hasAB) {
        extras.push({
          id: uid('rel'),
          fromCharacterId: parentId,
          toCharacterId: next.id,
          relation: '认识',
          fromPerspective: '',
          toPerspective: '',
        })
      }
      if (!hasBA) {
        extras.push({
          id: uid('rel'),
          fromCharacterId: next.id,
          toCharacterId: parentId,
          relation: '认识',
          fromPerspective: '',
          toPerspective: '',
        })
      }
      if (extras.length) await personaDb.bulkPutRelationships(extras)
    }
    if (identityId) {
      const identity = await personaDb.getPlayerIdentity(identityId)
      await personaDb.upsertPlayerIdentityBindings({
        identityId,
        characterId: next.id,
        identityName: identity?.name || '你',
        characterName: next.name || '角色',
      })
    }
    setSaving(false)
    setDirty(false)
    onSaved()
    void performBack()
  }

  const persistSchedule = async (next: ScheduleTable) => {
    if (!data) return
    const merged: Character = { ...data, schedule: next, updatedAt: Date.now() }
    setDirty(true)
    setData(merged)
    await personaDb.upsertCharacter(merged)
  }

  const onPickAvatarFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setAvatarCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const onPickMomentsCoverFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setMomentsCoverCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const runGenerateOpening = async () => {
    try {
      setOpeningGenerating(true)
      if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
        setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
        setApiMissingOpen(true)
        return
      }
      if (!data) return
      const identityContext =
        data.playerIdentityId && data.playerIdentityId.trim()
          ? await personaDb.getPlayerIdentity(data.playerIdentityId)
          : await personaDb.getCurrentIdentity()
      const wbRow =
        data.worldBackgroundEnabled === false
          ? null
          : await personaDb.getWorldBackground(data.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID)
      const worldBackgroundPrompt = formatWorldBackgroundForPrompt(wbRow)
      const v = await generateCharacterOpeningLines({
        apiConfig,
        character: data,
        identityContext,
        worldBackgroundPrompt,
        contentBias: openingBiasText,
      })
      const cleaned = v
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
        .join('\n')
      setField('openingLines', cleaned)
    } catch (e) {
      if (e instanceof Error && /未配置 AI API/i.test(e.message)) {
        setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
        setApiMissingOpen(true)
      }
    } finally {
      setOpeningGenerating(false)
    }
  }

  if (!data) {
    return (
      <div className="h-full min-h-0" style={{ background: bg }}>
        <TopBar title="人设编辑" onBack={() => void performBack()} />
        <p className="p-4 text-[13px]" style={{ color: sub }}>
          加载中...
        </p>
      </div>
    )
  }

  if (wbFlow === 'pick') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden" style={{ background: '#f5f5f5' }}>
        <WorldBackgroundPickerPage
          selectedId={data.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID}
          onBack={() => setWbFlow(null)}
          onUse={(wid) => {
            setField('worldBackgroundId', wid)
            setWbFlow(null)
          }}
          onNew={() => setWbFlow({ type: 'edit' })}
          onEdit={(wid) => setWbFlow({ type: 'edit', id: wid })}
          onCloneFromPreset={(presetId) => setWbFlow({ type: 'edit', cloneFromPresetId: presetId })}
        />
      </div>
    )
  }

  if (wbFlow?.type === 'edit') {
    return (
      <div className="relative h-full min-h-0 overflow-hidden" style={{ background: '#f5f5f5' }}>
        <WorldBackgroundEditPage
          editingId={wbFlow.id}
          cloneFromPresetId={wbFlow.cloneFromPresetId}
          onBack={() => setWbFlow('pick')}
          onSaved={() => {
            setWbFlow('pick')
            void personaDb.getWorldBackground(data.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID).then((w) =>
              setWbCardName(w?.name ?? '现代都市'),
            )
          }}
        />
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden" style={{ background: bg }}>
      <TopBar
        title={isNew ? '创建人设' : '编辑人设'}
        onBack={() => {
          if (!dirty) void performBack()
          else setConfirmLeave(true)
        }}
        right={
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
            style={{ color: text }}
            disabled={saving}
          >
            <span className="inline-flex items-center gap-2">
              <Save className="size-4" />
              {saving ? '保存中' : '保存'}
            </span>
          </button>
        }
      />

      <div
        className="h-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none px-4 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{
          paddingBottom: `calc(96px + env(safe-area-inset-bottom,0px) + ${Math.round(keyboardInset)}px + ${editTab === 'worldbook' ? 88 : 0}px)`,
        }}
      >
        <Card>
          <div className="px-3 py-3">
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { id: 'basic' as const, label: '基础信息' },
                  { id: 'opening' as const, label: '开场白' },
                  { id: 'wechat' as const, label: '微信资料' },
                  { id: 'worldbook' as const, label: '世界书' },
                  { id: 'network' as const, label: '人脉关系' },
                  { id: 'schedule' as const, label: '日程表' },
                  { id: 'io' as const, label: '导入导出' },
                ] as const
              )
                .filter((t) => {
                  if (!data.generatedForCharacterId) return true
                  // NPC：不支持人脉关系；日程表仍可编辑并作为聊天参考
                  return t.id !== 'network'
                })
                .map((t) => {
                const active = editTab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditTab(t.id)}
                    className="shrink-0 rounded-xl border px-3 py-2 text-[13px] transition-all duration-200 ease-out"
                    style={{
                      borderColor: border,
                      background: active ? '#111827' : '#ffffff',
                      color: active ? '#ffffff' : text,
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        <div className="mt-4 rounded-[12px] border bg-white px-4 py-4" style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[16px] text-black">世界背景</p>
            <button
              type="button"
              role="switch"
              aria-checked={data.worldBackgroundEnabled !== false}
              onClick={() => setField('worldBackgroundEnabled', !(data.worldBackgroundEnabled !== false))}
              className={`relative h-7 w-[46px] rounded-full p-1 transition-colors ${
                data.worldBackgroundEnabled !== false ? 'bg-black' : 'bg-[#cccccc]'
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                  data.worldBackgroundEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (data.worldBackgroundEnabled === false) return
              setWbFlow('pick')
            }}
            disabled={data.worldBackgroundEnabled === false}
            className="flex w-full items-center rounded-[10px] border bg-white px-3 py-3 text-left transition-all duration-200 ease-out hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: '#e5e5e5' }}
          >
            <Globe className="size-5 shrink-0 text-black" strokeWidth={1.75} aria-hidden />
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-[14px] text-black">当前世界背景</p>
              <p className="mt-0.5 truncate text-[13px] text-[#666666]">{wbCardName}</p>
            </div>
            <ChevronRight className="ml-3 size-4 shrink-0 text-[#666666]" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="mt-4" />

        {isNew && data.generatedForCharacterId ? (
          <p
            className="mb-3 rounded-[12px] border px-3 py-2.5 text-[12px] leading-relaxed"
            style={{ borderColor: '#e5e5e5', background: '#fafafa', color: sub }}
          >
            手动新建的 NPC 在点击「保存」之前
            <span className="font-semibold" style={{ color: text }}>
              不会
            </span>
            出现在人脉 NPC 列表中。若已填写内容后返回，将提示是否放弃未保存的修改。
          </p>
        ) : null}

        {editTab === 'basic' ? (
          <Card>
          <div className="border-b px-4 py-4" style={{ borderColor: border }}>
            <p className="text-[14px] font-semibold" style={{ color: text }}>
              基础信息
            </p>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="flex items-center gap-3">
              {data.avatarUrl?.trim() ? (
                <img
                  src={data.avatarUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full border object-cover"
                  style={{ borderColor: border }}
                />
              ) : (
                <div
                  className="h-16 w-16 shrink-0 rounded-full border border-dashed bg-[#fafafa]"
                  style={{ borderColor: border }}
                  aria-hidden
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                  style={{ borderColor: border, color: text }}
                  onClick={() => fileRef.current?.click()}
                >
                  上传头像
                </button>
                {data.avatarUrl?.trim() ? (
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                    style={{ borderColor: border, color: sub }}
                    onClick={() => setField('avatarUrl', '')}
                  >
                    清除
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onPickAvatarFile(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            <label className="block">
              <p className="text-[13px]" style={{ color: sub }}>
                姓名
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={data.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="输入姓名"
                  className="flex-1 rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
                <button
                  type="button"
                  className="rounded-xl border bg-white p-3 transition-all duration-200 ease-out hover:bg-[#fafafa]"
                  style={{ borderColor: border, color: text }}
                  onClick={() => setField('name', randomChineseName(data.gender))}
                  title="骰子随机"
                >
                  <Dice5 className="size-5" />
                </button>
              </div>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setField('gender', g)}
                  className="rounded-xl border px-3 py-2 text-[13px] transition-all duration-200 ease-out"
                  style={{
                    borderColor: border,
                    background: data.gender === g ? '#f3f4f6' : '#fff',
                    color: text,
                  }}
                >
                  {pickGenderLabel(g)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  年龄
                </p>
                <input
                  value={data.age ?? ''}
                  onChange={(e) => setField('age', e.target.value ? Number(e.target.value) : null)}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
              </label>
              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  身高
                </p>
                <input
                  value={data.height ?? ''}
                  onChange={(e) => setField('height', e.target.value)}
                  placeholder="如 170cm"
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  体重
                </p>
                <input
                  value={data.weight ?? ''}
                  onChange={(e) => setField('weight', e.target.value)}
                  placeholder="如 55kg"
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
              </label>
              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  生日（月/日，自动星座）
                </p>
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <InlineDropdown
                    label="选择月份"
                    valueText={`${birthdayParts.month} 月`}
                    open={monthOpen}
                    onToggle={() => {
                      setMonthOpen((v) => !v)
                      setDayOpen(false)
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const active = birthdayParts.month === m
                      return (
                        <button
                          key={m}
                          type="button"
                          className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                          style={{
                            color: active ? '#ffffff' : text,
                            background: active ? '#111827' : 'transparent',
                          }}
                          onClick={() => {
                            const maxD = daysInMonth(m)
                            const d = Math.min(birthdayParts.day, maxD)
                            const md = formatMD(m, d)
                            setField('birthdayMD', md)
                            setField('zodiac', zodiacFromMD(md))
                            setMonthOpen(false)
                          }}
                        >
                          {m} 月
                        </button>
                      )
                    })}
                  </InlineDropdown>

                  <InlineDropdown
                    label="选择日期"
                    valueText={`${birthdayParts.day} 日`}
                    open={dayOpen}
                    onToggle={() => {
                      setDayOpen((v) => !v)
                      setMonthOpen(false)
                    }}
                  >
                    {Array.from({ length: daysInMonth(birthdayParts.month) }, (_, i) => i + 1).map((d) => {
                      const active = birthdayParts.day === d
                      return (
                        <button
                          key={d}
                          type="button"
                          className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                          style={{
                            color: active ? '#ffffff' : text,
                            background: active ? '#111827' : 'transparent',
                          }}
                          onClick={() => {
                            const md = formatMD(birthdayParts.month, d)
                            setField('birthdayMD', md)
                            setField('zodiac', zodiacFromMD(md))
                            setDayOpen(false)
                          }}
                        >
                          {d} 日
                        </button>
                      )
                    })}
                  </InlineDropdown>
                </div>
                {data.zodiac ? (
                  <p className="mt-1 text-[12px]" style={{ color: sub }}>
                    星座：{data.zodiac}
                  </p>
                ) : null}
              </label>
            </div>

            <div
              className="rounded-xl border bg-[#fafafa] px-3 py-3"
              style={{ borderColor: border }}
            >
              <p className="text-[13px] font-medium" style={{ color: text }}>
                BMI 身材参考
              </p>
              {bmiInfo ? (
                <p className="mt-1 text-[12px]" style={{ color: sub }}>
                  BMI：
                  <span className="font-semibold" style={{ color: text }}>
                    {' '}
                    {bmiInfo.bmi.toFixed(1)}
                  </span>
                  {' · '}
                  <span className="font-semibold" style={{ color: bmiInfo.tone }}>
                    {bmiInfo.label}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-[12px]" style={{ color: sub }}>
                  请填写有效的身高和体重（如 170cm、55kg）以自动计算。
                </p>
              )}
              <p className="mt-1 text-[11px]" style={{ color: sub, fontWeight: 300 }}>
                分级：&lt;18.5 偏瘦，18.5~23.9 正常，24~27.9 偏胖，≥28 肥胖。
              </p>
            </div>

            <label className="block">
              <p className="text-[13px]" style={{ color: sub }}>
                座右铭（可选）
              </p>
              <input
                value={data.motto ?? ''}
                onChange={(e) => setField('motto', e.target.value)}
                placeholder="最多15字；留空可在 AI 生成资料时自动生成"
                maxLength={15}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                style={{ borderColor: border, color: text }}
              />
              <p className="mt-1 text-[11px]" style={{ color: sub }}>
                {(data.motto ?? '').length}/15
              </p>
            </label>

            <label className="block">
              <p className="text-[13px]" style={{ color: sub }}>
                身份
              </p>
              <div className="mt-2">
                <InlineDropdown
                  label="选择身份"
                  valueText={data.identity || '请选择'}
                  open={identityOpen}
                  onToggle={() => {
                    setIdentityOpen((v) => !v)
                    if (!identityOpen) {
                      // 展开时默认不强制打开自定义输入
                      setIdentityCustomOpen(false)
                    }
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                    style={{
                      color: identityCustomOpen ? '#ffffff' : text,
                      background: identityCustomOpen ? '#111827' : 'transparent',
                    }}
                    onClick={() => {
                      setIdentityCustomOpen(true)
                    }}
                  >
                    自定义…
                  </button>
                  {identityCustomOpen ? (
                    <div className="px-3 py-2">
                      <input
                        value={data.identity}
                        onChange={(e) => setField('identity', e.target.value)}
                        className="w-full rounded-xl border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                        style={{ borderColor: border, color: text }}
                        placeholder="输入自定义身份"
                        autoFocus
                      />
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="rounded-xl border bg-white px-3 py-2 text-[12px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                          style={{ borderColor: border, color: text }}
                          onClick={() => {
                            setIdentityCustomOpen(false)
                          }}
                        >
                          收起输入
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-[#111827] px-3 py-2 text-[12px] font-semibold text-white transition-all duration-200 ease-out hover:bg-[#0b1220]"
                          onClick={() => {
                            setIdentityOpen(false)
                            setIdentityCustomOpen(false)
                          }}
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="my-1 h-px bg-black/5" />
                  {IDENTITY_POOL.map((x) => {
                    const active = data.identity === x && !identityCustomOpen
                    return (
                      <button
                        key={x}
                        type="button"
                        className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                        style={{
                          color: active ? '#ffffff' : text,
                          background: active ? '#111827' : 'transparent',
                        }}
                        onClick={() => {
                          setField('identity', x)
                          setIdentityOpen(false)
                          setIdentityCustomOpen(false)
                        }}
                      >
                        <span className="truncate">{x}</span>
                      </button>
                    )
                  })}
                </InlineDropdown>
              </div>
            </label>

            <label className="block">
              <p className="text-[13px]" style={{ color: sub }}>
                MBTI（可选）
              </p>
              <div className="mt-2">
                <InlineDropdown
                  label="选择 MBTI"
                  valueText={data.mbti?.trim() ? data.mbti : '未选择'}
                  open={mbtiOpen}
                  onToggle={() => setMbtiOpen((v) => !v)}
                >
                  <div className="grid grid-cols-2 gap-2 px-3 py-2">
                    {MBTI_LIST.map((m) => {
                      const active = data.mbti === m
                      const big = m === 'ENTJ' || m === 'ESFJ'
                      return (
                        <button
                          key={m}
                          type="button"
                          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out"
                          style={{
                            borderColor: border,
                            background: active ? '#111827' : '#ffffff',
                            color: active ? '#ffffff' : text,
                          }}
                          onClick={() => {
                            if (!data) return
                            setDirty(true)
                            setData((prev) => (prev ? syncMbtiPersonalityWorldBooks(prev, m) : prev))
                            setMbtiOpen(false)
                          }}
                        >
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
                            <img
                              src={mbtiImageSrc(m)}
                              alt=""
                              className={`${big ? 'h-9 w-9' : 'h-[36px] w-[36px]'} border object-contain`}
                              style={{ borderColor: active ? 'rgba(255,255,255,0.25)' : border }}
                              onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold">{m}</p>
                            <p className="mt-0.5 text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.72)' : sub }}>
                              {MBTI_SUMMARY_4[m] ?? '人格概括'}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="px-3 pb-2">
                    <button
                      type="button"
                      className="w-full rounded-xl border bg-white px-3 py-2 text-[12px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                      style={{ borderColor: border, color: sub }}
                      onClick={() => {
                        if (!data) return
                        setDirty(true)
                        setData((prev) => (prev ? syncMbtiPersonalityWorldBooks(prev, '') : prev))
                        setMbtiOpen(false)
                      }}
                    >
                      清空选择
                    </button>
                  </div>
                </InlineDropdown>
              </div>
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <p className="text-[13px]" style={{ color: sub }}>
                  角色简介（可选）
                </p>
                <button
                  type="button"
                  className="rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                  style={{ borderColor: border, color: text }}
                  disabled={bioGenerating}
                  onClick={async () => {
                    try {
                      setBioGenerating(true)
                      if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
                        setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
                        setApiMissingOpen(true)
                        return
                      }
                      const identityContext =
                        data.playerIdentityId && data.playerIdentityId.trim()
                          ? await personaDb.getPlayerIdentity(data.playerIdentityId)
                          : await personaDb.getCurrentIdentity()
                      const wbRow =
                        data.worldBackgroundEnabled === false
                          ? null
                          : await personaDb.getWorldBackground(data.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID)
                      const worldBackgroundPrompt = formatWorldBackgroundForPrompt(wbRow)
                      const v = await generateCharacterBio({
                        apiConfig,
                        character: data,
                        identityContext,
                        worldBackgroundPrompt,
                      })
                      setField('bio', v)
                    } catch (e) {
                      if (e instanceof Error && /缺少世界书内容/i.test(e.message)) {
                        setApiMissingMsg('请先在下方“世界书”中填写条目内容（并保持世界书/条目为开启），再生成角色简介。')
                        setApiMissingOpen(true)
                      } else if (e instanceof Error && /未配置 AI API/i.test(e.message)) {
                        setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
                        setApiMissingOpen(true)
                      }
                    } finally {
                      setBioGenerating(false)
                    }
                  }}
                >
                  {bioGenerating ? '生成中…' : 'AI 生成'}
                </button>
              </div>
              <textarea
                value={data.bio ?? ''}
                onChange={(e) => setField('bio', e.target.value)}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[14px] leading-relaxed outline-none transition-all duration-200 ease-out"
                style={{ borderColor: border, color: text }}
                rows={4}
                placeholder="约120~180字"
              />
            </label>

          </div>
          </Card>
        ) : null}

        {editTab === 'opening' ? (
          <Card>
            <div className="border-b px-4 py-4" style={{ borderColor: border }}>
              <p className="text-[14px] font-semibold" style={{ color: text }}>
                开场白
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                角色首次进入聊天且无历史消息时，会按行自动发送开场白（每行一个气泡）。
              </p>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block">
                <div className="flex items-center justify-between">
                  <p className="text-[13px]" style={{ color: sub }}>
                    开场白（角色侧）
                  </p>
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                    style={{ borderColor: border, color: text }}
                    disabled={openingGenerating}
                    onClick={() => setOpeningBiasOpen(true)}
                  >
                    {openingGenerating ? '生成中…' : 'AI 生成'}
                  </button>
                </div>
                <textarea
                  value={data.openingLines ?? ''}
                  onChange={(e) => setField('openingLines', e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[14px] leading-relaxed outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                  rows={5}
                  placeholder={'每行一个气泡消息。\n按一次回车就是一条消息。'}
                />
                <p className="mt-1 text-[11px]" style={{ color: sub }}>
                  每回车一次即一条气泡；首次进入聊天且无历史消息时会自动按行发送。
                </p>
              </label>

              <div className="rounded-xl border bg-[#fafafa] px-3 py-3" style={{ borderColor: border }}>
                <p className="text-[13px] font-medium" style={{ color: text }}>
                  开场白预览
                </p>
                <div className="mt-2 space-y-2">
                  {(data.openingLines || '')
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((line, idx) => (
                      <div key={`${idx}-${line}`} className="flex justify-start">
                        <div
                          className="max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed"
                          style={{ background: '#ffffff', border: `1px solid ${border}`, color: text }}
                        >
                          {line}
                        </div>
                      </div>
                    ))}
                  {!String(data.openingLines || '').trim() ? (
                    <p className="text-[12px]" style={{ color: sub }}>
                      暂无开场白内容。可手动填写，或点击上方 AI 生成。
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {editTab === 'wechat' ? (
          <Card>
            <div className="border-b px-4 py-4" style={{ borderColor: border }}>
              <p className="text-[14px] font-semibold" style={{ color: text }}>
                微信资料
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                昵称、微信号、个性签名与朋友圈封面将用于微信内对该角色的展示（若后续界面已接入）。
              </p>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  微信昵称
                </p>
                <input
                  value={data.wechatNickname ?? ''}
                  onChange={(e) => setField('wechatNickname', e.target.value)}
                  placeholder="展示在微信里的昵称"
                  maxLength={32}
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
                <p className="mt-1 text-[11px]" style={{ color: sub }}>
                  {(data.wechatNickname ?? '').length}/32 · 留空时可由「姓名」兜底（若界面支持）
                </p>
              </label>

              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  微信号
                </p>
                <input
                  value={data.wechatId ?? ''}
                  onChange={(e) => setField('wechatId', e.target.value)}
                  placeholder="字母、数字、下划线等，仅作展示"
                  maxLength={32}
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
                <p className="mt-1 text-[11px]" style={{ color: sub }}>
                  {(data.wechatId ?? '').length}/32
                </p>
              </label>

              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  个性签名
                </p>
                <textarea
                  value={data.wechatSignature ?? ''}
                  onChange={(e) => setField('wechatSignature', e.target.value)}
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[14px] leading-relaxed outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                  rows={3}
                  placeholder="展示在资料卡下方的一行简介"
                  maxLength={120}
                />
                <p className="mt-1 text-[11px]" style={{ color: sub }}>
                  {(data.wechatSignature ?? '').length}/120
                </p>
              </label>

              <label className="block">
                <p className="text-[13px]" style={{ color: sub }}>
                  地区
                </p>
                <input
                  value={data.wechatRegion ?? ''}
                  onChange={(e) => setField('wechatRegion', e.target.value)}
                  placeholder=""
                  maxLength={32}
                  className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: border, color: text }}
                />
                <p className="mt-1 text-[11px]" style={{ color: sub }}>
                  {(data.wechatRegion ?? '').length}/32 · 留空则资料卡地区显示为空
                </p>
              </label>

              <div>
                <p className="text-[13px]" style={{ color: sub }}>
                  朋友圈背景图
                </p>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                  可填写图片链接，或本地上传并在 1:1 裁剪后保存为本地图。
                </p>
                <label className="mt-3 block">
                  <p className="text-[12px] font-medium" style={{ color: sub }}>
                    图片地址（URL）
                  </p>
                  <input
                    value={data.momentsCoverUrl?.startsWith('data:') ? '' : (data.momentsCoverUrl ?? '')}
                    onChange={(e) => setField('momentsCoverUrl', e.target.value)}
                    placeholder="https://… 粘贴图片链接；与下方本地上传二选一，会互相覆盖"
                    className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-[13px] outline-none transition-all duration-200 ease-out"
                    style={{ borderColor: border, color: text }}
                  />
                  <p className="mt-1 text-[11px]" style={{ color: sub }}>
                    当前为本地裁剪图时输入框留空；填写 URL 会替换为链接图；清除后可重新上传。
                  </p>
                </label>
                <div
                  className="mx-auto mt-3 max-w-[220px] overflow-hidden rounded-xl border bg-[#f5f5f5]"
                  style={{ borderColor: border, aspectRatio: '1 / 1' }}
                >
                  {data.momentsCoverUrl?.trim() ? (
                    <img
                      src={data.momentsCoverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center text-[13px]" style={{ color: sub }}>
                      暂无背景
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                    style={{ borderColor: border, color: text }}
                    onClick={() => momentsCoverFileRef.current?.click()}
                  >
                    上传并裁剪（1:1）
                  </button>
                  {data.momentsCoverUrl?.trim() ? (
                    <button
                      type="button"
                      className="rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                      style={{ borderColor: border, color: sub }}
                      onClick={() => setField('momentsCoverUrl', '')}
                    >
                      清除
                    </button>
                  ) : null}
                  <input
                    ref={momentsCoverFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      onPickMomentsCoverFile(e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {editTab === 'worldbook' ? (
          <WorldBooksEditor
            apiConfig={apiConfig}
            character={data}
            forPlayerIdentity={false}
            worldBackgroundPrompt={characterWbPrompt}
            identityContext={wbIdentityCtx}
            linkedNpcsContext={linkedNpcsWbContext}
            onChange={(next: Character) => {
              setDirty(true)
              setData(next)
            }}
          />
        ) : null}

        {editTab === 'network' && !data.generatedForCharacterId ? (
          <PersonaNetworkSection
            main={data}
            apiConfig={apiConfig}
            onApiMissing={() => {
              setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
              setApiMissingOpen(true)
            }}
            onOpenNpcEdit={onNavigateToCharacter}
          />
        ) : null}

        {editTab === 'network' && data.generatedForCharacterId ? (
          <Card>
            <div className="px-4 py-5 text-[13px]" style={{ color: sub }}>
              NPC 角色不支持生成人脉关系，请在主角角色中查看和编辑。
            </div>
          </Card>
        ) : null}

        {editTab === 'schedule' ? (
          <Card>
            <div className="border-b px-4 py-4" style={{ borderColor: border }}>
              <p className="text-[14px] font-semibold" style={{ color: text }}>
                日程表
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                保存后会自动加入 AI 聊天回复参考（与长期记忆同优先级）。
              </p>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]" style={{ color: text }}>
                    {data.schedule?.name?.trim() || '未设置'}
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: sub }}>
                    {data.schedule ? `表头 ${data.schedule.headers.length} 列 · ${data.schedule.rows.length} 行` : '点击编辑，选择模板或自定义创建'}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl border bg-white px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
                  style={{ borderColor: border, color: text }}
                  onClick={() => setScheduleOpen(true)}
                >
                  编辑
                </button>
              </div>
            </div>
          </Card>
        ) : null}

        {editTab === 'io' ? (
          <Card>
          <div className="border-b px-4 py-4" style={{ borderColor: border }}>
            <p className="text-[14px] font-semibold" style={{ color: text }}>
              导入 / 导出
            </p>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
              导出为完整人设包：基础与微信资料、世界书、所选世界背景（含地图与时间线）、人脉 NPC、角色间关系、与该主角相关的「我的身份」绑定、人脉图画布与「你」的连线词。不含微信聊天记录与长期记忆。从
              NPC 页导出会带上所属主角与整个人脉圈。导入仅支持本应用导出的完整包 JSON；写入时按包内角色 id 覆盖本地同 id 数据。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-4">
            <button
              type="button"
              disabled={ioExporting}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa] disabled:opacity-60"
              style={{ borderColor: border, color: text }}
              onClick={() => {
                void (async () => {
                  setIoExporting(true)
                  try {
                    const payload = await buildCharacterExportBundle(data)
                    toJsonDownload(
                      payload,
                      `【Lumi Phone】-人设-${safeExportNameSegment(payload.mainCharacter.name, '未命名')}.json`,
                    )
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : '导出失败')
                  } finally {
                    setIoExporting(false)
                  }
                })()
              }}
            >
              <Download className="size-4" />
              {ioExporting ? '导出中…' : '导出完整包'}
            </button>
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
              style={{ borderColor: border, color: text }}
            >
              <Upload className="size-4" />
              导入人设包
              <input
                type="file"
                accept=".json,application/json,text/json"
                className="hidden"
                onChange={(e) => {
                  const input = e.currentTarget
                  void (async () => {
                    const f = input.files?.[0]
                    if (!f) {
                      input.value = ''
                      return
                    }
                    if (!data) {
                      window.alert('数据尚未加载完成，请稍后再试。')
                      input.value = ''
                      return
                    }
                    try {
                      const raw = await f.text()
                      const parsed: unknown = JSON.parse(raw)
                      const bundles = parseCharacterImportFile(parsed)
                      if (!bundles?.length) {
                        window.alert('无法识别：请导入本页或列表页导出的「完整人设包」JSON（单包文件）。')
                        return
                      }
                      if (bundles.length > 1) {
                        window.alert('此处请一次只选一个完整人设包；多个包请在人设列表页导入「全部人设包」文件。')
                        return
                      }
                      const result = await importCharacterBundle(bundles[0], 'overwrite')
                      const importedRoot = result.rootId
                      const myRoot = data.generatedForCharacterId?.trim() || data.id
                      if (importedRoot === myRoot) {
                        const row = await personaDb.getCharacter(id)
                        if (row) {
                          setData(row)
                          setDirty(false)
                        }
                      } else {
                        onNavigateToCharacter(importedRoot)
                      }
                      await onBundleImported?.({ rootId: importedRoot, replacePage: false })
                      window.alert('导入成功。')
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : '导入失败')
                    } finally {
                      input.value = ''
                    }
                  })()
                }}
              />
            </label>
          </div>
          </Card>
        ) : null}
      </div>

      <CenterDialog
        open={confirmLeave}
        title="放弃未保存更改？"
        message={
          isNew && data?.generatedForCharacterId
            ? '此 NPC 尚未保存到人脉列表。返回将丢弃已填写的人设与世界书等修改。'
            : '你有未保存的修改。返回将丢失本次更改。'
        }
        confirmText="放弃"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false)
          void performBack()
        }}
      />

      <CenterDialog
        open={apiMissingOpen}
        title="未配置 API"
        message={apiMissingMsg}
        confirmText="去配置"
        cancelText="知道了"
        onCancel={() => setApiMissingOpen(false)}
        onConfirm={() => {
          setApiMissingOpen(false)
          openApiSettings()
        }}
      />

      <ImageCropperModal
        open={!!avatarCropSrc}
        imageSrc={avatarCropSrc ?? ''}
        title="裁剪头像（1:1）"
        aspect={1}
        maxSide={512}
        objectFit="contain"
        onCancel={() => setAvatarCropSrc(null)}
        onConfirm={(dataUrl) => {
          setField('avatarUrl', dataUrl)
          setAvatarCropSrc(null)
        }}
      />

      <ImageCropperModal
        open={!!momentsCoverCropSrc}
        imageSrc={momentsCoverCropSrc ?? ''}
        title="裁剪朋友圈背景（1:1）"
        aspect={1}
        maxSide={1200}
        objectFit="contain"
        onCancel={() => setMomentsCoverCropSrc(null)}
        onConfirm={(dataUrl) => {
          setField('momentsCoverUrl', dataUrl)
          setMomentsCoverCropSrc(null)
        }}
      />

      <ScheduleEditorScreen
        open={scheduleOpen}
        title="日程表"
        apiConfig={apiConfig}
        initial={(data?.schedule as ScheduleTable | undefined) ?? null}
        onClose={() => setScheduleOpen(false)}
        onSave={async (next) => {
          await persistSchedule(next)
        }}
      />

      <AiGeneratingOverlay open={bioGenerating} message="正在生成角色简介…" />
      <AiGeneratingOverlay open={openingGenerating} message="正在生成开场白…" />

      <OpeningBiasModal
        open={openingBiasOpen}
        value={openingBiasText}
        onChange={setOpeningBiasText}
        onClose={() => setOpeningBiasOpen(false)}
        onConfirm={() => {
          setOpeningBiasOpen(false)
          void runGenerateOpening()
        }}
      />
    </div>
  )
}

export default NewFriendsPersonaApp

