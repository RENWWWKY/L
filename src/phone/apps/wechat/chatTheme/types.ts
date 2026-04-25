export interface ChatTheme {
  id: string
  name: string
  isDefault: boolean
  inputBar: {
    borderRadius: number
    borderColor: string
    buttonSize: number
    buttonColor: string
    backgroundColor: string
  }
  bubble: {
    borderRadius: number
    otherBackgroundColor: string
    myBackgroundColor: string
    showBorder: boolean
  }
}

export const DEFAULT_CHAT_THEME_ID = 'default-bw'

export const DEFAULT_CHAT_THEME: ChatTheme = {
  id: DEFAULT_CHAT_THEME_ID,
  name: '默认黑灰白',
  isDefault: true,
  inputBar: {
    borderRadius: 16,
    borderColor: '#e5e5e5',
    buttonSize: 20,
    buttonColor: '#000000',
    backgroundColor: '#ffffff',
  },
  bubble: {
    /** 与 `DEFAULT_CUSTOMIZATION.wechatTheme.bubbleGlobal` 一致（非微信绿） */
    borderRadius: 18,
    otherBackgroundColor: '#EEEFF2',
    myBackgroundColor: 'rgba(123, 138, 166, 0.22)',
    showBorder: false,
  },
}

export function normalizeChatTheme(raw: unknown): ChatTheme {
  const base = DEFAULT_CHAT_THEME
  if (!raw || typeof raw !== 'object') return { ...base, inputBar: { ...base.inputBar }, bubble: { ...base.bubble } }
  const o = raw as Record<string, unknown>
  const ib = (o.inputBar && typeof o.inputBar === 'object' ? o.inputBar : {}) as Record<string, unknown>
  const bb = (o.bubble && typeof o.bubble === 'object' ? o.bubble : {}) as Record<string, unknown>
  const num = (v: unknown, d: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d
  const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  return {
    id: str(o.id, base.id),
    name: str(o.name, base.name),
    isDefault: bool(o.isDefault, base.isDefault),
    inputBar: {
      borderRadius: num(ib.borderRadius, base.inputBar.borderRadius, 8, 28),
      borderColor: str(ib.borderColor, base.inputBar.borderColor),
      buttonSize: num(ib.buttonSize, base.inputBar.buttonSize, 14, 28),
      buttonColor: str(ib.buttonColor, base.inputBar.buttonColor),
      backgroundColor: str(ib.backgroundColor, base.inputBar.backgroundColor),
    },
    bubble: {
      borderRadius: num(bb.borderRadius, base.bubble.borderRadius, 4, 28),
      otherBackgroundColor: str(bb.otherBackgroundColor, base.bubble.otherBackgroundColor),
      myBackgroundColor: str(bb.myBackgroundColor, base.bubble.myBackgroundColor),
      showBorder: bool(bb.showBorder, base.bubble.showBorder),
    },
  }
}
