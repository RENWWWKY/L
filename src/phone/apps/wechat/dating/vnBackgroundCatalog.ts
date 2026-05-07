export type VnBackgroundAsset = {
  name: string
  fileName: string
  url: string
}

type GlobModule = {
  default?: string
}

const VN_BG_MODULES = import.meta.glob<GlobModule>(
  '../../../../../image/VN模型背景图/*.{png,jpg,jpeg,webp,gif,avif,PNG,JPG,JPEG,WEBP,GIF,AVIF}',
  { eager: true },
)

function cleanBgName(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  return t
    .replace(/\.[A-Za-z0-9]+$/u, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBgKey(raw: string): string {
  return cleanBgName(raw).toLowerCase().replace(/\s+/g, '')
}

function pathBaseName(path: string): string {
  const norm = String(path || '').replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

export const VN_BACKGROUND_ASSETS: VnBackgroundAsset[] = Object.entries(VN_BG_MODULES)
  .map(([path, mod]) => {
    const fileName = pathBaseName(path)
    const name = cleanBgName(fileName)
    const url = String(mod?.default || '').trim()
    if (!name || !url) return null
    return { name, fileName, url }
  })
  .filter((x): x is VnBackgroundAsset => !!x)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

export function buildVnBackgroundPromptBlock(): string {
  if (!VN_BACKGROUND_ASSETS.length) return ''
  const names = VN_BACKGROUND_ASSETS.map((x) => x.name)
  return (
    `【VN场景背景库】以下背景名可用，背景名即画面内容语义：\n` +
    `${names.map((x) => `- ${x}`).join('\n')}\n` +
    `【背景输出规则】` +
    `在 VN 模式回复中，第一行必须输出「【背景】背景名」。` +
    `当场景发生变化时（含进入闪回/退出闪回），必须再次输出一行「【背景】背景名」再继续写后续气泡；` +
    `同一段闪回内若回忆跨越多个地点，可多次输出「【背景】」，每换一场景写一行，从下一气泡起切换画面；` +
    `背景名必须从上述列表中选择最符合当前场景的一项；` +
    `后续才输出剧情气泡内容。`
  )
}

export function resolveVnBackgroundByName(name: string): VnBackgroundAsset | null {
  const key = normalizeBgKey(name)
  if (!key) return null
  const exact = VN_BACKGROUND_ASSETS.find((x) => normalizeBgKey(x.name) === key)
  if (exact) return exact
  const fuzzy = VN_BACKGROUND_ASSETS.find((x) => {
    const nk = normalizeBgKey(x.name)
    return nk.includes(key) || key.includes(nk)
  })
  return fuzzy ?? null
}

export function extractVnBackgroundCue(raw: string): { cleanedText: string; backgroundName: string | null } {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (!lines.length) return { cleanedText: '', backgroundName: null }

  const pickName = (line: string): string | null => {
    const t = String(line || '').trim()
    if (!t) return null
    const m1 = t.match(/^【\s*背景\s*】\s*(.+)$/u)
    if (m1?.[1]) return m1[1].trim()
    const m2 = t.match(/^背景[：:]\s*(.+)$/u)
    if (m2?.[1]) return m2[1].trim()
    return null
  }

  let bgName: string | null = null
  const rest: string[] = []
  for (const line of lines) {
    if (!bgName) {
      const n = pickName(line)
      if (n) {
        bgName = n
        continue
      }
    }
    rest.push(line)
  }
  return { cleanedText: rest.join('\n'), backgroundName: bgName }
}

/** 地下/室内停车，避免被泛化「停车场」判成室外 */
const VN_SCENE_UNDERGROUND_PARK = /地下停车|地下车库/u

/** 命中则视为室外/半室外：不压制雨滴叠层（仍须模型【VN雨】开才会显示） */
const VN_SCENE_OUTDOOR_HINTS: readonly string[] = [
  '室外',
  '户外',
  '露天',
  '广场',
  '操场',
  '运动场',
  '体育场',
  '球场',
  '田径',
  '跑道',
  '街道',
  '人行道',
  '步行街',
  '马路',
  '公路',
  '公园',
  '花园',
  '植物园',
  '动物园',
  '码头',
  '海边',
  '海滩',
  '沙滩',
  '海岸',
  '港口',
  '海滨',
  '森林',
  '山野',
  '郊野',
  '郊外',
  '草坪',
  '草地',
  '绿地',
  '湖畔',
  '湖边',
  '河岸',
  '江边',
  '河堤',
  '林荫',
  '雨巷',
  '胡同',
  '小巷',
  '泳池',
  '天台',
  '阳台',
  '楼顶',
  '屋顶',
  '公交站',
  '站台',
  '月台',
]

/** 命中则视为典型室内：与雨滴全屏叠层互斥（避免「屋内下雨」） */
const VN_SCENE_INDOOR_HINTS: readonly string[] = [
  '办公室',
  '教室',
  '课室',
  '卧室',
  '睡房',
  '客厅',
  '起居室',
  '厨房',
  '餐厅',
  '食堂',
  '卫生间',
  '厕所',
  '洗手间',
  '卫浴',
  '浴室',
  '澡堂',
  '淋浴',
  '走廊',
  '过道',
  '楼道',
  '连廊',
  '门厅',
  '玄关',
  '电梯',
  '楼梯间',
  '会议室',
  '实验室',
  '诊室',
  '病房',
  '护士站',
  '排练',
  '琴房',
  '琴室',
  '画室',
  '机房',
  '录音棚',
  '图书馆',
  '阅览室',
  '自习室',
  '便利店',
  '超市',
  '商场',
  '书店',
  '网吧',
  '影院',
  '影厅',
  '包厢',
  '车内',
  '地铁',
  '车厢',
  '机舱',
  '船舱',
  '地下室',
  '仓库',
  '储物',
  '储藏',
  '更衣',
  '衣帽间',
  '室内',
  '屋内',
  '家里',
  '家中',
  '酒店',
  '宾馆',
  '客房',
  '民宿',
  '大堂',
  '泳馆',
  '游泳馆',
  '体育馆',
  '音乐室',
  '舞蹈室',
  '体操房',
  '车库',
  '报告厅',
  '音乐厅',
  '礼堂',
  '阶梯教室',
  '停车楼',
]

/**
 * 根据当前【背景】名称做粗略室内外判断：室内则不应叠雨滴全屏（防穿帮）。
 * 未命中任何关键词时返回 false，不代替模型【VN雨】决策。
 */
export function isVnIndoorSceneBackground(name: string): boolean {
  const s = String(name || '').trim().replace(/\s+/g, '')
  if (!s) return false

  if (VN_SCENE_UNDERGROUND_PARK.test(s)) return true

  for (const h of VN_SCENE_OUTDOOR_HINTS) {
    if (s.includes(h)) return false
  }

  if (s.includes('停车场')) return false

  for (const h of VN_SCENE_INDOOR_HINTS) {
    if (s.includes(h)) return true
  }

  return false
}
