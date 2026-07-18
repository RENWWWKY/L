import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryArchiveCoachTargetId =
  | 'roster'
  | 'source'
  | 'search'
  | 'align'
  | 'create'
  | 'memories-tab-tutorial'

export const MEMORY_ARCHIVE_START_COACH_EVENT = 'memory-archive-start-coach'
export const MEMORY_ARCHIVE_OPEN_TUTORIAL_EVENT = 'memory-archive-open-tutorial'

/** 角色总结 · 列表主页高亮引导（不含角色详情） */
export const MEMORY_ARCHIVE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '角色总结 · 列表',
    body: '这里先按角色浏览记忆入口。点进某位角色后，详情页会有另一套独立引导，和本页分开。',
  },
  {
    target: 'roster',
    title: '先选一位角色',
    body: '每个卡片是一位联系人或群聊。角标数字是记忆条数；小标签表示常见场景（私聊、遇见、线下等）。点进去看这位角色的详情。',
    cardPlacement: 'below',
  },
  {
    target: 'source',
    title: '用哪个微信账号看',
    body: '你有几个微信马甲时，在这里切换，列表会跟着变。遇见记的内容不按马甲分，要用分类标签里的「遇见应用」来筛。',
    cardPlacement: 'below',
  },
  {
    target: 'search',
    title: '搜角色',
    body: '在列表页搜角色名或场景，快速找到要进的那一位。',
    cardPlacement: 'below',
  },
  {
    target: 'align',
    title: '对齐 {{user}}',
    body: '记忆里若写了 {{user}} 这类玩家占位符，点这里可以按当前身份批量补全。已经手动绑好的不会被改掉。',
    cardPlacement: 'below',
  },
  {
    target: 'create',
    title: '手动加一条记忆',
    body: '右上角加号：自己写一条长期记忆。若已打开某位角色，新建时会默认记在这个人名下。',
    cardPlacement: 'above',
  },
  {
    target: 'memories-tab-tutorial',
    title: '忘了再看',
    body: '点标题栏右上角「教程」打开本页（列表）的文字说明，或再走一遍列表高亮引导。点进角色后的用法，看详情页自己的教程。',
    cardPlacement: 'below',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '好啦',
    body: '可以点一位角色进去了。详情里的线上/线下/待办，会在进角色后单独教一遍。',
  },
]
