import { pullPhoneKvWithLocalStorageLegacy } from '../newFriendsPersona/idb'
import { splitDatingAssistantOutput } from './plotCoT'

/** 与约会页 `DATING_AI_PLOT_HISTORY_MAX` 对齐：微信回复参考最近若干条线下剧情 */
export const WECHAT_OFFLINE_DATING_PLOT_MAX = 5

const STORAGE_KEY = 'wechat-dating-archives-v1'

type PlotLike = { type?: string; content?: string }
type ArchiveLike = { plots?: PlotLike[] }

function clipBody(s: string, maxChars: number): string {
  const t = String(s || '').trim()
  if (!t) return ''
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars)}（…已截断）`
}

/**
 * 读取当前角色在「约会页」的最近线下剧情（去 thinking），供微信 system 注入，避免线下↔线上脱节。
 * 与 `DatingContext` 使用同一 `wechat-dating-archives-v1` 存档（优先 IndexedDB，兼容 legacy localStorage）。
 */
export async function loadOfflineDatingPlotsPromptBlock(
  characterId: string | null | undefined,
  characterDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  if (!cid) return ''
  try {
    const raw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
    if (!raw || typeof raw !== 'object') return ''
    const store = raw as Record<string, unknown>
    const arch = store[cid] as ArchiveLike | undefined
    const plots = Array.isArray(arch?.plots) ? arch.plots : []
    if (!plots.length) return ''
    const tail = plots.slice(-WECHAT_OFFLINE_DATING_PLOT_MAX)
    const label = characterDisplayName?.trim() || '角色'
    const chunks: string[] = []
    let n = 0
    for (const p of tail) {
      const role = p.type === 'player' ? '玩家（线下输入）' : `${label}（线下剧情）`
      let body = String(p.content || '').trim()
      if (p.type !== 'player') {
        body = splitDatingAssistantOutput(body).content.trim()
      }
      body = clipBody(body, 2400)
      if (!body) continue
      n += 1
      chunks.push(`【${n}】${role}\n${body}`)
    }
    if (!chunks.length) return ''
    const body = chunks.join('\n\n').slice(0, 11000)
    return (
      `【线下约会剧情·最近 ${chunks.length} 条】与当前微信会话为**同一角色、同一时间线**。` +
      `生成微信回复时**须参考**下列已发生事实（地点、人物、矛盾、约定、情绪），自然衔接，**禁止**与线下剧情明显矛盾或假装线下从未发生；若下列为空则可忽略。\n\n` +
      body
    )
  } catch {
    return ''
  }
}
