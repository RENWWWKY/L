/** 玩家身份 / 人设是否归属当前微信账号（多账号隔离） */
export function identityBelongsToWechatAccount(
  identity: { wechatAccountId?: string },
  wechatAccountId: string | null | undefined,
): boolean {
  const owner = identity.wechatAccountId?.trim()
  const acc = wechatAccountId?.trim()
  if (!acc) return false
  if (!owner) return false
  return owner === acc
}

/** 角色人设是否归属当前微信账号（无归属标记的孤儿数据仅主账号迁移后可见） */
export function characterBelongsToWechatAccount(
  character: { wechatAccountId?: string },
  wechatAccountId: string | null | undefined,
): boolean {
  const owner = character.wechatAccountId?.trim()
  const acc = wechatAccountId?.trim()
  if (!acc) return false
  if (!owner) return false
  return owner === acc
}

/** 本账号可访问：仅归属当前微信账号的人设（多账号间不共享、不同步）。 */
export function characterAccessibleToWechatAccount(
  character: { id: string; wechatAccountId?: string },
  wechatAccountId: string | null | undefined,
  _linkedCanonicalCharacterIds?: ReadonlySet<string>,
): boolean {
  void _linkedCanonicalCharacterIds
  const id = character.id.trim()
  if (!id) return false
  return characterBelongsToWechatAccount(character, wechatAccountId)
}

export function stampWechatAccountOwner<T extends { wechatAccountId?: string }>(
  entity: T,
  wechatAccountId: string | null | undefined,
): T {
  const acc = wechatAccountId?.trim()
  if (!acc) return entity
  return { ...entity, wechatAccountId: acc }
}
