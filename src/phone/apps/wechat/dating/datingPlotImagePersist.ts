import { personaDb } from '../newFriendsPersona/idb'
import type { ArchivesStore, CharacterArchive, PlotImageItem, PlotItem } from './types'

const PLOT_IMAGE_KV_PREFIX = 'wechat-dating-plot-img-v1::'

function plotImageKvKey(id: string): string {
  return `${PLOT_IMAGE_KV_PREFIX}${id.trim()}`
}

function isInlinePlotImageUrl(url: string): boolean {
  return url.trim().startsWith('data:image/')
}

/** 将配图写入独立 KV（base64 与外链均保留），避免约会存档体积过大导致落库失败 */
export async function persistPlotImageItemsToSideStore(items: PlotImageItem[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      const url = item.url?.trim()
      if (!url) return
      try {
        await personaDb.setPhoneKv(plotImageKvKey(item.id), url)
      } catch (err) {
        console.warn('[dating] plot image side-store write failed', item.id, err)
      }
    }),
  )
}

/** 从侧存储补全 plotImages.url（存档中可能只保留了 id/prompt） */
export async function hydratePlotImageItems(
  items: PlotImageItem[] | undefined,
): Promise<PlotImageItem[] | undefined> {
  if (!items?.length) return items
  const out = await Promise.all(
    items.map(async (item) => {
      const url = item.url?.trim()
      if (url) return item
      try {
        const stored = await personaDb.getPhoneKv(plotImageKvKey(item.id))
        if (typeof stored === 'string' && stored.trim()) {
          return { ...item, url: stored.trim() }
        }
      } catch {
        /* ignore */
      }
      return item
    }),
  )
  return out
}

export async function hydrateArchivePlotImages(archive: CharacterArchive): Promise<CharacterArchive> {
  let changed = false
  const plots = await Promise.all(
    archive.plots.map(async (plot) => {
      if (!plot.plotImages?.length) return plot
      const hydrated = await hydratePlotImageItems(plot.plotImages)
      if (hydrated === plot.plotImages) return plot
      changed = true
      return { ...plot, plotImages: hydrated }
    }),
  )
  return changed ? { ...archive, plots } : archive
}

export async function hydrateArchivesPlotImages(store: ArchivesStore): Promise<ArchivesStore> {
  const entries = await Promise.all(
    Object.entries(store).map(async ([id, arch]) => [id, await hydrateArchivePlotImages(arch)] as const),
  )
  return Object.fromEntries(entries)
}

/** 写入约会存档 KV 前剥离 inline base64（侧存储已保存时可恢复） */
export function stripInlinePlotImagesForKvArchive(archive: CharacterArchive): CharacterArchive {
  let archiveChanged = false
  const plots = archive.plots.map((plot) => {
    if (!plot.plotImages?.length) return plot
    let plotChanged = false
    const plotImages = plot.plotImages.map((img) => {
      if (!isInlinePlotImageUrl(img.url ?? '')) return img
      plotChanged = true
      return { ...img, url: '' }
    })
    if (plotChanged) {
      archiveChanged = true
      return { ...plot, plotImages }
    }
    return plot
  })
  return archiveChanged ? { ...archive, plots } : archive
}

export function stripInlinePlotImagesForKvStore(store: ArchivesStore): ArchivesStore {
  const out: ArchivesStore = {}
  for (const [id, arch] of Object.entries(store)) {
    out[id] = stripInlinePlotImagesForKvArchive(arch)
  }
  return out
}

/** 从侧存储收集某条剧情全部配图（供落库前写入） */
export async function collectPlotImagesForPersist(plots: PlotItem[]): Promise<void> {
  const all: PlotImageItem[] = []
  for (const p of plots) {
    if (p.plotImages?.length) all.push(...p.plotImages)
  }
  if (all.length) await persistPlotImageItemsToSideStore(all)
}

/** 按 id 合并配图列表：优先保留有 url 的版本，避免 KV 重载时丢第二张 */
export function mergePlotImageItemLists(
  memoryItems?: PlotImageItem[],
  kvItems?: PlotImageItem[],
): PlotImageItem[] | undefined {
  if (!memoryItems?.length && !kvItems?.length) return undefined
  const byId = new Map<string, PlotImageItem>()
  for (const item of kvItems ?? []) {
    byId.set(item.id, item)
  }
  for (const item of memoryItems ?? []) {
    const prev = byId.get(item.id)
    const url = item.url?.trim() || prev?.url?.trim() || ''
    byId.set(item.id, {
      ...(prev ?? item),
      ...item,
      url,
      prompt: item.prompt?.trim() || prev?.prompt?.trim() || '',
    })
  }
  const orderSource = (kvItems?.length ? kvItems : memoryItems) ?? []
  const seen = new Set<string>()
  const out: PlotImageItem[] = []
  for (const item of orderSource) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const merged = byId.get(item.id)
    if (merged) out.push(merged)
  }
  for (const [id, item] of byId) {
    if (!seen.has(id)) out.push(item)
  }
  return out.length ? out : undefined
}

/** KV 重载时保留内存里已有、但 KV 尚未写回的配图 */
export function mergePlotImagesFromMemory(prev: ArchivesStore, next: ArchivesStore): ArchivesStore {
  const out: ArchivesStore = { ...next }
  for (const charId of Object.keys(prev)) {
    const prevArch = prev[charId]
    const nextArch = out[charId]
    if (!prevArch || !nextArch) continue
    const prevById = new Map(prevArch.plots.map((p) => [p.id, p]))
    let plotsChanged = false
    const plots = nextArch.plots.map((p) => {
      const mem = prevById.get(p.id)
      const mergedImages = mergePlotImageItemLists(mem?.plotImages, p.plotImages)
      if (!mergedImages) return p
      const memCount = mem?.plotImages?.filter((i) => i.url?.trim()).length ?? 0
      const kvCount = p.plotImages?.filter((i) => i.url?.trim()).length ?? 0
      const mergedCount = mergedImages.filter((i) => i.url?.trim()).length
      const countChanged = mergedImages.length !== (p.plotImages?.length ?? 0)
      if (mergedCount > kvCount || mergedCount > memCount || countChanged) {
        plotsChanged = true
        return { ...p, plotImages: mergedImages }
      }
      return p
    })
    if (plotsChanged) out[charId] = { ...nextArch, plots }
  }
  return out
}
