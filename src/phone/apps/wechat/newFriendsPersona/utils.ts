import type { Gender } from './types'

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 小说向单姓：叙事感、文雅，避免俗套「伟强」类组合语境 */
const MALE_FIRST = [
  '顾', '沈', '陆', '季', '谢', '周', '贺', '裴', '宋', '许', '林', '程', '闻', '秦', '萧', '傅', '喻', '楚', '靳', '晏',
  '叶', '莫', '祁', '孟', '荀', '褚', '穆', '商', '虞', '薛', '卓', '易', '池', '纪', '乔', '骆', '戚', '任', '邵', '段',
  '严', '韩', '唐', '尹', '岑', '梁', '魏', '路', '俞', '方', '江', '苏', '卫',
]

const FEMALE_FIRST = [
  '苏', '林', '温', '江', '许', '沈', '季', '顾', '白', '姜', '陆', '夏', '黎', '阮', '虞', '奚', '钟', '柳', '乔', '谢',
  '明', '楼', '慕', '池', '冉', '宣', '尹', '岑', '甄', '嵇', '卞', '卫', '段', '方', '易', '程', '贺', '裴', '宋', '秦',
  '萧', '傅', '喻', '楚', '靳', '叶', '莫', '祁',
]

const MALE_GIVEN = [
  '砚', '舟', '言', '峥', '临', '予', '景', '行', '川', '烬', '屿', '珩', '晏', '知', '辞', '澈', '珣', '朔', '叙', '湛',
  '珂', '墨', '洵', '衍', '樾', '谌', '骁', '恪', '昀', '翊', '朗', '逾', '聿', '琅', '晗', '璋', '璞', '泊', '戟', '旌',
]

const FEMALE_GIVEN = [
  '杳', '宁', '昭', '澄', '予', '绾', '晚', '棠', '柚', '岚', '微', '怜', '禾', '清', '瓷', '漪', '玥', '栀', '遥', '熹',
  '蘅', '翎', '莞', '霁', '纾', '妧', '旖', '浔', '旎', '泠', '纭', '霓', '纨', '缇', '岫',
]

export function randomChineseName(gender: Gender): string {
  const firstPool = gender === 'female' ? FEMALE_FIRST : gender === 'male' ? MALE_FIRST : [...MALE_FIRST, ...FEMALE_FIRST]
  const givenPool = gender === 'female' ? FEMALE_GIVEN : gender === 'male' ? MALE_GIVEN : [...MALE_GIVEN, ...FEMALE_GIVEN]
  const first = firstPool[Math.floor(Math.random() * firstPool.length)]
  const len = Math.random() < 0.6 ? 1 : 2
  let given = ''
  for (let i = 0; i < len; i += 1) given += givenPool[Math.floor(Math.random() * givenPool.length)]
  return `${first}${given}`
}

export function zodiacFromMD(md: string): string {
  const m = Number(md.slice(0, 2))
  const d = Number(md.slice(3, 5))
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12 || d < 1 || d > 31) return ''
  const mmdd = m * 100 + d
  const cuts = [120, 219, 321, 420, 521, 622, 723, 823, 923, 1024, 1123, 1222]
  const names = ['摩羯座', '水瓶座', '双鱼座', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座']
  for (let i = 0; i < cuts.length; i += 1) {
    if (mmdd < cuts[i]) return names[i]
  }
  return '摩羯座'
}

export function formatMD(month: number, day: number) {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${mm}-${dd}`
}

export function daysInMonth(month: number) {
  if (month === 2) return 29
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}

export const IDENTITY_POOL = [
  '学生',
  '总裁',
  '医生',
  '特工',
  '歌手',
  '演员',
  '画师',
  '作家',
  '骑士',
  '法师',
  '记者',
  '律师',
  '摄影师',
  '调酒师',
] as const

