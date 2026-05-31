import { useEffect } from 'react'

import { ensureListenTogetherPlayerEngine } from './listenTogetherPlayerEngine'

/** 在模拟手机顶层挂载一次，初始化全局音频引擎 */
export function ListenTogetherPlayerBootstrap() {
  useEffect(() => {
    ensureListenTogetherPlayerEngine()
  }, [])
  return null
}
