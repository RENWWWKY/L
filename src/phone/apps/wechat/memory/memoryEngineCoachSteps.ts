import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryEngineCoachTargetId =
  | 'auto-summary'
  | 'summary-interval'
  | 'trigger-mode'
  | 'linked-summary'
  | 'dating-summary'
  | 'summary-api'
  | 'vector-recall'
  | 'extra-api'
  | 'vector-model'
  | 'engine-tutorial'

export const MEMORY_ENGINE_START_COACH_EVENT = 'memory-engine-start-coach'
export const MEMORY_ENGINE_OPEN_TUTORIAL_EVENT = 'memory-engine-open-tutorial'

export type MemoryConfigSubTab = 'summary' | 'summary-model' | 'vector'

/** 引导高亮目标 → 配置子 Tab */
export function memoryEngineCoachTargetSubTab(
  target: string | null | undefined,
): MemoryConfigSubTab | null {
  if (!target) return null
  if (
    target === 'auto-summary' ||
    target === 'summary-interval' ||
    target === 'trigger-mode' ||
    target === 'linked-summary' ||
    target === 'dating-summary' ||
    target === 'engine-tutorial'
  ) {
    return 'summary'
  }
  if (target === 'summary-api') return 'summary-model'
  if (target === 'vector-recall' || target === 'extra-api' || target === 'vector-model') {
    return 'vector'
  }
  return null
}

export const MEMORY_ENGINE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '记忆配置一览',
    body: '上方小 Tab 分为「自动总结」「总结模型」「向量召回」三类。接下来用高亮带你认一圈，约半分钟；可随时跳过。',
  },
  {
    target: 'auto-summary',
    title: '自动总结',
    body: '总开关：关闭后不再按轮数自动合并总结，你仍可在「记忆管理」手动刻录。',
  },
  {
    target: 'trigger-mode',
    title: '自动总结的类型',
    body: '新自动总结的记忆默认「关键词」或「始终」参与聊天召回。不论选哪种，入库时仍会保存模型提炼的触发词备份。',
  },
  {
    target: 'summary-interval',
    title: '总结间隔',
    body: '可选全局统一或按角色单独配置；与该角色私聊每满 N 轮 AI 回复后触发一次合并总结。数字可在 1～100 之间调整，失焦后自动保存。',
  },
  {
    target: 'linked-summary',
    title: '关联记忆总结',
    body: '开启后：约会推剧情时，相关人脉配角会自动收到「关联记忆」摘录，之后私聊该配角时单独注入。关闭后：主角自有约会记忆不受影响，但配角不会自动知晓线下剧情，需手动刻录。玩约会+人脉网建议开启；只要主角私聊记忆可关闭。',
  },
  {
    target: 'dating-summary',
    title: '约会剧情计入总结轮数',
    body: '与私聊共用「总结间隔」：开启后约会 AI 回复也计轮，满间隔时把微信 + 线下剧情合并入库；关闭则只在微信私聊里计轮。',
  },
  {
    target: 'summary-api',
    title: '总结接口',
    body: '滑动胶囊在「聊天主接口」与「专用副接口」间切换。选主接口时沿用全局聊天 API；选副接口后填写专用地址与密钥，或只换一个总结模型。',
  },
  {
    target: 'vector-recall',
    title: '语义向量召回',
    body: '开启后，聊天上下文足够长时会尝试用向量相似度再召回几条长期记忆，与关键词命中互补。',
  },
  {
    target: 'extra-api',
    title: '向量化接口',
    body: '与总结类似：胶囊选「聊天主接口」或「专用副接口」。选副接口时填写专用地址与密钥，并在下方测试连通、拉取 embedding 模型。',
  },
  {
    target: 'vector-model',
    title: '向量模型',
    body: '拉取可用模型列表后，选一个 embedding 模型。选主接口时从聊天 API 拉列表；选副接口时建议先测连通再拉取。改动会自动保存。',
  },
  {
    target: 'engine-tutorial',
    title: '随时回看',
    body: '顶栏右侧「教程」可打开文字说明，也能再开一遍高亮引导；上方小 Tab 可在自动总结、总结模型与向量召回之间切换。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '平时想查详细说明，点「教程」即可。下面可以打开文字版小抄，也可以直接调整配置。',
  },
]
