/// <reference lib="webworker" />

type RowIn = { id: string; content: string; timestamp: number }

type InMsg = { rows: RowIn[]; keyword: string }
type OutMsg = { matches: Array<{ id: string; timestamp: number }> }

self.onmessage = (e: MessageEvent<InMsg>) => {
  const { rows, keyword } = e.data
  const k = keyword.trim().toLowerCase()
  if (!k) {
    const out: OutMsg = { matches: [] }
    self.postMessage(out)
    return
  }
  const matches: Array<{ id: string; timestamp: number }> = []
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]!
    const c = r.content
    if (typeof c === 'string' && c.toLowerCase().includes(k)) {
      matches.push({ id: r.id, timestamp: r.timestamp })
    }
  }
  matches.sort((a, b) => b.timestamp - a.timestamp)
  const out: OutMsg = { matches: matches.slice(0, 100) }
  self.postMessage(out)
}

export {}
