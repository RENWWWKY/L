import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from './ai'
import type { WorldBackgroundSettings } from './types'
import { emptyWorldBackgroundSettings } from './types'
import { WB_DIMENSION_SECTIONS } from './worldBackgroundDimensions'

function parseWorldBgJson(text: string): Record<string, unknown> {
  const t = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i
  const m = t.match(fence)
  const raw = (m ? m[1] : t).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型未返回可解析的 JSON')
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
}

function pickStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}

/**
 * 根据已填名称/简介与当前勾选，补全十二维与自定义规则（JSON）。
 */
export async function generateWorldBackgroundWithAi(params: {
  apiConfig: ApiConfig
  nameDraft: string
  descriptionDraft: string
  current: WorldBackgroundSettings
}): Promise<{ name: string; description: string; settings: WorldBackgroundSettings }> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim()) throw new Error('未配置 AI API')

  const catalog = WB_DIMENSION_SECTIONS.map((s) => `${s.title}（字段 ${s.key}）可选值：${s.options.join('；')}`).join(
    '\n',
  )

  const currentDump = JSON.stringify(params.current, null, 0)

  const system = `你是世界观设定助手。只输出一个合法 JSON 对象，不要 Markdown 围栏外多余文字。
JSON 字段：
- name: string 世界名称
- description: string 世界简介 80～200 字，口语白话
- worldType, era, technology, supernatural, geography, politics, society, economy, religion, races, conflicts, rules: 各为 string[]，从给定可选值中选或自拟相近短词，每维 1～5 项
- customRuleLines: string[] 0～8 条短规则
要求：十二维与简介要自洽；不要与当前已有勾选明显矛盾（可在其基础上扩展）；文风直白不要堆砌文采。`

  const user = `【用户已填】名称：${params.nameDraft || '（空）'}\n简介：${params.descriptionDraft || '（空）'}\n【当前勾选（可保留并补充）】\n${currentDump}\n\n【各维可选目录】\n${catalog}\n\n请输出完整 JSON。`

  const text = await openAiCompatibleChat(cfg, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], { temperature: 0.55, max_tokens: 2500 })

  const j = parseWorldBgJson(text)
  const next = emptyWorldBackgroundSettings()
  const keys = [
    'worldType',
    'era',
    'technology',
    'supernatural',
    'geography',
    'politics',
    'society',
    'economy',
    'religion',
    'races',
    'conflicts',
    'rules',
  ] as const
  for (const k of keys) {
    next[k] = pickStrArr(j[k])
  }
  next.customRuleLines = pickStrArr(j.customRuleLines)

  const name = typeof j.name === 'string' && j.name.trim() ? j.name.trim() : params.nameDraft.trim() || '未命名世界'
  const description =
    typeof j.description === 'string' && j.description.trim() ? j.description.trim() : params.descriptionDraft.trim()

  return { name, description, settings: next }
}
