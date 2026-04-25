import { useEffect, useMemo, useSyncExternalStore } from 'react'

import type { ConsoleLog, LogType } from './consoleLogger'
import {
  clearConsoleLogs,
  getConsoleLogs,
  installGlobalConsoleCapture,
  logConsole,
  subscribeConsoleLogs,
} from './consoleLogger'

export function useConsoleLogger() {
  useEffect(() => {
    installGlobalConsoleCapture()
  }, [])

  return useMemo(
    () => ({
      log: (type: LogType, content: string) => logConsole(type, content),
      clear: () => clearConsoleLogs(),
    }),
    [],
  )
}

export function useConsoleLogs(): ConsoleLog[] {
  useEffect(() => {
    installGlobalConsoleCapture()
  }, [])
  return useSyncExternalStore(subscribeConsoleLogs, getConsoleLogs, getConsoleLogs)
}

