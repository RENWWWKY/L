import type { YuyePlayerRole } from './jbsPublicDiscuss'

export type JbsDiscussNpcReply = {
  speaker: string
  action?: string
  line: string
}

/** 模型未填 action 时，按人设轮替的默认神态旁白 */
const ROLE_ASIDE_POOL: Record<YuyePlayerRole, readonly string[]> = {
  陆景川: [
    '指节在桌下收紧，声线压得很低',
    '抬眼一瞬，目光仍硬',
    '端杯未饮，唇线抿得死紧',
    '视线扫过桌面，面上不露',
  ],
  沈知意: [
    '指尖在杯沿停了一瞬，语气仍温',
    '笑意不达眼底，声线仍软',
    '文件夹边沿被指腹摩过，字字落在条款上',
    '目光从刷卡记录移开，仍保持礼貌',
  ],
  苏晚晴: [
    '端杯未饮，眉梢微挑',
    '克制地移开视线，声线发淡',
    '米色风衣肩角仍湿，语气却平',
    '似笑非笑地抬眼，不接话茬',
  ],
  程予安: [
    '文件夹合上，声线平',
    '视线落向说话者，仍守机要',
    '工牌在指间轻转，低声应话',
    '侍立姿态未变，只微微颔首',
  ],
}

const INLINE_ASIDE_RE =
  /^(?:[（(]([^）)]+)[）)]|[【\[]([^】\]]+)[】\]]|旁白[:：]\s*([^，。！？\n]+)[，,]?)\s*(.+)$/su

/** 模型把神态写进 line 开头时拆出 action */
export function extractInlineActionFromLine(line: string): { action?: string; line: string } {
  const raw = line.trim()
  if (!raw) return { line: raw }

  const m = raw.match(INLINE_ASIDE_RE)
  if (m) {
    const action = (m[1] ?? m[2] ?? m[3] ?? '').trim()
    const rest = (m[4] ?? '').trim()
    if (action && rest) return { action, line: rest }
  }

  return { line: raw }
}

function pickDefaultAside(speaker: string, beatIndex: number): string | undefined {
  const pool = ROLE_ASIDE_POOL[speaker as YuyePlayerRole]
  if (!pool?.length) return undefined
  return pool[beatIndex % pool.length]
}

/** 规范化单条 beat：拆 inline action，缺失时补人设旁白 */
export function normalizeDiscussBeat(
  beat: JbsDiscussNpcReply,
  beatIndex: number,
): JbsDiscussNpcReply {
  let action = beat.action?.trim()
  let line = beat.line.trim()

  if (!action) {
    const extracted = extractInlineActionFromLine(line)
    if (extracted.action) {
      action = extracted.action
      line = extracted.line
    }
  }

  if (!action) {
    action = pickDefaultAside(beat.speaker, beatIndex)
  }

  return {
    speaker: beat.speaker,
    line,
    action: action?.trim() || undefined,
  }
}

/** 保证每条 NPC beat 尽量带 action，供旁白面板展示 */
export function enrichDiscussBeatActions(replies: JbsDiscussNpcReply[]): JbsDiscussNpcReply[] {
  return replies.map((beat, index) => normalizeDiscussBeat(beat, index))
}
