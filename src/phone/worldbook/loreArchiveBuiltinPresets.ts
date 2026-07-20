import {
  CHARACTER_EMOTION_CONFESSION_ENGINE_APPENDIX,
  LUMI_DOCTRINE_OF_LOVE_APPENDIX,
} from '../apps/wechat/wechatReplyOutputPrompt'
import { OFFLINE_DATING_RICH_INNER_OS_APPENDIX } from '../apps/wechat/dating/offlineDatingRichInnerOsAppendix'

/** 档案室系统内置预设（仅开关，正文不对用户展示） */
export type LoreArchiveBuiltinPresetId =
  | 'lumiDoctrineOfLove'
  | 'activeConfession'
  | 'offlineRichInnerOs'

export type LoreArchiveBuiltinPresetToggles = Partial<Record<LoreArchiveBuiltinPresetId, boolean>>

export type LoreArchiveBuiltinPresetMeta = {
  id: LoreArchiveBuiltinPresetId
  title: string
  description: string
}

export const LORE_ARCHIVE_BUILTIN_PRESETS: LoreArchiveBuiltinPresetMeta[] = [
  {
    id: 'lumiDoctrineOfLove',
    title: 'Lumi 高质量爱情观',
    description:
      '系统内置：约束角色对玩家的具象付出、安全感、情绪托底与灵魂尊重。开启后注入 AI，正文不可查看或编辑。',
  },
  {
    id: 'activeConfession',
    title: '角色情感破冰与主动告白',
    description:
      '系统内置：打破暧昧循环，在适当时机完成情感交付与告白演绎。开启后注入 AI，正文不可查看或编辑。',
  },
  {
    id: 'offlineRichInnerOs',
    title: '线下约会·多内心 OS 描写',
    description:
      '系统内置：线下约会剧情中增加内心 OS 条数、句数与字数，并配合神态外化，减少「只会说话、没有心思」的木偶感。开启后仅注入线下约会 AI，正文不可查看或编辑。',
  },
]

export function resolveLoreArchiveBuiltinPresetToggles(
  raw?: LoreArchiveBuiltinPresetToggles | null,
): Record<LoreArchiveBuiltinPresetId, boolean> {
  return {
    lumiDoctrineOfLove: raw?.lumiDoctrineOfLove !== false,
    activeConfession: raw?.activeConfession !== false,
    offlineRichInnerOs: raw?.offlineRichInnerOs !== false,
  }
}

export function buildWechatReplyRomanceSections(
  toggles: LoreArchiveBuiltinPresetToggles | null | undefined,
): string {
  const resolved = resolveLoreArchiveBuiltinPresetToggles(toggles)
  const parts: string[] = []
  if (resolved.lumiDoctrineOfLove || resolved.activeConfession) {
    parts.push(
      '【内置恋爱参考·效力说明】下列爱情观/告白引擎为中性相处参考，**低于**角色档案与人设世界书；气质、主动程度与表达方式以人设为准，禁止写成霸总或强势主导。',
    )
  }
  if (resolved.lumiDoctrineOfLove) parts.push(LUMI_DOCTRINE_OF_LOVE_APPENDIX)
  if (resolved.activeConfession) parts.push(CHARACTER_EMOTION_CONFESSION_ENGINE_APPENDIX)
  return parts.filter(Boolean).join('\n\n')
}

export function buildWechatThinkingChainRomanceSteps(
  toggles: LoreArchiveBuiltinPresetToggles | null | undefined,
): string {
  const resolved = resolveLoreArchiveBuiltinPresetToggles(toggles)
  const steps: string[] = []
  let stepNo = 5
  if (resolved.lumiDoctrineOfLove) {
    steps.push(
      `- 第${['五', '六', '七', '八', '九', '十'][stepNo - 5] ?? String(stepNo)}步：内化「Lumi 高质量爱情观」（中性参考，**不得覆盖人设**；条文已在输出协议；禁止复述）`,
    )
    stepNo += 1
  }
  if (resolved.activeConfession) {
    steps.push(
      `- 第${['五', '六', '七', '八', '九', '十'][stepNo - 5] ?? String(stepNo)}步：内化「情感破冰与告白引擎」（推进节奏服从人设；条文已在输出协议；禁止复述）`,
    )
    stepNo += 1
  }
  return steps.join('\n')
}

export function buildOfflineRomanceThinkingChainSections(
  toggles: LoreArchiveBuiltinPresetToggles | null | undefined,
): string {
  const resolved = resolveLoreArchiveBuiltinPresetToggles(toggles)
  const parts: string[] = []
  if (resolved.lumiDoctrineOfLove) {
    parts.push(`【Lumi高质量爱情观】
以下为恋爱相处**中性参考**（非最高优先级）。须在思维链中对照自检，但**不得**覆盖【约会对象·档案/世界书】或角色人设；气质与表达强度以人设为准，禁止借本节写成霸总/强势主导：
${LUMI_DOCTRINE_OF_LOVE_APPENDIX}`)
  }
  if (resolved.activeConfession) {
    parts.push(`【{{char}} 情感破冰与告白演绎引擎】
以下为情感推进参考；须在思维链中校准是否触发破冰/告白，但**节奏与语气服从人设世界书**；禁止为「推进」改成霸总腔：
${CHARACTER_EMOTION_CONFESSION_ENGINE_APPENDIX}`)
  }
  if (resolved.offlineRichInnerOs) {
    parts.push(`【线下约会·多内心 OS 描写引擎】
以下规则为本轮线下约会内心 OS 的**硬性约束**；须在思维链中先规划 OS 分布与字数，再写正文；**覆盖**默认 OS 篇幅规则（单条不少于 40 汉字）：
${OFFLINE_DATING_RICH_INNER_OS_APPENDIX}`)
  }
  return parts.join('\n\n')
}
