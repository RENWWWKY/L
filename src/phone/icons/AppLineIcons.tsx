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

/** 数据中心：双层圆角机架 + 槽位线（存储/节点意象，与全局线宽一致） */
export function IconDataArchive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5.75h14a2 2 0 0 1 2 2v2.65a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.75a2 2 0 0 1 2-2z" />
      <path d="M5 13.6h14a2 2 0 0 1 2 2v2.65a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.65a2 2 0 0 1 2-2z" />
      <path d="M7.25 8.75h5.5M7.25 16.6h5.5" opacity="0.42" />
      <path d="M15 8.75h2.75M15 16.6h2.75" opacity="0.42" />
    </svg>
  )
}

/** 档案室：层叠书页 + 细脊线 */
export function IconLoreArchive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 5.5h7.5a3.5 3.5 0 0 1 3.5 3.5v9a1.5 1.5 0 0 1-1.5 1.5H7a2.5 2.5 0 0 1-2.5-2.5v-9A3.5 3.5 0 0 1 7 5.5z" />
      <path d="M8.5 7.25h6.2M8.5 10.1h6.2M8.5 12.95h4.3" opacity="0.35" />
      <path d="M9.2 5.35L8.2 4.1a1.2 1.2 0 0 1 .2-1.85h6.1a3.1 3.1 0 0 1 3.1 3.1v1.1" opacity="0.45" />
    </svg>
  )
}

/** 遇见：同心圆雷达意象 + 中心光点（宿命邂逅） */
export function IconLumiMeet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.25" opacity="0.28" />
      <circle cx="12" cy="12" r="5.25" opacity="0.45" />
      <circle cx="12" cy="12" r="2.15" />
    </svg>
  )
}

/** 回收站：筒身 + 波纹盖 */
export function IconRecycleBin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 9.5h6l-.8 9.2a1.2 1.2 0 0 1-1.2 1.1h-2a1.2 1.2 0 0 1-1.2-1.1L9 9.5z" />
      <path d="M7.5 9.5h9" />
      <path d="M10 7V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
      <path d="M8 12.5h8" opacity="0.35" />
    </svg>
  )
}

/** 幻境引擎：六边形沙盒网格（平行宇宙推演意象） */
export function IconSandbox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.25 17.2 7.25v6l-5.2 3-5.2-3v-6L12 4.25z" />
      <path d="M12 8.1v3.8M9.7 9.95h4.6" opacity="0.38" />
      <circle cx="12" cy="10" r="1.15" opacity="0.55" />
    </svg>
  )
}

/** 后台通知：铃铛 */
export function IconBackgroundNotify(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5a3.2 3.2 0 0 0-3.2 3.2v2.1c0 .8-.3 1.6-.8 2.2L7 13.2h10l-.9-1.2c-.5-.6-.8-1.4-.8-2.2V7.7A3.2 3.2 0 0 0 12 4.5z" />
      <path d="M10 15.8h4" />
      <path d="M10.8 17.8a1.2 1.2 0 0 0 2.4 0" />
    </svg>
  )
}

const map = {
  wechat: IconWeChat,
  takeout: IconTakeout,
  weibo: IconWeibo,
  lumiMeet: IconLumiMeet,
  api: IconApi,
  voiceprint: IconVoiceprint,
  dataArchive: IconDataArchive,
  loreArchive: IconLoreArchive,
  recycleBin: IconRecycleBin,
  backgroundNotify: IconBackgroundNotify,
  sandbox: IconSandbox,
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
