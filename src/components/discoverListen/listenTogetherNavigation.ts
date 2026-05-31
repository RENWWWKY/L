import { useMusicStore } from '../../stores/useMusicStore'

export const LISTEN_TOGETHER_NAVIGATE_EVENT = 'listen-together:navigate'
export const LISTEN_TOGETHER_FULLSCREEN_EVENT = 'listen-together:fullscreen'

/** 从任意应用直接唤起全屏歌词/播放页（不跳转微信发现 Tab） */
export function navigateToListenTogetherFullscreen(): void {
  useMusicStore.getState().openListenFullscreen()
}
