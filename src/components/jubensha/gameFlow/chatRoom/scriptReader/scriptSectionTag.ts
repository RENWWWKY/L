import type { ScriptSectionId } from '../jbsFlowTypes'

const SECTION_TAG_BY_ID: Record<ScriptSectionId | 'locked', string> = {
  intro: '个人介绍',
  act1: '第一幕',
  act2: '第二幕',
  act3: '第三幕',
  finale: '终局',
  locked: '未解封',
}

/** 页角小标签：个人介绍 / 第一幕 … */
export function resolveSectionTag(
  sectionId: ScriptSectionId | 'locked',
  sectionTitle: string,
): string {
  const byId = SECTION_TAG_BY_ID[sectionId as ScriptSectionId]
  if (byId) return byId

  const t = sectionTitle.trim()
  if (/自我介绍|个人介绍/.test(t)) return '个人介绍'
  const act = t.match(/^第([一二三四五六七八九十百\d]+)幕/)
  if (act) return `第${act[1]}幕`
  const head = t.split(/[·\-—|]/)[0]?.trim()
  return head || t
}
