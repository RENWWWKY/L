import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import type { WorldBackground } from './types'
import { emptyWorldBackgroundSettings, emptyWorldMap } from './types'

export function buildPresetWorldBackgrounds(): WorldBackground[] {
  const now = Date.now()

  const modern = emptyWorldBackgroundSettings()
  modern.worldType = ['现代都市']
  modern.era = ['现代（2000-2025）']
  modern.technology = ['现代科技']
  modern.supernatural = ['无超自然']
  modern.geography = ['单一大陆']
  modern.politics = ['民主共和', '资本主义']
  modern.society = ['平等社会', '金钱至上']
  modern.economy = ['市场经济', '信用货币']
  modern.religion = ['无神论', '无宗教']
  modern.races = ['人类']
  modern.conflicts = ['阶级矛盾', '个人与集体的矛盾']
  modern.rules = []

  const wuxia = emptyWorldBackgroundSettings()
  wuxia.worldType = ['古代武侠']
  wuxia.era = ['古代（中国）', '封建社会']
  wuxia.technology = ['冷兵器时代']
  wuxia.supernatural = ['低魔（少量魔法）', '修仙体系']
  wuxia.geography = ['单一大陆']
  wuxia.politics = ['封建割据', '帝国制']
  wuxia.society = ['士农工商', '能力至上']
  wuxia.economy = ['自然经济', '金币本位']
  wuxia.religion = ['多神教', '祖先崇拜']
  wuxia.races = ['人类']
  wuxia.conflicts = ['正邪对抗', '资源争夺']
  wuxia.rules = ['不能违反誓言']

  const scifi = emptyWorldBackgroundSettings()
  scifi.worldType = ['科幻未来']
  scifi.era = ['近未来（2026-2050）', '远未来（2050以后）']
  scifi.technology = ['近未来科技', '星际科技']
  scifi.supernatural = ['无超自然', '超能力']
  scifi.geography = ['星际文明', '星球文明']
  scifi.politics = ['联邦制', '寡头政治']
  scifi.society = ['能力至上', '资产阶级-无产阶级']
  scifi.economy = ['信用货币', '能量货币']
  scifi.religion = ['无神论', '科学教']
  scifi.races = ['人类', '外星种族', '机械族']
  scifi.conflicts = ['资源争夺', '科技与自然的矛盾']
  scifi.rules = []

  return [
    {
      id: DEFAULT_WORLD_BACKGROUND_ID,
      name: '现代都市',
      description: '与现实接近的当代城市社会，日常叙事与轻量设定皆宜。',
      isPreset: true,
      settings: modern,
      map: emptyWorldMap(),
      timeline: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wb-preset-ancient-wuxia',
      name: '古代武侠',
      description: '江湖门派、武功与恩怨的东方古典武侠世界。',
      isPreset: true,
      settings: wuxia,
      map: emptyWorldMap(),
      timeline: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'wb-preset-scifi-future',
      name: '科幻未来',
      description: '高科技、星际或近未来都市的科幻舞台。',
      isPreset: true,
      settings: scifi,
      map: emptyWorldMap(),
      timeline: [],
      createdAt: now,
      updatedAt: now,
    },
  ]
}
