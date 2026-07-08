/** 《雨夜归零》· 聊天室氛围背景（Vite ?url） */
import yuyeChatRoomBgVideo from '../../../剧本杀/《雨夜归零》/聊天室背景视频.mp4?url'
import yuyeGameplayBgm from '../../../剧本杀/《雨夜归零》/功能音频/BGM1.mp3?url'
import yuyeAmbulanceSiren from '../../../剧本杀/《雨夜归零》/功能音频/救护车鸣笛.mp3?url'
import yuyePourWine from '../../../剧本杀/《雨夜归零》/功能音频/倒酒.mp3?url'
import yuyePlate from '../../../剧本杀/《雨夜归零》/功能音频/放盘子.mp3?url'
import yuyeOpenWineBottle from '../../../剧本杀/《雨夜归零》/功能音频/开酒瓶.mp3?url'
import yuyePageFlip from '../../../剧本杀/《雨夜归零》/功能音频/翻页声.mp3?url'
import yuyeClueCardFlip from '../../../剧本杀/《雨夜归零》/功能音频/翻卡片（公共线索等）.mp3?url'
import yuyeDoctorRun from '../../../剧本杀/《雨夜归零》/功能音频/快跑声.mp3?url'

export function getChatRoomVideoUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeChatRoomBgVideo
  return undefined
}

/** 游玩全程背景音乐（独立 Audio 轨，与 DM 语音 / 视频氛围轨分轨） */
export function getChatRoomBgmUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeGameplayBgm
  return undefined
}

/** 第一幕 20:10「救护车鸣笛切开雨幕」功能音效 */
export function getAmbulanceSirenUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeAmbulanceSiren
  return undefined
}

/** 第一幕程予安开席换盘（倒酒仅第一处「添酒」，见 yuyeAct1PublicPlotVoice） */
export function getPlateSfxUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyePlate
  return undefined
}

/** 第一幕程予安开席添酒（仅第一处，不与「添杯」重复） */
export function getPourWineSfxUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyePourWine
  return undefined
}

/** 第一幕 19:55 林晚星亲手开瓶功能音效 */
export function getOpenWineBottleSfxUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeOpenWineBottle
  return undefined
}

/** 打开个人剧本阅读器时的翻页音效 */
export function getPageFlipSfxUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyePageFlip
  return undefined
}

/** 新线索飞牌 · 点击翻开 / 收纳线索卡 */
export function getClueCardFlipSfxUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeClueCardFlip
  return undefined
}

/** 第一幕驻家医生从侧廊冲入 */
export function getDoctorRunSfxUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeDoctorRun
  return undefined
}
