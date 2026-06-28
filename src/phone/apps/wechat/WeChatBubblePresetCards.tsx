import { Pressable } from '../../components/Pressable'
import { resolvePublicImageUrl } from '../../../publicAssetUrl'
import type { WeChatBubbleTheme, WeChatTheme } from '../../types'
import { wechatChatRoomBgToStyle } from './wechatChatRoomBg'
import {
  type WeChatBubblePreset,
  wechatBubblePresetMatchesActive,
} from './wechatBubblePresets'
import { bubbleTemplateFontFamily } from './wechatBubbleTemplateFonts'

function MiniBubbleSwatch({
  selfBg,
  otherBg,
  chatRoomDefaultBg,
  fontFamily,
}: {
  selfBg: string
  otherBg: string
  chatRoomDefaultBg: WeChatBubblePreset['chatRoomDefaultBg']
  fontFamily?: string
}) {
  return (
    <div
      className="overflow-hidden rounded-[10px]"
      style={wechatChatRoomBgToStyle(chatRoomDefaultBg, resolvePublicImageUrl)}
    >
      <div
        className="flex items-end justify-center gap-2 px-1 py-2"
        style={fontFamily ? { fontFamily } : undefined}
      >
        <span
          className="inline-block max-w-[72px] rounded-[6px] px-2 py-1 text-[10px] leading-snug"
          style={{ background: otherBg, color: '#191919', boxShadow: '0 0 0 1px rgba(0,0,0,0.04)' }}
        >
          对方
        </span>
        <span
          className="inline-block max-w-[72px] rounded-[6px] px-2 py-1 text-[10px] leading-snug"
          style={{ background: selfBg, color: '#191919' }}
        >
          我方
        </span>
      </div>
    </div>
  )
}

export function WeChatBubblePresetCards({
  presets,
  activeBubble,
  selfBubbleText,
  otherBubbleText,
  wechatTheme,
  bubbleScope,
  onApply,
}: {
  presets: WeChatBubblePreset[]
  activeBubble: WeChatBubbleTheme
  selfBubbleText: string
  otherBubbleText: string
  wechatTheme: WeChatTheme
  bubbleScope: 'global' | 'role'
  onApply: (preset: WeChatBubblePreset) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {presets.map((preset) => {
        const active = wechatBubblePresetMatchesActive(
          preset,
          activeBubble,
          selfBubbleText,
          otherBubbleText,
          wechatTheme,
          bubbleScope,
        )
        return (
          <Pressable
            key={preset.id}
            type="button"
            onClick={() => onApply(preset)}
            className="rounded-[16px] border p-3 text-left transition-[background-color,box-shadow] duration-150"
            style={{
              borderColor: active ? 'var(--wx-primary)' : 'var(--wx-border)',
              background: active ? 'rgba(0,0,0,0.04)' : 'var(--wx-surface)',
              boxShadow: active ? '0 0 0 1px color-mix(in oklab, var(--wx-primary) 35%, transparent)' : undefined,
            }}
            aria-pressed={active}
          >
            <MiniBubbleSwatch
              selfBg={preset.bubble.selfBubbleBg}
              otherBg={preset.bubble.otherBubbleBg}
              chatRoomDefaultBg={preset.chatRoomDefaultBg}
              fontFamily={
                preset.bubble.bubbleTailStyle
                  ? bubbleTemplateFontFamily(preset.bubble.bubbleTailStyle)
                  : undefined
              }
            />
            <p
              className="mt-1 text-[12px] font-medium"
              style={{
                color: 'var(--wx-text)',
                fontFamily: preset.bubble.bubbleTailStyle
                  ? bubbleTemplateFontFamily(preset.bubble.bubbleTailStyle)
                  : undefined,
              }}
            >
              {preset.name}
              {active ? (
                <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--wx-text-muted)' }}>
                  当前
                </span>
              ) : null}
            </p>
          </Pressable>
        )
      })}
    </div>
  )
}
