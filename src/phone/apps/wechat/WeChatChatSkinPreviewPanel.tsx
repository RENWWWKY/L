import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useMemo, useRef } from 'react'

import type { WeChatBubbleTheme, WeChatTheme } from '../../types'
import type { ChatTheme } from './chatTheme/types'
import { LocationChatRow } from './location/LocationChatRow'
import { WeChatMessageBubbleRow } from './WeChatMessageBubbleRow'
import { RedPacketChatRow } from './redPacket/RedPacketChatRow'
import { TransferBubbleFace } from './transfer/TransferBubble'
import { VoiceMessageBubble } from './VoiceMessageBubble'
import { ChatInputBar } from './voiceInput/ChatInputBar'
import {
  migrateMislabeledLumiDefaultBubble,
  resolveEffectiveChatInputBarForBubble,
} from './wechatBubblePresets'
import { chatDisplayFontCssVars, resolveChatDisplayFontFamily } from './wechatBubbleTemplateFonts'
import { resolveMessengerBubbleStyle } from './wechatMessengerSpecialBubbles'
import { weChatChatSkinCssProperties } from './wechatChatSkinVars'
import './wechatChatSkinScope.css'

const SAMPLE_LOCATION = {
  locationId: 'skin-preview-location',
  name: '中央公园',
  address: '示例路 88 号',
  distance: '320m',
  latitude: 0,
  longitude: 0,
}

type Props = {
  wechatTheme: WeChatTheme
  chatTheme: ChatTheme
  bubble: WeChatBubbleTheme
  roomBgStyle?: CSSProperties
  tailMaskColor?: string
}

function previewBubbleTail(
  bubble: WeChatBubbleTheme,
  groupPosition: 'first' | 'last' | 'only',
): boolean {
  if (!bubble.showBubbleTail) return false
  const tailStyle = bubble.bubbleTailStyle
  if (tailStyle === 'imessage') {
    return groupPosition === 'last' || groupPosition === 'only'
  }
  if (tailStyle === 'telegram' || tailStyle === 'talkmaker') {
    return groupPosition === 'first' || groupPosition === 'only'
  }
  return bubble.showBubbleTail && bubble.showAvatar
}

function PreviewChatMessageRow({
  isSelf,
  bubble,
  showAvatarColumn = true,
  children,
}: {
  isSelf: boolean
  bubble: WeChatBubbleTheme
  showAvatarColumn?: boolean
  children: ReactNode
}) {
  const showAvatarVisual = bubble.showAvatar && showAvatarColumn
  const reserveAvatarGutter = bubble.showAvatar
  const avatarPlaceholder = (
    <div
      className="h-10 w-10 shrink-0"
      style={{
        borderRadius: `${bubble.avatarRadiusPx}px`,
        background: isSelf ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.06)',
      }}
      aria-hidden
    />
  )

  if (!isSelf) {
    return (
      <div className="w-full max-w-full shrink-0 overflow-x-hidden">
        {!bubble.showAvatar ? (
          <div className="ml-[24px] mr-auto min-w-0">{children}</div>
        ) : showAvatarVisual ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            {avatarPlaceholder}
            {children}
          </div>
        ) : reserveAvatarGutter ? (
          <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
            <div className="h-10 w-10 shrink-0" aria-hidden />
            {children}
          </div>
        ) : (
          <div className="ml-[24px] mr-auto min-w-0">{children}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-full shrink-0 items-end justify-end overflow-x-hidden">
      {!bubble.showAvatar ? (
        <div className="mr-[24px] ml-auto min-w-0">{children}</div>
      ) : showAvatarVisual ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {children}
          {avatarPlaceholder}
        </div>
      ) : reserveAvatarGutter ? (
        <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
          {children}
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </div>
      ) : (
        <div className="mr-[24px] ml-auto min-w-0">{children}</div>
      )}
    </div>
  )
}

/** 聊天气泡页统一预览：顶栏 + 文字/连续气泡 + 特殊消息 + 输入栏（与当前气泡模版一致） */
export function WeChatChatSkinPreviewPanel({
  wechatTheme,
  chatTheme,
  bubble,
  roomBgStyle,
  tailMaskColor = '#EDEDED',
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const effectiveBubble = useMemo(() => migrateMislabeledLumiDefaultBubble(bubble), [bubble])
  const inputBar = useMemo(
    () => resolveEffectiveChatInputBarForBubble(chatTheme.inputBar, effectiveBubble),
    [chatTheme.inputBar, effectiveBubble],
  )
  const previewChatTheme = useMemo(
    () => ({ ...chatTheme, inputBar }),
    [chatTheme, inputBar],
  )
  const messengerStyle = resolveMessengerBubbleStyle(effectiveBubble)
  const inputLayout = inputBar.layout ?? 'lumi'
  const mergeAvatarGroup =
    effectiveBubble.bubbleTailStyle === 'wechat' ? false : effectiveBubble.mergeConsecutiveAvatarGroup

  const bubbleTail = useCallback(
    (groupPosition: 'first' | 'last' | 'only') => previewBubbleTail(effectiveBubble, groupPosition),
    [effectiveBubble],
  )

  const scopeStyle: CSSProperties = {
    ...roomBgStyle,
    ...chatDisplayFontCssVars(resolveChatDisplayFontFamily(effectiveBubble)),
    ...weChatChatSkinCssProperties(wechatTheme, previewChatTheme),
    '--wx-self-bubble-bg': effectiveBubble.selfBubbleBg,
    '--wx-self-bubble-text': wechatTheme.selfBubbleText,
    '--wx-self-bubble-radius': `${effectiveBubble.selfBubbleRadiusPx}px`,
    '--wx-other-bubble-bg': effectiveBubble.otherBubbleBg,
    '--wx-other-bubble-text': wechatTheme.otherBubbleText,
    '--wx-other-bubble-radius': `${effectiveBubble.otherBubbleRadiusPx}px`,
    '--wx-avatar-radius': `${effectiveBubble.avatarRadiusPx}px`,
    '--wx-timestamp-text': wechatTheme.timestampText,
  } as CSSProperties

  return (
    <div
      data-wx-chat-skin-scope
      className="mt-3 overflow-hidden rounded-[14px] border border-black/5 shadow-sm"
      style={scopeStyle}
    >
      <header
        data-wx-chat-header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
        style={{
          borderColor: 'var(--wx-chat-header-border, var(--wx-border))',
          background: 'var(--wx-chat-header-bg, var(--wx-surface))',
          color: 'var(--wx-chat-header-text, var(--wx-text))',
        }}
      >
        <span className="text-[13px] opacity-70" aria-hidden>
          ‹
        </span>
        <span className="truncate text-[14px] font-semibold">预览</span>
        <span className="text-[13px] opacity-70" aria-hidden>
          ⋯
        </span>
      </header>

      <div className="space-y-3 px-2 py-3">
        <p className="text-center text-[10px] leading-snug" style={{ color: 'var(--wx-text-muted)' }}>
          预览区与当前选中的气泡模版一致；切换模版或调整颜色后可即时查看。
        </p>

        {wechatTheme.timestampStyle === 'hidden' ? null : (
          <div className="flex justify-center">
            <span
              className="rounded-full px-3 py-1 text-[12px]"
              style={{
                color: 'var(--wx-timestamp-text)',
                background: 'rgba(0,0,0,0.03)',
                lineHeight: 1.1,
                fontFamily: 'var(--wx-chat-font, var(--wx-font))',
              }}
            >
              <span style={{ fontFamily: 'var(--wx-chat-font, var(--wx-font))' }}>今天&nbsp;</span>
              <span
                style={{
                  fontFamily: 'var(--wx-num-font)',
                  fontVariantNumeric: 'tabular-nums lining-nums',
                  fontFeatureSettings: '"tnum" 1, "lnum" 1',
                  display: 'inline-block',
                }}
              >
                09:41
              </span>
            </span>
          </div>
        )}

        <p className="pt-1 text-center text-[10px]" style={{ color: 'var(--wx-text-muted)' }}>
          文字气泡
        </p>
        <WeChatMessageBubbleRow
          messageText="这是对方气泡预览：低饱和、留白、干净。"
          isSelf={false}
          bubble={effectiveBubble}
          showAvatar={effectiveBubble.showAvatar}
          showBubbleTail={bubbleTail('first')}
          variant="preview"
          showAvatarColumn
          bubbleTailMaskColor={tailMaskColor}
        />
        <WeChatMessageBubbleRow
          messageText={
            mergeAvatarGroup && effectiveBubble.showAvatar
              ? '连续对方消息：本行无头像，左侧占位与首条气泡对齐。'
              : '连续对方消息：每条均显示头像。'
          }
          isSelf={false}
          bubble={effectiveBubble}
          showAvatar={effectiveBubble.showAvatar}
          showBubbleTail={bubbleTail('last')}
          variant="preview"
          showAvatarColumn={!(mergeAvatarGroup && effectiveBubble.showAvatar)}
          bubbleTailMaskColor={tailMaskColor}
        />
        {mergeAvatarGroup && effectiveBubble.showAvatar ? (
          <>
            <WeChatMessageBubbleRow
              messageText="这是我方气泡预览：主色弱点缀，圆角克制。（同组首条右侧带头像）"
              isSelf
              bubble={effectiveBubble}
              showAvatar={effectiveBubble.showAvatar}
              showBubbleTail={bubbleTail('first')}
              variant="preview"
              showAvatarColumn
              bubbleTailMaskColor={tailMaskColor}
            />
            <WeChatMessageBubbleRow
              messageText="连续我方消息：本行无头像，右侧占位与首条气泡对齐。"
              isSelf
              bubble={effectiveBubble}
              showAvatar={effectiveBubble.showAvatar}
              showBubbleTail={bubbleTail('last')}
              variant="preview"
              showAvatarColumn={false}
              bubbleTailMaskColor={tailMaskColor}
            />
          </>
        ) : (
          <>
            <WeChatMessageBubbleRow
              messageText="这是我方气泡预览：主色弱点缀，圆角克制。"
              isSelf
              bubble={effectiveBubble}
              showAvatar={effectiveBubble.showAvatar}
              showBubbleTail={bubbleTail('first')}
              variant="preview"
              showAvatarColumn
              bubbleTailMaskColor={tailMaskColor}
            />
            <WeChatMessageBubbleRow
              messageText="连续我方消息：每条均显示头像。"
              isSelf
              bubble={effectiveBubble}
              showAvatar={effectiveBubble.showAvatar}
              showBubbleTail={bubbleTail('last')}
              variant="preview"
              showAvatarColumn
              bubbleTailMaskColor={tailMaskColor}
            />
          </>
        )}

        <p className="pt-1 text-center text-[10px]" style={{ color: 'var(--wx-text-muted)' }}>
          特殊消息
        </p>
        <RedPacketChatRow
          id="skin-preview-rp"
          isSelf={false}
          data={{ remark: 'Best Wishes', opened: false, amountYuan: 88 }}
          bubble={effectiveBubble}
          showAvatar={effectiveBubble.showAvatar}
          showAvatarColumn
          onOpen={() => {}}
        />
        <PreviewChatMessageRow isSelf={false} bubble={effectiveBubble}>
          <TransferBubbleFace
            messengerStyle={messengerStyle}
            status="pending"
            amountYuan={520}
            remark="示例转账"
            perspective="incoming"
          />
        </PreviewChatMessageRow>
        <PreviewChatMessageRow isSelf={false} bubble={effectiveBubble}>
          <VoiceMessageBubble
            isUser={false}
            duration={8}
            audioUrl=""
            transcriptText="对方语音转写预览"
            messengerStyle={messengerStyle}
            bubble={effectiveBubble}
            showBubbleTail={bubbleTail('only')}
            bubbleTailMaskColor={tailMaskColor}
          />
        </PreviewChatMessageRow>
        <PreviewChatMessageRow isSelf bubble={effectiveBubble}>
          <VoiceMessageBubble
            isUser
            duration={12}
            audioUrl=""
            transcriptText="己方语音转写预览"
            messengerStyle={messengerStyle}
            bubble={effectiveBubble}
            showBubbleTail={bubbleTail('only')}
            bubbleTailMaskColor={tailMaskColor}
          />
        </PreviewChatMessageRow>
        <LocationChatRow
          id="skin-preview-loc-other"
          isSelf={false}
          data={SAMPLE_LOCATION}
          bubble={effectiveBubble}
          showAvatar={effectiveBubble.showAvatar}
          showAvatarColumn
          showBubbleTail={bubbleTail('only')}
          bubbleTailMaskColor={tailMaskColor}
        />
        <LocationChatRow
          id="skin-preview-loc-self"
          isSelf
          data={SAMPLE_LOCATION}
          bubble={effectiveBubble}
          showAvatar={effectiveBubble.showAvatar}
          showAvatarColumn
          showBubbleTail={bubbleTail('only')}
          bubbleTailMaskColor={tailMaskColor}
        />
      </div>

      <div
        data-wx-chat-input-bar
        className="border-t px-2 py-2"
        style={{
          backgroundColor: 'var(--wx-chat-input-bar-bg, var(--wx-input-bg))',
          borderTopColor: 'var(--wx-chat-input-bar-border, #e5e5e5)',
        }}
      >
        <p className="mb-1.5 text-center text-[10px]" style={{ color: 'var(--wx-text-muted)' }}>
          输入栏
        </p>
        <ChatInputBar
          inputMode="text"
          btnPx={inputBar.buttonSize}
          btnColor={inputBar.buttonColor}
          layout={inputLayout}
          sendButtonColor={inputBar.sendButtonColor}
          borderRadius={inputBar.borderRadius}
          borderColor={inputBar.borderColor}
          draft=""
          sendBusy={false}
          planeCanAct={false}
          plusMenuOpen={false}
          onToggleInputMode={() => {}}
          textareaRef={textareaRef}
          onVoicePointerDown={() => {}}
          onVoicePointerMove={() => {}}
          onVoicePointerUp={() => {}}
          onDraftChange={() => {}}
          onComposerKeyDown={() => {}}
          onToggleEmoji={() => {}}
          onTogglePlus={() => {}}
          onSend={() => {}}
        />
      </div>
    </div>
  )
}
