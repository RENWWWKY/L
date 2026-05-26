import type { ScriptPageBodyMetrics } from './scriptPageMetrics'
import { isValidPageBodyMetrics } from './scriptPageMetrics'

const FIT_FUDGE_PX = 8

type PaginateProbe = {
  root: HTMLDivElement
  bodyBox: HTMLDivElement
  text: HTMLParagraphElement
}

let probe: PaginateProbe | null = null

function ensureProbe(width: number, height: number): PaginateProbe {
  if (!probe) {
    const root = document.createElement('div')
    root.className = 'jbs-script-page-paginate-probe'

    const content = document.createElement('div')
    content.className =
      'jbs-script-page-content relative flex min-h-0 min-w-0 flex-col overflow-hidden'

    const tag = document.createElement('span')
    tag.className = 'jbs-script-section-tag jbs-font-serif'
    tag.textContent = '占位'

    const bodyBox = document.createElement('div')
    bodyBox.className = 'jbs-script-page-body-box min-h-0 flex-1 overflow-hidden'

    const text = document.createElement('p')
    text.className = 'jbs-script-page-body jbs-font-kai whitespace-pre-wrap'

    bodyBox.appendChild(text)
    content.appendChild(tag)
    content.appendChild(bodyBox)
    root.appendChild(content)
    document.body.appendChild(root)

    probe = { root, bodyBox, text }
  }

  probe.root.style.width = `${width}px`
  probe.bodyBox.style.width = `${width}px`
  probe.bodyBox.style.height = `${height}px`

  return probe
}

/** 与 PageContent 内 body-box + <p> 同构测量 */
function textFitsInBox(text: string, width: number, height: number): boolean {
  const { bodyBox, text: p } = ensureProbe(width, height)
  p.textContent = text.length > 0 ? text : '\u00a0'
  bodyBox.style.overflow = 'hidden'
  void bodyBox.offsetHeight
  return p.scrollHeight <= bodyBox.clientHeight - FIT_FUDGE_PX
}

export function paginateBodyExact(body: string, metrics: ScriptPageBodyMetrics): string[] {
  if (!isValidPageBodyMetrics(metrics)) {
    console.warn('[scriptPagePaginator] 无效 metrics，跳过分页', metrics)
    return []
  }

  const src = body.replace(/\r\n/g, '\n')
  if (!src.trim()) return ['']

  const { width, height } = metrics
  const pages: string[] = []
  let i = 0

  while (i < src.length) {
    let lo = 1
    let hi = src.length - i
    let best = 0

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (textFitsInBox(src.slice(i, i + mid), width, height)) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    if (best <= 0) {
      console.error('[scriptPagePaginator] 单字也放不下', { width, height, at: i })
      best = 1
    }

    pages.push(src.slice(i, i + best))
    i += best
  }

  const joined = pages.join('')
  if (joined !== src) {
    console.error('[scriptPagePaginator] 分页丢字', { srcLen: src.length, joinedLen: joined.length })
    return [src]
  }

  if (import.meta.env.DEV && pages.length > 3 && src.length / pages.length < 8) {
    console.warn('[scriptPagePaginator] 每页字数异常偏少', {
      pages: pages.length,
      srcLen: src.length,
      metrics,
    })
  }

  return pages
}

export function findPageIndexForCharOffset(
  pages: readonly { body: string }[],
  charOffset: number,
): number {
  if (!pages.length) return 0
  let acc = 0
  const target = Math.max(0, charOffset)
  for (let i = 0; i < pages.length; i++) {
    const len = pages[i].body.length
    if (target < acc + len) return i
    acc += len
  }
  return pages.length - 1
}

export function charOffsetBeforePage(
  pages: readonly { body: string }[],
  pageIndex: number,
): number {
  let o = 0
  for (let i = 0; i < pageIndex && i < pages.length; i++) {
    o += pages[i].body.length
  }
  return o
}
