/**
 * 人设模式：**换行 = 多条气泡**，不用 JSON。
 * 解析见 `parseWeChatPeerPlainReply`：仅按换行拆分，无本地强拆。
 * 正文定义见 `wechatReplyOutputPrompt.ts`（与 Lumi 共用统一协议）。
 */
export {
  WECHAT_REPLY_OUTPUT_APPENDIX,
  WECHAT_REPLY_OUTPUT_APPENDIX as WECHAT_SEGMENTATION_JSON_APPENDIX,
} from './wechatReplyOutputPrompt'
