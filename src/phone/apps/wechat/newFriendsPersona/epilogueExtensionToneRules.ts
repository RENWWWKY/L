import { buildPersonaAiHealthyToneRules } from './personaAiGeneratePrompt'

/**
 * 尾声延展（priority=after）条目正文 / newContent 共用文风约束。
 * 人设生成、每轮尾声判断、inline 补丁、自动总结 epilogue_patches 均须注入。
 */
export function buildEpilogueExtensionArchiveToneRules(): string {
  return `
【尾声延展 · 档案体文风（newContent / 条目正文须遵守）】
- 尾声延展是**客观克制**的第三人称关系快照，记录「此刻」可核对的事实与态度，**不是**小说正文或情绪宣泄。
- 用**平实、具体**表述关系变化（称呼、回复节奏、边界、心里分量、是否会主动找话题等）；禁止网文式极端修饰与夸张跃迁词。
- **禁止**下列倾向及同义变体：彻底粉碎/封死/碾压/无可撼动/极度/极具侵略性/充满危险占有欲/毁灭性突破/恐怖占有/ALPHA 式支配/驯服/猎物等油腻强控词。
- 关系升温须写**可核对事实**，勿用戏剧化形容词堆叠；好感与适度在意可写，但须**有分寸、有人味**，禁止恐怖情人 caricature。
- 篇幅宜精简（通常 80–280 字）；一句一事，少形容词叠床。

${buildPersonaAiHealthyToneRules()}`.trim()
}
