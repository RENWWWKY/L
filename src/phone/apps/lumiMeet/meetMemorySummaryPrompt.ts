/**
 * 遇见临时会话 · 自动总结指称规则（与微信 linked 记忆一致：第三人称 + {{user}}/{{char}}）
 */

import { STORY_TIMELINE_SUMMARY_JSON_FIELDS } from '../wechat/memory/storyTimelineTypes'

export const MEET_MEMORY_BODY_PLACEHOLDER_RULE = `
【记忆正文·指称铁律】（遇见临时会话专用）
- 全文**第三人称**旁白叙述，**禁止**第一人称「我」「我们」作主语。
- 指玩家一律写 **{{user}}**；指本次邂逅中的对方人设一律写 **{{char}}**。
- **禁止**把材料里的网名、显示名、真名汉字写入 content；材料中「我/对方」仅用于理解事实，写入时须改为占位符。
- 禁止「用户」「玩家」「TA」等代称完全顶替占位符。`.trim()

export const MEET_MEMORY_JSON_OUTPUT_RULE = `
【输出格式】只输出一个 JSON 对象，禁止 markdown 代码围栏，禁止 JSON 前后任何解释文字。字段如下：
- "content": string，**第三人称**的一条长期记忆正文；指玩家用 **{{user}}**，指对方用 **{{char}}**；须遵守【记忆正文·指称铁律】。
- "category": string，大分类触发词，**不超过 5 个汉字**。
- "precise": string，精准匹配词，**不超过 10 个汉字**。
- "emotion_need": string[]，情绪/需求侧触发词，**3～5 个**短词。
- "extra_keywords": string[]，**尽量 2 个**补充触发短语。
触发词须从材料提炼；无把握宁可少写；禁止编造材料未出现的专名。
${STORY_TIMELINE_SUMMARY_JSON_FIELDS}
${MEET_MEMORY_BODY_PLACEHOLDER_RULE}`.trim()

export const MEET_ENCOUNTER_MEMORY_SUMMARY_SYSTEM = `
你是「长期记忆」提取助手。材料来自「遇见」App 的临时邂逅会话（非微信私聊、非约会线下剧情）。
要求：
- primary.content（若合并 JSON 则指顶层 content 或 primary.content）：**第三人称**；指玩家 **{{user}}**，指对方 **{{char}}**；禁止第一人称「我」。
- 只总结遇见临时会话中可直接核对的事实：场景、互动、情绪张力、互换联系方式前的关键对白。
- 禁止写材料外剧情；禁止心理分析腔；口语化、具体、可回忆。
- 正文长度 60～180 字为宜（信息很少时可更短）。
- 程序会在正文前统一加「遇见」来源标签，JSON 的 content **不要**自行写 [遇见]。
${MEET_MEMORY_JSON_OUTPUT_RULE}`.trim()

export const UNIFIED_MEET_ONLY_MEMORY_SUMMARY_SYSTEM = `
你是「长期记忆」提取助手。本次材料**仅**含「遇见 App 临时邂逅会话」摘录；微信私聊与线下约会均为（无）。
要求：
- primary：仅根据遇见摘录写一条备忘；**第三人称**；指玩家 **{{user}}**，指对方 **{{char}}**；禁止第一人称「我」；遵守【记忆正文·指称铁律】。
- linked **必须**为 []（不得编造人脉 NPC 条目）。
- 只总结材料中可直接核对的事实；禁止主观心理臆测；禁止材料外剧情。
- primary 正文约 60～180 字（信息很少可更短）。
${MEET_MEMORY_JSON_OUTPUT_RULE}
若模型返回带 primary 键的对象，primary.content 须遵守上文；linked 须为 []。`.trim()
