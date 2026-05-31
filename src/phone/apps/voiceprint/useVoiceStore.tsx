import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MiniMaxApiRegion, MiniMaxVoiceInfo } from './services/minimaxApi'
import {
  CHARACTER_VOICE_MAP_LS_KEY,
  pruneCharacterVoiceMappings as pruneCharacterVoiceMappingsInStorage,
  pruneCharacterVoiceMappingsToAllowed as pruneCharacterVoiceMappingsToAllowedInStorage,
  readCharacterVoiceMapFromStorage,
  type CharacterVoiceMap,
} from './characterVoiceMapStorage'

const LS_KEY = {
  apiKey: 'minimax:apiKey',
  groupId: 'minimax:groupId',
  speechModel: 'minimax:speechModel',
  apiRegion: 'minimax:apiRegion',
  characterVoiceMap: CHARACTER_VOICE_MAP_LS_KEY,
} as const

export type { CharacterVoiceMap }

type VoiceStore = {
  apiKey: string
  groupId: string
  speechModel: string
  apiRegion: MiniMaxApiRegion
  setApiKey: (v: string) => void
  setGroupId: (v: string) => void
  setSpeechModel: (v: string) => void
  setApiRegion: (v: MiniMaxApiRegion) => void

  voices: MiniMaxVoiceInfo[]
  setVoices: (v: MiniMaxVoiceInfo[]) => void

  characterVoiceMap: CharacterVoiceMap
  setCharacterVoice: (characterId: string, voiceId: string) => void
  clearCharacterVoice: (characterId: string) => void
  pruneCharacterVoiceMappings: (characterIds: readonly string[]) => void
  pruneCharacterVoiceMappingsToAllowed: (allowedCharacterIds: ReadonlySet<string>) => void
}

const Ctx = createContext<VoiceStore | null>(null)

export function VoiceStoreProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem(LS_KEY.apiKey) ?? '')
  const [groupId, setGroupIdState] = useState(() => localStorage.getItem(LS_KEY.groupId) ?? '')
  const [speechModel, setSpeechModelState] = useState(() => localStorage.getItem(LS_KEY.speechModel) ?? 'speech-2.8-hd')
  const [apiRegion, setApiRegionState] = useState<MiniMaxApiRegion>(() =>
    localStorage.getItem(LS_KEY.apiRegion) === 'international' ? 'international' : 'domestic',
  )
  const [voices, setVoices] = useState<MiniMaxVoiceInfo[]>([])
  const [characterVoiceMap, setCharacterVoiceMap] = useState<CharacterVoiceMap>(() =>
    readCharacterVoiceMapFromStorage(),
  )

  const setApiKey = useCallback((v: string) => setApiKeyState(v), [])
  const setGroupId = useCallback((v: string) => setGroupIdState(v), [])
  const setSpeechModel = useCallback((v: string) => setSpeechModelState(v), [])
  const setApiRegion = useCallback((v: MiniMaxApiRegion) => setApiRegionState(v), [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY.apiKey, apiKey)
    } catch {
      // ignore
    }
  }, [apiKey])
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY.groupId, groupId)
    } catch {
      // ignore
    }
  }, [groupId])
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY.speechModel, speechModel)
    } catch {
      // ignore
    }
  }, [speechModel])
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY.apiRegion, apiRegion)
    } catch {
      // ignore
    }
  }, [apiRegion])
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY.characterVoiceMap, JSON.stringify(characterVoiceMap))
    } catch {
      // ignore
    }
  }, [characterVoiceMap])

  const setCharacterVoice = useCallback((characterId: string, voiceId: string) => {
    const cid = characterId.trim()
    const vid = voiceId.trim()
    if (!cid) return
    setCharacterVoiceMap((m) => ({ ...m, [cid]: vid }))
  }, [])

  const clearCharacterVoice = useCallback((characterId: string) => {
    const cid = characterId.trim()
    if (!cid) return
    setCharacterVoiceMap((m) => {
      const next = { ...m }
      delete next[cid]
      return next
    })
  }, [])

  const pruneCharacterVoiceMappings = useCallback((characterIds: readonly string[]) => {
    setCharacterVoiceMap(pruneCharacterVoiceMappingsInStorage(characterIds))
  }, [])

  const pruneCharacterVoiceMappingsToAllowed = useCallback((allowedCharacterIds: ReadonlySet<string>) => {
    setCharacterVoiceMap(pruneCharacterVoiceMappingsToAllowedInStorage(allowedCharacterIds))
  }, [])

  const value = useMemo<VoiceStore>(
    () => ({
      apiKey,
      groupId,
      speechModel,
      apiRegion,
      setApiKey,
      setGroupId,
      setSpeechModel,
      setApiRegion,
      voices,
      setVoices,
      characterVoiceMap,
      setCharacterVoice,
      clearCharacterVoice,
      pruneCharacterVoiceMappings,
      pruneCharacterVoiceMappingsToAllowed,
    }),
    [
      apiKey,
      groupId,
      speechModel,
      apiRegion,
      setApiKey,
      setGroupId,
      setSpeechModel,
      setApiRegion,
      voices,
      characterVoiceMap,
      setCharacterVoice,
      clearCharacterVoice,
      pruneCharacterVoiceMappings,
      pruneCharacterVoiceMappingsToAllowed,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useVoiceStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVoiceStore must be used within VoiceStoreProvider')
  return ctx
}

