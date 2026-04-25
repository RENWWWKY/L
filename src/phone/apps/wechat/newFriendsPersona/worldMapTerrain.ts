import type { WorldMapData } from './types'
import { getDefaultTerrainColor, isBuiltUpTerrainId, LEGACY_TERRAIN_ALIASES } from './worldMapCatalog'

export { WORLD_MAP_UNITS } from './types'

export function getTerrainFill(map: WorldMapData, terrain: string): string {
  const id = terrain.trim()
  const resolved = LEGACY_TERRAIN_ALIASES[id] ?? id
  const o = map.terrainColorOverrides
  if (o && typeof o[resolved] === 'string' && o[resolved]!.trim()) return o[resolved]!.trim()
  if (o && typeof o[id] === 'string' && o[id]!.trim()) return o[id]!.trim()
  return getDefaultTerrainColor(id)
}

/** @deprecated 使用 isBuiltUpTerrainId */
export function isBuiltUpTerrain(t: string): boolean {
  return isBuiltUpTerrainId(t)
}
