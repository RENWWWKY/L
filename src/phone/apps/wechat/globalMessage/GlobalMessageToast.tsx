import { motion } from 'framer-motion'
import type { WeChatInAppCharacterMessageDetail } from './wechatGlobalMessageGuard'
import {
  globalMessageToastGridStyle,
  globalMessageToastTopStyle,
} from './globalMessageLayout'

const POD_LAYOUT_ID = 'wechat-global-message-pod'

const toastSpring = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.95 }

type Props = {
  detail: WeChatInAppCharacterMessageDetail
  onPress: () => void
}

export function GlobalMessageToast({ detail, onPress }: Props) {
  return (
    <motion.button
      type="button"
      layoutId={POD_LAYOUT_ID}
      initial={{ y: -52, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -28, opacity: 0, scale: 0.98 }}
      transition={toastSpring}
      onClick={onPress}
      className="fixed left-1/2 z-[9999] grid w-[min(90vw,420px)] max-w-[90%] -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-100 bg-white/90 py-0 pl-5 pr-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl"
      style={{ ...globalMessageToastTopStyle, ...globalMessageToastGridStyle }}
      aria-label={`${detail.title}：${detail.preview}`}
    >
      <span className="row-span-2 flex items-center justify-center self-stretch py-4">
        {detail.avatarUrl ? (
          <img
            src={detail.avatarUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
            width={44}
            height={44}
          />
        ) : (
          <span className="h-11 w-11 shrink-0 rounded-full bg-neutral-200" aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 items-end pb-1.5 pt-2.5">
        <span className="truncate text-[14px] font-medium leading-tight text-neutral-950">{detail.title}</span>
      </span>
      <span className="min-w-0 pb-4 pt-1">
        <span className="line-clamp-2 text-[12px] leading-[1.45] text-gray-500">{detail.preview}</span>
      </span>
    </motion.button>
  )
}

export { POD_LAYOUT_ID }
