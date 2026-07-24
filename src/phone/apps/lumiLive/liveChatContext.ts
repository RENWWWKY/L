import type { LiveDanmakuStyle, LiveRoom, StreamerEvent } from './types'
import type { LivePersonaSnapshot } from './livePersonaContext'

/**
 * 全部按「批次」记上下文：
 * - lastUserBatch：已结算的最近一批用户弹幕
 * - lastFanBatch：最近一批网友弹幕
 * - lastHostBatch：最近一批角色反应
 * pending*：本轮尚未结算的累积
 */
export type LiveChatContext = {
  lastUserBatch: string[]
  lastFanBatch: string[]
  lastHostBatch: string[]
  pendingUserBatch: string[]
  pendingHostBatch: string[]
}

export function emptyLiveChatContext(): LiveChatContext {
  return {
    lastUserBatch: [],
    lastFanBatch: [],
    lastHostBatch: [],
    pendingUserBatch: [],
    pendingHostBatch: [],
  }
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

const FAN_NICKS = [
  '静默观客',
  '铂金旁听',
  '夜色访客',
  '窗边的人',
  '低饱和听众',
  '未署名',
  '云端席位',
  '迟到的观众',
  '呼吸同步',
  '银线留声',
  '私语位',
  '后排留白',
  '细光收藏',
  '冷调常客',
  '只看不说',
  '浮光旁听',
  '深灰席',
  '台灯下',
  '雨声位',
  '留白观众',
] as const

const STYLE_TAIL: Record<LiveDanmakuStyle, readonly string[]> = {
  restrained: ['气氛更静了', '别吵', '先看着', '好克制', '像在听你们说话'],
  fangirl: ['我也想说这个', '跟上了', '前排附议', '太会了', '锁死这段'],
  quiet: ['嗯', '听见了', '在', '继续', '不吵'],
  sarcastic: ['挺会接的', '又开始了', '围观', '行吧', '挺热闹'],
}

/** 用户发弹幕：先进入本轮 pending 用户批次 */
export function noteUserDanmaku(ctx: LiveChatContext, text: string): LiveChatContext {
  const t = text.trim()
  if (!t) return ctx
  return { ...ctx, pendingUserBatch: [...ctx.pendingUserBatch, t] }
}

/**
 * 结算用户批次：pending → lastUserBatch（若有）
 * 在生成网友下一批 / 角色新反应前调用
 */
export function commitUserBatch(ctx: LiveChatContext): LiveChatContext {
  if (!ctx.pendingUserBatch.length) return ctx
  return {
    ...ctx,
    lastUserBatch: [...ctx.pendingUserBatch],
    pendingUserBatch: [],
  }
}

/**
 * 结算角色批次：pendingHost → lastHostBatch（若有）
 * 在角色开启「新一轮反应」之前、或生成下一批网友弹幕之前调用
 */
export function commitHostBatch(ctx: LiveChatContext): LiveChatContext {
  if (!ctx.pendingHostBatch.length) return ctx
  return {
    ...ctx,
    lastHostBatch: [...ctx.pendingHostBatch],
    pendingHostBatch: [],
  }
}

/** 角色本轮又说了一句：写入 pendingHost */
export function noteHostReaction(ctx: LiveChatContext, text: string): LiveChatContext {
  const t = text.trim()
  if (!t) return ctx
  return { ...ctx, pendingHostBatch: [...ctx.pendingHostBatch, t] }
}

/** 网友新批次落地 */
export function noteFanBatch(ctx: LiveChatContext, texts: string[]): LiveChatContext {
  const cleaned = texts.map((t) => t.trim()).filter(Boolean)
  if (!cleaned.length) return ctx
  return { ...ctx, lastFanBatch: cleaned }
}

/** 有效用户批次：优先已结算；否则看 pending（刚发尚未结算时） */
export function effectiveUserBatch(ctx: LiveChatContext): string[] {
  if (ctx.lastUserBatch.length) return ctx.lastUserBatch
  return ctx.pendingUserBatch
}

function contextualFanLine(params: {
  style: LiveDanmakuStyle
  lastUserBatch: string[]
  lastFanBatch: string[]
  lastHostBatch: string[]
  index: number
}): string {
  const userOne = clip(params.lastUserBatch[params.lastUserBatch.length - 1] ?? '', 12)
  const prevFan = clip(params.lastFanBatch[params.lastFanBatch.length - 1] ?? '', 12)
  const hostOne = clip(params.lastHostBatch[params.lastHostBatch.length - 1] ?? '', 12)
  const tail = pick(STYLE_TAIL[params.style])

  // 只写「真人观众会说的话」，绝不出现「上一批 / 那批 / 接他」
  const templates: string[] = [
    tail,
    `先看着，${tail}`,
    `嗯，${tail}`,
    `气氛还行`,
    `别太吵`,
    `我就听听`,
  ]
  if (userOne) {
    templates.push(
      `「${userOne}」……也在听`,
      `刚那句「${userOne}」，记下了`,
      `有人说「${userOne}」`,
    )
  }
  if (prevFan) {
    templates.push(`附议「${prevFan}」`, `「${prevFan}」说得对`, `同感`)
  }
  if (hostOne) {
    templates.push(`他这句「${hostOne}」……`, `听见了`, `话说得挺淡`)
  }
  return pick(templates)
}

/** 自然口语网友弹幕（无系统/批次话术） */
export function pickNaturalFanBatch(params: {
  count: number
  style: LiveDanmakuStyle
  ctx: LiveChatContext
}): Array<{ nick: string; text: string }> {
  const n = Math.max(1, Math.min(5, Math.round(params.count)))
  const users = effectiveUserBatch(params.ctx)
  const out: Array<{ nick: string; text: string }> = []
  const used = new Set<string>()
  let guard = 0
  while (out.length < n && guard < 40) {
    guard += 1
    const nick = FAN_NICKS[Math.floor(Math.random() * FAN_NICKS.length)]!
    const text = contextualFanLine({
      style: params.style,
      lastUserBatch: users,
      lastFanBatch: params.ctx.lastFanBatch,
      lastHostBatch: params.ctx.lastHostBatch,
      index: out.length + guard,
    })
    const key = `${nick}|${text}`
    if (used.has(key)) continue
    used.add(key)
    out.push({ nick, text })
  }
  return out
}

/** @deprecated 使用 pickNaturalFanBatch */
export function pickContextualFanBatch(params: {
  count: number
  style: LiveDanmakuStyle
  ctx: LiveChatContext
}): Array<{ nick: string; text: string }> {
  return pickNaturalFanBatch(params)
}

export function buildSeedFanLines(
  count = 6,
  style: LiveDanmakuStyle = 'restrained',
): Array<{ nick: string; text: string }> {
  return pickContextualFanBatch({
    count: Math.min(5, Math.max(1, count)),
    style,
    ctx: emptyLiveChatContext(),
  }).concat(
    count > 5
      ? pickContextualFanBatch({
          count: Math.min(5, count - 5),
          style,
          ctx: emptyLiveChatContext(),
        })
      : [],
  )
}

/** 生成下一批网友前：结算用户 pending + 结算角色 pending → last* */
export function prepareFanBatchContext(ctx: LiveChatContext): LiveChatContext {
  let next = commitUserBatch(ctx)
  next = commitHostBatch(next)
  return next
}

/** 主播反应兜底：自然口语，禁止「上一批/那批」系统话 */
export function mockStreamerLineFromContext(params: {
  room: LiveRoom
  event: StreamerEvent
  ctx: LiveChatContext
  persona?: LivePersonaSnapshot | null
}): string {
  const name = params.persona?.displayName?.trim() || params.room.hostName
  const users = effectiveUserBatch(params.ctx)
  const userOne = clip(users[users.length - 1] ?? '', 16)
  const fanOne = clip(params.ctx.lastFanBatch[params.ctx.lastFanBatch.length - 1] ?? '', 14)

  switch (params.event.type) {
    case 'enter':
      return pick([
        `……进来就进来，别太吵。我是${name}，就开一会儿。`,
        `看到有人进了。随便坐，我不一定会一直说。`,
        `临时上线而已。别指望气氛热闹。`,
      ])
    case 'danmaku': {
      const q = clip(params.event.text, 18)
      return pick([
        `有人说「${q}」——我听见了。`,
        `「${q}」……嗯，记下了。`,
        userOne && userOne !== q ? `「${q}」。还有你刚那句，看见了。` : `你刚才那句「${q}」，行吧。`,
        fanOne ? `「${q}」。弹幕别太密。` : `「${q}」？先这样。`,
      ])
    }
    case 'gift':
      return pick([
        `谢谢某人的${params.event.giftName}，破费了。下不为例。`,
        `${params.event.giftName}收到了。别总在外面这么显眼。`,
        `……${params.event.giftName}？心意收到，少来几次。`,
        `${params.event.giftName}挺安静的，还行。`,
      ])
    case 'fan_prompt': {
      const q = clip(params.event.text, 16)
      return pick([
        `……${q}？随便聊聊吧，别期待太多。`,
        `有人问「${q}」。不想答太细。`,
        `「${q}」——听见了，下一条。`,
        userOne ? `弹幕又在起哄了。安静一点。` : `弹幕别围着问。`,
      ])
    }
    default:
      return pick(['……还在。别太吵。', '今晚就开一会。', '弹幕我看得见，不一定都回。', '嗯。'])
  }
}

export function pickHostIdleLine(
  _ctx?: LiveChatContext,
  _persona?: LivePersonaSnapshot | null,
): string {
  return pick([
    '……还在。别太吵。',
    '今晚就开一会。',
    '弹幕我看得见，不一定都回。',
    '灯光有点刺，等一下。',
    '你们安静一点也挺好。',
    '喝口水。',
    '……嗯。',
  ])
}
