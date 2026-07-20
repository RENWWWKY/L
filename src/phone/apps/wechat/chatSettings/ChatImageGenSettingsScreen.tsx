import { ArrowLeft, User, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import { phoneNumStyle } from '../../../types'
import { AppearanceRefSettingsPanel } from '../appearanceRef/AppearanceRefSettingsPanel'
import { SharedImageGenStyleSection } from '../appearanceRef/SharedImageGenStyleSection'
import { useAppearanceReferenceStatus } from '../appearanceRef/useAppearanceReferenceStatus'
import type { ChatConversationSettingsRow } from '../newFriendsPersona/types'
import {
  clampImageRoundCount,
  formatImageRoundCountRangeLabel,
  IMAGE_DEFAULT_ROUND_COUNT_MAX,
  IMAGE_DEFAULT_ROUND_COUNT_MIN,
  IMAGE_ROUND_COUNT_MAX_LIMIT,
  IMAGE_ROUND_COUNT_MIN_LIMIT,
  isCharacterImageSendSupported,
  isImageRoundCountRangeCustomized,
  parseStoredImageRoundCountRange,
} from '../wechatMediaSendFrequency'
import { CommitOnReleaseRangeInput } from './CommitOnReleaseRangeInput'

type ImageGenTab = 'count' | 'appearance' | 'style'
type RefSubTab = 'character' | 'user'

export type ChatImageGenSettingsPatch = Partial<
  Pick<ChatConversationSettingsRow, 'imageRoundCountMin' | 'imageRoundCountMax'>
> & {
  clearImageRoundCountRange?: boolean
}

function ChatSettingsNum({ children }: { children: React.ReactNode }) {
  return <span style={phoneNumStyle}>{children}</span>
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
  const [uiMin, setUiMin] = useState(range.min)
  const [uiMax, setUiMax] = useState(range.max)
  const [draggingMin, setDraggingMin] = useState(false)
  const [draggingMax, setDraggingMax] = useState(false)

  useEffect(() => {
    setUiMin(range.min)
  }, [range.min])

  useEffect(() => {
    setUiMax(range.max)
  }, [range.max])

  const showCustom = customized || draggingMin || draggingMax
  const labelMin = draggingMin ? uiMin : range.min
  const labelMax = draggingMax ? uiMax : range.max

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-black">
          {showCustom ? (
            <ChatSettingsNum>
              {uiMin}～{uiMax} 张
            </ChatSettingsNum>
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
        {customized && !draggingMin && !draggingMax ? (
          <button type="button" onClick={onResetDefault} className="shrink-0 text-[12px] text-[#576b95]">
            恢复默认
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#8e8e8e]">
          <span>最少张数</span>
          <ChatSettingsNum>{labelMin} 张</ChatSettingsNum>
        </div>
        <CommitOnReleaseRangeInput
          min={IMAGE_ROUND_COUNT_MIN_LIMIT}
          max={IMAGE_ROUND_COUNT_MAX_LIMIT}
          step={1}
          value={range.min}
          onDraftChange={setUiMin}
          onDragStateChange={setDraggingMin}
          onCommit={(raw) => {
            const min = clampImageRoundCount(raw)
            const max = Math.max(min, uiMax)
            setUiMin(min)
            onChange(min, max)
          }}
          className="mt-1 w-full accent-black"
          aria-label="AI 配图每次最少张数"
        />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#8e8e8e]">
          <span>最多张数</span>
          <ChatSettingsNum>{labelMax} 张</ChatSettingsNum>
        </div>
        <CommitOnReleaseRangeInput
          min={IMAGE_ROUND_COUNT_MIN_LIMIT}
          max={IMAGE_ROUND_COUNT_MAX_LIMIT}
          step={1}
          value={range.max}
          onDraftChange={setUiMax}
          onDragStateChange={setDraggingMax}
          onCommit={(raw) => {
            const max = clampImageRoundCount(raw)
            const min = Math.min(uiMin, max)
            setUiMax(max)
            onChange(min, max)
          }}
          className="mt-1 w-full accent-black"
          aria-label="AI 配图每次最多张数"
        />
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
  const imageSendSupported = isCharacterImageSendSupported(row.imageRoundTriggerPercent)
  const parts: string[] = imageSendSupported ? ['按语境发图'] : ['已关闭发图']
  if (imageSendSupported) {
    const range = parseStoredImageRoundCountRange(row.imageRoundCountMin, row.imageRoundCountMax)
    if (isImageRoundCountRangeCustomized(row.imageRoundCountMin, row.imageRoundCountMax)) {
      parts.push(formatImageRoundCountRangeLabel(range))
    }
  }
  parts.push('形象与风格')
  return parts.join(' · ')
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
  const [activeTab, setActiveTab] = useState<ImageGenTab>('count')
  const [refTab, setRefTab] = useState<RefSubTab>('character')
  const { hasReference: hasAppearanceReference } = useAppearanceReferenceStatus({
    context: 'chat',
    characterId: peerCharacterId,
    playerIdentityId,
  })

  const showUserRef = !!playerIdentityId?.trim()
  const imageSendSupported = isCharacterImageSendSupported(settings.imageRoundTriggerPercent)

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
              { id: 'count' as const, label: '发图设置' },
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
        {activeTab === 'count' ? (
          <div className="space-y-3">
            {!imageSendSupported ? (
              <section
                className="rounded-[12px] bg-white px-4 py-4"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <p className="text-[15px] font-medium text-black">发图已关闭</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                  请先在「聊天信息」页打开「支持发图」开关，再调整张数与形象。关闭时不注入发图/生图提示词，也不展示图片占位。
                </p>
              </section>
            ) : (
              <>
                <section
                  className="rounded-[12px] bg-white px-4 py-4"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  <p className="text-[15px] font-medium text-black">按语境适量发图</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                    角色可在合适场景自发配图（不是每轮都发）。气泡先显示通俗中文画面描述；点确认后直接用同轮输出的英文生图提示词生图，不再另调模型推提示词。须已配置生图
                    API。总开关在「聊天信息 › 支持发图」。
                  </p>
                </section>

                <section
                  className="rounded-[12px] bg-white px-4 py-4"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  <p className="text-[15px] font-medium text-black">每次张数范围</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                    发图时角色可发送的图片张数（每条 <span className="font-mono">[图片]</span> 行计 1
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
              </>
            )}
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
