import type { SVGProps } from 'react'

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** 微信：单一路径绘制的聊天气泡（圆角主体 + 左下指向三角尾） */
export function IconWeChat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 6.5h9a2 2 0 0 1 2 2v5.2a2 2 0 0 1-2 2h-4.1l-2.4 4V15.7H7.5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z" />
    </svg>
  )
}

/** 外卖：购物袋身 + 半圆提手 + 袋口折线 */
export function IconTakeout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 10 Q12 6 15.5 10" />
      <path d="M6 10h12v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 17v-7z" />
      <path d="M9 14h6" />
    </svg>
  )
}

/** 微博：地球经纬线（社交/广播意象） */
export function IconWeibo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M5.5 12h13" />
      <path d="M12 5.5c1.8 2.2 1.8 10.8 0 13" />
      <path d="M8.2 7.5c2.2 1.5 5.6 1.5 7.8 0M8.2 16.5c2.2-1.5 5.6-1.5 7.8 0" />
    </svg>
  )
}

/** API：插头 / 接口（两侧插脚 + 主体） */
export function IconApi(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4.5v3.5M15 4.5v3.5" />
      <path d="M6.5 8h11v4.5a3.5 3.5 0 0 1-3.5 3.5h-4A3.5 3.5 0 0 1 6.5 12.5V8z" />
      <path d="M10 16v3.5M14 16v3.5" />
    </svg>
  )
}

export function IconAppearance(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2.2" />
      <path d="M12 19.8V22" />
      <path d="M2 12h2.2" />
      <path d="M19.8 12H22" />
      <path d="M4.5 4.5l1.6 1.6" />
      <path d="M17.9 17.9l1.6 1.6" />
      <path d="M4.5 19.5l1.6-1.6" />
      <path d="M17.9 6.1l1.6-1.6" />
    </svg>
  )
}

/** 声纹：麦克风 + 声波线 */
export function IconVoiceprint(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 13.8a2.6 2.6 0 0 0 2.6-2.6V7.6a2.6 2.6 0 0 0-5.2 0v3.6A2.6 2.6 0 0 0 12 13.8z" />
      <path d="M7.8 11.1a4.2 4.2 0 0 0 8.4 0" />
      <path d="M12 16.2v3.3" />
      <path d="M9.4 19.5h5.2" />
    </svg>
  )
}

const map = {
  wechat: IconWeChat,
  takeout: IconTakeout,
  weibo: IconWeibo,
  api: IconApi,
  voiceprint: IconVoiceprint,
  appearance: IconAppearance,
} as const

export function AppLineIcon({
  id,
  className,
  ...rest
}: { id: keyof typeof map } & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  const Cmp = map[id]
  return <Cmp className={className} aria-hidden {...rest} />
}
