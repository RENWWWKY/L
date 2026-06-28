import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryHubCoachTargetId =
  | 'hub-tab-config'
  | 'hub-tab-memories'
  | 'hub-tab-epilogue'
  | 'hub-tab-progress'
  | 'hub-tab-retry'
  | 'hub-tutorial'

export const MEMORY_HUB_START_COACH_EVENT = 'memory-hub-start-coach'

export const MEMORY_HUB_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '记忆档案馆',
    body: '下面五个标签，各管一块内容。先快速认一遍它们是干什么的；点进某个标签后，还会有该页的详细引导。',
  },
  {
    target: 'hub-tab-config',
    title: '记忆配置',
    body: '开不开自动记记忆、微信隔几轮记一次、用哪台服务器写记忆、要不要按意思多找几条——都在这里设。',
    cardPlacement: 'below',
  },
  {
    target: 'hub-tab-memories',
    title: '角色总结',
    body: '按角色查看已记下的内容：微信聊天收成的大段文字，和约会每轮的小摘要，都在这里翻。',
    cardPlacement: 'below',
  },
  {
    target: 'hub-tab-epilogue',
    title: '尾声延展',
    body: '看、改和某角色关系、态度相关的世界书条目（聊天或剧情里会自动判断要不要更新）。',
    cardPlacement: 'below',
  },
  {
    target: 'hub-tab-progress',
    title: '线上总结进度',
    body: '看私聊、群聊聊了几轮、离「收成一条记忆」还差多少；有未总结的也能在这里手动收。',
    cardPlacement: 'below',
  },
  {
    target: 'hub-tab-retry',
    title: '补全总结',
    body: '自动记失败了的会话会列在这里，点一下可以补跑，不会多扣轮数。',
    cardPlacement: 'below',
  },
  {
    target: 'hub-tutorial',
    title: '忘了再看',
    body: '点右上角「教程」可以随时打开这页五个标签的说明；点进某个标签后，该页右上角或页内也有更细的教程。',
    cardPlacement: 'below',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '下一步',
    body: '点上面任意一个标签进去，会自动开始该页的详细引导（每个标签只需看一次）。',
  },
]
