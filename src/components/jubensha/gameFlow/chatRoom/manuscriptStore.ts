export type ManuscriptMemo = {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

export type ManuscriptStore = {
  memos: ManuscriptMemo[]
  activeMemoId: string | null
}

type LegacyManuscriptMemo = ManuscriptMemo & { bodyHtml?: string }

function memoUid(): string {
  return `memo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createManuscriptMemo(title: string, body = ''): ManuscriptMemo {
  const now = Date.now()
  return {
    id: memoUid(),
    title,
    body,
    createdAt: now,
    updatedAt: now,
  }
}

function legacyStorageKey(scriptId: string, roleId: string): string {
  return `jbs-manuscript-${scriptId}-${roleId}`
}

export function manuscriptStorageKey(scriptId: string, roleId: string): string {
  return `jbs-manuscript-v2-${scriptId}-${roleId}`
}

function htmlToPlainText(html: string): string {
  if (!html.trim()) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').replace(/\r\n/g, '\n')
}

function normalizeMemo(raw: LegacyManuscriptMemo): ManuscriptMemo {
  const body =
    typeof raw.body === 'string'
      ? raw.body
      : typeof raw.bodyHtml === 'string'
        ? htmlToPlainText(raw.bodyHtml)
        : ''
  return {
    id: raw.id,
    title: raw.title,
    body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

const EMPTY_STORE: ManuscriptStore = { memos: [], activeMemoId: null }

export function loadManuscriptStore(scriptId: string, roleId: string): ManuscriptStore {
  const v2Key = manuscriptStorageKey(scriptId, roleId)
  try {
    const v2Raw = sessionStorage.getItem(v2Key)
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw) as { memos?: LegacyManuscriptMemo[]; activeMemoId?: string | null }
      if (parsed && Array.isArray(parsed.memos)) {
        const memos = parsed.memos.map(normalizeMemo)
        return {
          memos,
          activeMemoId: parsed.activeMemoId ?? memos[0]?.id ?? null,
        }
      }
    }

    const legacyRaw = sessionStorage.getItem(legacyStorageKey(scriptId, roleId))
    if (legacyRaw != null && legacyRaw.trim()) {
      if (legacyRaw.trimStart().startsWith('{')) {
        try {
          const legacyJson = JSON.parse(legacyRaw) as {
            memos?: LegacyManuscriptMemo[]
            activeMemoId?: string | null
          }
          if (Array.isArray(legacyJson.memos)) {
            const memos = legacyJson.memos.map(normalizeMemo)
            const migrated = { memos, activeMemoId: legacyJson.activeMemoId ?? memos[0]?.id ?? null }
            saveManuscriptStore(scriptId, roleId, migrated)
            return migrated
          }
        } catch {
          /* fall through */
        }
      }
      const memo = createManuscriptMemo('默认手稿', legacyRaw)
      const migrated: ManuscriptStore = { memos: [memo], activeMemoId: memo.id }
      saveManuscriptStore(scriptId, roleId, migrated)
      return migrated
    }
  } catch {
    /* ignore */
  }
  return { ...EMPTY_STORE }
}

export function saveManuscriptStore(scriptId: string, roleId: string, store: ManuscriptStore): void {
  try {
    sessionStorage.setItem(manuscriptStorageKey(scriptId, roleId), JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function manuscriptPreviewText(body: string, maxLen = 80): string {
  const oneLine = body.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

export function formatManuscriptTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
