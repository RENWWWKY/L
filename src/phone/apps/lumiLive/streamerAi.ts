import type { LiveRoom, StreamerEvent } from './types'

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/** 主播闲聊 / 自言自语（不绑定具体事件） */
const HOST_IDLE_LINES = [
  '……还在。别太吵。',
  '今晚就开一会。',
  '弹幕我看得见，不一定都回。',
  '灯光有点刺，等一下。',
  '外面风很大。',
  '别问下班时间。',
  '喝口水。',
  '你们安静一点也挺好。',
  '临时上线，别期待太多。',
  '镜头先这样。',
  '有人刷礼物了？看见了。',
  '……嗯。',
  '今天话不多，习惯就好。',
  '别在公屏起哄。',
  '再待十分钟吧。',
] as const

/** 本地 mock 主播口述（当前阶段不调用任何 API） */
export function mockStreamerLine(room: LiveRoom, event: StreamerEvent): string {
  const name = room.hostName
  switch (event.type) {
    case 'enter':
      return pick([
        `……进来就进来，别太吵。我是${name}，就开一会儿。`,
        `看到有人进了。随便坐，我不一定会一直说。`,
        `临时上线而已。别指望气氛热闹。`,
        `新进来的那位，看见了。安静看就行。`,
        `……又来人了。别太热情。`,
      ])
    case 'danmaku':
      return pick([
        `有人说「${clip(event.text, 24)}」——我听见了。`,
        `「${clip(event.text, 20)}」……嗯，记下了。`,
        `弹幕别太密。「${clip(event.text, 18)}」我看到了。`,
        `你刚才那句「${clip(event.text, 16)}」，行吧。`,
        `「${clip(event.text, 18)}」？先这样。`,
      ])
    case 'gift':
      return pick([
        `谢谢某人的${event.giftName}，破费了。下不为例。`,
        `${event.giftName}收到了。别总在外面这么显眼。`,
        `……${event.giftName}？心意收到，少来几次。`,
        `有人送了${event.giftName}。看见了，别闹。`,
        `${event.giftName}挺安静的，还行。`,
      ])
    case 'fan_prompt':
      return pick([
        `……${clip(event.text, 20)}？随便聊聊吧，别期待太多。`,
        `有人问「${clip(event.text, 18)}」。不想答太细。`,
        `弹幕又在起哄了。安静一点。`,
        `「${clip(event.text, 16)}」——听见了，下一条。`,
        `别围着同一句问。`,
      ])
    default:
      return pickHostIdleLine()
  }
}

export function pickHostIdleLine(): string {
  return pick(HOST_IDLE_LINES)
}
