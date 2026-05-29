import { useCallback, useEffect, useMemo, useState } from 'react'
import { emitWeChatStorageChanged, personaDb } from '../../idb'
import type { Character, PlayerIdentity } from '../../types'
import {
  buildCrossBindingRegistry,
  loadPlayerNetworkLinkLabelMap,
  relationshipsToEdges,
} from './crossBindingEngine'
import type { CrossBindingNode, RelationshipEdge } from './crossBindingTypes'
import { nodeKey } from './crossBindingEngine'

export function useCrossBindingStore(params: {
  identityList: PlayerIdentity[]
  mainCharacters: Character[]
  npcCharacters: Character[]
  identityNameById: Record<string, string>
  enabled: boolean
}) {
  const [edges, setEdges] = useState<RelationshipEdge[]>([])
  const [loading, setLoading] = useState(false)

  const registry = useMemo(
    () =>
      buildCrossBindingRegistry({
        identityList: params.identityList,
        mainCharacters: params.mainCharacters,
        npcCharacters: params.npcCharacters,
        identityNameById: params.identityNameById,
      }),
    [
      params.identityList,
      params.identityNameById,
      params.mainCharacters,
      params.npcCharacters,
    ],
  )

  const refresh = useCallback(async () => {
    if (!params.enabled) return
    setLoading(true)
    try {
      const rels = await personaDb.listAllRelationships()
      const playerLinkLabels = await loadPlayerNetworkLinkLabelMap(
        params.mainCharacters,
        params.npcCharacters,
      )
      const reg = buildCrossBindingRegistry({
        identityList: params.identityList,
        mainCharacters: params.mainCharacters,
        npcCharacters: params.npcCharacters,
        identityNameById: params.identityNameById,
      })
      setEdges(relationshipsToEdges(rels, reg, playerLinkLabels))
    } finally {
      setLoading(false)
    }
  }, [
    params.enabled,
    params.identityList,
    params.identityNameById,
    params.mainCharacters,
    params.npcCharacters,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upsertEdge = useCallback(
    async (edge: RelationshipEdge) => {
      const { persistRelationshipEdge } = await import('./crossBindingEngine')
      await persistRelationshipEdge(edge, registry)
      emitWeChatStorageChanged()
      await refresh()
    },
    [refresh, registry],
  )

  const removeEdge = useCallback(
    async (edge: RelationshipEdge) => {
      const { deleteRelationshipEdge } = await import('./crossBindingEngine')
      await deleteRelationshipEdge(edge)
      emitWeChatStorageChanged()
      await refresh()
    },
    [refresh],
  )

  const getNode = useCallback(
    (type: CrossBindingNode['type'], id: string) => registry.get(nodeKey(type, id)),
    [registry],
  )

  return {
    edges,
    registry,
    loading,
    refresh,
    upsertEdge,
    removeEdge,
    getNode,
    setEdges,
  }
}

export type CrossBindingStore = ReturnType<typeof useCrossBindingStore>
