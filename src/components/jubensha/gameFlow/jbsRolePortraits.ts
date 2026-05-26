/** 《雨夜归零》公共剧情 / 聊天室角色立绘 */
const YUYE_ROLE_PORTRAITS: Record<string, string> = {
  林晚星: new URL('../../../剧本杀/《雨夜归零》/角色立绘/林晚星立绘.jpg', import.meta.url).href,
  苏晚晴: new URL('../../../剧本杀/《雨夜归零》/角色立绘/苏晚晴立绘.jpg', import.meta.url).href,
  陆景川: new URL('../../../剧本杀/《雨夜归零》/角色立绘/陆景川立绘.jpg', import.meta.url).href,
  沈知意: new URL('../../../剧本杀/《雨夜归零》/角色立绘/沈知意立绘.jpg', import.meta.url).href,
  程予安: new URL('../../../剧本杀/《雨夜归零》/角色立绘/程予安立绘.jpg', import.meta.url).href,
}

export function resolveJbsRolePortrait(scriptId: string, roleName: string): string | undefined {
  if (scriptId !== 'yuye-guiling') return undefined
  return YUYE_ROLE_PORTRAITS[roleName.trim()]
}
