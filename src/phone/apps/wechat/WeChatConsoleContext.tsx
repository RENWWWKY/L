import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

type WeChatConsoleContextValue = {
  consoleOpen: boolean
  setConsoleOpen: Dispatch<SetStateAction<boolean>>
  openConsole: () => void
  closeConsole: () => void
}

const WeChatConsoleContext = createContext<WeChatConsoleContextValue | null>(null)

export function WeChatConsoleProvider({ children }: { children: ReactNode }) {
  const [consoleOpen, setConsoleOpen] = useState(false)
  const openConsole = useCallback(() => setConsoleOpen(true), [])
  const closeConsole = useCallback(() => setConsoleOpen(false), [])

  const value = useMemo(
    () => ({ consoleOpen, setConsoleOpen, openConsole, closeConsole }),
    [consoleOpen, openConsole, closeConsole],
  )

  return <WeChatConsoleContext.Provider value={value}>{children}</WeChatConsoleContext.Provider>
}

export function useWeChatConsole(): WeChatConsoleContextValue {
  const ctx = useContext(WeChatConsoleContext)
  if (!ctx) {
    throw new Error('useWeChatConsole must be used within WeChatConsoleProvider')
  }
  return ctx
}
