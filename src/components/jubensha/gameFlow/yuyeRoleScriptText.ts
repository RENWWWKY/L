import type { ScriptSection, ScriptSectionId } from './chatRoom/jbsFlowTypes'

import roleChengyuanRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-程予安.md?raw'
import roleLujingchuanRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-陆景川.md?raw'
import roleShenzhiyiRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-沈知意.md?raw'
import roleSuwanqingRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-苏晚晴.md?raw'

/** 去掉剧本 Markdown 中的加粗标记，便于阅读器纯文本展示 */
export function stripRoleScriptMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').trim()
}

function parseSectionHeading(line: string): { bracket: string; subtitle: string } | null {
  const m = line.trim().match(/^## 【([^】]+)】(.*)$/)
  if (!m) return null
  return { bracket: m[1].trim(), subtitle: m[2].trim() }
}

function formatSectionTitle(bracket: string, subtitle: string, fallback: string): string {
  if (subtitle) return `${bracket} · ${subtitle}`
  return bracket || fallback
}

/** 提取 `## 【xxx】` 二级标题下正文，直到下一节或分隔线 */
export function extractRoleScriptSection(
  raw: string,
  sectionKeyword: string,
): { title: string; body: string } {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let start = -1
  let title = sectionKeyword

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed.startsWith('## 【') || !trimmed.includes(sectionKeyword)) continue
    const parsed = parseSectionHeading(trimmed)
    if (parsed) {
      title = formatSectionTitle(parsed.bracket, parsed.subtitle, sectionKeyword)
    }
    start = i + 1
    break
  }
  if (start < 0) return { title: sectionKeyword, body: '' }

  const body: string[] = []
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '---') break
    if (line.startsWith('## 【')) break
    body.push(line)
  }
  return { title, body: stripRoleScriptMarkdown(body.join('\n').trim()) }
}

type YuyeRoleActs = {
  intro: { title: string; body: string }
  act1: { title: string; body: string }
  act2: { title: string; body: string }
  act3: { title: string; body: string }
}

function buildActsFromRaw(raw: string): YuyeRoleActs {
  const intro = extractRoleScriptSection(raw, '自我介绍')
  const act1 = extractRoleScriptSection(raw, '第一幕')
  const act2 = extractRoleScriptSection(raw, '第二幕')
  const act3 = extractRoleScriptSection(raw, '第三幕')
  return {
    intro: { title: '我的自我介绍', body: intro.body },
    act1: { title: act1.title, body: act1.body },
    act2: { title: act2.title, body: act2.body },
    act3: { title: act3.title, body: act3.body },
  }
}

const YUYE_ROLE_ACTS_BY_NAME: Record<string, YuyeRoleActs> = {
  程予安: buildActsFromRaw(roleChengyuanRaw),
  陆景川: buildActsFromRaw(roleLujingchuanRaw),
  沈知意: buildActsFromRaw(roleShenzhiyiRaw),
  苏晚晴: buildActsFromRaw(roleSuwanqingRaw),
}

const GENERIC_FINALE =
  '终局将至。请整理手稿中的疑点，准备投票。真相将在主持人宣读后揭晓。'

/** 《雨夜归零》完整分幕个人剧本（intro / act1–3 来自 Markdown；finale 为流程占位） */
export function buildYuyeGuilingRoleScriptSections(
  roleName: string,
  blurb: string,
): ScriptSection[] {
  const acts = YUYE_ROLE_ACTS_BY_NAME[roleName.trim()]
  if (!acts) return []

  const pick = (section: { title: string; body: string }, fallback: string) =>
    section.body || fallback

  const defs: Array<{ id: ScriptSectionId; section: { title: string; body: string }; fallback: string }> =
    [
      { id: 'intro', section: acts.intro, fallback: blurb },
      { id: 'act1', section: acts.act1, fallback: '第一幕内容加载失败，请稍后重试。' },
      { id: 'act2', section: acts.act2, fallback: '第二幕内容加载失败，请稍后重试。' },
      { id: 'act3', section: acts.act3, fallback: '第三幕内容加载失败，请稍后重试。' },
    ]

  return [
    ...defs.map(({ id, section, fallback }) => ({
      id,
      title: section.title,
      body: pick(section, fallback),
    })),
    { id: 'finale', title: '终极线索', body: GENERIC_FINALE },
  ]
}
