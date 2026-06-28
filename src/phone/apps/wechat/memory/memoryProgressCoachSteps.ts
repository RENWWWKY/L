import type { MemoryCoachStep } from './memoryCoachTypes'

export const MEMORY_PROGRESS_START_COACH_EVENT = 'memory-progress-start-coach'

export const MEMORY_PROGRESS_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '线上总结进度',
    body: '这里只看微信私聊和群聊：每个角色或群聊聊了几轮、离收成一条记忆还差多少。线下约会不算在这里。',
  },
  {
    target: 'progress-filters',
    title: '主号 / 小号 · 私聊 / 群聊',
    body: '先选看主号还是小号，再选私聊或群聊。列表会跟着切换。',
    cardPlacement: 'below',
  },
  {
    target: 'progress-list',
    title: '进度卡片',
    body: '每张卡片是一个角色或群。显示已聊几轮、间隔是多少。有「待总结」时可以点「手动总结」立刻收成一条记忆，不会多扣轮数。',
    cardPlacement: 'above',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '好啦',
    body: '遇见应用的计数在邂逅档案里看，不在这个页。',
  },
]

export const MEMORY_PROGRESS_TUTORIAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: '这页看什么',
    body: '微信私聊和群聊的「计轮」进度：离自动收成一条记忆还差几轮，有没有还没收进记忆的消息。',
  },
  {
    title: '主号 / 小号',
    body: '有多个微信马甲时，在这里切换。每个马甲各自统计，互不影响。',
  },
  {
    title: '手动总结',
    body: '卡片上显示「有待总结」时，可以立刻收成一条记忆，不会额外消耗计轮。适合想马上写入、不等满 N 轮的情况。',
  },
  {
    title: '和线下无关',
    body: '约会每轮的小摘要不走这里的计轮，请在「角色总结」里看线下摘要。',
  },
]
