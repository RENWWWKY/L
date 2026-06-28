import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryArchiveCoachTargetId =
  | 'roster'
  | 'source'
  | 'search'
  | 'align'
  | 'create'
  | 'detail-source-tabs'
  | 'type-filter'
  | 'list'
  | 'memories-tab-tutorial'

export const MEMORY_ARCHIVE_START_COACH_EVENT = 'memory-archive-start-coach'

export const MEMORY_ARCHIVE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '角色总结',
    body: '这里按角色查看已记下的内容。先认一圈这个页上的按钮；可随时跳过。',
  },
  {
    target: 'roster',
    title: '先选一位角色',
    body: '每个卡片是一位联系人或群聊。角标数字是记忆条数；小标签表示常见场景（私聊、遇见、线下等）。点进去看详情。',
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
    body: '在列表页可以搜角色名或场景。进到某位角色里面之后，搜索框会变成搜该角色的记忆正文。',
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
    body: '右上角加号：自己写一条长期记忆。如果已经打开了某位角色，新建时会默认记在这个人名下。',
    cardPlacement: 'above',
  },
  {
    target: 'detail-source-tabs',
    title: '线上 / 线下分开看',
    body: '点进角色后，在这里切换：「线上总结」是微信聊天收成的大段文字；「线下摘要」是约会每轮的一行小摘要。',
    cardPlacement: 'below',
  },
  {
    target: 'type-filter',
    title: '按场景筛选',
    body: '进入某位角色后可以多选：私聊、群聊、遇见、线下等。只看你关心的那几类记忆。',
    cardPlacement: 'below',
  },
  {
    target: 'list',
    title: '记忆卡片',
    body: '每条记忆一张卡片，点进去能改、能删。标签颜色表示来自哪种聊天或场景。',
    cardPlacement: 'above',
  },
  {
    target: 'memories-tab-tutorial',
    title: '忘了再看',
    body: '点页内「教程」打开文字说明，也可以再跑一遍本页的高亮引导。五个总标签的说明在档案馆右上角「教程」。',
    cardPlacement: 'below',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '好啦',
    body: '可以开始翻记忆了。想查五个标签分别是干什么的，回到列表页点右上角「教程」。',
  },
]
