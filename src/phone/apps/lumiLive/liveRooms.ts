import type { WeChatPersonaContact } from '../../types'
import type { LiveRoom } from './types'

const NPC_ROOMS: Omit<LiveRoom, 'id' | 'viewerCount'>[] = [
  {
    hostKind: 'npc',
    hostName: '顾知晚',
    avatarUrl: '',
    coverUrl: '',
    title: '不想开，但开了一会',
    personaBrief: '高冷青年，话少，直播像被迫的私人连线，语气淡、偶有傲娇。',
  },
  {
    hostKind: 'npc',
    hostName: '沈屿',
    avatarUrl: '',
    coverUrl: '',
    title: '雨声与台灯',
    personaBrief: '安静温柔的夜播主，不煽情，用短句回应弹幕。',
  },
  {
    hostKind: 'npc',
    hostName: '陆予安',
    avatarUrl: '',
    coverUrl: '',
    title: '临时上线',
    personaBrief: '少爷气质，嫌吵，对打赏淡淡致谢，偶尔呛人。',
  },
]

const COVER_TONES = [
  'linear-gradient(160deg, #1a1a1c 0%, #2c2a26 42%, #3a3428 100%)',
  'linear-gradient(165deg, #12141a 0%, #1e2430 45%, #2a3340 100%)',
  'linear-gradient(155deg, #181616 0%, #26201c 50%, #3a2e28 100%)',
  'linear-gradient(170deg, #141816 0%, #1c2420 48%, #2a322c 100%)',
]

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function formatViewers(seed: number): number {
  return 1800 + (seed % 42000)
}

export function coverToneForId(id: string): string {
  return COVER_TONES[hashStr(id) % COVER_TONES.length]!
}

/** 由微信人脉 + 内置 NPC 组装直播大厅 */
export function buildLiveRooms(personaContacts: WeChatPersonaContact[]): LiveRoom[] {
  const rooms: LiveRoom[] = []
  const seen = new Set<string>()

  for (const c of personaContacts) {
    const cid = c.characterId?.trim()
    if (!cid || seen.has(cid)) continue
    seen.add(cid)
    const name = c.remarkName?.trim() || '未知主播'
    const avatar = c.avatarUrl?.trim() || ''
    rooms.push({
      id: `live-char-${cid}`,
      hostKind: 'character',
      characterId: cid,
      hostName: name,
      avatarUrl: avatar,
      coverUrl: avatar,
      title: '深夜连线',
      viewerCount: formatViewers(hashStr(cid)),
      personaBrief: `${name}，按其人设以主播口述语气回应，克制、私密、少煽情。`,
    })
  }

  for (let i = 0; i < NPC_ROOMS.length; i += 1) {
    const npc = NPC_ROOMS[i]!
    const id = `live-npc-${i}`
    rooms.push({
      ...npc,
      id,
      viewerCount: formatViewers(hashStr(id) + 99),
    })
  }

  if (rooms.length === 0) {
    rooms.push({
      id: 'live-npc-fallback',
      hostKind: 'npc',
      hostName: '浮光',
      avatarUrl: '',
      coverUrl: '',
      title: '空镜试播',
      viewerCount: 2400,
      personaBrief: '匿名主播，话极少，像在测试连线。',
    })
  }

  return rooms
}

export function formatViewerLabel(n: number): string {
  if (n >= 10000) {
    const v = n / 10000
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}万`
  }
  if (n >= 1000) {
    const v = n / 1000
    return `${v.toFixed(1).replace(/\.0$/, '')}k`
  }
  return String(n)
}
