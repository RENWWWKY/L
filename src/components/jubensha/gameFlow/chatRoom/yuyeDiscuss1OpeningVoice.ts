/** 公开讨论① · 按玩家身份分支的 NPC 互讨论开场（6 句 / 3 来回，末句点玩家） */

export type DiscussOpeningTrack = {
  url: string
  script: string
  speaker: { role: string }
  /** 末句：由 NPC 点名引导当前玩家角色接话 */
  isPlayerCue?: boolean
}

const PLAYER_ROLES = ['沈知意', '陆景川', '苏晚晴', '程予安'] as const
export type Discuss1PlayerRole = (typeof PLAYER_ROLES)[number]

type Discuss1Line = {
  speaker: Discuss1PlayerRole
  script: string
}

/** 玩家扮演某角色时，另外三人先互讨论一轮（前 5 句互怼，第 6 句点玩家） */
const DISCUSS1_SCENES: Record<Discuss1PlayerRole, readonly Discuss1Line[]> = {
  /** 玩家 · 沈知意 */
  沈知意: [
    {
      speaker: '陆景川',
      script:
        '服务员证词写得很清楚：19:45 到 19:50 我那格是空的。但我记得当时在阳台透气——这条怎么跟记录对上，得先说明白。',
    },
    {
      speaker: '苏晚晴',
      script:
        '先别只盯陆景川离席。19:43 还有一张从未登记的副卡刷卡失败，门没开——这条线同样值得问。',
    },
    {
      speaker: '程予安',
      script:
        '酒窖两次刷卡都是我这边主卡，我不躲。C-2 那瓶没登记的香槟，是林晚星坚持要用的——经过我可以配合说清楚。',
    },
    {
      speaker: '陆景川',
      script:
        '那就把 19:45 到 20:00 一段一段抠：谁离席、谁进酒窖、谁还在席上。空白不补齐，后面没法谈。',
    },
    {
      speaker: '苏晚晴',
      script:
        '我同意先对时间线。但别只问离席的人——也在席的，未必就没有动手脚的空间。',
    },
    {
      speaker: '程予安',
      script:
        '沈知意，你代表资方坐了一整晚，证词也说你没离席——现在轮到你了：19:45 到 20:00，你这边怎么看这些线索？',
    },
  ],

  /** 玩家 · 陆景川 */
  陆景川: [
    {
      speaker: '沈知意',
      script:
        '第一轮我不绕弯：19:45 到 19:50 我没离席，服务员证词也写了。我更关心的是——未登记的酒是怎么上了桌的。',
    },
    {
      speaker: '苏晚晴',
      script:
        '那得问进过酒窖的人。我 19:45 去过洗手间，没在 C-2 里待着；私事这一轮可以先不说。',
    },
    {
      speaker: '程予安',
      script:
        '19:48 我跟林晚星下过酒窖，C-2 未登记是事实。瓶口检出花粉的报告，你们现在比我在场时更清楚。',
    },
    {
      speaker: '沈知意',
      script:
        '19:43 副卡刷卡失败，能不能和监控缺的那段并在一起看？别各说各的、各藏各的。',
    },
    {
      speaker: '苏晚晴',
      script:
        '可以并看。但动线对质要公平——别只追着离席的人问，也在席的同样要接受追问。',
    },
    {
      speaker: '程予安',
      script:
        '陆景川，服务员证词写你 19:45 到 19:50 离席，公共剧情里 19:40 你也去过阳台——现在当着大家，把这两段动线对清楚吧。',
    },
  ],

  /** 玩家 · 苏晚晴 */
  苏晚晴: [
    {
      speaker: '程予安',
      script:
        '我先把能说的摆出来：19:48 我随林晚星取酒，服务员看见的只有我们两个。两次刷卡是我主卡，没有推脱。',
    },
    {
      speaker: '陆景川',
      script:
        '我没有进酒窖的印象；19:40 去阳台透气我记得。19:48 前后我应在席位上——若有人看见不是这样，现在就可以说。',
    },
    {
      speaker: '沈知意',
      script:
        '服务员证词里你那时位空着，陆景川。这不是谁在冤枉你，是记录在提问。还有那次副卡失败，也得有人解释。',
    },
    {
      speaker: '程予安',
      script:
        'C-2 那瓶未登记的香槟，林晚星当时坚持选用——我提醒过没上酒水单，但没有拦住。',
    },
    {
      speaker: '陆景川',
      script:
        '那就查动线、查瓶、查离席。第一轮不够，但至少先把空白钉死，别靠猜。',
    },
    {
      speaker: '沈知意',
      script:
        '苏晚晴，你和我们三个不一样，有些话不必当着全桌展开——但 19:45 到 20:00 在哪，这一轮请你也给个准的。',
    },
  ],

  /** 玩家 · 程予安 */
  程予安: [
    {
      speaker: '陆景川',
      script:
        '线索既然发了，我先把口径放这：19:45 前后我在餐厅和阳台一带，没进酒窖。有不对的，拿证据顶上来。',
    },
    {
      speaker: '苏晚晴',
      script:
        '19:45 我去洗手间，19:48 在廊下听见过酒窖方向有动静——我不在里面，但这个我可以作证。',
    },
    {
      speaker: '沈知意',
      script:
        '我全程在席，服务员证词能印证。更该问的是：未登记的酒、失败的副卡，还有过敏档案为何外人不知。',
    },
    {
      speaker: '陆景川',
      script:
        '动线可以慢慢对，但别跳过 19:43 刷卡失败——像有人在试门，不是无的放矢。',
    },
    {
      speaker: '苏晚晴',
      script:
        '也对。进酒窖的名字大家知道了，但动线里还有别的空白——剩下的，各人说各人的。',
    },
    {
      speaker: '陆景川',
      script:
        '程予安，你随林晚星下酒窖这段全场都知道——最后一环：19:41 到 20:00 你还做过什么？接着往下说。',
    },
  ],
}

const DISCUSS1_WAV_URLS = import.meta.glob<string>(
  '../../../../../剧本杀/《雨夜归零》/公开讨论1/**/*.wav',
  { eager: true, query: '?url', import: 'default' },
)

/** `公开讨论1/玩家{身份}/{说话人}.wav` 或 `{说话人}1.wav`、`{说话人}2.wav` … */
function buildDiscuss1FolderFileIndex(): Map<string, Map<string, string>> {
  const byFolder = new Map<string, Map<string, string>>()
  for (const [path, url] of Object.entries(DISCUSS1_WAV_URLS)) {
    const normalized = path.replace(/\\/g, '/')
    const marker = '/公开讨论1/'
    const idx = normalized.indexOf(marker)
    if (idx < 0) continue
    const rest = normalized.slice(idx + marker.length)
    const slash = rest.indexOf('/')
    if (slash < 0) continue
    const folder = rest.slice(0, slash)
    const filename = rest.slice(slash + 1)
    if (!filename.endsWith('.wav')) continue
    let files = byFolder.get(folder)
    if (!files) {
      files = new Map()
      byFolder.set(folder, files)
    }
    files.set(filename, url)
  }
  return byFolder
}

const DISCUSS1_FOLDER_FILES = buildDiscuss1FolderFileIndex()

function resolveDiscuss1WavUrl(
  playerRole: Discuss1PlayerRole,
  lineIndex: number,
  speaker: string,
): string {
  const folder = `玩家${playerRole}`
  const files = DISCUSS1_FOLDER_FILES.get(folder)
  if (!files) return ''

  const scene = DISCUSS1_SCENES[playerRole]
  let occurrence = 0
  for (let i = 0; i <= lineIndex; i += 1) {
    if (scene[i]?.speaker === speaker) occurrence += 1
  }

  const candidates: string[] = []
  if (occurrence <= 1) {
    candidates.push(`${speaker}.wav`, `${speaker}1.wav`)
  } else {
    candidates.push(`${speaker}${occurrence}.wav`)
  }
  candidates.push(`${String(lineIndex + 1).padStart(2, '0')}-${speaker}.wav`)

  for (const name of candidates) {
    const url = files.get(name)
    if (url) return url
  }
  return ''
}

function isDiscuss1PlayerRole(role: string): role is Discuss1PlayerRole {
  return (PLAYER_ROLES as readonly string[]).includes(role)
}

export function getYuyeDiscuss1OpeningTracks(playerRoleName: string): DiscussOpeningTrack[] {
  if (!isDiscuss1PlayerRole(playerRoleName)) return []
  const lines = DISCUSS1_SCENES[playerRoleName]
  return lines.map((line, index) => ({
    url: resolveDiscuss1WavUrl(playerRoleName, index, line.speaker),
    script: line.script,
    speaker: { role: line.speaker },
    isPlayerCue: index === lines.length - 1,
  }))
}

export const DISCUSS1_OPENING_SYSTEM_BRIEF =
  '第一轮公开讨论 · 对质时间线、解释离席、提出怀疑；可隐瞒隐私，不得编造与已公开线索冲突的物证。'

export const DISCUSS1_OPENING_SYSTEM_READY =
  '讨论开场白已结束。请在下方输入框自由发言，与其他角色对质。'
