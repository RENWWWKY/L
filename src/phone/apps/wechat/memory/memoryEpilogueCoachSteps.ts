import type { MemoryCoachStep } from './memoryCoachTypes'

export const MEMORY_EPILOGUE_START_COACH_EVENT = 'memory-epilogue-start-coach'

export const MEMORY_EPILOGUE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '尾声延展',
    body: '这里放和角色关系、态度相关的世界书条目。聊天或剧情里会自动判断要不要改，你也可以在这里直接改。',
  },
  {
    target: 'epilogue-intro',
    title: '按角色浏览',
    body: '先选一位角色，再进去看 TA 的尾声条目。可以搜角色名，点卡片进入详情。',
    cardPlacement: 'below',
  },
  {
    target: 'epilogue-roster',
    title: '角色列表',
    body: '数字表示该角色有多少条尾声。点进去可以展开、编辑或删除单条，改动会同步到角色人设的世界书。',
    cardPlacement: 'below',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '好啦',
    body: '进到某位角色后，还可以粘贴剧情正文，手动判断要不要更新尾声。',
  },
]

export const MEMORY_EPILOGUE_TUTORIAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: '尾声是什么',
    body: '世界书里「尾声延展」类条目，用来记角色对玩家当前的态度、关系阶段等，会随剧情慢慢变。',
  },
  {
    title: '自动 vs 手动',
    body: '每轮聊天或约会后，系统会判断要不要改；你也可以在这里直接编辑，或粘贴正文手动对齐。',
  },
  {
    title: '和角色总结的区别',
    body: '「角色总结」记的是聊天和约会事实；「尾声延展」记的是关系态、态度类快照，写法更像档案。',
  },
]
