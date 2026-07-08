const PROMPT_PART_BAN_RE =
  /^(?:8k|4k|超清|高清|最佳画质|masterpiece|ultra[\s-]?detailed|best quality|highres)$/i

const DATING_PLOT_POV_PART_RE =
  /first-person POV|first person POV|POV lens|front camera selfie|mirror selfie|handheld snapshot|smartphone POV|smartphone selfie|rear camera|phone camera|viewer IS the|own hand at frame edge|own (?:left |right )?hand|partner(?:'s|s)? hand|selfie stick|第一人称|第一视角|前置自拍|对镜自拍|随手拍|手机镜头|后置摄像头/i

/** 剧情配图 prompt 清洗：禁止 POV/自拍 tag，保留英文场景 tag */
export function sanitizeDatingPlotImagePrompt(prompt: string): string {
  let s = prompt.trim()
  if (!s) return s
  s = s.replace(/参考图角色/g, 'reference character')
  s = s.replace(/参考图玩家|玩家参考/g, 'reference player')

  const parts = s
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !PROMPT_PART_BAN_RE.test(part))
    .filter((part) => !DATING_PLOT_POV_PART_RE.test(part))

  return parts.join(', ').replace(/\s+/g, ' ').replace(/,{2,}/g, ',').trim()
}
