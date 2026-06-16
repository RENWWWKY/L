/**
 * 听一听开发占位开关。
 * 默认开启（暂不可用）；本地 .env 设 `VITE_LISTEN_TOGETHER_UNDER_DEV=false` 可加载完整模块。
 */
const raw = import.meta.env.VITE_LISTEN_TOGETHER_UNDER_DEV

export const LISTEN_TOGETHER_UNDER_DEV =
  raw === undefined || String(raw).trim() === ''
    ? true
    : String(raw).toLowerCase() === 'true'
