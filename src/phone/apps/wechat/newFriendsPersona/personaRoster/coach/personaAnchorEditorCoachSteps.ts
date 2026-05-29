import type { MemoryCoachStep } from '../../../memory/memoryCoachTypes'

export const PERSONA_ANCHOR_EDITOR_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '文字版关系编辑',
    body: '这里用列表改关系，适合把关系词、单向/双向一次说清楚。下面带你过一遍关键按钮。',
  },
  {
    target: 'anchor-editor-header',
    title: '当前是谁的视角',
    body: '标题是「视角中心」的名字。你写的每条关系，都是「这个人怎么看别人」。',
  },
  {
    target: 'anchor-add-relation',
    title: '新增关系',
    body: '主角/NPC 视角才有「新增」：选另一个主角或 NPC，保存后多一条关系。用户身份视角主要管和角色的绑定，不靠这里拉主角线。',
  },
  {
    target: 'anchor-relation-row',
    title: '改一条关系',
    body: '每张卡片是一个对象。改关系词、勾选是否双向，别忘看下面灰色小字——不勾选就是「单方面认识」。',
  },
  {
    target: 'anchor-mutual-toggle',
    title: '双向还是单向',
    body: '勾选 = 互相认识；不勾选 = 只有当前角色认识对方。这是聊天 AI 会不会「知道」这条线的开关，很重要。',
  },
  {
    target: 'anchor-save',
    title: '保存才生效',
    body: '改完点底部「保存（含新建）」或「保存全部更改」，才会写进档案。没保存就返回，改动会丢。',
  },
  {
    target: 'anchor-editor-tutorial',
    title: '教程在这',
    body: '标题栏「教程」随时能看文字说明，或再跑一遍高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '文字编辑学会了',
    body: '拿不准单向双向时，想想：对方聊天该不该知道这条关系？不该知道就别勾选双向。',
  },
]
