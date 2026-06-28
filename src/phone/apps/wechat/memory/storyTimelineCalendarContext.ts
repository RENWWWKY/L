import { personaDb } from '../newFriendsPersona/idb'
import { formatZhDateWithWeekday } from './storyTimelineTypes'

/** 从约会 plot 快照取最近有效 timestamp，否则当前时刻 */
export function resolveStoryTimeHintMsFromPlots(
  plots: Array<{ timestamp?: number }> | null | undefined,
): number {
  const list = plots ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const ts = list[i]?.timestamp
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts
  }
  return Date.now()
}

/** 写入 timeline 摘要 prompt：公历锚点 + 生日/节日感知 */
export const STORY_TIMELINE_CALENDAR_AWARENESS_RULES = `
【剧情日历·公历锚点（timeline 必填语义）】
- story_day **须写含年份的公历日期**，格式如 "2025年10月1日" 或 "2025年2月14日（情人节）"；**禁止**仅写「第3天」「Day 12」等无年份相对日（相对进度可写在 relative_time）。
- story_time **须写可核对钟点**（24 小时制 HH:mm，如 "19:30"）；材料仅有「傍晚/深夜」等模糊词时，结合上下文推断合理钟点并写入；勿与【当前时间】现实世界混淆。
- 写 event_summary / row_title 时须感知**季节与节日氛围**（春/夏/秋/冬、寒暑假、开学季等），并与 story_day 一致。
- **生日节点**：若下方提供了 {{user}} / {{char}} 的生日 MM-DD，须对照 story_day 判断是否临近或当日；是则 event_summary 或 row_title 可体现（勿臆造未发生的庆祝）。
- **重要节日（公历/农历常识，按 story_day 对照）**：元旦（1/1）、春节/元宵（农历新年期间）、清明节、劳动节（5/1）、端午节、中秋节、国庆节（10/1～7）；情人节（2/14）、520（5/20）、七夕（农历七月初七）、跨年夜（12/31 夜～1/1 凌晨）。命中或临近（±1～2 天）时须在摘要中点明节日语境，勿写成普通工作日。
`.trim()

export async function buildStoryTimelineCalendarContextBlock(params: {
  peerCharacterId?: string | null
  /** 当前会话玩家身份 id（用于读取 {{user}} 生日） */
  sessionPlayerIdentityId?: string | null
  /** 本轮剧情参考时刻（约会 plot.timestamp / 落库 recordedAt） */
  storyTimeHintMs?: number | null
}): Promise<string> {
  const lines: string[] = []
  const hintMs = params.storyTimeHintMs
  if (typeof hintMs === 'number' && Number.isFinite(hintMs)) {
    lines.push(
      `【本轮剧情参考时刻（写 timeline 时优先对齐；勿与手机【当前时间】混淆）】${formatZhDateWithWeekday(hintMs, { includeTime: true })}`,
    )
  }

  const cid = params.peerCharacterId?.trim()
  if (cid) {
    try {
      const ch = await personaDb.getCharacter(cid)
      if (ch?.birthdayMD?.trim()) {
        lines.push(`{{char}} 生日（MM-DD，对照 story_day 判断是否节点）：${ch.birthdayMD.trim()}`)
      }
    } catch {
      /* ignore */
    }
  }

  const playerId = params.sessionPlayerIdentityId?.trim()
  if (playerId) {
    try {
      const player = await personaDb.getPlayerIdentity(playerId)
      if (player?.birthdayMD?.trim()) {
        lines.push(`{{user}} 生日（MM-DD，对照 story_day 判断是否节点）：${player.birthdayMD.trim()}`)
      }
    } catch {
      /* ignore */
    }
  }

  if (!lines.length) return ''
  return `\n\n${lines.join('\n')}\n${STORY_TIMELINE_CALENDAR_AWARENESS_RULES}`
}
