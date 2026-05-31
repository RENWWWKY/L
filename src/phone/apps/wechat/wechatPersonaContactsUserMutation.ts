/** 用户主动改动通讯录（删除/替换/清空）时递增，供同步与修复逻辑识别「勿从 bundle 回填」。 */
let generation = 0

export function bumpWeChatPersonaContactsUserMutation(): void {
  generation += 1
}

export function getWeChatPersonaContactsUserMutationGeneration(): number {
  return generation
}
