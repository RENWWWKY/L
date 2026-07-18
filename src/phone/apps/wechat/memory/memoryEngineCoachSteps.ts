import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryEngineCoachTargetId =
  | 'config-subtabs'
  | 'auto-summary'
  | 'summary-interval'
  | 'summary-api'
  | 'timeline-api'
  | 'vector-recall'
  | 'embedding-provider'
  | 'extra-api'
  | 'vector-model'
  | 'engine-tutorial'

export const MEMORY_ENGINE_START_COACH_EVENT = 'memory-engine-start-coach'
export const MEMORY_ENGINE_OPEN_TUTORIAL_EVENT = 'memory-engine-open-tutorial'

export type MemoryConfigSubTab = 'summary' | 'summary-model' | 'timeline-model' | 'vector'

/** 引导高亮目标 → 配置子 Tab */
export function memoryEngineCoachTargetSubTab(
  target: string | null | undefined,
): MemoryConfigSubTab | null {
  if (!target) return null
  if (
    target === 'config-subtabs' ||
    target === 'auto-summary' ||
    target === 'summary-interval' ||
    target === 'engine-tutorial'
  ) {
    return 'summary'
  }
  if (target === 'summary-api') return 'summary-model'
  if (target === 'timeline-api') return 'timeline-model'
  if (
    target === 'vector-recall' ||
    target === 'embedding-provider' ||
    target === 'extra-api' ||
    target === 'vector-model'
  ) {
    return 'vector'
  }
  return null
}

export const MEMORY_ENGINE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '这页是干什么的',
    body: '帮你设置：聊天和约会时，哪些内容会自动记进「长期记忆」。微信聊天隔几轮记一次；线下约会每推进一轮记一行小摘要。下面用高亮带你走一圈，看不懂随时点跳过。',
  },
  {
    target: 'config-subtabs',
    title: '上面四个小标签',
    body: '「自动总结」：总开关和微信聊天隔几轮记一次。「线上总结」「线下摘要」：分别选用来写记忆的服务器和模型。「向量召回」：按聊天意思多找几条相关记忆。引导会自动帮你切换标签。',
  },
  {
    target: 'auto-summary',
    title: '自动总结开关',
    body: '打开：微信聊天会按下面设置的轮数自动记；线下约会每轮也会记一行，并更新「尾声延展」、给相关配角记关联内容。关掉：不再自动记，但你仍可在档案馆里手动添加或手动总结。',
  },
  {
    target: 'summary-interval',
    title: '微信聊天隔几轮记一次',
    body: '只对微信私聊、群聊、遇见生效：聊满你填的 N 轮，就把这段对话收成一条记忆。可以所有人统一一个数，也可以给不同角色单独设。线下约会每轮都会记，不算在这里，也不占「线上总结进度」里的计数。',
  },
  {
    target: 'summary-api',
    title: '线上总结 · 选服务器和模型',
    body: '用来写「微信聊天那类」整段文字记忆，以及判断「尾声延展」要不要改。可以沿用聊天用的服务器，也可以单独填一套地址和密钥。和「线下摘要」分开设置，互不影响。',
  },
  {
    target: 'timeline-api',
    title: '线下摘要 · 选服务器和模型',
    body: '用来写「线下约会」每轮那一行小摘要（标题、发生了什么、时间地点等）。一般和写剧情用同一个回复里一起生成；万一没生成出来，会用这里填的服务器再补一次，不会重写整段剧情。',
  },
  {
    target: 'vector-recall',
    title: '按意思找相关记忆',
    body: '打开后，聊得比较长时，除了按关键词找记忆，还会按「意思相近」多捞几条相关的长期记忆；线下摘要向量召回也依赖此总开关。',
  },
  {
    target: 'embedding-provider',
    title: '算「意思相近」放哪算',
    body: '「自动」：优先用手机/浏览器里本地算，不行再用服务器。「仅本地」：全程不联网算。「仅 API」：全程用下面填的服务器。选本地的话，第一次要先下载一个小模型。',
  },
  {
    target: 'extra-api',
    title: '向量用的服务器',
    body: '只有选「自动」或「仅 API」时才需要配。可以沿用聊天服务器，也可以单独填一套。填完建议先点测试能不能连上，再选模型。如果上面选了「仅本地」，这里不会出现。',
  },
  {
    target: 'vector-model',
    title: '选一个「算意思」的模型',
    body: '从列表里选名字带「embed」或「embedding」的（是专门算相似度的，不要选平时聊天的那个模型）。纯本地模式不用在这里选；改完会自动保存。',
  },
  {
    target: 'engine-tutorial',
    title: '忘了再看',
    body: '点右上角「教程」能看文字说明，也能再跑一遍高亮引导。记下来的内容在「记忆管理 → 角色总结」里看：微信的是「线上」，约会的是「线下」。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '好啦',
    body: '改过的设置会保存在本机，刷新也在。你可以继续看文字说明，或者直接改上面的开关和模型。',
  },
]
