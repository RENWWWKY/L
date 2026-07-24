/** Light Platinum palette — chart & chrome only */
export const PLATINUM = {
  ink: '#1C1C1E',
  gold: '#C5A880',
  mist: '#F3EFEA',
  ash: '#9A9A9E',
  line: 'rgba(28, 28, 30, 0.12)',
} as const

/** 须与 `apps/wechat/newFriendsPersona/idb.ts` 中 `DB_NAME` 一致 */
export const WECHAT_PERSONA_DB_NAME = 'wechat-personas-v1'

export const LUMI_SYS_FIRST_BOOT_KEY = 'lumi_sys_first_boot'
export const LUMI_SYS_TOKENS_TOTAL_KEY = 'lumi_sys_tokens_total'

export const ARCHIVE_KIND = 'lumi-cloud-archive' as const
/** v1：仅 localStorage；v2：另含已接入的 IndexedDB 全表快照 */
export const ARCHIVE_VERSION = 2 as const

/** 数据中心完成 .lumi 导入后派发，供外观等内存态从存储重新水合（无需整页刷新） */
export const LUMI_ARCHIVE_IMPORTED_EVENT = 'lumi-archive-imported'

export function utf8ByteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length
  } catch {
    return s.length * 2
  }
}
