import { getPlushCatalogEntry, plushImageUrl, type PlushKind } from './clawPlushCatalog'

const cache = new Map<string, HTMLImageElement>()
const inflight = new Map<string, Promise<HTMLImageElement>>()

function loadImage(file: string): Promise<HTMLImageElement> {
  const cached = cache.get(file)
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached)

  const pending = inflight.get(file)
  if (pending) return pending

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      cache.set(file, img)
      inflight.delete(file)
      resolve(img)
    }
    img.onerror = () => {
      inflight.delete(file)
      reject(new Error(`failed to load plush: ${file}`))
    }
    img.src = plushImageUrl(file)
  })
  inflight.set(file, promise)
  return promise
}

export function preloadPlushKinds(kinds: PlushKind[]): Promise<void> {
  const files = [...new Set(kinds.map((k) => getPlushCatalogEntry(k).file))]
  return Promise.all(files.map((f) => loadImage(f).catch(() => null))).then(() => undefined)
}

export function getPlushImage(kind: PlushKind): HTMLImageElement | null {
  const file = getPlushCatalogEntry(kind).file
  const img = cache.get(file)
  if (img?.complete && img.naturalWidth > 0) return img
  void loadImage(file).catch(() => null)
  return null
}
