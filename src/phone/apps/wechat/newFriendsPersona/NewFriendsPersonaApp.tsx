import { ArrowLeft, Plus, Save, Trash2, User, UserPlus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emitWeChatStorageChanged, personaDb } from './idb'
import type { Character, PlayerIdentity, Relationship } from './types'
import { genderLabelZh, uid } from './utils'
import { formatLinkedNpcsForWorldBookPrompt, generateCharacterOpeningLines, generateWechatProfilesForPersonaCharacters } from './ai'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { useCustomization } from '../../../CustomizationContext'
import type { WeChatPersonaContact } from '../../../types'
import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { PersonaNetworkSection } from './PersonaNetworkSection'
import { PersonaBindingsManager } from './PersonaBindingsManager'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import type { ScheduleTable } from './types'
import { ScheduleEditorScreen } from '../schedule/ScheduleEditorScreen'
import { buildCharacterExportBundle, importCharacterBundle, parseCharacterImportFile } from './characterBundleIo'
import { formatWorldBackgroundForPrompt } from './worldBackgroundFormat'
import { WorldBackgroundEditPage, WorldBackgroundPickerPage } from './WorldBackgroundScreens'
import type { FriendRequest } from './friendRequestTypes'
import { NewFriendsPage } from './NewFriendsPage'
import { RequestDetail } from './RequestDetail'
import {
  buildMbtiPersonalityWorldBook,
  buildMbtiPersonalityWorldBookItems,
  getMbtiPersonalityWorldBookName,
  isMbtiPersonalityWorldBookName,
  normalizeMbti,
} from '../mbtiPersonalityWorldBook'
import { isLargeMbtiAvatar } from './mbtiProfileUi'
import { useWechatStore } from '../useWechatStore'
import {
  backfillCharacterPlayerIdentityLinkMeta,
  buildIdentityDisplayNameMapForCharacters,
  repairCharacterSlotPrimaryBindingFromLinked,
} from '../wechatCharacterPlayerIdentity'
import {
  formatWechatAccountLabel,
  resolvePlayerIdentityWechatAccountId,
} from '../wechatContactIdentityPrompt'
import { loadAccountsBundle } from '../wechatAccountPersistence'
import { deleteCharacterPersonaForWechatAccount } from '../wechatCharacterPersonaDelete'
import {
  collectCanonicalIdsPreservedAcrossAccounts,
  expandCanonicalIdSet,
  resolveCanonicalCharacterId,
} from '../wechatGlobalCharacterRegistry'
import { normalizeAccountsBundle, WECHAT_ACCOUNTS_BUNDLE_KV_KEY } from '../wechatAccountTypes'
import {
  characterAccessibleToWechatAccount,
  characterBelongsToWechatAccount,
  stampWechatAccountOwner,
} from '../wechatAccountScope'
import { ArchiveIndexTabs } from './personaEditor/ArchiveIndexTabs'
import type { PersonaEditTabId } from './personaEditor/personaEditorTabs'
import { BasicInfoTab } from './personaEditor/BasicInfoTab'
import { BindingsInfoTab } from './personaEditor/BindingsInfoTab'
import { ConnectionsTab } from './personaEditor/ConnectionsTab'
import { DataTransferTab } from './personaEditor/DataTransferTab'
import { FirstMessageTab } from './personaEditor/FirstMessageTab'
import { ScheduleTimelineTab } from './personaEditor/ScheduleTimelineTab'
import { WeChatProfileTab } from './personaEditor/WeChatProfileTab'
import { WorldBackgroundTab } from './personaEditor/WorldBackgroundTab'
import {
  consolidateMeetCharacterWorldBooks,
  meetWorldbooksNeedConsolidation,
} from '../../lumiMeet/meetWorldbookConsolidate'
import { WorldbookTab } from './personaEditor/WorldbookTab'

const bg = '#f5f5f5'
const card = '#ffffff'
const text = '#262626'
const sub = '#8e8e8e'
const border = '#dbdbdb'

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ background: card }}>{children}</div>
}

/** 人脉「你↔主角」所在根：主角本人为 id，NPC 为 generatedForCharacterId */
function networkRootCharacterId(ch: Pick<Character, 'id' | 'generatedForCharacterId'>): string {
  return (ch.generatedForCharacterId || ch.id).trim()
}

function TopBar({
  title,
  onBack,
  right,
  /** 与档案 Tab 等同列一层 sticky 时：外层已处理 safe-area，此处不再重复 padding-top / sticky */
  embedInStickyShell,
}: {
  title: string
  onBack: () => void
  right?: React.ReactNode
  embedInStickyShell?: boolean
}) {
  return (
    <div
      className={`${embedInStickyShell ? '' : 'sticky top-0 z-30 '}bg-white px-4`}
      style={{
        paddingTop: embedInStickyShell ? 0 : 'max(10px, env(safe-area-inset-top,0px))',
        paddingBottom: 10,
      }}
    >
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

/** iOS / iPadOS Safari：大 JSON 用 `<a download>` + blob: 极易整页被系统干掉或 OOM，须走 share + 紧凑序列化 */
function isLikelyIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!iOS) return false
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPT\//i.test(ua)
}

/** 移动设备导出：跳过多余 pretty-print，降低 stringify 内存峰值 */
function prefersCompactExportSerialization(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true
  return false
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, prefersCompactExportSerialization() ? 48 : 0)
    })
  })
}

/**
 * 大包若再 pretty-print，会多占一份字符串内存，部分 WebView 易 OOM；小包仍格式化为可读缩进。
 * `forceCompact`：移动 / 大导出时强制单行 JSON，避免 parse+stringify 第二份大串。
 */
function serializeCharacterExportJson(obj: unknown, opts?: { forceCompact?: boolean }): string {
  let compact = ''
  try {
    compact = JSON.stringify(obj)
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : '导出数据无法序列化')
  }
  if (opts?.forceCompact) return compact
  const maxPrettyLen = Math.floor(1.25 * 1024 * 1024)
  if (compact.length > maxPrettyLen) return compact
  try {
    return JSON.stringify(JSON.parse(compact), null, 2)
  } catch {
    return compact
  }
}

/** 用户勾选「加时间戳」时在主文件名与 .json 之间插入，避免静默 (1)(2) 式重命名 */
function applyExportFilenameTimestamp(baseName: string): string {
  const t = baseName.trim()
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  const m = t.match(/^(.+)(\.json)$/i)
  if (m) return `${m[1]}_${stamp}${m[2]}`
  return `${t}_${stamp}.json`
}

function sanitizeExportFilenameInput(raw: string): string {
  const s = raw.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  if (!s) return 'export.json'
  return /\.json$/i.test(s) ? s : `${s}.json`
}

type FilePickerJsonResult = 'saved' | 'aborted' | 'unavailable'

async function trySaveJsonWithFilePicker(json: string, suggestedName: string): Promise<FilePickerJsonResult> {
  const w = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string
      types?: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<FileSystemFileHandle>
  }
  if (!window.isSecureContext || typeof w.showSaveFilePicker !== 'function') return 'unavailable'
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: sanitizeExportFilenameInput(suggestedName),
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(new Blob([json], { type: 'application/json;charset=utf-8' }))
    await writable.close()
    return 'saved'
  } catch (e) {
    const nm = (e as { name?: string }).name
    if (nm === 'AbortError') return 'aborted'
    return 'unavailable'
  }
}

/**
 * 桌面 Chrome/Edge：优先「另存为」，选同名文件时由系统询问是否替换（不会静默追加 (1)）。
 * 其它环境：分享 / `<a download>` 兜底。
 */
async function exportCharacterJsonToDisk(json: string, filename: string): Promise<void> {
  const name = sanitizeExportFilenameInput(filename)
  const pick = await trySaveJsonWithFilePicker(json, name)
  if (pick === 'saved' || pick === 'aborted') return

  const file = new File([json], name, { type: 'application/json', lastModified: Date.now() })
  await saveExportedCharacterFile(file)
}

/**
 * 必须由「真实的用户点击」触发（弹窗内按钮）；不可放在无手势的 await 之后单独调 share。
 * iOS Safari：优先 `navigator.share(files)`，避免 blob 下载导致标签页卸载 / 崩溃。
 */
async function saveExportedCharacterFile(file: File): Promise<void> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
  }
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    // 勿传 title/text/url：iOS 会把 title 当成第二份「纯文本」一起分享，存盘后多出一个 .txt
    const data: ShareData = { files: [file] }
    let can = false
    try {
      can = nav.canShare(data)
    } catch {
      can = false
    }
    if (can) {
      try {
        await nav.share(data)
        return
      } catch (e) {
        const err = e as { name?: string }
        if (err?.name === 'AbortError') return
      }
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const a = document.createElement('a')
    a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px'
    a.rel = 'noopener'
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    URL.revokeObjectURL(url)
    window.alert('无法保存文件。若在 iPhone/iPad 上，请再试一次并选用「分享」面板里的「存储到文件」。')
  }
}

function PersonaExportSaveDialog({
  open,
  suggestedName,
  draftName,
  addTimestamp,
  onDraftChange,
  onAddTimestampChange,
  onCancel,
  onConfirm,
}: {
  open: boolean
  suggestedName: string
  draftName: string
  addTimestamp: boolean
  onDraftChange: (v: string) => void
  onAddTimestampChange: (checked: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  const ios = isLikelyIosSafari()
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4">
      <div
        className="w-full max-w-[520px] rounded-2xl border bg-white p-4"
        style={{ borderColor: border, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
      >
        <p className="text-center text-[16px] font-semibold" style={{ color: text }}>
          人设包已生成
        </p>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
          {ios
            ? '请确认文件名后保存。iOS 无法在网页里检测「文件」App 是否已有同名；若同名请在存储时于系统中选择替换或改名。'
            : '支持「另存为」的浏览器（如 Chrome / Edge）会先打开保存对话框：若选到同名文件，系统会询问是否替换，不会静默改成「(1).json」。其它浏览器将尝试分享或下载。'}
        </p>
        <label className="mt-3 block text-[12px] font-medium" style={{ color: text }}>
          文件名
        </label>
        <input
          type="text"
          value={draftName}
          onChange={(e) => onDraftChange(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-[14px] outline-none ring-black/10 focus:ring-2"
          style={{ borderColor: border, color: text }}
          autoComplete="off"
          spellCheck={false}
        />
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]" style={{ color: text }}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={addTimestamp}
            onChange={(e) => onAddTimestampChange(e.target.checked)}
          />
          <span style={{ fontWeight: 300, color: sub }}>
            在文件名中加入时间戳（另存为新文件，避免与已有 JSON 同名）。不勾选则使用上方文件名，由你在保存步骤里自行处理是否替换。
          </span>
        </label>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
          默认名：{suggestedName}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
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
            {ios ? '分享 / 存储' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export type PendingNewFriendRequest = FriendRequest

export function NewFriendsPersonaApp({
  onBack,
  onOpenIdentityManager,
  initialEditCharacterId,
  initialActiveRequestId,
  onInitialActiveRequestConsumed,
  pendingRequests,
  onMarkRequestsRead,
  onResolveRequest,
  onReplyRequest,
  onTriggerReplyRequest,
  onRetryAdjudication,
  replyingRequestIds,
  onSendTempChat,
  tempChatReplyingIds,
  entrySource,
}: {
  onBack: () => void
  onOpenIdentityManager?: () => void
  /** 从聊天设置「聊天设定」等入口直达某角色编辑页 */
  initialEditCharacterId?: string
  /** 添加朋友发送成功后直达该条验证详情 */
  initialActiveRequestId?: string
  onInitialActiveRequestConsumed?: () => void
  pendingRequests?: PendingNewFriendRequest[]
  onMarkRequestsRead?: () => void
  onResolveRequest?: (requestId: string, action: 'accepted' | 'declined') => void
  onReplyRequest?: (requestId: string, replyText: string) => void | Promise<void>
  onTriggerReplyRequest?: (requestId: string) => void | Promise<void>
  /** 用户主动申请：强制重跑裁决（清卡死 in-flight） */
  onRetryAdjudication?: (requestId: string) => void | Promise<void>
  replyingRequestIds?: string[]
  onSendTempChat?: (requestId: string, text: string) => void | Promise<void>
  tempChatReplyingIds?: string[]
  entrySource?: 'contacts' | 'profile' | 'dating'
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
  const [deleteTargetDetachHint, setDeleteTargetDetachHint] = useState<string | null>(null)
  const [identityPickOpen, setIdentityPickOpen] = useState(false)
  const [identityList, setIdentityList] = useState<PlayerIdentity[]>([])
  const [identityNameById, setIdentityNameById] = useState<Record<string, string>>({})
  const [accountsBundle, setAccountsBundle] = useState<Awaited<ReturnType<typeof loadAccountsBundle>>>(null)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [pendingNewDraft, setPendingNewDraft] = useState<Character | null>(null)
  const [bindingsOpen, setBindingsOpen] = useState(false)
  const [contactGenRootId, setContactGenRootId] = useState<string | null>(null)
  const [aiGeneratingWechat, setAiGeneratingWechat] = useState(false)
  const [aiRemarkCandidates, setAiRemarkCandidates] = useState<Character[] | null>(null)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const requestRows = entrySource === 'contacts' ? (pendingRequests ?? []) : []
  const activeRequest = useMemo(() => requestRows.find((r) => r.id === activeRequestId) ?? null, [activeRequestId, requestRows])

  useEffect(() => {
    const id = initialActiveRequestId?.trim()
    if (!id || entrySource !== 'contacts') return
    setActiveRequestId(id)
    onInitialActiveRequestConsumed?.()
  }, [entrySource, initialActiveRequestId, onInitialActiveRequestConsumed])

  const { state, replaceWeChatPersonaContacts, removeWeChatPersonaContactsByCharacterIds } = useCustomization()
  const { currentAccountId, setActivePlayerIdentityForCurrentAccount } = useWechatStore()

  const linkedCharacterIds = useMemo(
    () => state.wechatPersonaContacts.map((c) => c.characterId.trim()).filter(Boolean),
    [state.wechatPersonaContacts],
  )
  const linkedCharacterIdSet = useMemo(() => new Set(linkedCharacterIds), [linkedCharacterIds])
  const apiConfigList = useCurrentApiConfig('chatCard')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const acc = currentAccountId?.trim()
      if (!acc) {
        setList([])
        setIdentityNameById({})
        return
      }
      let res = await personaDb.listRootCharactersAccessibleToWechatAccount(acc, linkedCharacterIds)
      let repaired = false
      for (const c of res) {
        if (await repairCharacterSlotPrimaryBindingFromLinked(c.id)) repaired = true
        if (await backfillCharacterPlayerIdentityLinkMeta(c.id)) repaired = true
      }
      if (repaired) {
        res = await personaDb.listRootCharactersAccessibleToWechatAccount(acc, linkedCharacterIds)
      }
      setList(res)
      setIdentityNameById(await buildIdentityDisplayNameMapForCharacters(acc, res))
      setAccountsBundle(await loadAccountsBundle())
    } catch (e) {
      console.warn('[persona] list refresh failed', e)
      window.alert(e instanceof Error ? e.message : '加载角色列表失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [currentAccountId, linkedCharacterIds])

  const refreshIdentities = async () => {
    setIdentityLoading(true)
    const res = await personaDb.listPlayerIdentities(currentAccountId ?? undefined)
    setIdentityList(res)
    setIdentityLoading(false)
  }

  /** 每次进入「角色人设」列表页重新拉取；避开紧跟大导出后的瞬时峰值内存（requestIdleCallback / 短时延迟） */
  useEffect(() => {
    if (page.name !== 'list') return
    let canceled = false
    const run = () => {
      if (!canceled) void refresh()
    }
    let idleId: number | undefined
    let timerId: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 1800 })
    } else {
      timerId = window.setTimeout(run, 150)
    }
    return () => {
      canceled = true
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timerId != null) window.clearTimeout(timerId)
    }
  }, [page.name, refresh])

  /** 进入通讯录「新的朋友」列表：清除被拒红点，并将待处理验证会话标为已读 */
  useEffect(() => {
    if (entrySource !== 'contacts' || page.name !== 'list') return
    onMarkRequestsRead?.()
  }, [entrySource, onMarkRequestsRead, page.name])

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
      const acc = currentAccountId?.trim()
      const root = await personaDb.getCharacter(rootId)
      if (!root || !acc || !characterAccessibleToWechatAccount(root, acc, linkedCharacterIdSet)) return
      const npcs = await personaDb.listNpcsForAccessibleRoot(rootId, acc, linkedCharacterIds)
      const all = [root, ...npcs]
      const ids = all.map((x) => x.id)
      replaceWeChatPersonaContacts(ids, buildPersonaContactEntries(all))
      setContactGenRootId(null)
    },
    [buildPersonaContactEntries, currentAccountId, linkedCharacterIdSet, linkedCharacterIds, replaceWeChatPersonaContacts],
  )

  const runAiWechatContacts = useCallback(
    async (rootId: string) => {
      setContactGenRootId(null)
      setAiGeneratingWechat(true)
      try {
        const acc = currentAccountId?.trim()
        const root = await personaDb.getCharacter(rootId)
        if (!root || !acc || !characterAccessibleToWechatAccount(root, acc, linkedCharacterIdSet)) {
          throw new Error('角色不存在')
        }
        const npcs = await personaDb.listNpcsForAccessibleRoot(rootId, acc, linkedCharacterIds)
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
    [
      apiConfigList,
      buildPersonaContactEntries,
      currentAccountId,
      linkedCharacterIdSet,
      linkedCharacterIds,
      refresh,
      replaceWeChatPersonaContacts,
    ],
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
                  userInitiated={activeRequest.direction === 'outbound' || !!activeRequest.userInitiated}
                  onRetryAdjudication={() =>
                    (onRetryAdjudication ?? onTriggerReplyRequest)?.(activeRequest.id)
                  }
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
                  <NewFriendsPage
                    requests={requestRows}
                    replyingRequestIds={replyingRequestIds}
                    tempChatReplyingIds={tempChatReplyingIds}
                    onRetryRequest={(id) => onTriggerReplyRequest?.(id)}
                    onSendTempChat={onSendTempChat}
                    onOpenRequest={(id) => setActiveRequestId(id)}
                  />
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
                          {c.identity} · {genderLabelZh(c.gender)} · {c.zodiac || '未设置生日'}
                        </p>
                        <p className="mt-1 truncate text-[12px]" style={{ color: sub, fontWeight: 300 }}>
                          {(() => {
                            const bindId = c.playerIdentityId?.trim()
                            const primaryLabel = !bindId
                              ? '未绑定'
                              : identityNameById[bindId] || '未命名身份'
                            const linked = (c.linkedPlayerIdentityIds ?? []).filter(
                              (id) => id?.trim() && id.trim() !== bindId,
                            )
                            const primaryAcc = bindId
                              ? resolvePlayerIdentityWechatAccountId(
                                  c,
                                  bindId,
                                  identityList.find((i) => i.id === bindId),
                                )
                              : ''
                            const primaryAccLabel = primaryAcc
                              ? formatWechatAccountLabel(accountsBundle, primaryAcc)
                              : ''
                            const linkedSuffix = linked.length
                              ? ` · 关联马甲：${linked
                                  .map((id) => {
                                    const name = identityNameById[id.trim()] || '未命名'
                                    const la = resolvePlayerIdentityWechatAccountId(
                                      c,
                                      id.trim(),
                                      identityList.find((i) => i.id === id.trim()),
                                    )
                                    const accLabel = la
                                      ? formatWechatAccountLabel(accountsBundle, la)
                                      : ''
                                    return accLabel ? `${name}·${accLabel}` : name
                                  })
                                  .slice(0, 2)
                                  .join('、')}${linked.length > 2 ? '…' : ''}`
                              : ''
                            const primaryWithAcc = primaryAccLabel
                              ? `${primaryLabel}·${primaryAccLabel}`
                              : primaryLabel
                            return `档案主绑定：${primaryWithAcc}${linkedSuffix}`
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
                        onClick={() => {
                          void (async () => {
                            const acc = currentAccountId?.trim()
                            if (!acc) {
                              setDeleteTargetDetachHint(null)
                              setDeleteId(c.id)
                              return
                            }
                            const canonical = (await resolveCanonicalCharacterId(c.id)) || c.id
                            const ch = await personaDb.getCharacter(canonical)
                            const bundle = normalizeAccountsBundle(
                              await personaDb.getPhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY),
                            )
                            const preserved = bundle
                              ? await expandCanonicalIdSet(
                                  collectCanonicalIdsPreservedAcrossAccounts(bundle, acc),
                                )
                              : new Set<string>()
                            const ownedHere = ch ? characterBelongsToWechatAccount(ch, acc) : false
                            const usedElsewhere = preserved.has(canonical)
                            setDeleteTargetDetachHint(
                              usedElsewhere || !ownedHere
                                ? '该角色可能在其它微信账号中仍在使用。确认后仅从当前账号移除联系人、本号聊天记录与本号可见的人设；其它马甲上的同一角色档案与共享长期记忆将保留。'
                                : null,
                            )
                            setDeleteId(c.id)
                          })()
                        }}
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
          message={
            deleteTargetDetachHint ??
            '将从本微信账号移除该角色人设、世界书及本号聊天记录。若其它马甲仍保留该角色，则不会删除共享档案。此操作不可撤销。'
          }
          confirmText="删除"
          onCancel={() => {
            setDeleteId(null)
            setDeleteTargetDetachHint(null)
          }}
          onConfirm={async () => {
            const id = deleteId
            setDeleteId(null)
            setDeleteTargetDetachHint(null)
            if (!id) return
            try {
              const acc = currentAccountId?.trim()
              if (!acc) {
                window.alert('请先选择微信账号')
                return
              }
              const npcs = await personaDb.listNpcsForWechatAccount(id, acc)
              removeWeChatPersonaContactsByCharacterIds([id, ...npcs.map((n) => n.id)])
              const mode = await deleteCharacterPersonaForWechatAccount({
                characterId: id,
                wechatAccountId: acc,
              })
              setList((prev) => prev.filter((c) => c.id !== id))
              await refresh()
              if (mode === 'detached-from-account') {
                window.alert(
                  '已从当前微信账号移除该角色与本号聊天记录；其它马甲若仍保留该角色，其档案与记忆不受影响。',
                )
              }
            } catch (e) {
              window.alert(e instanceof Error ? e.message : '删除失败')
              await refresh()
            }
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
              // 关键：注入备注时只改 remark，始终保留最新微信资料（尤其 wechatNickname）。
              const injected: Character[] = []
              for (const seed of listForInject) {
                const latest = (await personaDb.getCharacter(seed.id)) || seed
                injected.push({
                  ...latest,
                  remark: (latest.name || '').trim().slice(0, 64),
                  updatedAt: now,
                })
              }
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
            const base = { ...(pendingNewDraft ?? newCharacter()), playerIdentityId: identityId }
            const draft = currentAccountId ? stampWechatAccountOwner(base, currentAccountId) : base
            await setActivePlayerIdentityForCurrentAccount(identityId)
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
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
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
  const [editTab, setEditTab] = useState<PersonaEditTabId>('basic')
  const [ioExporting, setIoExporting] = useState(false)
  /** JSON 只放 ref；另存为弹窗里确认文件名后再写入磁盘 */
  const [exportSaveDialog, setExportSaveDialog] = useState<{ suggested: string } | null>(null)
  const [exportFilenameDraft, setExportFilenameDraft] = useState('')
  const [exportAddTimestamp, setExportAddTimestamp] = useState(false)
  const pendingExportJsonRef = useRef<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  /** 主角在剧情/人脉中对用户的称呼（PlayerNetworkLink.theyCallYou，characterId = 根主角 id） */
  const [protagonistCallsUser, setProtagonistCallsUser] = useState('')
  const protagonistCallsTouchedRef = useRef(false)
  const { currentAccountId } = useWechatStore()
  const { state: phoneState } = useCustomization()
  const linkedCharacterIdSet = useMemo(
    () => new Set(phoneState.wechatPersonaContacts.map((c) => c.characterId.trim()).filter(Boolean)),
    [phoneState.wechatPersonaContacts],
  )

  useEffect(() => {
    void (async () => {
      if (draft) {
        setData(
          currentAccountId && !draft.wechatAccountId?.trim()
            ? stampWechatAccountOwner(draft, currentAccountId)
            : draft,
        )
        setDirty(false)
        protagonistCallsTouchedRef.current = false
        return
      }
      const acc = currentAccountId?.trim()
      let c = await personaDb.getCharacter(id)
      if (c && acc && !characterAccessibleToWechatAccount(c, acc, linkedCharacterIdSet)) {
        c = null
      }
      if (c && meetWorldbooksNeedConsolidation(c.id, c.worldBooks ?? [])) {
        const worldBooks = consolidateMeetCharacterWorldBooks(c.id, c.worldBooks ?? [])
        c = { ...c, worldBooks, updatedAt: Date.now() }
        await personaDb.upsertCharacter(c)
        emitWeChatStorageChanged()
      }
      setData(c)
      setDirty(false)
      protagonistCallsTouchedRef.current = false
    })()
  }, [currentAccountId, draft, id])

  /** 遇见结业等路径会直接写 IndexedDB；本页无未保存修改时同步拉取，避免世界书分册与档案法则预览不一致 */
  useEffect(() => {
    if (isNew || draft) return
    const sid = id.trim()
    if (!sid) return
    const onStorage = () => {
      void (async () => {
        if (dirtyRef.current) return
        try {
          let fresh = await personaDb.getCharacter(sid)
          const acc = currentAccountId?.trim()
          if (fresh && acc && !characterAccessibleToWechatAccount(fresh, acc, linkedCharacterIdSet)) fresh = null
          if (fresh && meetWorldbooksNeedConsolidation(fresh.id, fresh.worldBooks ?? [])) {
            const worldBooks = consolidateMeetCharacterWorldBooks(fresh.id, fresh.worldBooks ?? [])
            fresh = { ...fresh, worldBooks, updatedAt: Date.now() }
            await personaDb.upsertCharacter(fresh)
          }
          if (fresh) setData(fresh)
        } catch {
          /* ignore */
        }
      })()
    }
    window.addEventListener('wechat-storage-changed', onStorage as EventListener)
    return () => window.removeEventListener('wechat-storage-changed', onStorage as EventListener)
  }, [currentAccountId, id, isNew, draft, linkedCharacterIdSet])

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
      const acc = currentAccountId?.trim() || data.wechatAccountId?.trim()
      try {
        const npcs = acc
          ? await personaDb.listNpcsForWechatAccount(parentId, acc)
          : await personaDb.listNpcsFor(parentId)
        const others = npcs.filter((c) => c.id !== data.id)
        setLinkedNpcsWbContext(formatLinkedNpcsForWorldBookPrompt(others))
      } catch {
        setLinkedNpcsWbContext('')
      }
    })()
  }, [data?.id, data?.generatedForCharacterId, editTab])

  /** NPC 人设无「人脉」索引：若停留在人脉 Tab 则回到基础信息 */
  useEffect(() => {
    if (data?.generatedForCharacterId && editTab === 'network') {
      setEditTab('basic')
    }
  }, [data?.generatedForCharacterId, editTab])

  /** 从人脉同步「主角→用户」称呼；切回基础信息时刷新（人脉页可能已改过）；未改写过本字段时不覆盖本地输入 */
  useEffect(() => {
    if (!data?.id || editTab !== 'basic') return
    if (protagonistCallsTouchedRef.current) return
    const rootId = networkRootCharacterId(data)
    if (!rootId) return
    void (async () => {
      try {
        const links = await personaDb.getPlayerNetworkLinks(rootId)
        const link = links.find((l) => l.characterId === rootId)
        setProtagonistCallsUser(link?.theyCallYou ?? '')
      } catch {
        setProtagonistCallsUser('')
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

  const patchCharacter = useCallback((p: Partial<Character>) => {
    setDirty(true)
    setData((s) => (s ? { ...s, ...p, updatedAt: Date.now() } : s))
  }, [])

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

  const save = async () => {
    if (!data) return
    if (!data.name.trim()) return
    const acc = currentAccountId?.trim()
    if (!acc) {
      window.alert('请先登录微信账号后再保存人设')
      return
    }
    setSaving(true)
    // 仅新建角色时才使用“当前身份”兜底，避免编辑既有角色时被全局身份误覆盖。
    const identityId = data.playerIdentityId?.trim() || (isNew ? await personaDb.getCurrentIdentityId() : '')
    const next = stampWechatAccountOwner(
      { ...data, playerIdentityId: identityId || undefined, updatedAt: Date.now() },
      acc,
    )
    await personaDb.upsertCharacter(next)
    const rootId = networkRootCharacterId(next)
    if (rootId) {
      const links = await personaDb.getPlayerNetworkLinks(rootId)
      const idx = links.findIndex((l) => l.characterId === rootId)
      const trimmedCalls = protagonistCallsUser.trim()
      if (idx >= 0) {
        const merged = [...links]
        merged[idx] = { ...merged[idx], theyCallYou: trimmedCalls }
        await personaDb.putPlayerNetworkLinks(rootId, merged)
      } else {
        await personaDb.putPlayerNetworkLinks(rootId, [
          ...links,
          {
            id: uid('pl'),
            characterId: rootId,
            relationYouToThem: '',
            relationThemToYou: '',
            youSeeThem: '',
            theySeeYou: '',
            youCallThem: '',
            theyCallYou: trimmedCalls,
          },
        ])
      }
      protagonistCallsTouchedRef.current = false
    }
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
          fromCallsTo: '',
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
          fromCallsTo: '',
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
    const acc = currentAccountId?.trim()
    const merged: Character = stampWechatAccountOwner(
      { ...data, schedule: next, updatedAt: Date.now() },
      acc,
    )
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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden" style={{ background: bg }}>
      {/*
        iOS PWA 全屏：safe-area-inset-top 只能加一次。原先 TopBar + ArchiveIndexTabs 各加一遍，
        会在标题与 Tab 之间叠出「第二道刘海高度」的空白；合并为单层 sticky 后只保留一处顶距。
      */}
      <div
        className="sticky top-0 z-40 shrink-0 bg-white"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <TopBar
          embedInStickyShell
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

        <ArchiveIndexTabs
          activeId={editTab}
          onChange={setEditTab}
          hideNetwork={!!data.generatedForCharacterId}
        />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none px-3 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{
          paddingBottom: `calc(96px + env(safe-area-inset-bottom,0px) + ${Math.round(keyboardInset)}px + ${editTab === 'worldbook' ? 88 : 0}px)`,
        }}
      >
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

        <AnimatePresence mode="wait">
          <motion.div
            key={editTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {editTab === 'basic' ? (
              <BasicInfoTab
                editorId={data?.id ?? id}
                character={data}
                isNpcPerspective={!!data.generatedForCharacterId}
                protagonistCallsUser={protagonistCallsUser}
                onProtagonistCallsChange={(v) => setProtagonistCallsUser(v)}
                onProtagonistCallsInteraction={() => {
                  protagonistCallsTouchedRef.current = true
                  setDirty(true)
                }}
                avatarFileInputRef={fileRef}
                onPickAvatarFile={onPickAvatarFile}
                patchCharacter={patchCharacter}
                onMbtiSelect={(next) => {
                  setDirty(true)
                  setData((prev) => (prev ? syncMbtiPersonalityWorldBooks(prev, next) : prev))
                }}
                apiConfig={apiConfig}
                bioGenerating={bioGenerating}
                setBioGenerating={setBioGenerating}
                onBioApiMissing={() => {
                  setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
                  setApiMissingOpen(true)
                }}
                onBioWorldBookMissing={() => {
                  setApiMissingMsg(
                    '请先在下方「世界书」中填写条目内容（并保持世界书 / 条目为开启），再生成角色简介。',
                  )
                  setApiMissingOpen(true)
                }}
                genderLabelZh={genderLabelZh}
              />
            ) : null}

            {editTab === 'bindings' ? <BindingsInfoTab character={data} /> : null}

            {editTab === 'opening' ? (
              <FirstMessageTab
                editorId={data?.id ?? id}
                openingLines={data.openingLines ?? ''}
                onChangeOpeningLines={(v) => setField('openingLines', v)}
                openingGenerating={openingGenerating}
                onRequestAiGenerate={() => setOpeningBiasOpen(true)}
              />
            ) : null}

            {editTab === 'wechat' ? (
              <WeChatProfileTab
                data={data}
                editorId={data?.id ?? id}
                momentsCoverFileRef={momentsCoverFileRef}
                onPickMomentsCoverFile={onPickMomentsCoverFile}
                setField={setField}
              />
            ) : null}

            {editTab === 'worldbook' ? (
              <WorldbookTab
                apiConfig={apiConfig}
                character={data}
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
              <ConnectionsTab>
                <PersonaNetworkSection
                  main={data}
                  apiConfig={apiConfig}
                  onApiMissing={() => {
                    setApiMissingMsg('未配置 API 或未选择模型。请先前往「API设置」完成配置。')
                    setApiMissingOpen(true)
                  }}
                  onOpenNpcEdit={onNavigateToCharacter}
                />
              </ConnectionsTab>
            ) : null}

            {editTab === 'schedule' ? (
              <ScheduleTimelineTab schedule={data.schedule} onEdit={() => setScheduleOpen(true)} />
            ) : null}

            {editTab === 'worldbackground' ? (
              <WorldBackgroundTab
                wbCardName={wbCardName}
                enabled={data.worldBackgroundEnabled !== false}
                onToggleEnabled={() => setField('worldBackgroundEnabled', !(data.worldBackgroundEnabled !== false))}
                onOpenPicker={() => {
                  if (data.worldBackgroundEnabled === false) return
                  setWbFlow('pick')
                }}
                literaturePreview={characterWbPrompt}
              />
            ) : null}

            {editTab === 'io' ? (
              <DataTransferTab
                ioExporting={ioExporting}
                onExport={() => {
                  void (async () => {
                    setIoExporting(true)
                    try {
                      await yieldToMain()
                      const payload = await buildCharacterExportBundle(data)
                      await yieldToMain()
                      const json = serializeCharacterExportJson(payload, {
                        forceCompact: prefersCompactExportSerialization(),
                      })
                      await yieldToMain()
                      const filename = `【Lumi Phone】-人设-${safeExportNameSegment(payload.mainCharacter.name, '未命名')}.json`
                      pendingExportJsonRef.current = json
                      setExportAddTimestamp(false)
                      setExportFilenameDraft(filename)
                      setExportSaveDialog({ suggested: filename })
                    } catch (e) {
                      window.alert(e instanceof Error ? e.message : '导出失败')
                    } finally {
                      setIoExporting(false)
                    }
                  })()
                }}
                onImportFileChange={(e) => {
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
                        window.alert('无法识别：请导入本应用导出的「完整人设包」JSON（单文件）。')
                        return
                      }
                      if (bundles.length > 1) {
                        window.alert('此处一次仅支持单个完整人设包。若 JSON 内包含多个包，请拆成多个文件后分别导入。')
                        return
                      }
                      const acc = currentAccountId?.trim()
                      if (!acc) {
                        window.alert('请先登录微信账号后再导入人设包')
                        return
                      }
                      const result = await importCharacterBundle(bundles[0], 'new', { wechatAccountId: acc })
                      const importedRoot = result.rootId
                      onNavigateToCharacter(importedRoot)
                      await onBundleImported?.({ rootId: importedRoot, replacePage: false })
                      window.alert('导入成功：已写入当前微信账号，并已后台存档人设包与绑定身份。')
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : '导入失败')
                    } finally {
                      input.value = ''
                    }
                  })()
                }}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <PersonaExportSaveDialog
        open={!!exportSaveDialog}
        suggestedName={exportSaveDialog?.suggested ?? ''}
        draftName={exportFilenameDraft}
        addTimestamp={exportAddTimestamp}
        onDraftChange={(v) => {
          setExportFilenameDraft(v)
          setExportAddTimestamp(false)
        }}
        onAddTimestampChange={(checked) => {
          const meta = exportSaveDialog
          if (!meta) return
          setExportAddTimestamp(checked)
          setExportFilenameDraft(checked ? applyExportFilenameTimestamp(meta.suggested) : meta.suggested)
        }}
        onCancel={() => {
          pendingExportJsonRef.current = null
          setExportSaveDialog(null)
        }}
        onConfirm={() => {
          const json = pendingExportJsonRef.current
          if (!json || !exportSaveDialog) return
          const finalName = sanitizeExportFilenameInput(exportFilenameDraft)
          setExportSaveDialog(null)
          void (async () => {
            try {
              await exportCharacterJsonToDisk(json, finalName)
            } catch (e) {
              window.alert(e instanceof Error ? e.message : '保存失败')
            } finally {
              pendingExportJsonRef.current = null
            }
          })()
        }}
      />

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

