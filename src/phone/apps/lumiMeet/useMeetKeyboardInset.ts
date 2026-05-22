import { useKeyboardInset } from '../../hooks/useKeyboardInset'

/** @deprecated 请直接用 `useKeyboardInset`；保留别名避免大范围改名 */
export function useMeetKeyboardInset(): number {
  return useKeyboardInset()
}
