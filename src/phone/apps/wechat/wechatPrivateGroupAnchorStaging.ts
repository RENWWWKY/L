/** 与 {@link personaDb.setPrivateChatAnchorGroupId} TTL 对齐；用于群→私切换同一帧内先于异步落库可读 */
const STAGED_TTL_MS = 45 * 60 * 1000

let staged: { characterId: string; groupId: string; setAtMs: number } | null = null

/** 私→群：本群优先承接的成员 id（与 {@link personaDb.setGroupChatAnchorPrivatePeerCharacterId} 同源） */
let stagedGroupPrivatePeer: { groupId: string; peerCharacterId: string; setAtMs: number } | null = null

/** 在路由 layout 阶段同步调用，避免子组件 effect 早于 IndexedDB 写入而读不到锚点 */
export function setPrivateChatGroupAnchorFromDockTransition(characterId: string, groupId: string): void {
  const cid = characterId.trim()
  const gid = groupId.trim()
  if (!cid || !gid) return
  staged = { characterId: cid, groupId: gid, setAtMs: Date.now() }
}

/** 与私聊 digest 构建同用：优先于 KV 读，不落库、不消费（同一会话多轮 AI 仍可命中 staging 直至过期） */
export function peekPrivateChatGroupAnchorFromDockStaging(characterId: string): string | null {
  const cid = characterId.trim()
  if (!cid || !staged || staged.characterId !== cid) return null
  if (Date.now() - staged.setAtMs > STAGED_TTL_MS) {
    staged = null
    return null
  }
  return staged.groupId
}

/** 私聊会话切到指定群时同步写入，便于群侧首轮拼 prompt 早于 IndexedDB */
export function setGroupChatPrivatePeerAnchorFromDockTransition(groupId: string, peerCharacterId: string): void {
  const gid = groupId.trim()
  const pid = peerCharacterId.trim()
  if (!gid || !pid) return
  stagedGroupPrivatePeer = { groupId: gid, peerCharacterId: pid, setAtMs: Date.now() }
}

export function peekGroupChatPrivatePeerAnchorFromDockStaging(groupId: string): string | null {
  const gid = groupId.trim()
  if (!gid || !stagedGroupPrivatePeer || stagedGroupPrivatePeer.groupId !== gid) return null
  if (Date.now() - stagedGroupPrivatePeer.setAtMs > STAGED_TTL_MS) {
    stagedGroupPrivatePeer = null
    return null
  }
  return stagedGroupPrivatePeer.peerCharacterId
}

/** 异步校验失败时清掉乐观写入，避免短暂误命中 */
export function clearGroupChatPrivatePeerAnchorDockStagingIfMatches(groupId: string, peerCharacterId: string): void {
  const gid = groupId.trim()
  const pid = peerCharacterId.trim()
  if (!stagedGroupPrivatePeer) return
  if (stagedGroupPrivatePeer.groupId === gid && stagedGroupPrivatePeer.peerCharacterId === pid) {
    stagedGroupPrivatePeer = null
  }
}
