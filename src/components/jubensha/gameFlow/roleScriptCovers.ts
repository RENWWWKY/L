/** 《雨夜归零》角色个人剧本封面（Vite 静态资源） */
const YUYE_COVERS: Partial<Record<string, string>> = {
  程予安: new URL('../../../剧本杀/《雨夜归零》/程予安个人剧本封面.png', import.meta.url).href,
  陆景川: new URL('../../../剧本杀/《雨夜归零》/陆景川个人剧本封面.png', import.meta.url).href,
}

export function resolveRoleScriptCover(
  scriptId: string,
  roleName: string,
  explicitUrl?: string,
): string | undefined {
  if (explicitUrl) return explicitUrl
  if (scriptId === 'yuye-guiling') return YUYE_COVERS[roleName]
  return undefined
}
