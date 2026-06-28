import { ArrowLeft, Plus, Save, User, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { emitWeChatStorageChanged, personaDb } from './idb'
import type { Character, PlayerIdentity, Relationship } from './types'
import { genderLabelZh, uid } from './utils'
import { formatLinkedNpcsForWorldBookPrompt, generateCharacterOpeningLines, generateWechatProfilesForPersonaCharacters } from './ai'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { useCustomization } from '../../../CustomizationContext'
import type { WeChatPersonaContact } from '../../../types'
import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { MOMENTS_COVER_ASPECT } from '../../../../components/moments/momentsCoverDefaults'
import { PersonaNetworkSection } from './PersonaNetworkSection'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import type { ScheduleTable } from './types'
import { ScheduleEditorScreen } from '../schedule/ScheduleEditorScreen'
import { buildCharacterExportBundle, importCharacterBundle, parseCharacterImportFile, buildAddressingHintFromAudit, shouldPromptImportIdentitySync, type CharacterBundleIdentityAddressingHint } from './characterBundleIo'
import { auditCliqueIdentityBinding } from './personaIdentityBindingAudit'
import { markCliqueIdentitySyncAck } from './personaIdentitySyncAck'
import {
  persistCliqueCharacterUpdates,
  runIdentityCliqueSyncWithAi,
  type IdentityCliqueSyncScope,
} from './personaIdentityCliqueSync'
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
import { isLargeMbtiAvatar, resolvePlayerIdentityPreviewAvatar } from './mbtiProfileUi'
import { useWechatStore } from '../useWechatStore'
import { isIOSWebKit } from '../../../utils/platform'
import { useEditableKeyboardLift } from '../../../hooks/useEditableKeyboardLift'
import { isAndroidWeb, keyboardScrollPaddingBottom } from '../../../hooks/keyboardInset'
import { KeyboardBottomWhitePad } from '../../../components/KeyboardBottomWhitePad'
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
import {
  contactEntryFromCharacter,
  isCharacterInPersonaContacts,
  personaContactSyncPromptCopy,
  type PersonaContactSyncPromptCopy,
} from '../wechatPersonaContactsSync'
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
import { PersonaTabs } from './personaRoster/PersonaTabs'
import { PersonaList } from './personaRoster/PersonaList'
import { PersonaRosterAvatar } from './personaRoster/PersonaRosterAvatar'
import { CrossBindingsPanel, PERSONA_RELATIONS_COACH_ROOT } from './personaRoster/crossBindings/CrossBindingsPanel'
import { formatIdentityBindingDisplay } from './personaRoster/personaRosterDisplay'
import { usePersonaRoster } from './personaRoster/usePersonaRoster'
import type { PersonaRosterTabId } from './personaRoster/personaRosterTypes'
import { WeChatThemePageBackdrop } from './WeChatThemePageBackdrop'
import { PersonaAiGeneratePage } from './PersonaAiGeneratePage'

const bg = '#F7F7F9'
const text = '#262626'
const sub = '#8e8e8e'
const border = '#dbdbdb'

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

function ImportAddressingDialog({
  open,
  hint,
  generating,
  onSyncAll,
  onSyncAddressing,
  onSyncAfterEntries,
  onSkip,
}: {
  open: boolean
  hint: CharacterBundleIdentityAddressingHint | null
  generating: boolean
  onSyncAll: () => void
  onSyncAddressing: () => void
  onSyncAfterEntries: () => void
  onSkip: () => void
}) {
  if (!open || !hint) return null
  const prevLabel = hint.previousIdentityNames.join('、') || '原身份'
  const clearedNote =
    hint.clearedAddressingCount > 0
      ? `已有 ${hint.clearedAddressingCount} 条称呼因与旧身份名冲突被清空。`
      : ''
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4">
      <div
        className="w-full max-w-[540px] rounded-2xl border bg-white p-5"
        style={{ borderColor: border, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
      >
        <p className="text-center text-[16px] font-semibold" style={{ color: text }}>
          身份不一致 · 是否同步称呼、看法与尾声延展？
        </p>
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
          <p>
            此人设包原绑定身份为「{prevLabel}」，当前导入身份为「{hint.currentIdentityName}」。
          </p>
          {hint.hasPlayerAddressing ? (
            <p>包内 NPC 对你的称呼与看法仍可能沿用旧身份；若不更改，对话中可能会叫错名字或性别不符。</p>
          ) : null}
          {hint.hasAfterAttitudeEntries ? (
            <p>
              各角色世界书「当前对你的态度」（尾声延展）仍按旧身份撰写，共约 {hint.afterAttitudeEntryCount}{' '}
              条，建议一并 AI 重写。
            </p>
          ) : null}
          {clearedNote ? <p>{clearedNote}</p> : null}
          <p className="font-medium" style={{ color: text }}>
            推荐选择「一键全部更新」。若关闭本窗口，可稍后在主角「人脉关系」页点击「绑定检测」再次生成。
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {hint.hasPlayerAddressing && hint.hasAfterAttitudeEntries ? (
            <button
              type="button"
              disabled={generating}
              onClick={onSyncAll}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-50"
              style={{ background: '#000000' }}
            >
              {generating ? 'AI 生成中…' : '一键全部更新（推荐）'}
            </button>
          ) : hint.hasPlayerAddressing ? (
            <button
              type="button"
              disabled={generating}
              onClick={onSyncAddressing}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-50"
              style={{ background: '#000000' }}
            >
              {generating ? 'AI 生成中…' : 'AI 更新称呼与看法（推荐）'}
            </button>
          ) : hint.hasAfterAttitudeEntries ? (
            <button
              type="button"
              disabled={generating}
              onClick={onSyncAfterEntries}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-50"
              style={{ background: '#000000' }}
            >
              {generating ? 'AI 生成中…' : 'AI 更新尾声延展（推荐）'}
            </button>
          ) : null}
          {hint.hasPlayerAddressing && hint.hasAfterAttitudeEntries ? (
            <button
              type="button"
              disabled={generating}
              onClick={onSyncAddressing}
              className="rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa] disabled:opacity-50"
              style={{ borderColor: border, color: text }}
            >
              {generating ? 'AI 生成中…' : '仅 AI 更新称呼与看法'}
            </button>
          ) : null}
          {hint.hasPlayerAddressing && hint.hasAfterAttitudeEntries ? (
            <button
              type="button"
              disabled={generating}
              onClick={onSyncAfterEntries}
              className="rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa] disabled:opacity-50"
              style={{ borderColor: border, color: text }}
            >
              {generating ? 'AI 生成中…' : '仅 AI 更新尾声延展条目'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={generating}
            onClick={onSkip}
            className="rounded-xl py-2 text-[12px] transition-all duration-200 ease-out disabled:opacity-50"
            style={{ color: sub }}
          >
            暂不更改
          </button>
        </div>
      </div>
    </div>
  )
}

function CharacterCreateModeModal({
  open,
  onClose,
  onPickCustom,
  onPickAi,
}: {
  open: boolean
  onClose: () => void
  onPickCustom: () => void
  onPickAi: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[400px] rounded-2xl border bg-white p-4"
        style={{ borderColor: border, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[16px] font-semibold" style={{ color: text }}>
          新建角色人设
        </p>
        <p className="mt-2 text-center text-[13px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
          选择创建方式：自定义编辑，或由 AI 根据预设一键生成立体人设与世界书。
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPickCustom}
            className="rounded-xl bg-[#111827] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out hover:bg-[#0b1220]"
          >
            自定义编辑
          </button>
          <button
            type="button"
            onClick={onPickAi}
            className="rounded-xl border bg-white py-3 text-[14px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
            style={{ borderColor: border, color: text }}
          >
            AI 生成
          </button>
          <button type="button" onClick={onClose} className="rounded-xl py-2 text-[13px]" style={{ color: sub }}>
            取消
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
              {identities.map((it) => {
                const previewAvatar = resolvePlayerIdentityPreviewAvatar({
                  mbti: it.mbti,
                  avatarUrl: it.avatarUrl,
                })
                return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-[12px] border bg-white p-4"
                  style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <div
                    className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white"
                    style={{ borderColor: '#e5e5e5' }}
                  >
                    {previewAvatar.src ? (
                      <img
                        src={previewAvatar.src}
                        alt=""
                        className={
                          previewAvatar.kind === 'mbti'
                            ? `max-h-full max-w-full object-contain ${isLargeMbtiAvatar(it.mbti) ? '' : 'scale-90'}`
                            : 'h-full w-full object-cover'
                        }
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
              )})}

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

function MainCharacterPickModal({
  open,
  mainCharacters,
  identityList,
  identityNameById,
  onClose,
  onPick,
}: {
  open: boolean
  mainCharacters: Character[]
  identityList: PlayerIdentity[]
  identityNameById: Record<string, string>
  onClose: () => void
  onPick: (main: Character) => void
}) {
  if (!open) return null
  const hasAny = mainCharacters.length > 0
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-[16px] bg-white"
        style={{ background: '#ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5">
          <p className="text-center text-[18px] font-bold" style={{ color: '#000000' }}>
            选择主要角色
          </p>
          <p className="mt-1 text-center text-[13px]" style={{ color: '#666666' }}>
            新建 NPC 将围绕该主角，并继承其绑定的用户身份
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

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-5 pb-5 pt-4">
          {!hasAny ? (
            <div className="py-6 text-center">
              <User className="mx-auto size-12" style={{ color: '#999999' }} strokeWidth={1.5} />
              <p className="mt-4 text-[16px] font-semibold" style={{ color: '#666666' }}>
                暂无主要角色
              </p>
              <p className="mt-2 text-[14px]" style={{ color: '#999999' }}>
                请先创建主要角色，再为其添加次要/NPC
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mainCharacters.map((main) => {
                const identityLine = formatIdentityBindingDisplay(
                  main,
                  main.playerIdentityId,
                  identityList,
                  identityNameById,
                )
                return (
                  <div
                    key={main.id}
                    className="flex items-center gap-3 rounded-[12px] border bg-white p-4"
                    style={{ borderColor: '#e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                  >
                    <PersonaRosterAvatar character={main} size={50} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold" style={{ color: '#000000' }}>
                        {main.name?.trim() || '未命名'}
                      </p>
                      <p className="mt-1 truncate text-[13px]" style={{ color: '#666666' }}>
                        {main.identity?.trim() || '—'}
                      </p>
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: '#999999' }}>
                        绑定身份 · {identityLine}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPick(main)}
                      className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
                      style={{ background: '#000000' }}
                    >
                      选择
                    </button>
                  </div>
                )
              })}
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

/** 空白 NPC 草稿：围绕主角，并继承主角绑定的用户身份 */
function newBlankNpcForMain(main: Character): Character {
  const now = Date.now()
  return {
    id: uid('ch'),
    createdAt: now,
    updatedAt: now,
    name: '',
    gender: 'female',
    age: null,
    birthdayMD: '',
    zodiac: '',
    identity: '学生',
    mbti: '',
    bio: '',
    avatarUrl: '',
    worldBooks: [],
    generatedForCharacterId: main.id,
    playerIdentityId: main.playerIdentityId,
    wechatAccountId: main.wechatAccountId,
    worldBackgroundId: main.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID,
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
    | {
        name: 'edit'
        id: string
        isNew: boolean
        draft?: Character
        /** NPC 编辑页返回目标：名册直入为 list，人脉内打开为 parent */
        backTo?: 'list' | 'parent'
      }
    | {
        name: 'ai-generate'
        draft: Character
        playerIdentityId: string
      }
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
  const [rosterTab, setRosterTab] = useState<PersonaRosterTabId>('main')
  const [relationsTopRight, setRelationsTopRight] = useState<ReactNode>(null)
  const ensureRelationsTab = useCallback(() => setRosterTab('relations'), [])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteTargetDetachHint, setDeleteTargetDetachHint] = useState<string | null>(null)
  const [identityPickOpen, setIdentityPickOpen] = useState(false)
  const [createModeOpen, setCreateModeOpen] = useState(false)
  const [pendingCreateMode, setPendingCreateMode] = useState<'custom' | 'ai' | null>(null)
  const [mainPickOpen, setMainPickOpen] = useState(false)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [pendingNewDraft, setPendingNewDraft] = useState<Character | null>(null)
  const [contactGenRootId, setContactGenRootId] = useState<string | null>(null)
  const [aiGeneratingWechat, setAiGeneratingWechat] = useState(false)
  const [aiRemarkCandidates, setAiRemarkCandidates] = useState<Character[] | null>(null)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [importAddressingPrompt, setImportAddressingPrompt] = useState<{
    rootId: string
    hint: CharacterBundleIdentityAddressingHint
  } | null>(null)
  const [importAddressingGenerating, setImportAddressingGenerating] = useState(false)
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

  const runImportIdentitySync = useCallback(
    async (scope: IdentityCliqueSyncScope) => {
      const prompt = importAddressingPrompt
      if (!prompt) return
      if (!apiConfigList?.apiUrl?.trim() || !apiConfigList?.apiKey?.trim() || !apiConfigList?.modelId?.trim()) {
        window.alert('请先在 API 设置中配置聊天接口后再使用 AI 同步。')
        return
      }
      setImportAddressingGenerating(true)
      try {
        const root = await personaDb.getCharacter(prompt.rootId)
        if (!root) throw new Error('未找到导入后的主角档案')
        const npcs = await personaDb.listNpcsFor(prompt.rootId)
        const playerLinks = await personaDb.getPlayerNetworkLinks(prompt.rootId)
        const identityId =
          root.playerIdentityId?.trim() || (await personaDb.getCurrentIdentityId()).trim()
        const playerIdentity = identityId ? await personaDb.getPlayerIdentity(identityId) : null
        const { updatedLinks, updatedCharacters } = await runIdentityCliqueSyncWithAi(apiConfigList, scope, {
          rootCharacter: root,
          npcs,
          playerLinks,
          playerIdentity,
          previousIdentityNames: prompt.hint.previousIdentityNames,
          currentIdentityName: prompt.hint.currentIdentityName,
        })
        if (updatedLinks !== playerLinks) {
          await personaDb.putPlayerNetworkLinks(prompt.rootId, updatedLinks)
        }
        if (updatedCharacters.length) {
          await persistCliqueCharacterUpdates(updatedCharacters)
        } else if (updatedLinks !== playerLinks) {
          emitWeChatStorageChanged()
        }
        const parts: string[] = []
        if (scope === 'all' || scope === 'addressing') parts.push('称呼与看法')
        if (scope === 'all' || scope === 'afterEntries') parts.push('尾声延展条目')
        await markCliqueIdentitySyncAck(prompt.rootId, identityId, prompt.hint.currentIdentityName)
        window.alert(`已 AI 更新${parts.join('与')}。可在人脉关系页「绑定检测」或关系图中核对。`)
        setImportAddressingPrompt(null)
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'AI 同步失败')
      } finally {
        setImportAddressingGenerating(false)
      }
    },
    [apiConfigList, importAddressingPrompt],
  )

  const importIdentitySyncDialogs = (
    <>
      <AiGeneratingOverlay open={importAddressingGenerating} message="正在 AI 同步称呼、看法与尾声延展…" />
      <ImportAddressingDialog
        open={!!importAddressingPrompt}
        hint={importAddressingPrompt?.hint ?? null}
        generating={importAddressingGenerating}
        onSyncAll={() => {
          void runImportIdentitySync('all')
        }}
        onSyncAddressing={() => {
          void runImportIdentitySync('addressing')
        }}
        onSyncAfterEntries={() => {
          void runImportIdentitySync('afterEntries')
        }}
        onSkip={() => setImportAddressingPrompt(null)}
      />
    </>
  )

  const {
    mainCharacters,
    npcCharacters,
    identityList,
    identityNameById,
    accountsBundle,
    mainNameById,
    mainById,
    loading,
    refresh,
  } = usePersonaRoster(linkedCharacterIds)

  const refreshIdentities = async () => {
    setIdentityLoading(true)
    await personaDb.listPlayerIdentities(currentAccountId ?? undefined)
    await refresh()
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

  const buildPersonaContactEntries = useCallback(
    (chars: Character[]): WeChatPersonaContact[] => chars.map((ch) => contactEntryFromCharacter(ch)),
    [],
  )

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
      <>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <WeChatThemePageBackdrop />
        <div
          className="relative z-[1] flex min-h-0 flex-1 flex-col"
          {...PERSONA_RELATIONS_COACH_ROOT}
        >
        <TopBar
          title="世界线人物名册"
          onBack={onBack}
          right={rosterTab === 'relations' ? relationsTopRight : undefined}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden touch-pan-y overscroll-x-none pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <PersonaTabs active={rosterTab} onChange={setRosterTab} />

          <AnimatePresence mode="wait">
            <motion.div
              key={rosterTab}
              className="px-4 pt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {rosterTab === 'main' ? (
                <PersonaList
                  variant="main"
                  characters={mainCharacters}
                  loading={loading}
                  identityList={identityList}
                  identityNameById={identityNameById}
                  mainNameById={mainNameById}
                  mainById={mainById}
                  accountsBundle={accountsBundle}
                  onOpen={(id) => setPage({ name: 'edit', id, isNew: false })}
                  onDelete={(id) => {
                    void (async () => {
                      const acc = currentAccountId?.trim()
                      if (!acc) {
                        setDeleteTargetDetachHint(null)
                        setDeleteId(id)
                        return
                      }
                      const canonical = (await resolveCanonicalCharacterId(id)) || id
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
                      setDeleteId(id)
                    })()
                  }}
                  onGenerateContacts={setContactGenRootId}
                  emptyTitle="尚无主要角色"
                  emptyHint="点击下方按钮创建第一位主角档案，世界线由此展开。"
                />
              ) : null}

              {rosterTab === 'npc' ? (
                <PersonaList
                  variant="npc"
                  characters={npcCharacters}
                  loading={loading}
                  identityList={identityList}
                  identityNameById={identityNameById}
                  mainNameById={mainNameById}
                  mainById={mainById}
                  accountsBundle={accountsBundle}
                  onOpen={(id) => setPage({ name: 'edit', id, isNew: false, backTo: 'list' })}
                  onDelete={(id) => {
                    void (async () => {
                      setDeleteTargetDetachHint(null)
                      setDeleteId(id)
                    })()
                  }}
                  emptyTitle="尚无 NPC 档案"
                  emptyHint="在主要角色的「人脉关系」中生成 NPC 后，将自动归入本册。"
                />
              ) : null}

              {rosterTab === 'relations' ? (
                <CrossBindingsPanel
                  mainCharacters={mainCharacters}
                  npcCharacters={npcCharacters}
                  identityList={identityList}
                  identityNameById={identityNameById}
                  loading={loading}
                  onTopBarRight={setRelationsTopRight}
                  onEnsureRelationsTab={ensureRelationsTab}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 space-y-2 px-4 pt-2" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom,0px))' }}>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111827] px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-200 ease-out hover:bg-[#0b1220]"
            onClick={async () => {
              const c = newCharacter()
              setPendingNewDraft(c)
              setCreateModeOpen(true)
            }}
          >
            <Plus className="size-5" />
            新建角色人设
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#111827]/15 bg-white px-4 py-3.5 text-[15px] font-semibold text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:bg-[#FAFAFA]"
            onClick={() => setMainPickOpen(true)}
          >
            <Plus className="size-5" />
            新建次要/NPC
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
              const removedIds = [id, ...npcs.map((n) => n.id)]
              removeWeChatPersonaContactsByCharacterIds(removedIds)
              const mode = await deleteCharacterPersonaForWechatAccount({
                characterId: id,
                wechatAccountId: acc,
              })
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

        <CharacterCreateModeModal
          open={createModeOpen}
          onClose={() => {
            setCreateModeOpen(false)
            setPendingNewDraft(null)
            setPendingCreateMode(null)
          }}
          onPickCustom={async () => {
            setCreateModeOpen(false)
            setPendingCreateMode('custom')
            setIdentityPickOpen(true)
            await refreshIdentities()
          }}
          onPickAi={async () => {
            setCreateModeOpen(false)
            setPendingCreateMode('ai')
            setIdentityPickOpen(true)
            await refreshIdentities()
          }}
        />

        <IdentityPickModal
          open={identityPickOpen}
          loading={identityLoading}
          identities={identityList}
          onClose={() => {
            setIdentityPickOpen(false)
            setPendingNewDraft(null)
            setPendingCreateMode(null)
          }}
          onCreateNew={() => {
            setIdentityPickOpen(false)
            setPendingNewDraft(null)
            setPendingCreateMode(null)
            onOpenIdentityManager?.()
          }}
          onPick={async (identityId) => {
            const base = { ...(pendingNewDraft ?? newCharacter()), playerIdentityId: identityId }
            const draft = currentAccountId ? stampWechatAccountOwner(base, currentAccountId) : base
            await setActivePlayerIdentityForCurrentAccount(identityId)
            setIdentityPickOpen(false)
            setPendingNewDraft(null)
            const mode = pendingCreateMode ?? 'custom'
            setPendingCreateMode(null)
            if (mode === 'ai') {
              setPage({ name: 'ai-generate', draft, playerIdentityId: identityId })
              return
            }
            setPage({ name: 'edit', id: draft.id, isNew: true, draft })
          }}
        />

        <MainCharacterPickModal
          open={mainPickOpen}
          mainCharacters={mainCharacters}
          identityList={identityList}
          identityNameById={identityNameById}
          onClose={() => setMainPickOpen(false)}
          onPick={async (main) => {
            if (!main.playerIdentityId?.trim()) {
              window.alert('该主角尚未绑定用户身份，请先在主角人设中绑定身份后再创建 NPC。')
              return
            }
            const base = newBlankNpcForMain(main)
            const draft = currentAccountId ? stampWechatAccountOwner(base, currentAccountId) : base
            await setActivePlayerIdentityForCurrentAccount(main.playerIdentityId.trim())
            setMainPickOpen(false)
            setPage({ name: 'edit', id: draft.id, isNew: true, draft, backTo: 'list' })
          }}
        />
        </div>
      </div>
      {importIdentitySyncDialogs}
      </>
    )
  }

  if (page.name === 'ai-generate') {
    const playerIdentity =
      identityList.find((it) => it.id === page.playerIdentityId) ?? null
    return (
      <PersonaAiGeneratePage
        draft={page.draft}
        playerIdentity={playerIdentity}
        playerIdentityId={page.playerIdentityId}
        wechatAccountId={currentAccountId}
        apiConfig={apiConfigList}
        onBack={() => setPage({ name: 'list' })}
        onGenerated={(generated) => {
          setPage({ name: 'edit', id: generated.id, isNew: true, draft: generated })
        }}
      />
    )
  }

  if (page.name !== 'edit') {
    return null
  }

  return (
    <>
    <PersonaEditPage
      key={page.id}
      id={page.id}
      isNew={page.isNew}
      draft={page.draft}
      backTo={page.backTo ?? 'parent'}
      onBack={() => setPage({ name: 'list' })}
      onSaved={() => void refresh()}
      onNavigateToCharacter={(cid, draftNpc) => {
        if (draftNpc) {
          setPage({ name: 'edit', id: draftNpc.id, isNew: true, draft: draftNpc, backTo: 'parent' })
        } else {
          setPage({ name: 'edit', id: cid, isNew: false, backTo: 'parent' })
        }
      }}
      onBundleImported={async ({ rootId, replacePage }) => {
        await refresh()
        if (replacePage) setPage({ name: 'edit', id: rootId, isNew: false })
      }}
      onImportBundleAudited={(payload) => {
        setImportAddressingPrompt(payload)
      }}
    />
    {importIdentitySyncDialogs}
    </>
  )
}

function PersonaEditPage({
  id,
  isNew,
  draft,
  backTo,
  onBack,
  onSaved,
  onNavigateToCharacter,
  onBundleImported,
  onImportBundleAudited,
}: {
  id: string
  isNew: boolean
  draft?: Character
  /** NPC 返回：名册 list / 主角人脉 parent */
  backTo: 'list' | 'parent'
  onBack: () => void
  onSaved: () => void
  onNavigateToCharacter: (characterId: string, draftNpc?: Character) => void
  onBundleImported?: (opts: { rootId: string; replacePage: boolean }) => void | Promise<void>
  onImportBundleAudited?: (payload: { rootId: string; hint: CharacterBundleIdentityAddressingHint }) => void
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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [iosKeyboardInset, setIosKeyboardInset] = useState(0)
  const androidKeyboardInsetPx = useEditableKeyboardLift(scrollRef)
  const keyboardInsetPx = isIOSWebKit() ? iosKeyboardInset : androidKeyboardInsetPx.padPx
  /** 主角在剧情/人脉中对用户的称呼（PlayerNetworkLink.theyCallYou，characterId = 根主角 id） */
  const [protagonistCallsUser, setProtagonistCallsUser] = useState('')
  const protagonistCallsTouchedRef = useRef(false)
  const { currentAccountId } = useWechatStore()
  const { state: phoneState, replaceWeChatPersonaContacts } = useCustomization()
  const linkedCharacterIdSet = useMemo(
    () => new Set(phoneState.wechatPersonaContacts.map((c) => c.characterId.trim()).filter(Boolean)),
    [phoneState.wechatPersonaContacts],
  )
  const [contactSyncPrompt, setContactSyncPrompt] = useState<{
    character: Character
    pendingBack: boolean
    copy: PersonaContactSyncPromptCopy
  } | null>(null)

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
    if (!isIOSWebKit() || typeof window === 'undefined') {
      setIosKeyboardInset(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setIosKeyboardInset((prev) => (Math.abs(prev - inset) < 1 ? prev : inset))
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

  /** 名册直入的 NPC 返回列表；人脉内打开的 NPC 返回所属主角；主角返回名册 */
  const performBack = useCallback(async () => {
    let ch = data
    if (!ch) ch = await personaDb.getCharacter(id)
    const parentId = ch?.generatedForCharacterId?.trim()
    if (parentId && backTo === 'parent') {
      onNavigateToCharacter(parentId)
      return
    }
    onBack()
  }, [backTo, data, id, onBack, onNavigateToCharacter])

  const promptContactSyncAfterPersist = useCallback(
    (ch: Character, pendingBack: boolean) => {
      const inContacts = isCharacterInPersonaContacts(phoneState.wechatPersonaContacts, ch.id)
      setContactSyncPrompt({
        character: ch,
        pendingBack,
        copy: personaContactSyncPromptCopy(inContacts, !!ch.generatedForCharacterId?.trim()),
      })
    },
    [phoneState.wechatPersonaContacts],
  )

  const dismissContactSyncPrompt = useCallback(
    (didSync: boolean) => {
      if (!contactSyncPrompt) return
      const { character, pendingBack } = contactSyncPrompt
      if (didSync) {
        replaceWeChatPersonaContacts([character.id], [contactEntryFromCharacter(character)])
      }
      setContactSyncPrompt(null)
      if (pendingBack) void performBack()
    },
    [contactSyncPrompt, performBack, replaceWeChatPersonaContacts],
  )

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
    promptContactSyncAfterPersist(next, true)
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
    promptContactSyncAfterPersist(merged, false)
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
    <div
      ref={scrollRef}
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{ background: bg }}
    >
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
          paddingBottom: isIOSWebKit()
            ? `calc(96px + env(safe-area-inset-bottom,0px) + ${Math.round(keyboardInsetPx)}px + ${editTab === 'worldbook' ? 88 : 0}px)`
            : keyboardScrollPaddingBottom(keyboardInsetPx, {
                basePx: 96 + (editTab === 'worldbook' ? 88 : 0),
              }),
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
                onChange={(next) => {
                  setDirty(true)
                  setData((prev) => {
                    if (!prev) return prev
                    return typeof next === 'function' ? next(prev) : next
                  })
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
                      const importedMain = await personaDb.getCharacter(importedRoot)
                      let showSyncDialog = false
                      if (importedMain) {
                        const importedNpcs = await personaDb.listNpcsFor(importedRoot)
                        const importedLinks = await personaDb.getPlayerNetworkLinks(importedRoot)
                        const importAudit = await auditCliqueIdentityBinding({
                          rootId: importedRoot,
                          main: importedMain,
                          npcs: importedNpcs,
                          playerLinks: importedLinks,
                          wechatAccountId: acc,
                          knownPreviousIdentityNames: result.addressingHint?.previousIdentityNames,
                        })
                        if (
                          shouldPromptImportIdentitySync(
                            importAudit,
                            result.addressingHint,
                            importedLinks,
                          )
                        ) {
                          onImportBundleAudited?.({
                            rootId: importedRoot,
                            hint: buildAddressingHintFromAudit(
                              importAudit,
                              result.addressingHint,
                              importedLinks,
                            ),
                          })
                          showSyncDialog = true
                        }
                      } else if (result.addressingHint) {
                        onImportBundleAudited?.({ rootId: importedRoot, hint: result.addressingHint })
                        showSyncDialog = true
                      }
                      onNavigateToCharacter(importedRoot)
                      await onBundleImported?.({ rootId: importedRoot, replacePage: false })
                      if (!showSyncDialog) {
                        window.alert('导入成功：已写入当前微信账号，并已后台存档人设包与绑定身份。')
                      }
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
      {isAndroidWeb() ? <KeyboardBottomWhitePad insetPx={keyboardInsetPx} zIndex={45} /> : null}

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
        open={!!contactSyncPrompt}
        title={contactSyncPrompt?.copy.title ?? ''}
        message={contactSyncPrompt?.copy.message ?? ''}
        confirmText={contactSyncPrompt?.copy.confirmText ?? '确定'}
        cancelText="暂不"
        onCancel={() => dismissContactSyncPrompt(false)}
        onConfirm={() => dismissContactSyncPrompt(true)}
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
        title={`裁剪朋友圈背景（${MOMENTS_COVER_ASPECT}:1）`}
        aspect={MOMENTS_COVER_ASPECT}
        maxSide={1200}
        objectFit="horizontal-cover"
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

