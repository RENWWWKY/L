import { useCallback } from 'react'

import { useMusicStore } from '../../stores/useMusicStore'
import { ListenTogetherActionToast } from './ListenTogetherActionToast'

/** 全局播放模式切换提示（悬浮球 / 全屏播放等共用） */
export function ListenTogetherPlayModeToastHost() {
  const label = useMusicStore((s) => s.playModeToast)
  const clearPlayModeToast = useCallback(() => {
    useMusicStore.setState({ playModeToast: null })
  }, [])

  return (
    <ListenTogetherActionToast
      message={label ? `已切换为${label}` : null}
      onClear={clearPlayModeToast}
    />
  )
}
