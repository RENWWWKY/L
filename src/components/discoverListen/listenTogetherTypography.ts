/**
 * 听一听全局数字字族：与「我的」页关注/粉丝等大数字一致。
 * 无衬线 + 等宽数字 + 略紧字距。
 */
export const listenNumClass = 'font-sans tabular-nums tracking-tight'

/** 「我的」资料栏大号统计数字 */
export const listenNumStatClass = `text-2xl font-light text-stone-800 ${listenNumClass}`

export function listenNumMetaClass(extra = '') {
  return [listenNumClass, extra].filter(Boolean).join(' ')
}
