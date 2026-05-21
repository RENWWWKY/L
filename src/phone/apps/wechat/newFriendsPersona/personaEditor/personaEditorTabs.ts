/** 人设编辑页 Archive Index 的 9 个板块 */

export type PersonaEditTabId =
  | 'basic'
  | 'bindings'
  | 'opening'
  | 'wechat'
  | 'worldbook'
  | 'network'
  | 'schedule'
  | 'worldbackground'
  | 'io'

export const PERSONA_ARCHIVE_TABS: {
  id: PersonaEditTabId
  num: string
  en: string
  zh: string
}[] = [
  { id: 'basic', num: '01', en: 'INFO', zh: '基础信息' },
  { id: 'bindings', num: '02', en: 'LINK', zh: '绑定信息' },
  { id: 'opening', num: '03', en: 'CHAT', zh: '开场白' },
  { id: 'wechat', num: '04', en: 'WX', zh: '微信资料' },
  { id: 'worldbook', num: '05', en: 'LORE', zh: '世界书' },
  { id: 'network', num: '06', en: 'NET', zh: '人脉关系' },
  { id: 'schedule', num: '07', en: 'TIME', zh: '日程表' },
  { id: 'worldbackground', num: '08', en: 'WORLD', zh: '世界背景' },
  { id: 'io', num: '09', en: 'DATA', zh: '导入导出' },
]
