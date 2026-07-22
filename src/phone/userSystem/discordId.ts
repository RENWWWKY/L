/** Discord 数字用户 ID（snowflake）：17–20 位纯数字 */
export function isDiscordSnowflakeId(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim())
}

export const DISCORD_SNOWFLAKE_HINT =
  '请填写 Discord 数字 ID（开发者模式 → 右键头像 → 复制用户 ID），不要填用户名/昵称'
