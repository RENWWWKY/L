import {
  WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY,
  WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
  WECHAT_NON_PRIMARY_SPEAKER_IRON_RULES,
  WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
  WECHAT_THIRD_PARTY_PSYCHOLOGY_RULES,
} from './wechatAltAccountPrompt'
import { WECHAT_MEMORY_LINE_SCOPE_RULES } from './wechatMemoryLineScopeRules'

const POLICY_LITERAL_BLOCKS = [
  WECHAT_MEMORY_LINE_SCOPE_RULES,
  WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
  WECHAT_NON_PRIMARY_SPEAKER_IRON_RULES,
  WECHAT_THIRD_PARTY_PSYCHOLOGY_RULES,
  WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
  WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY,
]

function removeLiteralBlock(text: string, block: string): string {
  const b = block.trim()
  if (!b || !text.includes(b)) return text
  return text.split(b).join('\n')
}

/**
 * 思维溯源 UI：去掉仅注入模型用的分线铁则/跨号说明，保留未总结聊天摘录等实质内容。
 * 不影响 ChatRoom 拼进 prompt 的原文。
 */
export function stripPromptPolicyBlocksForTraceDisplay(text: string): string {
  let s = String(text ?? '').trim()
  if (!s) return ''

  s = s.replace(/\n*（↑[^）\n]*）[\s\S]*$/m, '').trim()

  const anchorIdx = s.indexOf('【私聊记忆注入 · 分线锚点')
  if (anchorIdx >= 0) {
    const nextSection = s.slice(anchorIdx).search(/\n【(?!私聊记忆注入)/)
    if (nextSection >= 0) {
      s = (s.slice(0, anchorIdx) + s.slice(anchorIdx + nextSection)).trim()
    } else {
      s = s.slice(0, anchorIdx).trim()
    }
  }

  const crossIntro = '【其它微信号 · 未总结私聊摘录 · 分线参考】'
  const crossIntroIdx = s.indexOf(crossIntro)
  if (crossIntroIdx >= 0) {
    const excerptStart = s.indexOf('【其它微信线 ·', crossIntroIdx)
    if (excerptStart >= 0) {
      s = s.slice(excerptStart).trim()
    }
  }

  for (const block of POLICY_LITERAL_BLOCKS) {
    s = removeLiteralBlock(s, block)
  }

  s = s
    .replace(/\*\*再次确认\*\*：[^\n]+\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return s
}
