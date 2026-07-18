import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryArchiveDetailCoachTargetId =
  | 'detail-hero'
  | 'clear-all'
  | 'detail-source-tabs'
  | 'create'
  | 'search'
  | 'type-filter'
  | 'list'
  | 'detail-offline'
  | 'detail-offline-manual'
  | 'detail-todos'
  | 'detail-tutorial'

export const MEMORY_ARCHIVE_DETAIL_START_COACH_EVENT = 'memory-archive-detail-start-coach'
export const MEMORY_ARCHIVE_DETAIL_OPEN_TUTORIAL_EVENT = 'memory-archive-detail-open-tutorial'

/** 进入某位角色的总结详情页时的高亮操作指引 */
export const MEMORY_ARCHIVE_DETAIL_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '这位角色的记忆页',
    body: '这是角色详情专用引导（和列表主页那套分开）。这里集中看 TA 的长期记忆：微信聊过的、约会推进过的，以及还没办完的事。',
  },
  {
    target: 'detail-hero',
    title: '角色名片',
    body: '上面是名字、备注，以及线上/线下各有几条。想换下一位角色：点左上角返回，再到列表里另选。',
    cardPlacement: 'below',
  },
  {
    target: 'clear-all',
    title: '一键清空记忆',
    body: '会按你的选择删掉这位角色的线上记忆、线下摘要，或两者都清。适合推倒重来、换故事线、不想被旧记忆干扰。点下去还会再确认一次，不会误触就删光。',
    cardPlacement: 'above',
  },
  {
    target: 'detail-source-tabs',
    title: '三个标签分别干什么',
    body: '· 线上总结：微信私聊、群聊、微博、遇见等收成的大段文字；聊天时按关键词带进对话。\n· 线下摘要：约会每推进一轮记一行「发生了什么、何时何地」；用来接续剧情时间线。\n· 待办台账：还没做完的具体事（赴约、交作业等），单独存放，避免塞进摘要里越积越乱。\n点哪个标签，就看哪一类。',
    cardPlacement: 'below',
  },
  {
    target: 'create',
    title: '刻录记忆',
    body: '自己写一条想让系统长期记住的事。适合：重要约定、人设补充、模型老记错的事实。保存时可选「每次都带进对话」或「聊到相关词才带」。',
    cardPlacement: 'below',
  },
  {
    target: 'search',
    title: '搜索与查看账号',
    body: '搜索框用来找记忆正文或触发词。下方「查看账号」在多个微信马甲之间切换——不同马甲下，同一角色看到的私聊记忆可能不同。',
    cardPlacement: 'below',
  },
  {
    target: 'type-filter',
    title: '按场景筛选',
    body: '只看私聊、群聊、微博、遇见等某一类。比如只想翻微博相关记忆，点「微博」就行；可以多选。',
    cardPlacement: 'below',
  },
  {
    target: 'list',
    title: '记忆卡片',
    body: '每条点开能改、能删。颜色标签表示来自哪种场景。日常核对「模型有没有记错」，就在这里翻。',
    cardPlacement: 'above',
  },
  {
    target: 'detail-offline',
    title: '线下摘要列表',
    body: '约会推进后会自动多一行：标题、本轮事件、剧情日期地点等。翻剧情、核对时间线、改写错摘要，都在这里。时间按故事内日期排，不是手机时钟。',
    cardPlacement: 'below',
  },
  {
    target: 'detail-offline-manual',
    title: '手动补摘要',
    body: '某轮约会没自动写出摘要时，可粘贴当轮正文，点「生成并写入」。只补摘要，不会改待办台账。',
    cardPlacement: 'below',
  },
  {
    target: 'detail-todos',
    title: '待办台账怎么操作',
    body: '看当前还没办完的事；可点「完成 / 未兑现 / 删除」，或底部「补充」手写一条。\n· 清空待办：只清台账，不动摘要正文。\n· 按近况重建：按剧情时间最近 2 轮模型回复（线上或线下）重新整理未完事项，适合旧档迁移。\n场景举例：约会约了明天见面、私聊说要交作业——会出现在这里，而不是埋在摘要里。',
    cardPlacement: 'below',
  },
  {
    target: 'detail-tutorial',
    title: '忘了再看',
    body: '点标题栏右上角「教程」可打开文字说明，或再走一遍高亮引导。',
    cardPlacement: 'below',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '可以开始翻了',
    body: '先在三个标签之间切换找内容；要手动补事实用「刻录记忆」；旧待办乱了用待办台账里的清空/重建。',
  },
]
