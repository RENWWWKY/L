import type { ScriptSection } from './jbsFlowTypes'
import { buildYuyeGuilingRoleScriptSections } from '../yuyeRoleScriptText'

const GENERIC_INTRO = (name: string, blurb: string) =>
  `【${name}】\n\n${blurb}\n\n今夜玻璃湾七号暴雨未歇，香槟塔尚未撤下，女主人已倒下。请以你的身份在群内完成自我介绍，勿提前透露未解锁章节中的隐秘。`

const GENERIC_ACT1 = `第一幕已开启。请根据主持人节奏，在脑海中回放今夜时间线：晚宴、离席、酒窖、回到客厅的那一刻。

所有尚未写入你剧本的细节，在讨论中只可推测，不可捏造已读内容。`

const GENERIC_ACT2 = `第二幕已开启。新的矛盾点浮出水面——请结合公共线索区已发放的证据，审视每一个人的动线与说辞。`

const GENERIC_ACT3 = `第三幕已开启。关键物证与时间点开始闭合，请准备进入最后一轮集中讨论。`

const GENERIC_FINALE = `终局将至。请整理手稿中的疑点，准备投票。真相将在主持人宣读后揭晓。`

function sectionsForRole(
  roleName: string,
  blurb: string,
  overrides?: Partial<Record<'intro' | 'act1' | 'act2' | 'act3', string>>,
): ScriptSection[] {
  return [
    {
      id: 'intro',
      title: '我的自我介绍',
      body: overrides?.intro ?? GENERIC_INTRO(roleName, blurb),
    },
    {
      id: 'act1',
      title: '第一幕 · 起风之时',
      body: overrides?.act1 ?? GENERIC_ACT1,
    },
    {
      id: 'act2',
      title: '第二幕 · 缺口',
      body: overrides?.act2 ?? GENERIC_ACT2,
    },
    { id: 'act3', title: '第三幕 · 收束', body: overrides?.act3 ?? GENERIC_ACT3 },
    { id: 'finale', title: '终极线索', body: GENERIC_FINALE },
  ]
}

/** 按剧本与角色 id 返回分幕个人剧本正文 */
export function buildRoleScriptSections(
  scriptId: string,
  roleName: string,
  blurb: string,
): ScriptSection[] {
  if (scriptId === 'yuye-guiling') {
    const fromMarkdown = buildYuyeGuilingRoleScriptSections(roleName, blurb)
    if (fromMarkdown.length > 0) return fromMarkdown
  }
  return sectionsForRole(roleName, blurb)
}
