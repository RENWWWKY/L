import { getPageFlipSfxUrl } from '../jbsChatRoomMedia'

import { createJbsSfxPlayer } from './jbsSfxPlayer'

const pageFlipPlayer = createJbsSfxPlayer()

const PAGE_FLIP_VOLUME = 0.72

/** 打开剧本阅读器 / 选角翻书时播放翻页声 */
export function playJbsPageFlipSfx(scriptId: string): void {
  const url = getPageFlipSfxUrl(scriptId)
  if (!url) return
  pageFlipPlayer.play(url, PAGE_FLIP_VOLUME)
}
