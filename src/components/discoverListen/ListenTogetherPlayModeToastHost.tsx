import { AnimatePresence } from 'framer-motion'

import { useMusicStore } from '../../stores/useMusicStore'
import { PlayModeSwitchToast } from './PlayModeSwitchToast'

/** 全局播放模式切换提示（悬浮球 / 全屏播放等共用） */
export function ListenTogetherPlayModeToastHost() {
  const label = useMusicStore((s) => s.playModeToast)

  return (
    <div className="pointer-events-none absolute inset-0 z-[10001] overflow-hidden">
      <AnimatePresence>{label ? <PlayModeSwitchToast label={label} /> : null}</AnimatePresence>
    </div>
  )
}
