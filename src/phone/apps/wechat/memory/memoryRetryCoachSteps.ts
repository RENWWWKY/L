import type { MemoryCoachStep } from './memoryCoachTypes'

export const MEMORY_RETRY_START_COACH_EVENT = 'memory-retry-start-coach'

export const MEMORY_RETRY_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '补全总结',
    body: '到了该自动记记忆的时候却失败了，会话会出现在这里。可以补跑，不会多扣轮数。',
  },
  {
    target: 'retry-actions',
    title: '全部补跑',
    body: '有多条失败记录时，可以一次全部重试；也可以逐条点「补跑」。',
    cardPlacement: 'below',
  },
  {
    target: 'retry-list',
    title: '失败列表',
    body: '每条会显示角色名、失败时间和类型（私聊、群聊、约会等）。补跑成功后会从列表消失。',
    cardPlacement: 'above',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '好啦',
    body: '列表为空说明目前没有待补全的总结。',
  },
]

export const MEMORY_RETRY_TUTORIAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: '什么时候会出现在这里',
    body: '微信聊天到了总结间隔，或相关自动记记忆步骤失败时，会进这个队列。',
  },
  {
    title: '补跑会多扣轮数吗',
    body: '不会。补跑只是把上次失败的那次总结重做一遍。',
  },
  {
    title: '全部补跑',
    body: '有多条时可以一次全部重试；网络或服务器不稳定时建议逐条试。',
  },
]
