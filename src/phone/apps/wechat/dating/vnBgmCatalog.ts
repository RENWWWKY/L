import { VN_BGM_MANIFEST } from './vnBgmManifest.generated'

export type VnBgmAsset = {
  name: string
  fileName: string
  url: string
}

function cleanBgmName(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  return t
    .replace(/\.[A-Za-z0-9]+$/u, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBgmKey(raw: string): string {
  return cleanBgmName(raw)
    .toLowerCase()
    .replace(/[，,。.!！?？、;；:："“”"'‘’（）()[\]【】\-_/\\]/g, '')
    .replace(/\s+/g, '')
}

export const VN_BGM_ASSETS: VnBgmAsset[] = VN_BGM_MANIFEST.filter((x) => x.name && x.url)

/** 把「心动、氛围、emo」这类文件名拆成可匹配的关键词（已 normalize） */
function bgmNameToTokens(raw: string): string[] {
  const cleaned = cleanBgmName(raw)
  if (!cleaned) return []
  const parts = cleaned
    .split(/[、，,\s|\/·]+/u)
    .map((p) => normalizeBgmKey(p))
    .filter((t) => t.length >= 2)
  const full = normalizeBgmKey(cleaned)
  if (full.length >= 2 && !parts.includes(full)) parts.unshift(full)
  return [...new Set(parts)]
}

function tokenPairMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length < 2 || b.length < 2) return false
  return a.includes(b) || b.includes(a)
}

/** 同一 cue 多次命中多首同分时轮询，避免总播排序后的第一首 */
const bgmResolveRoundRobin = new Map<string, number>()

function pickRoundRobin(cacheKey: string, list: VnBgmAsset[]): VnBgmAsset {
  if (list.length === 1) return list[0]!
  const i = bgmResolveRoundRobin.get(cacheKey) ?? 0
  bgmResolveRoundRobin.set(cacheKey, i + 1)
  return list[i % list.length]!
}

/** 最近若干次选曲窗口长度（与 MAX_SAME_IN_WINDOW 配合，抑制单曲刷屏） */
export const VN_BGM_DIVERSITY_WINDOW = 8
export const VN_BGM_MAX_SAME_IN_WINDOW = 2

export function buildVnBgmPromptBlock(): string {
  if (!VN_BGM_ASSETS.length) return ''
  const names = VN_BGM_ASSETS.map((x) => x.name)
  return (
    `【VN背景音乐库】以下 BGM 名可用（直接使用文件名语义）：\n` +
    `${names.map((x) => `- ${x}`).join('\n')}\n` +
    `【BGM输出规则】` +
    `需要切换音乐时，在对应气泡前单独输出一行「【BGM】音乐名」。` +
    `文件名里若用「、」等串联多个情绪/场景词，你只需输出**任意一个词或一小段**即可命中对应曲目；不必写全名，也无需固定写第一个词。` +
    `同一轮可多次切换，且必须从上述列表中选最符合当下情绪和场景的一项；` +
    `若当前音乐已合适则不要重复输出。` +
    `【去重】客户端对**最近 ${VN_BGM_DIVERSITY_WINDOW} 次**成功切换的曲目做统计：**同一文件**在这窗口内**最多出现 ${VN_BGM_MAX_SAME_IN_WINDOW} 次**；超出时会在仍匹配你写的氛围词的前提下**自动换一首**（多首同分时轮换，并优先选近期少播的）。` +
    `【动态】场景或情绪稍有变化就应输出新的「【BGM】关键词」；不必写完整文件名，**文件名里以「、」等分隔的任意一个词**只要贴当前氛围即可命中该曲。` +
    `请主动换用**不同文件**里出现的不同词（例如别整段只写「心动」「日常」），让曲库轮换起来。`
  )
}

export type ResolveVnBgmOptions = {
  /** 最近已成功播放的曲目键（与 vnBgmAssetDiversityKey 一致），旧→新 */
  recentResolvedKeys?: readonly string[]
}

export function vnBgmAssetDiversityKey(asset: VnBgmAsset): string {
  const k = String(asset.fileName || asset.url || '').trim()
  return k || normalizeBgmKey(asset.name)
}

function countSameInWindowAfterPick(
  recentFifo: readonly string[],
  pickKey: string,
  windowSize: number,
): number {
  const next = [...recentFifo, pickKey].slice(-windowSize)
  return next.filter((k) => k === pickKey).length
}

function countPlaysInRecent(recentFifo: readonly string[], pickKey: string): number {
  return recentFifo.filter((k) => k === pickKey).length
}

type BgmScored = { asset: VnBgmAsset; score: number }

function dedupeAssetsByBestScore(items: BgmScored[]): VnBgmAsset[] {
  const m = new Map<string, BgmScored>()
  for (const s of items) {
    const dk = vnBgmAssetDiversityKey(s.asset)
    const prev = m.get(dk)
    if (!prev || s.score > prev.score) m.set(dk, s)
  }
  return [...m.values()]
    .sort((a, b) => b.score - a.score)
    .map((s) => s.asset)
}

function scoreForAsset(scored: BgmScored[], a: VnBgmAsset): number {
  const dk = vnBgmAssetDiversityKey(a)
  return scored.find((s) => vnBgmAssetDiversityKey(s.asset) === dk)?.score ?? 0
}

export function resolveVnBgmByName(name: string, options?: ResolveVnBgmOptions): VnBgmAsset | null {
  const raw = String(name || '').trim()
  if (!raw) return null
  const key = normalizeBgmKey(raw)
  if (!key) return null

  const exact = VN_BGM_ASSETS.find((x) => normalizeBgmKey(x.name) === key)
  const recent = options?.recentResolvedKeys ?? []
  if (exact) {
    const dk = vnBgmAssetDiversityKey(exact)
    if (
      countSameInWindowAfterPick(recent, dk, VN_BGM_DIVERSITY_WINDOW) <= VN_BGM_MAX_SAME_IN_WINDOW
    ) {
      return exact
    }
    // 歌名完全一致但最近播放次数已达上限：继续走模糊匹配，在同一 cue 下换一首
  }

  let cueTokens = bgmNameToTokens(raw)
  if (!cueTokens.length && key.length >= 2) cueTokens = [key]
  if (!cueTokens.length) return null

  const scored: BgmScored[] = []

  for (const x of VN_BGM_ASSETS) {
    const nk = normalizeBgmKey(x.name)
    const assetTokens = bgmNameToTokens(x.name)
    let score = 0

    for (const ct of cueTokens) {
      let best = 0
      for (const at of assetTokens) {
        if (tokenPairMatch(ct, at)) {
          const rank = ct === at || nk === key ? 100 : ct.length >= 4 && (at === ct || nk.includes(ct) || ct.includes(nk)) ? 40 : 25
          if (rank > best) best = rank
        }
      }
      if (best === 0 && nk.includes(ct)) best = 20
      if (best === 0 && ct.includes(nk) && nk.length >= 2) best = 15
      score += best
    }

    if (score === 0 && (nk.includes(key) || key.includes(nk))) {
      score = 10
    }
    if (score > 0) scored.push({ asset: x, score })
  }

  if (!scored.length) return null

  const rrKey = `${key}::${cueTokens.join('|')}`
  const passes = (a: VnBgmAsset) =>
    countSameInWindowAfterPick(recent, vnBgmAssetDiversityKey(a), VN_BGM_DIVERSITY_WINDOW) <=
    VN_BGM_MAX_SAME_IN_WINDOW

  const maxScore = Math.max(...scored.map((s) => s.score))
  /** 与最高分相差在此范围内的曲目一并参与轮换，避免永远只播并列第一的同一首 */
  const slack = Math.max(18, Math.min(45, Math.floor(maxScore * 0.22)))
  const bandScored = scored.filter((s) => s.score >= maxScore - slack)
  const bandAssets = dedupeAssetsByBestScore(bandScored)

  const sortByRecencyThenScore = (list: VnBgmAsset[]): VnBgmAsset[] =>
    [...list].sort((a, b) => {
      const ca = countPlaysInRecent(recent, vnBgmAssetDiversityKey(a))
      const cb = countPlaysInRecent(recent, vnBgmAssetDiversityKey(b))
      if (ca !== cb) return ca - cb
      return scoreForAsset(scored, b) - scoreForAsset(scored, a)
    })

  const eligibleBand = bandAssets.filter(passes)
  if (eligibleBand.length) {
    return pickRoundRobin(`${rrKey}::band`, sortByRecencyThenScore(eligibleBand))
  }

  /** 分数带内都已触碰多样性上限：在仍匹配的曲里选「窗口内播放次数最少」的 */
  const leastLoaded = sortByRecencyThenScore(bandAssets)
  if (leastLoaded.length) {
    const minC = countPlaysInRecent(recent, vnBgmAssetDiversityKey(leastLoaded[0]!))
    const tie = leastLoaded.filter((a) => countPlaysInRecent(recent, vnBgmAssetDiversityKey(a)) === minC)
    return pickRoundRobin(`${rrKey}::relax`, tie)
  }

  const scoreLevels = [...new Set(scored.map((s) => s.score))].sort((a, b) => b - a)
  for (const lev of scoreLevels) {
    const tierAssets = scored.filter((s) => s.score === lev).map((s) => s.asset)
    const eligible = tierAssets.filter(passes)
    if (eligible.length) return pickRoundRobin(`${rrKey}::s${lev}`, sortByRecencyThenScore(eligible))
  }
  const topLev = scoreLevels[0]!
  const top = dedupeAssetsByBestScore(scored.filter((s) => s.score === topLev))
  return pickRoundRobin(`${rrKey}::force`, sortByRecencyThenScore(top))
}

export function extractVnBgmCueName(rawLine: string): string | null {
  const t = String(rawLine || '').trim()
  if (!t) return null
  const m1 = t.match(/^【\s*BGM\s*】\s*(.+)$/iu)
  if (m1?.[1]) return m1[1].trim()
  const m2 = t.match(/^BGM[：:]\s*(.+)$/iu)
  if (m2?.[1]) return m2[1].trim()
  return null
}
