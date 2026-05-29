import type { MemoryCoachStep } from '../../../memory/memoryCoachTypes'
import type { CrossBindingSubTabId } from '../crossBindings/crossBindingTypes'

export const PERSONA_RELATIONS_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '关系管理，一眼看懂',
    body: '这页管的是「谁认识谁、用什么关系词」。接下来会带你认三个视角、两种编辑方式，以及单向/双向是啥意思。',
  },
  {
    target: 'roster-tab-relations',
    title: '先来到关系管理',
    body: '底部名册有四个分区，你现在要在「关系管理」这一栏。如果高亮没对准，点一下顶上的「关系管理」标签即可。',
  },
  {
    target: 'relations-subtabs',
    title: '三种视角切换',
    body: 'USER = 微信身份跟谁绑定；MAIN = 主角之间、主角与 NPC；NPC = 从某个 NPC 看自己认识谁。点不同 pill 就换一张关系清单。',
  },
  {
    target: 'sample-perspective-card',
    title: '每张角色卡片',
    body: '一张卡片 = 一个「视角中心」。默认折叠，点箭头展开能看到所有关系词；右边两个按钮分别进图谱和文字编辑。',
  },
  {
    target: 'open-graph',
    title: '查看关系图谱',
    body: '想一眼看清谁连着谁，点「查看关系图谱」。进去后能看到头像、连线、关系词标签，还能拖一拖排版。',
  },
  {
    target: 'open-text-edit',
    title: '编辑关系（文字版）',
    body: '想认真改关系词、勾选单向/双向，点「编辑关系」。适合一条条核对，也能点「新增」补关系（主角↔主角、主角↔NPC）。',
  },
  {
    target: 'relations-tutorial',
    title: '教程按钮在这',
    body: '顶栏右侧「教程」随时能打开文字小抄，或再走一遍你现在看到的这种高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '关系管理入门完成',
    body: '记住：双向 = 俩人都认识；不勾选双向 = 只有这一方认识对方。需要温习就点「教程」。',
  },
]

export function relationsCoachSubTabForTarget(target: string | null): CrossBindingSubTabId | null {
  if (target === 'relations-subtab-user') return 'user'
  if (target === 'relations-subtab-main') return 'main'
  if (target === 'relations-subtab-npc') return 'npc'
  return null
}
