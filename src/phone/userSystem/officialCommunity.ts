/** 官方 QQ 答疑群号 */
export const OFFICIAL_QQ_GROUP_NUMBER = '1084498477'

/** 官方 Discord 社区 ID（可在 .env 设置 VITE_OFFICIAL_DISCORD_COMMUNITY_ID） */
export const OFFICIAL_DISCORD_COMMUNITY_ID = (
  import.meta.env.VITE_OFFICIAL_DISCORD_COMMUNITY_ID as string | undefined
)?.trim() || ''

/** 官方 Discord 验证区频道（完成入门验证获取 Lumi 身份组） */
export const OFFICIAL_DISCORD_VERIFY_CHANNEL_URL =
  'https://discord.com/channels/1495319174044712993/1528933401959334008'

/** QQ 群入群申请说明 */
export const OFFICIAL_QQ_GROUP_JOIN_HINT = '入群申请原因请填写你的 Discord 社区 ID'

/** 首页使用前须知中的补充说明 */
export const OFFICIAL_COMMUNITY_JOIN_HINT = `加入官方 QQ 群（群号 ${OFFICIAL_QQ_GROUP_NUMBER}）时，${OFFICIAL_QQ_GROUP_JOIN_HINT}。`
