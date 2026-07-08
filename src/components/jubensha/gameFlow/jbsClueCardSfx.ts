import { getClueCardFlipSfxUrl } from '../jbsChatRoomMedia'

import { createJbsSfxPlayer } from './jbsSfxPlayer'

const clueCardPlayer = createJbsSfxPlayer()

const CLUE_CARD_FLIP_VOLUME = 0.78

/** 新线索发放 · 点击线索卡牌时播放 */
export function playJbsClueCardFlipSfx(scriptId: string): void {
  const url = getClueCardFlipSfxUrl(scriptId)
  if (!url) return
  clueCardPlayer.play(url, CLUE_CARD_FLIP_VOLUME)
}
