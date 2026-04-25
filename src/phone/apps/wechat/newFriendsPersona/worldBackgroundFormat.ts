import type { WorldBackground, WorldBackgroundDimensionKey } from './types'
import { formatTimelineEventDate, timelineSortKey } from './types'
import { WB_DIMENSION_SECTIONS } from './worldBackgroundDimensions'
import { findTerrainLabel } from './worldMapCatalog'

const MAX_PROMPT_CHARS = 6200

/** 将世界背景压成系统提示用文本；供聊天、世界书、人脉等 AI 引用 */
export function formatWorldBackgroundForPrompt(w: WorldBackground | null | undefined): string {
  if (!w) return ''
  const s = w.settings
  const lines: string[] = [`【世界背景：${w.name}】`]
  if (w.description.trim()) lines.push(w.description.trim())

  for (const sec of WB_DIMENSION_SECTIONS) {
    const key = sec.key as WorldBackgroundDimensionKey
    const arr = (s[key] as string[] | undefined)?.filter(Boolean) ?? []
    if (arr.length) lines.push(`${sec.title}：${arr.join('、')}`)
  }

  const custom = (s.customRuleLines ?? []).map((x) => x.trim()).filter(Boolean)
  if (custom.length) {
    lines.push('自定义规则：')
    for (const line of custom) lines.push(`- ${line}`)
  }

  const m = w.map
  const regionCount = (m?.regions ?? []).length
  const markerCount = m?.markers?.length ?? 0
  const hasOverlay = Boolean(m?.imageUrl?.trim())
  if (hasOverlay || regionCount > 0 || markerCount > 0) {
    const bits: string[] = []
    if (regionCount) bits.push(`地貌板块 ${regionCount} 块`)
    if (markerCount) bits.push(`标记 ${markerCount} 个`)
    if (hasOverlay) bits.push('已叠加参考图')
    lines.push(`世界地图：${bits.join('，')}。`)
    for (let i = 0; i < (m.regions ?? []).length; i += 1) {
      const r = m.regions![i]
      const t = findTerrainLabel(r.terrainType ?? '')
      lines.push(`  板块 ${i + 1}：${t}${r.name ? `「${r.name}」` : ''}`)
    }
    for (let i = 0; i < (m.markers ?? []).length; i += 1) {
      const mk = m.markers[i]
      const head = [mk.name, mk.type].filter(Boolean).join('·')
      const desc = (mk.description ?? '').trim()
      lines.push(`  标记 ${i + 1}：${head}${desc ? `：${desc}` : ''}`)
    }
  }

  const tl = (w.timeline ?? [])
    .slice()
    .sort((a, b) => {
      const d = timelineSortKey(b) - timelineSortKey(a)
      if (d !== 0) return d
      return b.createdAt - a.createdAt
    })
  if (tl.length) {
    lines.push('时间线（由上至下：新→旧）：')
    for (const ev of tl) {
      const tag = ev.importance === 'critical' ? '关键' : ev.importance === 'important' ? '重要' : '普通'
      const when = formatTimelineEventDate(ev)
      lines.push(`- [${tag}] ${when} ${ev.title}${ev.description ? ` — ${ev.description}` : ''}`)
    }
  }

  const raw = lines.join('\n')
  if (raw.length <= MAX_PROMPT_CHARS) return raw
  return `${raw.slice(0, MAX_PROMPT_CHARS)}…\n（世界背景已截断）`
}
