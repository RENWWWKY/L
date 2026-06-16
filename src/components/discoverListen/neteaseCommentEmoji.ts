/**
 * 网易云评论/动态里的 [大哭] 等占位符 → 可渲染字符。
 * 官方 Web 端使用 CDN 雪碧图，但未提供稳定公开 API；第三方普遍用名称对照表。
 * 数据来源参考 SPlayer / 网易云 Web 端表情集。
 */
export const NETEASE_COMMENT_EMOJI: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: '大笑', emoji: '😄' },
  { name: '可爱', emoji: '😊' },
  { name: '憨笑', emoji: '😄' },
  { name: '亲亲', emoji: '😘' },
  { name: '流泪', emoji: '😢' },
  { name: '亲', emoji: '😊' },
  { name: '呆', emoji: '😐' },
  { name: '哀伤', emoji: '😢' },
  { name: '呲牙', emoji: '😁' },
  { name: '吐舌', emoji: '😝' },
  { name: '撇嘴', emoji: '😒' },
  { name: '怒', emoji: '😡' },
  { name: '奸笑', emoji: '😏' },
  { name: '汗', emoji: '😅' },
  { name: '痛苦', emoji: '😣' },
  { name: '惶恐', emoji: '😱' },
  { name: '生病', emoji: '🤒' },
  { name: '口罩', emoji: '😷' },
  { name: '大哭', emoji: '😭' },
  { name: '晕', emoji: '😵' },
  { name: '发怒', emoji: '😡' },
  { name: '开心', emoji: '😀' },
  { name: '鬼脸', emoji: '😈' },
  { name: '皱眉', emoji: '😠' },
  { name: '流感', emoji: '🤧' },
  { name: '爱心', emoji: '❤️' },
  { name: '心碎', emoji: '💔' },
  { name: '钟情', emoji: '💗' },
  { name: '星星', emoji: '⭐' },
  { name: '生气', emoji: '💢' },
  { name: '便便', emoji: '💩' },
  { name: '强', emoji: '💪' },
  { name: '弱', emoji: '💤' },
  { name: '拜', emoji: '🙏' },
  { name: '牵手', emoji: '🤝' },
  { name: '跳舞', emoji: '💃' },
  { name: '禁止', emoji: '🚫' },
  { name: '这边', emoji: '👉' },
  { name: '爱意', emoji: '😍' },
  { name: '示爱', emoji: '💏' },
  { name: '嘴唇', emoji: '💋' },
  { name: '狗', emoji: '🐶' },
  { name: '猫', emoji: '😸' },
  { name: '猪', emoji: '🐷' },
  { name: '兔子', emoji: '🐰' },
  { name: '小鸡', emoji: '🐔' },
  { name: '公鸡', emoji: '🐓' },
  { name: '幽灵', emoji: '👻' },
  { name: '圣诞', emoji: '🎅' },
  { name: '外星', emoji: '👽' },
  { name: '钻石', emoji: '💎' },
  { name: '礼物', emoji: '🎁' },
  { name: '男孩', emoji: '👦' },
  { name: '女孩', emoji: '👧' },
  { name: '蛋糕', emoji: '🎂' },
  { name: '18', emoji: '🔞' },
  { name: '圈', emoji: '⭕' },
  { name: '叉', emoji: '❌' },
  { name: '惊恐', emoji: '😱' },
  { name: '色', emoji: '😍' },
] as const

const EMOJI_BY_NAME = new Map(NETEASE_COMMENT_EMOJI.map((item) => [item.name, item.emoji]))

/** 与网易云 Web 端一致的 [名称] 占位符 */
const NETEASE_EMOJI_TOKEN = /\[([^[\]\s]+?)\]/g

export type NeteaseCommentTextPart =
  | { type: 'text'; value: string }
  | { type: 'emoji'; value: string; name: string }

export function parseNeteaseCommentText(text: string): NeteaseCommentTextPart[] {
  if (!text) return []

  const parts: NeteaseCommentTextPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  NETEASE_EMOJI_TOKEN.lastIndex = 0
  while ((match = NETEASE_EMOJI_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const name = match[1]
    const emoji = EMOJI_BY_NAME.get(name)
    if (emoji) {
      parts.push({ type: 'emoji', value: emoji, name })
    } else {
      parts.push({ type: 'text', value: match[0] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}
