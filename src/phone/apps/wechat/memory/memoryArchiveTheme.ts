/** 记忆档案馆 · 柔和极简视觉令牌 */
export const ARCHIVE_BG = '#F7F7F9'
export const ARCHIVE_INK = '#111827'
export const ARCHIVE_MUTED = '#9CA3AF'
/** 记忆馆正文衬线：显式宋体/Noto Serif 优先，避免用户把 --phone-font 设成无衬线时摘要仍变 sans */
export const ARCHIVE_SERIF =
  '"Noto Serif SC", "Songti SC", "STSong", "SimSun", var(--phone-font), Georgia, serif'
export const ARCHIVE_CARD_SHADOW = '0 8px 30px rgba(0,0,0,0.03)'

/** 档案馆正文/摘要块（与 {@link ARCHIVE_SERIF} 一致） */
export const archiveSerifTextStyle = { fontFamily: ARCHIVE_SERIF } as const

/** 记忆馆摘要/云卡正文容器 class（见 index.css `.memory-archive-serif-text`） */
export const MEMORY_ARCHIVE_SERIF_CLASS = 'memory-archive-serif-text'

/** 尾声延展 / 线下摘要等子页：柔和黑白 UI 片段 */
export const ARCHIVE_SOFT_CARD =
  'rounded-[20px] border border-gray-200/70 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.03)]'
export const ARCHIVE_SOFT_CARD_OPEN =
  'open:shadow-[0_10px_36px_rgba(0,0,0,0.06)]'
export const ARCHIVE_SOFT_SECTION =
  'rounded-[24px] border border-gray-200/60 bg-white px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)]'
export const ARCHIVE_SOFT_CHIP = 'rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600'
export const ARCHIVE_SOFT_BTN_PRIMARY =
  'rounded-full bg-gray-900 px-4 py-1.5 text-[12px] font-semibold text-white active:opacity-90 disabled:opacity-50'
export const ARCHIVE_SOFT_BTN_SECONDARY =
  'rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 active:bg-gray-50 disabled:opacity-50'
export const ARCHIVE_SOFT_TEXTAREA =
  'w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] leading-relaxed text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60'
export const ARCHIVE_SOFT_BODY_PANEL =
  'rounded-2xl bg-gray-50/80 px-3.5 py-3.5 text-[13px] leading-[1.75] text-gray-800 ring-1 ring-gray-100'
export const ARCHIVE_MONO_SCENE_CHIP =
  'rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200/70'
