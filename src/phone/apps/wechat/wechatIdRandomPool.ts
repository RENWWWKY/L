import { isWechatIdValid, normalizeWechatIdInput } from './wechatProfileTypes'

/** 随机微信号词素池（组合后仅含字母与数字，符合注册校验） */
const ADJECTIVES = [
  'late',
  'soft',
  'quiet',
  'wild',
  'pale',
  'warm',
  'cool',
  'lazy',
  'tiny',
  'urban',
  'neo',
  'mono',
  'zero',
  'nova',
  'idle',
  'mild',
  'slow',
  'deep',
  'faint',
  'calm',
] as const

const NOUNS = [
  'lake',
  'rain',
  'fox',
  'cat',
  'moon',
  'star',
  'ink',
  'leaf',
  'wave',
  'snow',
  'peach',
  'mint',
  'soda',
  'cafe',
  'lane',
  'zone',
  'core',
  'bit',
  'pod',
  'arc',
  'mist',
  'dusk',
  'dawn',
  'fern',
] as const

const PREFIXES = ['wx', 'lum', 'ori', 'aki', 'mio', 'yui', 'lin', 'chen', 'hao', 'lei', 'nan', 'xi'] as const

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randDigits(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String(randInt(0, 9))
  return s
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

const BUILDERS: Array<() => string> = [
  () => `${pick(ADJECTIVES)}${pick(NOUNS)}${randDigits(randInt(2, 4))}`,
  () => `${pick(PREFIXES)}${pick(NOUNS)}${randDigits(randInt(2, 3))}`,
  () => `${pick(NOUNS)}${pick(ADJECTIVES)}${randDigits(randInt(2, 3))}`,
  () => `${pick(PREFIXES)}${randDigits(randInt(4, 6))}`,
  () => `${pick(ADJECTIVES)}${randDigits(randInt(4, 6))}`,
  () => `${pick(NOUNS)}${randDigits(randInt(3, 5))}`,
  () => `${pick(PREFIXES)}${pick(ADJECTIVES).slice(0, 4)}${randDigits(2)}`,
  () => `${pick(NOUNS)}${pick(NOUNS)}${randDigits(2)}`,
]

/** 从词素池掷骰组合一个可用微信号 */
export function pickRandomWechatId(maxAttempts = 32): string {
  for (let i = 0; i < maxAttempts; i++) {
    const id = normalizeWechatIdInput(pick(BUILDERS)())
    if (isWechatIdValid(id)) return id
  }
  return normalizeWechatIdInput(`wx${Date.now().toString(36).slice(-8)}`)
}
