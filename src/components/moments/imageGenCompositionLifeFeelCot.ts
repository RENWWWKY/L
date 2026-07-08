/**
 * 生图构图与生活感·内隐思维链
 * 仅在需要生图的场景注入（聊天配图协议 / 朋友圈配图 prompt），普通文字回复不注入。
 */

export const IMAGE_GEN_COMPOSITION_LIFE_FEEL_INTERNAL_COT = `
■ 写 \`[图片]\` / imagePrompt 前·构图与生活感内隐自检（脑中完成，**禁止输出**分析过程）

【与上方 POV/自拍协议的关系】
- **first-person POV / front camera selfie / mirror selfie**：以上 POV/自拍/俯仰角协议**优先**；已选 extreme close-up 自拍时，下列「禁大头/禁 close-up」**不适用**。
- **third-person reference character 镜头、环境 POV 空镜、半身以上生活场景**：须严格执行下列规则。

【7 步·按序内部分析】
1. **场景**：这是哪？什么时段？用户未指定则补最合理、最有生活感的场景；场景与人物气质冲突时修正场景。
   - 须有可辨识空间（墙/地面/门窗/家具/路面/建筑等）+ 前景/中景/背景至少两层纵深。
   - 补 5～10 个可见环境元素与生活痕迹（桌面杂物、书本、杯子、耳机、雨痕、磨损等），背景信息密度 ≥ 人物。
2. **构图**：默认半身 / 三分之二身 / 坐姿中景 / 带动作站姿 / 过肩 / 斜侧；禁大头照、证件照、无背景近景、纯正面站桩（自拍协议除外）。
3. **背景**：须具体可辨；禁纯色/渐变/空白/棚拍感/只有光晕；夜晚须有明确光源（台灯/屏幕/霓虹/路灯/店招等），禁整片纯黑。
4. **动作**：禁无动作站桩；手须有具体状态（拿杯、扶桌、插兜、翻书、碰手机、托腮等）；身体有自然重心与衣褶动态。
5. **表情**：先环境→情绪→表情幅度；日常用 natural smile, slight smile, light blush, averted gaze, focused eyes 等**可见**英文 tag；禁 expressionless / stiff face / 与场景无关冷脸。
6. **服装饰品**：禁长期纯色无细节；允许 pattern, layered clothing, collar detail, embroidery, small accessories（earring, necklace, hair clip, watch 等），协调不堆满。
7. **光线质感**：从场景推断光源与阴影；写 3～6 个贴合场景的光线/质感 tag；整体须像「被拍到的真实瞬间」。

【输出前自检（任一项不过 → 脑中补全再写 tag）】
- 删人物后仍能辨认地点？至少 5 个可见环境元素？有光源与纵深？
- 非自拍时景别至少半身？有动作与手部状态？表情与场景一致？服装有层次？

【tag 构建顺序】场景环境 → 构图景别 → 姿态动作 → 表情 → 服装饰品道具 → 光线氛围

【脑中排除·勿写入可见回复】close-up, headshot, portrait only, simple background, gradient background, solid color background, blank background, studio backdrop, stiff pose, expressionless, flat composition, no background, plain outfit
`.trim()

/** 本轮聊天是否应注入构图/生活感思维链 */
export function shouldInjectImageGenCompositionLifeFeelCot(params: {
  characterImageGenEnabled?: boolean
  userExplicitCharacterImageRequest?: boolean
  imageRoundCountTarget?: number
  /** 主动消息等路径：概率已命中允许发图 */
  imageRoundAllowed?: boolean
}): boolean {
  if (!params.characterImageGenEnabled) return false
  if (params.userExplicitCharacterImageRequest) return true
  if (params.imageRoundAllowed) return true
  if ((params.imageRoundCountTarget ?? 0) > 0) return true
  return false
}

export function buildImageGenCompositionLifeFeelCotBlock(): string {
  return IMAGE_GEN_COMPOSITION_LIFE_FEEL_INTERNAL_COT
}
