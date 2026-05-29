import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { buildNetworkRelationshipsPromptBlock } from '../networkRelationshipsPrompt'
import { worldBookPronounGuideAnnotation } from '../newFriendsPersona/worldBookPronounGuide'

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
      const ann = worldBookPronounGuideAnnotation(it.pronounGuide, String(n.name || '').trim() || '该角色', 'character_card')
      chunks.push(`《${w.name}》${it.name}：${c}${ann ? ` ${ann}` : ''}`)
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
    const npcRows = await personaDb.listNpcsFor(rootId)
    const npcs = npcRows as Character[]

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

    const relBlock = await buildNetworkRelationshipsPromptBlock({
      rootId,
      focusCharacterId: rootId,
      mainToNpcOnly: true,
      maxChars: 2800,
    })

    if (!npcs.length && !relBlock.trim()) return ''

    const roster = lines.join('\n')
    const body = `${roster}${relBlock}`.slice(0, MAX_CHARS)
    return (
      `【主角人脉网·须参考】以下来自人设「人脉」绑定；**有名 NPC 须优先从下表与关系中选用**，勿随意用新全名顶替表中已有职能/关系位（如已有队友却写另一随机队友名）。` +
      `若仅需一次性无名龙套，用「工作人员」「路人」等弱指代，勿起易与表内混淆的全名。\n\n${body}`
    )
  } catch {
    return ''
  }
}
