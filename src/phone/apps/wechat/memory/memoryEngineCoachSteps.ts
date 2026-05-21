import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryEngineCoachTargetId =
  | 'auto-summary'
  | 'summary-interval'
  | 'trigger-mode'
  | 'linked-summary'
  | 'dating-summary'
  | 'vector-recall'
  | 'extra-api'
  | 'vector-model'
  | 'save-settings'
  | 'engine-tutorial'

export const MEMORY_ENGINE_START_COACH_EVENT = 'memory-engine-start-coach'
export const MEMORY_ENGINE_OPEN_TUTORIAL_EVENT = 'memory-engine-open-tutorial'

export const MEMORY_ENGINE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '记忆配置一览',
    body: '这里决定自动总结、约会关联记忆与向量语义召回如何工作。接下来用高亮带你认一圈，约半分钟；可随时跳过。',
  },
  {
    target: 'auto-summary',
    title: '自动总结',
    body: '总开关：关闭后不再按轮数自动合并总结，你仍可在「记忆管理」手动刻录。',
  },
  {
    target: 'summary-interval',
    title: '总结间隔',
    body: '与该角色私聊每满 N 轮 AI 回复后触发一次合并总结。数字可在 1～100 之间调整，失焦后自动保存。',
  },
  {
    target: 'trigger-mode',
    title: '默认触发方式',
    body: '自动写入的新记忆默认「关键词触发」或「始终触发」。不论选哪种，入库时仍会保存模型提炼的触发词备份。',
  },
  {
    target: 'linked-summary',
    title: '关联记忆总结',
    body: '约会推剧情时，是否给人脉配角顺带记一条「关联记忆」。关闭后不再自动写入关联条，私聊按间隔总结不受影响。',
  },
  {
    target: 'dating-summary',
    title: '约会推剧情时自动记记忆',
    body: '关闭后，约会线下段落本身不再跑合并总结；仅在与该角色私聊聊满「总结间隔」时才总结。',
  },
  {
    target: 'vector-recall',
    title: '语义向量召回',
    body: '开启后，聊天上下文足够长时会尝试用向量相似度再召回几条长期记忆，与关键词命中互补。',
  },
  {
    target: 'extra-api',
    title: '额外接口',
    body: '需要单独向量化网关时开启，填写专用地址与密钥；关闭则沿用全局聊天主接口，并在下方拉取主接口上的 embedding 模型。',
  },
  {
    target: 'vector-model',
    title: '向量模型',
    body: '拉取可用模型列表后，选一个 embedding 模型。未开额外接口时，此区从主接口拉列表；开启后可在专用配置区测试连通再拉取。',
  },
  {
    target: 'save-settings',
    title: '写入档案库',
    body: '汇总保存本页开关、间隔与向量模型等设置。部分开关已即时写入，点此可确保向量专用字段一并落库。',
  },
  {
    target: 'engine-tutorial',
    title: '随时回看',
    body: '「自动总结与关联」卡片右上角「教程」可打开文字说明，也能再开一遍高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '平时想查详细说明，点「教程」即可。下面可以打开文字版小抄，也可以直接调整配置。',
  },
]
