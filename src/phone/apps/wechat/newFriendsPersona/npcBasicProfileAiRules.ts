/**
 * 「基础档案」类字段的 AI 硬约束：**人设 · 人脉**（`generateNpcNetworkWithAi`）与 **遇见**（`aiGenerateEncounterNpc`）
 * 共用同一套措辞与禁令，仅「年龄/生日参照锚点」因场景不同分两条导出。
 */

/** 人脉 system：与主角年龄/生日联动（原文，勿改字以免两路漂移） */
export const NPC_NETWORK_AI_AGE_AND_BIRTHDAY_RULES = `年龄与生日规则（须严格遵守，且与主角信息联动）：
- 必须阅读用户给出的主角「年龄」「生日 MM-DD」作为叙事时间线参考：为每个 NPC 设定合理的 age（整数）与 birthdayMD（字符串，格式严格为 "MM-DD"，月日各两位零填充，如 "08-03"）。
- 同一故事时间线下，age 与 birthdayMD 应自洽（可按虚构「当前年」推算年份，不必写出年份）。
- 一般应根据关系类型推导年龄差（如父母长于子女、学长略长于学弟、同事多为相近年龄段等）。
- 允许例外：若用户「补充说明」或关系设定需要「忘年交、隔代亲友、老智者与年轻学生、社区里爱聊天的忘年朋友」等，NPC 可与主角年龄差距很大；此时必须在 bio 或 basicSettingEntries 中写清相识缘由与为何关系成立，避免凭空无铺垫。`

/** 遇见 SCHEMA：与人脉同一条自洽逻辑，参照改为滑动用户 + 雷达筛选 */
export const MEET_ENCOUNTER_AI_AGE_AND_BIRTHDAY_RULES = `年龄与生日规则（须严格遵守；**与人脉 NPC 生成引擎 \`npcNetworkGenerate\` 的自洽标准同源**，仅「时间线参照」替换如下）：
- 必须结合 user 中的**当前滑动用户**公开资料（若含年龄、生日线索）以及**雷达筛选年龄区间**，为顶层 age、comprehensive.base.birthdayMD 与 zodiac 设定**彼此一致**的值；birthdayMD 须为严格 "MM-DD" 两位零填充字符串。
- 同一故事时间线下，age 与 birthdayMD 应自洽（可按虚构「当前年」推算年份，不必写出年份）。
- 一般应符合常识：学生/职场/外貌描写与年龄段合理搭配。
- 允许与滑动用户年龄差距较大的设定时，须在 persona 或 comprehensive 叙述中写清缘由，避免凭空无铺垫。`

/** 身高、体重、座右铭：人脉 JSON 与遇见 JSON **同款句法与禁令**（遇见字段名见括号注）。 */
export const NPC_AI_HEIGHT_WEIGHT_MOTTO_RULES_CORE = `身高体重与座右铭要求（强约束）：
- height：写成易读格式，优先用 cm（例："170cm"），允许 "1.70m" / "170厘米"；不要写区间；不要写过长解释。（**遇见** comprehensive.base.heightCm 填**纯数字厘米**字符串，如 "172"，与人脉 height **语义一致**。）
- weight：优先用 kg（例："55kg"），允许 "55公斤"；不要写区间；不要写过长解释。（**遇见** comprehensive.base.weightKg 为千克数字字符串。）
- motto：一句短准的人设准则；人脉 JSON 中单条 <=15 个汉字；**遇见**顶层 motto 允许 8–40 字但必须保持**同一句式密度**；避免空洞大词；禁止「玩家」。尽量不写具体姓名；若须指本人可用「{{char}}」但须控制总长（占位符按字面计字需谨慎，优先不用占位符的抽象句）。`

/** 人脉：可写与档案主角占位符、{{user}} 的关系体感（mainRootPh 由调用方传入，如 {{id:xxx}}） */
export function npcNetworkAiMottoStyleTail(mainRootPlaceholder: string): string {
  return `- 内容应概括当下关系体感，可含与「${mainRootPlaceholder}」无关、仅与「{{user}}」相处状态有关的描述；自由发挥，不限定句式。可参考风格（禁止照搬）：第一次见面后就没怎么交流，感觉有点陌生；最近和 {{user}} 在冷战，感觉交流非常尴尬。`
}

/** 遇见：无档案主角占位符，句法与人脉末条一致 */
export const MEET_ENCOUNTER_AI_MOTTO_STYLE_TAIL = `- 内容应概括角色处世与情感基调；凡涉当前滑动对象用「{{user}}」；自由发挥，不限定句式。可参考风格（禁止照搬）：第一次见面后就没怎么交流，感觉有点陌生；最近和 {{user}} 在冷战，感觉交流非常尴尬。`
