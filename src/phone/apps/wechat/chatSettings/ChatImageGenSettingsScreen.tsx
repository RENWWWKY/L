import { ArrowLeft, User, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import { phoneNumStyle } from '../../../types'
import { AppearanceRefSettingsPanel } from '../appearanceRef/AppearanceRefSettingsPanel'
import { SharedImageGenStyleSection } from '../appearanceRef/SharedImageGenStyleSection'
import { useAppearanceReferenceStatus } from '../appearanceRef/useAppearanceReferenceStatus'
import type { ChatConversationSettingsRow } from '../newFriendsPersona/types'
import {
  clampImageRoundCount,
  displayRoundTriggerPercent,
  formatImageRoundCountRangeLabel,
  IMAGE_DEFAULT_ROUND_COUNT_MAX,
  IMAGE_DEFAULT_ROUND_COUNT_MIN,
  IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT,
  IMAGE_ROUND_COUNT_MAX_LIMIT,
  IMAGE_ROUND_COUNT_MIN_LIMIT,
  isImageRoundCountRangeCustomized,
  isRoundTriggerCustomized,
  parseStoredImageRoundCountRange,
} from '../wechatMediaSendFrequency'

type ImageGenTab = 'probability' | 'appearance' | 'style'
type RefSubTab = 'character' | 'user'

export type ChatImageGenSettingsPatch = Partial<
  Pick<
    ChatConversationSettingsRow,
    'imageRoundTriggerPercent' | 'imageRoundCountMin' | 'imageRoundCountMax'
  >
> & {
  clearImageRoundTriggerPercent?: boolean
  clearImageRoundCountRange?: boolean
}

function ChatSettingsNum({ children }: { children: React.ReactNode }) {
  return <span style={phoneNumStyle}>{children}</span>
}

function ImageTriggerPercentControl({
  stored,
  onChange,
  onResetDefault,
}: {
  stored: number | undefined
  onChange: (percent: number) => void
  onResetDefault: () => void
}) {
  const display = displayRoundTriggerPercent(stored, 'image')
  const customized = isRoundTriggerCustomized(stored)

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-black">
          {customized ? (
            <ChatSettingsNum>{display}%</ChatSettingsNum>
          ) : (
            <>
              默认 <ChatSettingsNum>{IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT}%</ChatSettingsNum>（不发图）
            </>
          )}
        </span>
        {customized ? (
          <button type="button" onClick={onResetDefault} className="shrink-0 text-[12px] text-[#576b95]">
            恢复默认
          </button>
        ) : null}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-black"
        aria-label="AI 配图每轮触发概率"
      />
      <div className="mt-1 flex justify-between text-[11px] text-[#8e8e8e]">
        <span>
          <ChatSettingsNum>0%</ChatSettingsNum> 不发
        </span>
        <span>
          <ChatSettingsNum>100%</ChatSettingsNum> 每轮必发
        </span>
      </div>
    </div>
  )
}

function ImageRoundCountRangeControl({
  minStored,
  maxStored,
  onChange,
  onResetDefault,
}: {
  minStored?: number
  maxStored?: number
  onChange: (min: number, max: number) => void
  onResetDefault: () => void
}) {
  const range = parseStoredImageRoundCountRange(minStored, maxStored)
  const customized = isImageRoundCountRangeCustomized(minStored, maxStored)

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-black">
          {customized ? (
            <ChatSettingsNum>{formatImageRoundCountRangeLabel(range)}</ChatSettingsNum>
          ) : (
            <>
              默认{' '}
              <ChatSettingsNum>
                {IMAGE_DEFAULT_ROUND_COUNT_MIN}～{IMAGE_DEFAULT_ROUND_COUNT_MAX}
              </ChatSettingsNum>{' '}
              张
            </>
          )}
        </span>
        {customized ? (
          <button type="button" onClick={onResetDefault} className="shrink-0 text-[12px] text-[#576b95]">
            恢复默认
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#8e8e8e]">
          <span>最少张数</span>
          <ChatSettingsNum>{range.min} 张</ChatSettingsNum>
        </div>
        <input
          type="range"
          min={IMAGE_ROUND_COUNT_MIN_LIMIT}
          max={IMAGE_ROUND_COUNT_MAX_LIMIT}
          step={1}
          value={range.min}
          onChange={(e) => {
            const min = clampImageRoundCount(Number(e.target.value))
            onChange(min, Math.max(min, range.max))
          }}
          className="mt-1 w-full accent-black"
          aria-label="AI 配图每次最少张数"
        />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#8e8e8e]">
          <span>最多张数</span>
          <ChatSettingsNum>{range.max} 张</ChatSettingsNum>
        </div>
        <input
          type="range"
          min={IMAGE_ROUND_COUNT_MIN_LIMIT}
          max={IMAGE_ROUND_COUNT_MAX_LIMIT}
          step={1}
          value={range.max}
          onChange={(e) => {
            const max = clampImageRoundCount(Number(e.target.value))
            onChange(Math.min(range.min, max), max)
          }}
          className="mt-1 w-full accent-black"
          aria-label="AI 配图每次最多张数"
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[#8e8e8e]">
        <span>
          <ChatSettingsNum>{IMAGE_ROUND_COUNT_MIN_LIMIT}</ChatSettingsNum> 张
        </span>
        <span>
          <ChatSettingsNum>{IMAGE_ROUND_COUNT_MAX_LIMIT}</ChatSettingsNum> 张
        </span>
      </div>
    </div>
  )
}

function RefTabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof UserRound
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-medium transition-colors ${
        active ? 'bg-black text-white' : 'bg-[#f5f5f5] text-[#666]'
      }`}
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
      {label}
    </button>
  )
}

export function summarizeChatImageGenSettings(
  row: Pick<
    ChatConversationSettingsRow,
    'imageRoundTriggerPercent' | 'imageRoundCountMin' | 'imageRoundCountMax'
  >,
): string {
  const parts: string[] = []
  if (row.imageRoundTriggerPercent !== undefined) {
    parts.push(`触发 ${row.imageRoundTriggerPercent}%`)
  }
  const range = parseStoredImageRoundCountRange(row.imageRoundCountMin, row.imageRoundCountMax)
  if (isImageRoundCountRangeCustomized(row.imageRoundCountMin, row.imageRoundCountMax)) {
    parts.push(formatImageRoundCountRangeLabel(range))
  }
  parts.push('形象与风格')
  return parts.length > 1 ? parts.join(' · ') : '触发概率 · 形象参考 · 生图风格'
}

export function ChatImageGenSettingsScreen({
  peerDisplayName,
  peerCharacterId,
  playerIdentityId,
  settings,
  onPatch,
  onClose,
}: {
  peerDisplayName: string
  peerCharacterId: string
  playerIdentityId: string
  settings: ChatConversationSettingsRow
  onPatch: (partial: ChatImageGenSettingsPatch) => void | Promise<void>
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<ImageGenTab>('probability')
  const [refTab, setRefTab] = useState<RefSubTab>('character')
  const { hasReference: hasAppearanceReference } = useAppearanceReferenceStatus({
    context: 'chat',
    characterId: peerCharacterId,
    playerIdentityId,
  })

  const showUserRef = !!playerIdentityId?.trim()

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#ededed]">
      <header
        className="shrink-0 border-b border-[#e5e5e5] bg-[#ededed] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex w-full items-center">
          <Pressable
            type="button"
            aria-label="返回聊天信息"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-5 text-black" strokeWidth={2} />
          </Pressable>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[18px] font-bold text-black">AI 配图与形象</h1>
            <p className="mt-0.5 truncate text-[12px] text-[#8e8e8e]">仅本聊天 · {peerDisplayName}</p>
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="shrink-0 border-b border-[#e5e5e5] px-4 py-2">
        <div className="flex gap-1">
          {(
            [
              { id: 'probability' as const, label: '触发概率' },
              { id: 'appearance' as const, label: '形象参考' },
              { id: 'style' as const, label: '生图风格' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-full py-2 text-[12px] font-medium transition-colors ${
                  active ? 'bg-black text-white' : 'bg-white text-[#666]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 'probability' ? (
          <div className="space-y-3">
            <section
              className="rounded-[12px] bg-white px-4 py-4"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <p className="text-[15px] font-medium text-black">每轮触发概率</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                设定角色每轮回复中至少发 1 张 AI 配图的目标概率。用户直接要求发图时不受限制；须已配置生图
                API。
              </p>
              <div className="mt-3">
                <ImageTriggerPercentControl
                  stored={settings.imageRoundTriggerPercent}
                  onChange={(percent) => void onPatch({ imageRoundTriggerPercent: percent })}
                  onResetDefault={() => void onPatch({ clearImageRoundTriggerPercent: true })}
                />
              </div>
            </section>

            <section
              className="rounded-[12px] bg-white px-4 py-4"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <p className="text-[15px] font-medium text-black">每次张数范围</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                触发发图时，角色可发送的图片张数（每条 <span className="font-mono">[图片]</span> 行计 1
                张）。
              </p>
              <div className="mt-3">
                <ImageRoundCountRangeControl
                  minStored={settings.imageRoundCountMin}
                  maxStored={settings.imageRoundCountMax}
                  onChange={(min, max) => void onPatch({ imageRoundCountMin: min, imageRoundCountMax: max })}
                  onResetDefault={() => void onPatch({ clearImageRoundCountRange: true })}
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'appearance' ? (
          <section
            className="rounded-[12px] bg-white px-4 py-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            {showUserRef ? (
              <div className="mb-3 flex gap-1 rounded-full bg-[#f5f5f5] p-1">
                <RefTabButton
                  active={refTab === 'character'}
                  onClick={() => setRefTab('character')}
                  icon={UserRound}
                  label="角色"
                />
                <RefTabButton
                  active={refTab === 'user'}
                  onClick={() => setRefTab('user')}
                  icon={User}
                  label="我"
                />
              </div>
            ) : null}

            <p className="mb-3 text-[12px] leading-relaxed text-[#8e8e8e]">
              {refTab === 'character' || !showUserRef
                ? '锁定角色在聊天发图中的五官与画风；与线下约会页可独立配置。'
                : '锁定你在聊天发图中的外貌；默认与身份页同步。'}
            </p>

            {refTab === 'character' || !showUserRef ? (
              <AppearanceRefSettingsPanel
                subject="character"
                context="chat"
                characterId={peerCharacterId}
                playerIdentityId={playerIdentityId}
                variant="dating"
                hideHeader
              />
            ) : (
              <AppearanceRefSettingsPanel
                subject="user"
                context="chat"
                characterId={peerCharacterId}
                playerIdentityId={playerIdentityId}
                variant="dating"
                hideHeader
              />
            )}
          </section>
        ) : null}

        {activeTab === 'style' ? (
          <section
            className="rounded-[12px] bg-white px-4 py-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <SharedImageGenStyleSection
              className="mt-0 border-0 pt-0"
              hasAppearanceReference={hasAppearanceReference}
            />
          </section>
        ) : null}
      </div>
    </div>
  )
}
