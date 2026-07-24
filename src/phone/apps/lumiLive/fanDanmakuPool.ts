/** 随机语料池仍保留；直播间主链路已改为 liveChatContext 上下文链式 mock */
export type { LiveDanmakuStyle } from './types'

export {
  buildSeedFanLines,
  pickContextualFanBatch as pickFanDanmakuBatch,
} from './liveChatContext'
