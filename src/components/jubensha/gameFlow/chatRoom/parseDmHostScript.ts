/** 解析 DM 主持剧本 Markdown · 按 ## 【标题】 分节 */

const H2_SECTION = /^## 【([^】]+)】/gm

function isDmOnlyLine(line: string): boolean {
  const t = line.trim()
  return (
    t.startsWith('【衔接校验】') ||
    t.startsWith('【主持人备忘') ||
    t.startsWith('**勿宣读') ||
    t.startsWith('**此时尚未发生') ||
    t.startsWith('**宣读') ||
    t.startsWith('**3 人局**：建议') ||
    /^\|[-\s|]+\|$/.test(t)
  )
}

export function parseDmSections(markdown: string): Map<string, string> {
  const map = new Map<string, string>()
  const matches = [...markdown.matchAll(H2_SECTION)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const title = m[1]?.trim()
    if (!title) continue
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? markdown.length) : markdown.length
    const raw = markdown.slice(start, end)
    map.set(title, cleanDmSection(raw, title))
  }
  return map
}

export function findDmSection(sections: Map<string, string>, keyword: string): string {
  for (const [title, body] of sections) {
    if (title.includes(keyword)) return body
  }
  return ''
}

/** 优先取引用块正文（公共剧情、过场等）· 合并为一段 */
export function extractDmBlockquotes(section: string): string {
  const chunks = extractDmBlockquoteChunks(section)
  if (chunks.length > 0) return chunks.join('\n\n')
  return stripInlineMarkdown(section.trim())
}

/**
 * 按引用块之间的空行拆成多段（用于聊天室逐条 DM 气泡）。
 * 同一块内仅用 `>` 空行分段，仍合并为一条。
 */
export function extractDmBlockquoteChunks(section: string): string[] {
  const lines = section.split('\n')
  const chunks: string[] = []
  let current: string[] = []

  const flush = () => {
    if (current.length === 0) return
    const text = current.filter((l) => l !== '').join('\n\n')
    const cleaned = stripInlineMarkdown(text.trim())
    if (cleaned) chunks.push(cleaned)
    current = []
  }

  for (const line of lines) {
    if (isDmOnlyLine(line)) continue
    if (line.trim() === '---') continue
    if (line.startsWith('>')) {
      current.push(line.replace(/^>\s?/, '').trimEnd())
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    flush()
  }
  flush()
  return chunks
}

function cleanDmSection(raw: string, title: string): string {
  if (title.includes('角色卡速览')) {
    return formatRoleOverviewTable(raw)
  }
  const lines = raw.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (isDmOnlyLine(line)) continue
    if (line.trim() === '---') continue
    kept.push(line)
  }
  return stripInlineMarkdown(kept.join('\n').trim())
}

function formatRoleOverviewTable(raw: string): string {
  const rows: string[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    if (/^\|[\s-|]+\|$/.test(line.trim())) continue
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
    if (cells[0] === '角色' || cells.length < 4) continue
    rows.push(`${cells[0]}（${cells[1]}）· ${cells[2]} — ${cells[3]}`)
  }
  const header = '今夜可选角色如下（仅外在信息，勿剧透）：'
  const footer = raw.includes('勿宣读')
    ? '\n\n请勿提前透露真凶身份、秘密恋情、匿名信与挪用细节。'
    : ''
  return rows.length > 0 ? `${header}\n\n${rows.join('\n')}${footer}` : cleanDmSection(raw, '')
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
