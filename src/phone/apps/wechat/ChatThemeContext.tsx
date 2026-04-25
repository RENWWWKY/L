/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { DEFAULT_CHAT_THEME, type ChatTheme } from './chatTheme/types'
import { personaDb } from './newFriendsPersona/idb'

export type ChatThemePatch = Partial<Omit<ChatTheme, 'inputBar' | 'bubble'>> & {
  inputBar?: Partial<ChatTheme['inputBar']>
  bubble?: Partial<ChatTheme['bubble']>
}

type ChatThemeContextValue = {
  chatTheme: ChatTheme
  /** 合并写入当前主题并持久化到 IndexedDB */
  updateChatTheme: (patch: ChatThemePatch) => void
  ready: boolean
}

const ChatThemeContext = createContext<ChatThemeContextValue | null>(null)

function mergeChatTheme(prev: ChatTheme, patch: ChatThemePatch): ChatTheme {
  return {
    ...prev,
    ...patch,
    inputBar: { ...prev.inputBar, ...patch.inputBar },
    bubble: { ...prev.bubble, ...patch.bubble },
  }
}

export function ChatThemeProvider({ children }: { children: ReactNode }) {
  const [chatTheme, setChatTheme] = useState<ChatTheme>(DEFAULT_CHAT_THEME)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    await personaDb.ensureDefaultChatTheme()
    const list = await personaDb.listChatThemes()
    const active = list.find((t) => t.isDefault) ?? (await personaDb.getChatTheme(DEFAULT_CHAT_THEME.id)) ?? DEFAULT_CHAT_THEME
    setChatTheme(active)
    setReady(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateChatTheme = useCallback((patch: ChatThemePatch) => {
    setChatTheme((prev) => {
      const next = mergeChatTheme(prev, patch)
      void personaDb.upsertChatTheme(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      chatTheme,
      updateChatTheme,
      ready,
    }),
    [chatTheme, updateChatTheme, ready],
  )

  return <ChatThemeContext.Provider value={value}>{children}</ChatThemeContext.Provider>
}

export function useChatTheme(): ChatThemeContextValue {
  const ctx = useContext(ChatThemeContext)
  if (!ctx) {
    throw new Error('useChatTheme must be used within ChatThemeProvider')
  }
  return ctx
}
