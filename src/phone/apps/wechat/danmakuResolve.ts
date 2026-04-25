import type { CharacterDanmakuSettingsRow, WeChatGlobalSettingsRow } from './newFriendsPersona/types'

/** 运行时弹幕参数（合并全局 + 角色覆盖后） */
export type EffectiveDanmakuVisuals = {
  fontSize: number
  color: string
  opacity: number
  scrollDurationSec: number
  position: 'top' | 'middle' | 'bottom' | 'random'
  density: 'sparse' | 'normal' | 'dense'
  style: 'none' | 'gray' | 'white'
  useMemory: boolean
  generateCount: number
  /** 合并后的弹幕规则文案：非空则优先于内置 `DANMAKU_VARIETY_SHOW_RULES` */
  customPrompt: string
  /** 按角色关闭弹幕（仅 character 模式且该角色有配置且 enabled=false） */
  skipCharacter: boolean
}

export function densityToTrackCount(d: 'sparse' | 'normal' | 'dense'): number {
  if (d === 'sparse') return 3
  if (d === 'dense') return 7
  return 5
}

/** 将 #RRGGBB 与透明度转为 rgba() */
export function hexAndOpacityToRgba(hex: string, opacity: number): string {
  const h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16)
    const g = parseInt(h[1]! + h[1]!, 16)
    const b = parseInt(h[2]! + h[2]!, 16)
    if (!Number.isFinite(r + g + b)) return `rgba(0,0,0,${opacity})`
    return `rgba(${r},${g},${b},${opacity})`
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if (!Number.isFinite(r + g + b)) return `rgba(0,0,0,${opacity})`
    return `rgba(${r},${g},${b},${opacity})`
  }
  return `rgba(0,0,0,${opacity})`
}

const defaultVisuals = (g: WeChatGlobalSettingsRow): Omit<EffectiveDanmakuVisuals, 'skipCharacter'> => ({
  fontSize: g.danmakuFontSize,
  color: g.danmakuColor,
  opacity: g.danmakuOpacity,
  scrollDurationSec: g.danmakuScrollDurationSec,
  position: g.danmakuPosition,
  density: g.danmakuDensity,
  style: g.danmakuStyle,
  useMemory: g.danmakuUseMemory,
  generateCount: g.danmakuGenerateCount,
  customPrompt: typeof g.danmakuCustomPrompt === 'string' ? g.danmakuCustomPrompt : '',
})

export function resolveEffectiveDanmakuVisuals(
  global: WeChatGlobalSettingsRow,
  peerCharacterId: string,
  charRow: CharacterDanmakuSettingsRow | null,
): EffectiveDanmakuVisuals {
  const pid = peerCharacterId.trim()
  const base = { ...defaultVisuals(global), skipCharacter: false }

  if (global.danmakuScopeMode !== 'character' || !pid) {
    return base
  }

  if (!charRow || charRow.characterId !== pid) {
    return base
  }

  if (charRow.enabled === false) {
    return {
      ...base,
      skipCharacter: true,
    }
  }

  const charPrompt = charRow.customPrompt.trim() ? charRow.customPrompt : global.danmakuCustomPrompt

  return {
    fontSize: charRow.fontSize,
    color: charRow.color,
    opacity: charRow.opacity,
    scrollDurationSec: charRow.scrollDurationSec,
    position: charRow.position,
    density: charRow.density,
    style: charRow.style,
    useMemory: charRow.useMemory,
    generateCount: charRow.generateCount,
    customPrompt: charPrompt,
    skipCharacter: false,
  }
}

/** 预览：无 skip；角色关闭弹幕时回退全局视觉，但生成条数/记忆仍用编辑中角色行（若有） */
export function mergeDanmakuVisualsForPreview(
  global: WeChatGlobalSettingsRow,
  charRow: CharacterDanmakuSettingsRow | null,
): Omit<EffectiveDanmakuVisuals, 'skipCharacter'> {
  if (global.danmakuScopeMode !== 'character' || !charRow) {
    return defaultVisuals(global)
  }
  if (charRow.enabled === false) {
    return defaultVisuals(global)
  }
  const charPrompt = charRow.customPrompt.trim() ? charRow.customPrompt : global.danmakuCustomPrompt

  return {
    fontSize: charRow.fontSize,
    color: charRow.color,
    opacity: charRow.opacity,
    scrollDurationSec: charRow.scrollDurationSec,
    position: charRow.position,
    density: charRow.density,
    style: charRow.style,
    useMemory: charRow.useMemory,
    generateCount: charRow.generateCount,
    customPrompt: charPrompt,
  }
}
