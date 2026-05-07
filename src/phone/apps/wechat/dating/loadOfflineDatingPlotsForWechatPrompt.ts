import { personaDb } from '../newFriendsPersona/idb'
import { loadDatingPlotsFromKv, type DatingPlotSnapshotItem } from '../unifiedMemoryAutoSummary'
import { DATING_AI_REFERENCE_SECTION_CHAR_CAP } from './types'
import { splitDatingAssistantOutput } from './plotCoT'

function plotBodyForPrompt(p: DatingPlotSnapshotItem): string {
  const raw = String(p.content || '').trim()
  if (!raw) return ''
  if (p.type === 'player') return raw
  return splitDatingAssistantOutput(raw).content.trim()
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatPlotTraceDate(ts: number): string {
  const d = new Date(Number.isFinite(ts) ? ts : Date.now())
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function clipSnippet(s: string, max: number) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}（…）`
}

/** 游标后线下剧情：带时间戳的条列表（供思维溯源） */
export async function listUnsummarizedOfflinePlotTraceItems(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
  opts?: { maxItems?: number; snippetChars?: number; /** 不作条内字数截断（思维溯源完整展示） */ fullSnippet?: boolean },
): Promise<Array<{ date: string; snippet: string }>> {
  const cid = characterId?.trim()
  if (!cid) return []
  const maxItems = Math.max(1, Math.min(2000, opts?.maxItems ?? 16))
  const snippetChars = Math.max(80, Math.min(2000, opts?.snippetChars ?? 420))
  try {
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(cid)
    const dMin = plotCursor ?? 0
    const plots = await loadDatingPlotsFromKv(cid)
    const tail = plots
      .filter((p) => {
        const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
        return ts > dMin
      })
      .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))
      .slice(-maxItems)
    const peer = peerDisplayName?.trim() || '对方'
    const out: Array<{ date: string; snippet: string }> = []
    for (const p of tail) {
      const body = plotBodyForPrompt(p)
      if (!body) continue
      const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : Date.now()
      const role = p.type === 'player' ? '我' : peer
      const line = `${role}：${body}`
      out.push({
        date: formatPlotTraceDate(ts),
        snippet: opts?.fullSnippet ? line : clipSnippet(line, snippetChars),
      })
    }
    return out
  } catch {
    return []
  }
}

function clipReferenceTail(raw: string, cap: number, label: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t.length <= cap) return t
  const marker = `…【${label}：过长已保留末尾最近内容】\n`
  const budget = Math.max(0, cap - marker.length)
  return marker + t.slice(-budget)
}

/**
 * 与约会页 `getOnlineMemoryContext` / `generateDatingAi` 使用同一规则：
 * `getDatingPlotSummaryCursor` 之后、尚未写入「已总结长期记忆」的约会剧情正文（去思维链）。
 */
export async function buildUnsummarizedOfflineDatingText(
  characterId: string | null | undefined,
  peerDisplayName?: string | null,
): Promise<string> {
  const cid = characterId?.trim()
  if (!cid) return ''
  try {
    const plotCursor = await personaDb.getDatingPlotSummaryCursor(cid)
    const dMin = plotCursor ?? 0
    const plots = await loadDatingPlotsFromKv(cid)
    const tail = plots
      .filter((p) => {
        const ts = typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? p.timestamp : 1
        return ts > dMin
      })
      .sort((a, b) => (a.timestamp ?? 1) - (b.timestamp ?? 1))
    const peer = peerDisplayName?.trim() || '对方'
    const lines: string[] = []
    for (const p of tail) {
      const t = plotBodyForPrompt(p)
      if (!t) continue
      if (p.type === 'player') lines.push(`我：${t}`)
      else lines.push(`${peer}：${t}`)
    }
    return lines.join('\n')
  } catch {
    return ''
  }
}

/**
 * 微信与其它线上 completion：注入「尚未总结·线下剧情」，与约会页游标规则一致。
 * 正文过长时保留时间轴末尾（与约会参考资料裁剪策略一致）。
 */
export async function loadOfflineDatingPlotsPromptBlock(
  characterId: string | null | undefined,
  characterDisplayName?: string | null,
): Promise<string> {
  const raw = await buildUnsummarizedOfflineDatingText(characterId, characterDisplayName)
  const body = clipReferenceTail(raw, DATING_AI_REFERENCE_SECTION_CHAR_CAP, '尚未总结·线下剧情')
  if (!body.trim()) return ''
  return (
    `【尚未总结·线下剧情（约会页 plot 总结游标之后）】与当前会话为**同一角色、同一时间线**。` +
    `须参考下列事实自然衔接，**禁止**与线下已发生内容明显矛盾或假装从未发生；若为空可忽略。\n\n` +
    body
  )
}
