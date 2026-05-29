import { nodeKey } from './crossBindingEngine'
import type {
  CrossBindingGraphLayoutRecord,
  CrossBindingGraphLayoutSnapshot,
  CrossBindingNode,
  CrossBindingNodeType,
} from './crossBindingTypes'

const POS_EPS = 0.5
const ZOOM_EPS = 0.001

export function crossBindingGraphLayoutId(type: CrossBindingNodeType, id: string): string {
  return nodeKey(type, id)
}

export function buildCrossBindingGraphLayoutSnapshot(
  nodes: CrossBindingNode[],
  pos: Record<string, { x: number; y: number }>,
  viewportPan: { x: number; y: number },
  viewportZoom: number,
): CrossBindingGraphLayoutSnapshot {
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    const key = nodeKey(node.type, node.id)
    const p = pos[key]
    if (p) positions[key] = { x: p.x, y: p.y }
  }
  return {
    positions,
    viewportPan: { x: viewportPan.x, y: viewportPan.y },
    viewportZoom,
  }
}

export function crossBindingGraphLayoutSnapshotsEqual(
  a: CrossBindingGraphLayoutSnapshot | null | undefined,
  b: CrossBindingGraphLayoutSnapshot | null | undefined,
): boolean {
  if (!a || !b) return false
  if (Math.abs(a.viewportZoom - b.viewportZoom) > ZOOM_EPS) return false
  if (Math.hypot(a.viewportPan.x - b.viewportPan.x, a.viewportPan.y - b.viewportPan.y) > POS_EPS) {
    return false
  }
  const keys = new Set([...Object.keys(a.positions), ...Object.keys(b.positions)])
  for (const key of keys) {
    const pa = a.positions[key]
    const pb = b.positions[key]
    if (!pa || !pb) return false
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > POS_EPS) return false
  }
  return true
}

export function snapshotFromGraphLayoutRecord(
  record: CrossBindingGraphLayoutRecord,
): CrossBindingGraphLayoutSnapshot {
  return {
    positions: { ...record.positions },
    viewportPan: { ...record.viewportPan },
    viewportZoom: record.viewportZoom,
  }
}
