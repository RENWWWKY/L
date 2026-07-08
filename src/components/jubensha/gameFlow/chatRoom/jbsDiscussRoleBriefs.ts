import type { PublicDiscussRound, YuyePlayerRole } from './jbsPublicDiscuss'
import { getYuyeActCommissionData, type YuyeActId } from '../yuyeRoleScriptText'

type RoleBrief = {
  identity: string
  /** 剧本任务未解析时的兜底发言方向 */
  discussDirection: string
  secrets: string
}

const ROUND_TO_ACT: Record<PublicDiscussRound, YuyeActId> = {
  1: 'act1',
  2: 'act2',
  3: 'act3',
}

const YUYE_ROLE_BRIEFS: Record<YuyePlayerRole, RoleBrief> = {
  陆景川: {
    identity: '归零科技联合创始人 / CTO，男，31 岁，话少、压力下更硬。',
    discussDirection:
      '第一幕讨论宜坚称 19:45–19:50 在阳台透气；此时仍以为自己是清白的。可追问离席者与未登记酒水，不宜主动认罪或自曝酒窖。',
    secrets: '真凶，但第一幕开始时角色本人也不记得下过毒；对外必须脱罪。',
  },
  沈知意: {
    identity: '沈厚泽基金派驻代表，女，26 岁，温柔外壳、条款即刀。',
    discussDirection:
      '强调全程在席；话题引向离席者、副卡刷卡失败、未登记酒水。与陆景川的私人关系此轮不宜公开。',
    secrets: '不是凶手；不必替陆景川顶罪。',
  },
  苏晚晴: {
    identity: '归零科技品牌总监，女，28 岁，林晚星前任，克制疏离。',
    discussDirection:
      '宜为自己辩护；19:48 门外听到的动静此轮可不主动提；可引向副卡失败与陆景川离席。',
    secrets: '不是凶手；不可虚构进酒窖或碰毒瓶。',
  },
  程予安: {
    identity: '林晚星总裁助理，男，27 岁，沉默机要、忠诚。',
    discussDirection:
      '可承认随林晚星下酒窖、C杠2 未登记；尽量别主动背锅。19:41 取信此轮不可提。',
    secrets: '不是凶手；暗恋林晚星不可说。',
  },
}

const ROUND_LABEL: Record<PublicDiscussRound, string> = {
  1: '第一幕后 · 第一轮公开讨论',
  2: '第二幕后 · 第二轮公开讨论',
  3: '第三幕后 · 第三轮公开讨论',
}

const ROUND_LUJINGCHUAN_PRESSURE: Record<PublicDiscussRound, string> = {
  1: '陆景川此轮仍以为自己是清白的：被点离席/酒窖时更宜硬撑、要求物证；真凶身份不可剧透。',
  2: '陆景川此轮面对指纹与搜索记录可否认或推诿；内心可怀疑记忆空白，但仍不宜当众认罪或完整自述下毒。',
  3: '陆景川此轮私密里明白自己做了什么，对外仍宜尽力脱罪；不宜主动认罪或完整自述作案过程。',
}

const ACTING_RULES_BASE = [
  '【NPC 表演 · 旁白与台词】',
  '- action 写第三人称旁白：神态、语气、小动作（如「轻咳两声，语气仍平」「指节在桌下收紧，面上不露」）；不要写「旁白：」前缀，不要写引号。',
  '- line 只写该角色口语台词；UI 会先以**旁白气泡**展示 action，再以角色对白气泡展示 line。',
  '- 每条 line/action 可写完整自然句（10～35 字常见）；客户端按整句优先拆气泡，**总字数不变**，模型勿刻意写极短 beat。',
  '- **每条 beat 必须带 action**（最后 1 条可省略）；UI 先展示居中旁白宽条，再展示对白气泡。',
  '- 陆景川：话少、硬、指节收紧/目光不躲；沈知意：温软外壳、指尖停杯/笑意不达眼底；苏晚晴：克制疏离、端杯未饮/眉梢微挑；程予安：沉默机要、文件夹/视线落点。',
  '- 优先填写贴合情境的 action；不必每句都「心虚」，平静克制为主。',
  '',
  '【圆桌讨论 · 穿插】',
  '- beats 按时间顺序一条一句；不同 NPC 交替出现，像抢话、追问、回怼（A→B→C→B）。',
  '- 不要整段都在「回答玩家上一句」；NPC 之间互驳为主。',
  '',
  '【抗压 · 勿一戳就破】',
  '- 单次被质疑、一条线索对上时：NPC 仍宜镇定辩护、反问、转移焦点；action 以「语气平稳」「目光不躲」「端杯未饮」等为主。',
  '- 禁止：玩家刚质疑一次就在 action 里写明显露馅（心虚、慌乱、结巴、语无伦次、当场认栽），除非 transcript 显示该 NPC 已被**连续、反复**集火（同一轮讨论内至少 2～3 次针对性质疑）。',
  '- 即便出现轻微破绽，line 仍要强撑、辩解、甩锅或要求证据；不要替玩家总结、不要主动认罪（除非角色边界允许且已多轮施压）。',
].join('\n')

function formatNpcRoundTasks(role: YuyePlayerRole, round: PublicDiscussRound): string {
  const fromScript = getYuyeActCommissionData(role, ROUND_TO_ACT[round])?.tasks ?? []
  if (fromScript.length > 0) {
    return fromScript.map((t) => `  · ${t}`).join('\n')
  }
  return `  · ${YUYE_ROLE_BRIEFS[role].discussDirection}`
}

function buildActingRules(round: PublicDiscussRound): string {
  return `${ACTING_RULES_BASE}\n- ${ROUND_LUJINGCHUAN_PRESSURE[round]}`
}

export function buildNpcDirectorBriefs(
  npcRoles: YuyePlayerRole[],
  round: PublicDiscussRound,
): string {
  const lines = npcRoles.map((role) => {
    const b = YUYE_ROLE_BRIEFS[role]
    return [
      `### ${role}`,
      `- 身份：${b.identity}`,
      `- ${ROUND_LABEL[round]} · 本幕任务（该角色本人清楚，按此推进发言，勿替其他角色完成任务）：`,
      formatNpcRoundTasks(role, round),
      `- 保密（不可对全员说出）：${b.secrets}`,
    ].join('\n')
  })
  return `${lines.join('\n\n')}\n\n${buildActingRules(round)}`
}
