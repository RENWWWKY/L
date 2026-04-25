import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'

const MAX_CHARS = 4200
const NPC_WB_PER_NPC = 380

/** 人脉 NPC 世界书短摘录（启用条目拼接后截断） */
function formatNpcWorldBooksSnippet(n: Character): string {
  const chunks: string[] = []
  for (const w of n.worldBooks ?? []) {
    if (!w.enabled) continue
    for (const it of w.items ?? []) {
      if (!it.enabled) continue
      const c = String(it.content || '').trim()
      if (!c) continue
      chunks.push(`《${w.name}》${it.name}：${c}`)
    }
  }
  const raw = chunks.join('｜')
  if (!raw) return ''
  return raw.length <= NPC_WB_PER_NPC ? raw : `${raw.slice(0, NPC_WB_PER_NPC)}…`
}

/**
 * 组装「主角 + 绑定 NPC + 圈内关系 + 玩家视角链接」文本块，供约会线下 AI 遵守人脉，不乱造替名 NPC。
 */
export async function loadDatingNpcNetworkPromptBlock(params: {
  mainCharacterId: string
  mainRealName: string
}): Promise<string> {
  const rootId = params.mainCharacterId.trim()
  if (!rootId) return ''
  const mainLabel = params.mainRealName.trim() || '主角'

  try {
    const [npcRows, playerLinks] = await Promise.all([
      personaDb.listNpcsFor(rootId),
      personaDb.getPlayerNetworkLinks(rootId),
    ])
    const npcs = npcRows as Character[]
    const idToName = new Map<string, string>()
    idToName.set(rootId, mainLabel)
    for (const n of npcs) {
      idToName.set(n.id, (n.name || '').trim() || '未命名')
    }

    const cliqueIds = [rootId, ...npcs.map((n) => n.id)]
    const rels = await personaDb.listRelationshipsInNetwork(cliqueIds)
    const relsFiltered = rels.filter((r) => !r.isPlayerIdentity)

    const lines: string[] = []
    lines.push(`【主角】${mainLabel}（勿在正文输出 id）`)

    if (npcs.length) {
      lines.push('\n【绑定 NPC 名册】（线下有名配角**优先**使用下列姓名与身份；**禁止**在已有对应关系位时再发明随机全名顶替）')
      for (const n of npcs.slice(0, 36)) {
        const nm = (n.name || '').trim() || '未命名'
        const idt = (n.identity || '').trim() || '未设定'
        const wb = (n.bio || '').trim().slice(0, 80)
        const wbBooks = formatNpcWorldBooksSnippet(n)
        lines.push(
          `- ${nm}：${idt}${wb ? `；简介摘录：${wb}` : ''}${wbBooks ? `；世界书摘录：${wbBooks}` : ''}`,
        )
      }
    }

    if (relsFiltered.length) {
      lines.push('\n【圈内关系（主角 ↔ NPC）】')
      for (const r of relsFiltered.slice(0, 48)) {
        const a = idToName.get(r.fromCharacterId)
        const b = idToName.get(r.toCharacterId)
        if (!a || !b) continue
        const rel = (r.relation || '').trim()
        const fp = (r.fromPerspective || '').trim().slice(0, 100)
        const tp = (r.toPerspective || '').trim().slice(0, 100)
        const mid = rel || '关系'
        const tail = [fp && `（从${a}看：${fp}）`, tp && `（从${b}看：${tp}）`].filter(Boolean).join('')
        lines.push(`- ${a} —「${mid}」→ ${b}${tail}`)
      }
    }

    if (playerLinks.length) {
      lines.push('\n【玩家与该主角圈内人（人脉编辑配置）】')
      for (const pl of playerLinks.slice(0, 24)) {
        const nm = idToName.get(pl.characterId)
        if (!nm) continue
        const bits = [pl.relationThemToYou, pl.theySeeYou].map((x) => String(x || '').trim()).filter(Boolean)
        if (!bits.length) continue
        lines.push(`- 对「${nm}」：${bits.join('；').slice(0, 220)}`)
      }
    }

    if (!npcs.length && !relsFiltered.length && !playerLinks.length) {
      return ''
    }

    const body = lines.join('\n').slice(0, MAX_CHARS)
    return (
      `【主角人脉网·须参考】以下来自人设「人脉」绑定；**有名 NPC 须优先从下表与关系中选用**，勿随意用新全名顶替表中已有职能/关系位（如已有队友却写另一随机队友名）。` +
      `若仅需一次性无名龙套，用「工作人员」「路人」等弱指代，勿起易与表内混淆的全名。\n\n${body}`
    )
  } catch {
    return ''
  }
}
