import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import { buildDatingPlotCastDnaBlock } from './datingPlotImageCast'
const DATING_PLOT_COMPOSITION_COT = `
■ 剧情配图·构图与生活感内隐自检（写在 <imgthink> 内；禁止输出到 <image>）

【镜头立场·最高优先级】
- 这是**给用户看的剧情插画**，像**电影镜头定格**，不是角色用手机随手记录。
- **固定第三人称外置摄影机**：third-person cinematic camera, external observer viewpoint, film still frame。
- **绝对禁止**：first-person POV, POV lens shot, smartphone selfie, mirror selfie, handheld phone snapshot, rear camera snap, own hand at frame edge, viewer-as-character POV, phone visible in frame。
- 空镜也须是**旁观镜头拍环境**，不是「举机者眼前所见」的主观 POV。

【6 步·按序内化（每张图重复）】
1. **场景**：可辨识空间 + 前景/中景/背景纵深；5～10 个可见环境与生活痕迹 tag。
2. **构图**：默认 medium shot / two-thirds body / wide shot；禁大头照、证件照、无背景近景、纯正面站桩。
3. **背景**：具体可辨；禁纯色/渐变/空白/棚拍；夜晚须有明确光源。
4. **动作**：角色在画面中有自然动作与重心；手有具体状态（拿杯、扶桌、插兜等）。
5. **表情**：natural smile, slight smile, averted gaze, focused eyes 等可见 tag；禁 expressionless。
6. **光线**：3～6 个贴合场景的光线 tag；电影感侧光/轮廓光/环境光均可。

【tag 构建顺序】third-person shot type → 场景环境 → reference character / reference player / DNA → 动作姿态 → 表情 → 服装 → 光线氛围
`.trim()

/**
 * 线下约会剧情配图·内隐视觉导演思维链
 * 适配「正文已生成 → 后置配图」流程，非 NAI 正文穿插式输出。
 */
export const DATING_PLOT_IMAGE_INTERNAL_COT = `
■ 剧情配图·视觉导演推演（写在 <imgthink> 内；客户端自动隐藏，用户不可见）

【任务边界】
- 输入是**已写完的单段剧情正文**；任务是把正文切成 N 个「正文里确实发生过」的定格画面。
- **禁止**通过配图推进剧情、补写新动作/表情/场景；每张图只能是正文的**视觉回顾**。
- 画风由客户端自动拼接；prompt **禁止** masterpiece, best quality, anime, realistic, 8k, photorealistic 等风格词。
- 配图是**电影级第三人称插画**，向用户呈现「镜头外的旁观画面」；**不是**角色第一人称 POV、**不是**手机随手拍、**不是**自拍。

【5 步·按序内化（每张图重复）】
1. **剧情切片**：从正文标出 N 个不同时间点的「决定性瞬间」（情绪转折、动作高潮、对峙、氛围点）；N=目标张数，每张必须对应不同片段。
2. **忠实性校验**（任一否→换画面）：
   - 这个动作在正文里写了吗？这个表情提到了吗？这个场景细节出现过吗？
   - 我是在**视觉化正文**，还是在**创造新剧情**？
3. **视觉连续性**：若提供「上文配图记录」，继承仍有效的服装/伤口/持有物；仅正文明确变化时才改。
4. **构图翻译**（第三人称电影镜头；景别默认 medium shot / two-thirds body / wide shot）：
   - 每条 prompt **必须**含 third-person view 或 third-person cinematic camera 或 external camera 之一。
   - 悬念张力 → dutch angle, negative space, rim lighting, deep shadows
   - 场面调度 → wide shot, layered background, deep focus, environmental storytelling
   - 情绪凝视 → soft side light, averted gaze, visible shadows, intimate framing
   - 氛围空镜 → environment focus, lived-in details, visible light source（仍是旁观镜头，不是 POV）
   - 禁止抽象心理 tag；全部转写为可见英文 tag。
5. **Tag 组装**：英文 comma-separated；顺序=第三人称景别镜头→场景环境→角色主体→动作姿态→表情→服装状态→光线氛围。

【角色 DNA 锁】
- **约会主角**：有参考图 → **reference character**；无参考图 → 1boy/1girl + DNA 摘要（全 N 张一致）。
- **玩家「你」同框时**：有参考图 → **reference player**；无参考图 → 另一组 1boy/1girl + 玩家 DNA；**禁止**与约会主角混用同一 tag。
- 有参考图时**禁止**写脸型/发色/瞳色/五官；只写动作、表情、服装、站位、光线。
- DNA 摘要来自档案，**禁止**擅自改写核心形容词。

【多人·同框 cast（正文出现须严格执行）】
- **仅 1 人 / 空镜**：只画该人或环境；禁止凭空加第二人。
- **玩家 + 约会角色同框**：prompt 须 **reference character + reference player**（或各自 DNA），写清 left/center/right 站位。
- **≥3 人**：两位主角仍用 reference character / reference player；NPC 用 1boy/1girl + 正文特征，写清站位。
- **性别校验（imgthink 必做）**：逐人核对 1boy/1girl；禁止 gender swap、fused bodies、merged faces。

【输出格式铁律（imgthink 自动隐藏，用户只见配图）】
- 每张图必须先输出一个 <imgthink> 块（纯文本推演，禁止 Markdown/代码块/步骤标题），再紧跟一个 <image> 块。
- <imgthink> 与 </imgthink> 之间写中文推演；<image> 与 </image> 之间**只写英文 comma-separated tags**。
- 禁止在 <image> 内写自然语言句子、禁止中文 tag、禁止 |centers:xx、禁止 (tag:1.2) 权重。
- 每条 <image> 内 tag 串 80～220 英文字符；恰好 N 组「imgthink + image」交替。
- 禁止输出 JSON、禁止 <details>、禁止 Step 1 等标题（思维链内容写在 imgthink 内即可）。

【imgthink 模板（每张复制，纯文本）】
<imgthink>
1. 视觉历史回溯：上文服装/伤口/持有物状态；本帧保留或变更什么
2. 本帧剧情切片：对应正文哪一句/哪个瞬间；是否正文已写
3. 忠实性校验：动作/表情/场景是否均在正文出现；有无超前编造
4. 镜头立场：确认为第三人称电影镜头（非 POV/非手机随手拍）；景别与机位
5. 人数与性别：画面内几人；约会主角/玩家/NPC 各自 gender tag 与 reference tag 是否正确
6. 光影布局：主光、环境光、阴影方向
7. Tag 转译：将如何写成英文 tag；reference character / reference player / DNA 是否一致
</imgthink>

【image 模板（单人）】
<image>
third-person cinematic camera, medium shot, reference character, two-thirds body, [场景环境 tag], [动作], [表情], [光线], [生活细节]
</image>

【image 模板（玩家与约会角色同框）】
<image>
third-person cinematic camera, medium shot, two people, reference character on [left/right], reference player on [right/left], [互动动作], [场景], [光线], NOT fused bodies
</image>

【image 模板（三人及以上·须逐人写 gender tag）】
<image>
third-person cinematic camera, medium wide shot, three people, reference character (1girl/1boy), reference player (1girl/1boy), 1boy/1girl NPC on [position], [各自站位 left/center/right], [互动动作], [场景], NOT fused bodies, NOT gender swap
</image>

【输出前自检】
- 是否**全程第三人称电影镜头**？是否误写 POV/selfie/phone camera？
- 同框时是否**同时**有 reference character + reference player（或各自 DNA）？**性别 tag 是否逐人正确**？
- 有参考图时是否避免写固定外貌？无参考图时 DNA 串是否每张一致？

【脑中排除·勿写入 prompt】
first-person POV, POV lens shot, front camera selfie, mirror selfie, smartphone snapshot, handheld phone, own hand at frame edge, close-up, headshot, portrait only, simple background, gradient background, solid color background, blank background, studio backdrop, expressionless, stiff pose, fused bodies, merged faces, blurry, worst quality
`.trim()

export function buildDatingPlotImageCotBlock(): string {
  return `${DATING_PLOT_IMAGE_INTERNAL_COT}\n\n${DATING_PLOT_COMPOSITION_COT}`
}

/** 构建角色 DNA 摘要（供 prompt 生成器锁定一致性） */
export function buildDatingPlotCharacterDnaBlock(character: Character | null | undefined): string {
  return buildDatingPlotCastDnaBlock({ character, playerIdentity: null })
}

export function buildDatingPlotImagePromptCastBlock(
  character: Character | null | undefined,
  playerIdentity?: PlayerIdentity | null,
  playerDisplayName?: string,
): string {
  return buildDatingPlotCastDnaBlock({ character, playerIdentity, playerDisplayName })
}

/** 上文配图 prompt 摘要（视觉连续性） */
export function formatDatingPlotVisualHistory(recentPrompts: string[]): string {
  const rows = recentPrompts.map((p) => p.trim()).filter(Boolean).slice(-4)
  if (!rows.length) return '（无上文配图记录，按本段正文独立构图）'
  return rows.map((p, i) => `${i + 1}. ${p.slice(0, 220)}`).join('\n')
}

export function buildDatingPlotImagePromptSystem(count: number): string {
  return `你是线下约会剧情配图 prompt 生成器（电影视觉导演模式）。
根据剧情正文，为每个画面先 <imgthink> 推演，再 <image> 输出英文 tag；共恰好 ${count} 组，每组结构固定。
所有配图必须是**第三人称电影镜头**定格画面，像给用户播放一段电影片段；禁止第一人称 POV、禁止手机随手拍、禁止自拍。
${buildDatingPlotImageCotBlock()}

【最终输出结构（严格遵守，不要其它前后缀）】
<imgthink>…第1帧推演…</imgthink>
<image>英文 tags 第1帧</image>
<imgthink>…第2帧推演…</imgthink>
<image>英文 tags 第2帧</image>
…共 ${count} 组…

客户端会自动隐藏全部 <imgthink>，只取 <image> 内 tag 发往生图 API。禁止额外解释、禁止 JSON。`
}
