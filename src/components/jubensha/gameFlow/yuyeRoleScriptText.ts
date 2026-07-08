import type { ScriptSection, ScriptSectionId } from './chatRoom/jbsFlowTypes'

import roleChengyuanRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-程予安.md?raw'
import roleLujingchuanRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-陆景川.md?raw'
import roleShenzhiyiRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-沈知意.md?raw'
import roleSuwanqingRaw from '../../../../剧本杀/《雨夜归零》/剧本/角色-苏晚晴.md?raw'

/** 去掉剧本 Markdown 中的加粗标记，便于阅读器纯文本展示 */
export function stripRoleScriptMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .trim()
}

function isPresentMomentLine(line: string): boolean {
  const t = line.trim()
  return /^\*\*现时点\*\*/.test(t) || /^现时点[：:]/.test(t)
}

const ACT_TASK_MARKER = '【本幕任务】'

/** 局内自我介绍顶部不展示的编剧/主持人备忘 */
function isHostOnlyPreambleLine(text: string): boolean {
  return /真凶|扮演目标|随幕推进|勿向玩家|主持人备忘|下毒者|凶手身份|本角色为/.test(text)
}

/** 陆景川 / 沈知意：局内「我的自我介绍」恋情专块（与 Markdown 叙事互补，便于扫读） */
const YUYE_SECRET_ROMANCE_INTRO: Record<'陆景川' | '沈知意', string> = {
  陆景川: [
    '【与沈知意的秘密恋情 · 第一幕不宜公开】',
    '· 怎么在一起的：一个月前行业酒会上，有人借酒纠缠沈知意，你从侧面挡开，把她的酒杯换成矿泉水——当时仍在谈对赌延期，表面只是乙方 CTO 对资方代表。',
    '· 确定关系：酒会后又见过几次（签字室外走廊、深夜电话），约三周前开始地下恋。',
    '· 对外规矩：她是沈厚泽基金代表，你是归零 CTO；在玻璃湾七号、在任何人面前，只作「宣读条款的资方」和「答技术问题的 CTO」。',
    '· 暗号：微信「别动那一支」这类短句只有你们懂；第一幕别主动向全员承认你们在谈恋爱。',
  ].join('\n'),
  沈知意: [
    '【与陆景川的秘密恋情 · 第一幕不宜公开】',
    '· 怎么在一起的：一个月前行业酒会上，有人借酒纠缠你，陆景川从侧面挡开，把你的酒杯换成矿泉水——当时仍是资方与乙方的谈判场合。',
    '· 确定关系：酒会后又见过几次（签字室外走廊、深夜电话），约三周前开始地下恋；父亲说过「不是让你去谈恋爱」，你们仍约好在桌上只谈条款。',
    '· 对外规矩：他是归零 CTO，你是沈厚泽基金代表；在林晚星、苏晚晴面前，只谈签字与回购。',
    '· 暗号：他发「别动那一支」时你当时以为说的是书房威士忌；第一幕别主动公开恋情。',
  ].join('\n'),
}

/** 从分幕段落行中提取叙事正文（跳过现时点、首条 ---、本幕任务） */
function buildNarrativeBodyFromSectionLines(sectionLines: string[]): string {
  const fullSection = sectionLines.join('\n')
  const taskIdx = fullSection.indexOf(ACT_TASK_MARKER)
  const narrativeRaw = taskIdx >= 0 ? fullSection.slice(0, taskIdx) : fullSection

  const narrativeLines = narrativeRaw.split('\n')
  const firstDash = narrativeLines.findIndex((l) => l.trim() === '---')
  let storyStart = 0

  if (firstDash >= 0) {
    const beforeDash = narrativeLines.slice(0, firstDash)
    const hasStoryBeforeDash = beforeDash.some((l) => {
      const t = l.trim()
      return t && !isPresentMomentLine(l)
    })
    storyStart = hasStoryBeforeDash ? 0 : firstDash + 1
  }

  while (storyStart < narrativeLines.length) {
    const line = narrativeLines[storyStart] ?? ''
    const t = line.trim()
    if (!t || isPresentMomentLine(line)) {
      storyStart += 1
      continue
    }
    break
  }

  return stripRoleScriptMarkdown(
    narrativeLines
      .slice(storyStart)
      .filter((l) => {
        const t = l.trim()
        return t !== '---' && !isPresentMomentLine(l)
      })
      .join('\n')
      .trim(),
  )
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

  const sectionLines: string[] = []
  for (let i = start; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('## 【')) break
    sectionLines.push(lines[i])
  }
  return { title, body: buildNarrativeBodyFromSectionLines(sectionLines) }
}

type YuyeRoleActs = {
  intro: { title: string; body: string }
  act1: { title: string; body: string }
  act2: { title: string; body: string }
  act3: { title: string; body: string }
}

/** 第一幕：与第二、三幕共用叙事提取逻辑 */
function extractAct1Section(raw: string): { title: string; body: string } {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let title = '第一幕'
  let sectionStart = -1

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed.startsWith('## 【') || !trimmed.includes('第一幕')) continue
    const parsed = parseSectionHeading(trimmed)
    if (parsed) {
      title = formatSectionTitle(parsed.bracket, parsed.subtitle, '第一幕')
    }
    sectionStart = i + 1
    break
  }
  if (sectionStart < 0) return { title: '第一幕', body: '' }

  const sectionLines: string[] = []
  for (let i = sectionStart; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('## 【')) break
    sectionLines.push(lines[i])
  }

  return { title, body: buildNarrativeBodyFromSectionLines(sectionLines) }
}

function extractRoleScriptProfilePreamble(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const identity: string[] = []
  const relations: string[] = []
  let passedTitle = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!passedTitle) {
      if (trimmed.startsWith('# ')) passedTitle = true
      continue
    }
    if (trimmed.startsWith('## 【')) break
    if (!trimmed || trimmed === '---') continue
    if (trimmed.startsWith('|')) continue
    if (/^\*\*.+\*\*[：:]/.test(trimmed)) {
      const plain = stripRoleScriptMarkdown(trimmed)
      if (/^与/.test(plain.split('：')[0] ?? '')) relations.push(plain)
      else identity.push(plain)
      continue
    }
    if (trimmed.startsWith('>')) {
      const plain = stripRoleScriptMarkdown(trimmed.replace(/^>\s?/, ''))
      if (isHostOnlyPreambleLine(plain)) continue
      identity.push(plain)
    }
  }

  if (identity.length === 0 && relations.length === 0) return ''

  const blocks: string[] = ['【人物关系与身份】']
  if (identity.length > 0) {
    blocks.push(...identity.map((p) => `· ${p}`))
  }
  if (relations.length > 0) {
    blocks.push('', '【私人关系 · 第一幕不宜公开】', ...relations.map((p) => `· ${p}`))
  }
  return blocks.join('\n')
}

function buildYuyeIdentityPreamble(raw: string): string {
  const lines: string[] = []
  let passedTitle = false

  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (!passedTitle) {
      if (trimmed.startsWith('# ')) passedTitle = true
      continue
    }
    if (trimmed.startsWith('## 【')) break
    if (!trimmed || trimmed === '---' || trimmed.startsWith('>') || trimmed.startsWith('|')) continue
    if (/^\*\*.+\*\*[：:]/.test(trimmed)) {
      const plain = stripRoleScriptMarkdown(trimmed)
      const key = plain.split('：')[0] ?? ''
      if (/^与沈知意/.test(key)) continue
      if (/^与陆景川/.test(key)) continue
      if (/^性别|^对外身份|^与林晚星/.test(key)) lines.push(`· ${plain}`)
    }
  }

  return lines.length ? `【我是谁】\n${lines.join('\n')}` : ''
}

/** 局内 intro 去掉 Markdown 中与恋情专块重复的段落，并滤掉主持人备忘 */
function sanitizeIntroNarrativeForRole(roleName: string, narrative: string): string {
  let text = narrative

  if (roleName === '陆景川') {
    text = text.replace(
      /你和沈知意是秘密恋人。[\s\S]*?别主动向全员承认你们在谈恋爱。\s*/g,
      '',
    )
  } else if (roleName === '沈知意') {
    text = text.replace(
      /可你还是会想起一个月前的行业酒会。[\s\S]*?（你当时以为说的是书房威士忌）。\s*/g,
      '',
    )
    text = text.replace(
      /陆景川是乙方，是归零的刀，也是你的秘密恋人[\s\S]*?只当那是地理描述。\s*/g,
      '',
    )
  }

  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !isHostOnlyPreambleLine(p))
    .join('\n\n')
    .trim()
}

function buildIntroBodyForRole(
  roleName: string,
  raw: string,
  profile: string,
  introNarrative: string,
): string {
  if (roleName === '陆景川' || roleName === '沈知意') {
    const identity = buildYuyeIdentityPreamble(raw)
    const romance = YUYE_SECRET_ROMANCE_INTRO[roleName]
    const narrative = sanitizeIntroNarrativeForRole(roleName, introNarrative)
    return [identity, romance, narrative].filter(Boolean).join('\n\n').trim()
  }
  return [profile, introNarrative].filter(Boolean).join('\n\n').trim()
}

function buildActsFromRaw(raw: string, roleName: string): YuyeRoleActs {
  const profile = extractRoleScriptProfilePreamble(raw)
  const introSection = extractRoleScriptSection(raw, '自我介绍')
  const introBody = buildIntroBodyForRole(roleName, raw, profile, introSection.body)
  const act1 = extractAct1Section(raw)
  const act2 = extractRoleScriptSection(raw, '第二幕')
  const act3 = extractRoleScriptSection(raw, '第三幕')
  return {
    intro: { title: '我的自我介绍', body: introBody },
    act1: { title: act1.title, body: act1.body },
    act2: { title: act2.title, body: act2.body },
    act3: { title: act3.title, body: act3.body },
  }
}

const YUYE_ROLE_RAW_BY_NAME: Record<string, string> = {
  程予安: roleChengyuanRaw,
  陆景川: roleLujingchuanRaw,
  沈知意: roleShenzhiyiRaw,
  苏晚晴: roleSuwanqingRaw,
}

const ACT_ROMAN: Record<'act1' | 'act2' | 'act3', string> = {
  act1: 'ACT I',
  act2: 'ACT II',
  act3: 'ACT III',
}

const ACT_SECTION_KEYWORD: Record<'act1' | 'act2' | 'act3', string> = {
  act1: '第一幕',
  act2: '第二幕',
  act3: '第三幕',
}

function collectSectionLines(raw: string, sectionKeyword: string): { title: string; lines: string[] } {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let title = sectionKeyword
  let sectionStart = -1

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed.startsWith('## 【') || !trimmed.includes(sectionKeyword)) continue
    const parsed = parseSectionHeading(trimmed)
    if (parsed) {
      title = formatSectionTitle(parsed.bracket, parsed.subtitle, sectionKeyword)
    }
    sectionStart = i + 1
    break
  }
  if (sectionStart < 0) return { title: sectionKeyword, lines: [] }

  const sectionLines: string[] = []
  for (let i = sectionStart; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('## 【')) break
    sectionLines.push(lines[i])
  }
  return { title, lines: sectionLines }
}

/** 提取某幕【本幕任务】下的 bullet 条目（供密函接取仪式使用） */
export function extractActTaskBullets(raw: string, sectionKeyword: string): string[] {
  const { lines: sectionLines } = collectSectionLines(raw, sectionKeyword)
  const fullSection = sectionLines.join('\n')
  const taskIdx = fullSection.indexOf(ACT_TASK_MARKER)
  if (taskIdx < 0) return []

  const bullets: string[] = []
  for (const line of fullSection.slice(taskIdx).split('\n')) {
    const t = line.trim()
    if (!t || t === '---') continue
    if (t.startsWith('>')) continue
    if (t.includes(ACT_TASK_MARKER)) continue
    const bullet = t.match(/^[-*]\s+(.+)$/)
    if (bullet?.[1]) {
      const text = stripRoleScriptMarkdown(bullet[1].trim())
      if (text) bullets.push(text)
    }
  }
  return bullets
}

export type YuyeActId = 'act1' | 'act2' | 'act3'

/** 《雨夜归零》某幕任务密函标题与条目 */
export function getYuyeActCommissionData(
  roleName: string,
  actId: YuyeActId,
): { missionTitle: string; sectionTitle: string; tasks: string[] } | null {
  const raw = YUYE_ROLE_RAW_BY_NAME[roleName.trim()]
  if (!raw) return null
  const keyword = ACT_SECTION_KEYWORD[actId]
  const { title: sectionTitle } = collectSectionLines(raw, keyword)
  const subtitle = sectionTitle.includes(' · ')
    ? sectionTitle.split(' · ').slice(1).join(' · ')
    : sectionTitle.replace(/^第一幕|^第二幕|^第三幕/, '').trim() || keyword
  const tasks = extractActTaskBullets(raw, keyword)
  return {
    missionTitle: `MISSION: ${ACT_ROMAN[actId]} | 密函：${subtitle}`,
    sectionTitle,
    tasks,
  }
}

const YUYE_ROLE_ACTS_BY_NAME: Record<string, YuyeRoleActs> = {
  程予安: buildActsFromRaw(roleChengyuanRaw, '程予安'),
  陆景川: buildActsFromRaw(roleLujingchuanRaw, '陆景川'),
  沈知意: buildActsFromRaw(roleShenzhiyiRaw, '沈知意'),
  苏晚晴: buildActsFromRaw(roleSuwanqingRaw, '苏晚晴'),
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

  const defs: Array<{
    id: ScriptSectionId
    section: { title: string; body: string }
    fallback: string
  }> = [
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
