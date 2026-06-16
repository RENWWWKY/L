import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryArchiveCoachTargetId =
  | 'search'
  | 'type-filter'
  | 'source'
  | 'roster'
  | 'align'
  | 'create'
  | 'list'
  | 'archive-tutorial'

export const MEMORY_ARCHIVE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '欢迎来到记忆档案馆',
    body: '记忆已按角色分类：先选一位联系人或群聊，再进入查看其名下各类长期记忆。接下来用高亮带你认一圈，约半分钟；可随时跳过。',
  },
  {
    target: 'roster',
    title: '按角色浏览',
    body: '列表展示当前查看账号下有记忆的角色与群聊。卡片上的数字是条数，彩色标签表示常见场景（私聊、遇见、线下、关联等）。点选进入详情。',
  },
  {
    target: 'search',
    title: '检索',
    body: '在角色列表可搜角色名或场景；进入某角色后可搜该角色记忆正文、触发词等。',
  },
  {
    target: 'source',
    title: '查看账号',
    body: '选择用哪个微信账号浏览角色记忆。Lumi Meet 的遇见记忆不按账号分线，请用下方「遇见应用」标签筛选。',
  },
  {
    target: 'type-filter',
    title: '记忆分类',
    body: '可按私聊、群聊、朋友圈、遇见应用、线下等场景多选筛选。标签颜色与下方记忆卡片一致。',
  },
  {
    target: 'align',
    title: '对齐 {{user}}',
    body: '一键把未绑定的玩家占位符按来源线或当前扮演身份补全；已有绑定不会被覆盖。',
  },
  {
    target: 'create',
    title: '刻录新记忆',
    body: '手动写入一条长期记忆。若已打开某位角色，新建时会默认归属该联系人。',
  },
  {
    target: 'list',
    title: '记忆列表',
    body: '每张卡片展示展开预览、场景标签与触发方式。点按即可修订、删除。',
  },
  {
    target: 'archive-tutorial',
    title: '随时回看',
    body: '右上角「教程」可打开文字说明，也能再开一遍你现在看到的高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '平时想查详细说明，点右上角「教程」即可。下面可以打开文字版小抄，也可以直接开始翻阅记忆。',
  },
]
