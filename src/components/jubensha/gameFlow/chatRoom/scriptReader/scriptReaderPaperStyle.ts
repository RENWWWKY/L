import type { CSSProperties } from 'react'

/** 剧本内页纸张底（羊皮纸图 + 浅色兜底，避免微信里 CSS 变量失效时透底） */
export function getScriptPaperSurfaceStyle(textureUrl: string): CSSProperties {
  return {
    backgroundColor: '#f4f1ea',
    backgroundImage: `url("${textureUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
}
