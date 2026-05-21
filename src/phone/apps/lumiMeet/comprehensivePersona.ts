import { normalizeBirthdayMD, zodiacZhFromStoredMD } from '../wechat/newFriendsPersona/characterProfilePhysioUtils'
import type { Gender } from '../wechat/newFriendsPersona/types'
import { daysInMonth, formatMD, randomChineseName } from '../wechat/newFriendsPersona/utils'
import type { MeetMbtiFourLetter } from './meetPersonaPrompt'
import { MEET_MBTI_SIXTEEN } from './meetPersonaPrompt'

/**
 * 遇见 · 九维立体人格（Comprehensive Persona）
 * 用于匹配生成、档案弹窗展示、同步至档案法则（世界书）。
 */

export interface ComprehensivePersona {
  base: {
    info: string
    physiology: string
    /** 真实姓名（对标微信人设中的姓名字段；界面主标题用顶层 nickname 网名） */
    realName: string
    /** 生日月日，与微信一致 `MM-DD` */
    birthdayMD: string
    /** 体重（千克），字符串与微信基础信息一致 */
    weightKg: string
    /** 身高（厘米），纯数字字符串；与微信资料 height 一致 */
    heightCm: string
    /** 中文星座，可与生日互推 */
    zodiac: string
    /** 微信「个性签名」式极短文案（写入世界书分册与同步人设） */
    wechatSignature: string
  }
  core: { mbti: string; surface: string; trueSelf: string; values: string; flaws: string }
  psyche: {
    background: string
    shadow: string
    emotionalPattern: string
    /** 性取向叙事：如何形成、是否与自我认同有过拉扯（须与顶层卡片 orientation 一致） */
    orientationOrigin: string
  }
  abilities: { skills: string; hobbies: string; socialMode: string }
  fetish: { preference: string; sensory: string; dynamic: string; jealousy: string }
  relations: { family: string; friends: string; enemies: string }
  contrast: { beforeLove: string; afterLove: string; conflict: string }
  daily: { speech: string; habits: string; money: string; quirks: string }
  arc: { secrets: string; goal: string; contrastMoe: string }
}

function pickStr(v: unknown, maxLen: number, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const t = v.trim()
  if (!t) return fallback
  return t.length > maxLen ? t.slice(0, maxLen) : t
}

function readNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

const PLACEHOLDER = '（档案待补全）'

export function isMeetProfilePlaceholder(s: string | undefined | null): boolean {
  const t = String(s ?? '').trim()
  return !t || t === PLACEHOLDER
}

/** 从 base.info 首句 "xx 岁" 解析年龄（模型兜底） */
export function parseMeetAgeYearsFromInfo(info: string): number | undefined {
  const m = /^(\d{1,2})\s*岁/u.exec(String(info ?? '').trim())
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 16 && n <= 99 ? n : undefined
}

function hashSeedString(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 1000003
  return h
}

function pickOfflineBirthdayMDFromSeed(seed: string): string {
  const h = hashSeedString(seed)
  const month = 1 + (h % 12)
  const dim = daysInMonth(month)
  const day = 1 + (Math.floor(h / 12) % dim)
  return formatMD(month, day)
}

function pickOfflineWeightKgFromSeed(seed: string): string {
  const h = hashSeedString(`${seed}:kg`)
  return String(45 + (h % 34))
}

/** 体重缺省或占位时，用稳定 seed 生成千克数字字符串（与离线邂逅一致） */
export function ensureMeetWeightKgValue(weightKg: string, seed: string): string {
  const t = String(weightKg ?? '').trim()
  if (!isMeetProfilePlaceholder(t)) return t
  return pickOfflineWeightKgFromSeed(seed)
}

function pickOfflineHeightCmFromSeed(seed: string): string {
  const h = hashSeedString(`${seed}:cm`)
  return String(158 + (h % 28))
}

/** 身高缺省或非法时，用稳定 seed 生成厘米数字串 */
export function ensureMeetHeightCmValue(heightCm: string, seed: string): string {
  const raw = String(heightCm ?? '').trim()
  if (!raw || isMeetProfilePlaceholder(raw)) return pickOfflineHeightCmFromSeed(seed)
  const digits = raw.replace(/\D/g, '')
  if (!digits) return pickOfflineHeightCmFromSeed(seed)
  const n = parseInt(digits, 10)
  if (!Number.isFinite(n) || n < 120 || n > 230) return pickOfflineHeightCmFromSeed(seed)
  return String(n)
}

/** 从九维 skills 摘一句作职业/身份展示 */
export function deriveMeetOccupationLabel(skills: string): string {
  const t = String(skills ?? '').trim()
  if (!t || t === PLACEHOLDER) return ''
  const line = (t.split(/[。；;\n]/)[0] ?? t).trim()
  return line.slice(0, 32)
}

/** 座右铭缺省：动机/三观短句 */
export function deriveMeetMottoFromPersona(p: ComprehensivePersona): string {
  const g = p.arc.goal?.trim()
  if (g && g !== PLACEHOLDER) return g.length > 44 ? `${g.slice(0, 44)}…` : g
  const v = p.core.values?.trim()
  if (v && v !== PLACEHOLDER) return v.length > 40 ? `${v.slice(0, 40)}…` : v
  return '走慢一点，也认真一点。'
}

/** 个性签名缺省：从外显/体征摘一句，避免世界书与微信签名为空 */
export function deriveMeetWechatSignatureFromPersona(p: ComprehensivePersona): string {
  const fromSurface = p.core.surface?.trim().slice(0, 44)
  if (fromSurface) return `${fromSurface}…`
  const fromInfo = p.base.info?.trim().slice(0, 44)
  if (fromInfo) return `${fromInfo}…`
  return '随缘回；忙完会看消息。'
}

function mapMeetGenderLabelToCharacterGender(g: string): Gender {
  if (g.includes('女')) return 'female'
  if (g.includes('男')) return 'male'
  return 'other'
}

/**
 * 恋爱向客观条目（fetish / contrast）：世界书固定陈述，不用 {{user}}，避免模型误以为开局即针对当前滑动用户。
 */
export function rewriteLoveBlocksUserPlaceholder(s: string): string {
  return String(s ?? '').replace(/\{\{user\}\}/gi, '对方')
}

/** MBTI 行：去掉消解质感的口语，旧存档读入时也会修正 */
export function sanitizeMeetCoreMbtiTone(s: string): string {
  let t = String(s ?? '')
  t = t.replace(/（\s*自测闹着玩\s*）/g, '')
  t = t.replace(/自测闹着玩/g, '')
  t = t.replace(/（\s*闹着玩\s*）/g, '')
  t = t.replace(/闹着玩/g, '')
  return t.replace(/\s{2,}/g, ' ').replace(/。{2,}/g, '。').trim()
}

/** 界面展示：只显示十六型四字母（从模型长句或离线模板中解析）；无法识别时显示「—」 */
export function formatMeetMbtiLettersForUi(raw: string): string {
  const t = sanitizeMeetCoreMbtiTone(String(raw ?? ''))
  if (!t || t === PLACEHOLDER) return '—'
  const re = new RegExp(`\\b(${MEET_MBTI_SIXTEEN.join('|')})\\b`, 'i')
  const m = t.match(re)
  return m ? m[1]!.toUpperCase() : '—'
}

/** 世界书 / 档案法则：恋爱向客观条目统一去掉 {{user}}，旧数据经此读时也会修正 */
export function sanitizeLoveBlocksForStaticLore(p: ComprehensivePersona): ComprehensivePersona {
  const rw = rewriteLoveBlocksUserPlaceholder
  return {
    ...p,
    fetish: {
      preference: rw(p.fetish.preference),
      sensory: rw(p.fetish.sensory),
      dynamic: rw(p.fetish.dynamic),
      jealousy: rw(p.fetish.jealousy),
    },
    contrast: {
      beforeLove: rw(p.contrast.beforeLove),
      afterLove: rw(p.contrast.afterLove),
      conflict: rw(p.contrast.conflict),
    },
  }
}

/** 从模型 JSON 归一化为完整九维对象；缺字段时用占位，避免 UI 崩溃。 */
export function normalizeComprehensivePersona(raw: unknown): ComprehensivePersona {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const g = (p: string[]) => readNested(o, p)
  const lv = (v: unknown, max: number) => rewriteLoveBlocksUserPlaceholder(pickStr(v, max, PLACEHOLDER))

  const birthdayRaw = pickStr(g(['base', 'birthdayMD']), 8, '01-01')
  const birthdayMD = normalizeBirthdayMD(birthdayRaw.includes('-') ? birthdayRaw : '01-01')
  let zodiac = pickStr(g(['base', 'zodiac']), 24, '').trim()
  if (!zodiac || zodiac === PLACEHOLDER) zodiac = zodiacZhFromStoredMD(birthdayMD)

  return {
    base: {
      info: pickStr(g(['base', 'info']), 1200, PLACEHOLDER),
      physiology: pickStr(g(['base', 'physiology']), 1200, PLACEHOLDER),
      realName: pickStr(g(['base', 'realName']), 24, PLACEHOLDER),
      birthdayMD,
      weightKg: pickStr(g(['base', 'weightKg']), 12, PLACEHOLDER),
      heightCm: pickStr(g(['base', 'heightCm']), 8, PLACEHOLDER),
      zodiac,
      wechatSignature: pickStr(g(['base', 'wechatSignature']), 120, PLACEHOLDER),
    },
    core: {
      mbti: sanitizeMeetCoreMbtiTone(pickStr(g(['core', 'mbti']), 80, PLACEHOLDER)),
      surface: pickStr(g(['core', 'surface']), 1200, PLACEHOLDER),
      trueSelf: pickStr(g(['core', 'trueSelf']), 1200, PLACEHOLDER),
      values: pickStr(g(['core', 'values']), 1200, PLACEHOLDER),
      flaws: pickStr(g(['core', 'flaws']), 1200, PLACEHOLDER),
    },
    psyche: {
      background: pickStr(g(['psyche', 'background']), 1400, PLACEHOLDER),
      shadow: pickStr(g(['psyche', 'shadow']), 1200, PLACEHOLDER),
      emotionalPattern: pickStr(g(['psyche', 'emotionalPattern']), 1200, PLACEHOLDER),
      orientationOrigin: pickStr(g(['psyche', 'orientationOrigin']), 1400, PLACEHOLDER),
    },
    abilities: {
      skills: pickStr(g(['abilities', 'skills']), 1000, PLACEHOLDER),
      hobbies: pickStr(g(['abilities', 'hobbies']), 1000, PLACEHOLDER),
      socialMode: pickStr(g(['abilities', 'socialMode']), 1000, PLACEHOLDER),
    },
    fetish: {
      preference: lv(g(['fetish', 'preference']), 1200),
      sensory: lv(g(['fetish', 'sensory']), 1000),
      dynamic: lv(g(['fetish', 'dynamic']), 1000),
      jealousy: lv(g(['fetish', 'jealousy']), 1000),
    },
    relations: {
      family: pickStr(g(['relations', 'family']), 1000, PLACEHOLDER),
      friends: pickStr(g(['relations', 'friends']), 1000, PLACEHOLDER),
      enemies: pickStr(g(['relations', 'enemies']), 1000, PLACEHOLDER),
    },
    contrast: {
      beforeLove: lv(g(['contrast', 'beforeLove']), 1200),
      afterLove: lv(g(['contrast', 'afterLove']), 1200),
      conflict: lv(g(['contrast', 'conflict']), 1200),
    },
    daily: {
      speech: pickStr(g(['daily', 'speech']), 1000, PLACEHOLDER),
      habits: pickStr(g(['daily', 'habits']), 1000, PLACEHOLDER),
      money: pickStr(g(['daily', 'money']), 800, PLACEHOLDER),
      quirks: pickStr(g(['daily', 'quirks']), 1000, PLACEHOLDER),
    },
    arc: {
      secrets: pickStr(g(['arc', 'secrets']), 1200, PLACEHOLDER),
      goal: pickStr(g(['arc', 'goal']), 1000, PLACEHOLDER),
      contrastMoe: pickStr(g(['arc', 'contrastMoe']), 1000, PLACEHOLDER),
    },
  }
}

/** 列表/卡片用短摘要（非九维全文） */
export function buildPersonaSummaryFromComprehensive(p: ComprehensivePersona): string {
  const a = p.base.info.slice(0, 120)
  const b = p.core.surface.slice(0, 100)
  const c = p.core.flaws.slice(0, 80)
  const raw = [a, b, c].filter((x) => x && x !== PLACEHOLDER).join(' ').trim()
  if (!raw) return PLACEHOLDER
  // 与九维 worldbook / persona 电梯句一致：兜底摘要须带字面量 {{char}}，便于列表展开与模型收束
  if (!raw.includes('{{char}}')) {
    return `{{char}}给人的侧写：${raw.slice(0, 220)}。旁人眼里的{{char}}也与此气质相合。`.slice(0, 320)
  }
  return raw.slice(0, 320)
}

function pickOfflineOrientationOrigin(seed: string, orientationTag: string): string {
  const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const homo = [
    '{{char}}对自己的吸引力朝向心里有数得很早：青春期时就察觉心跳更容易落在同性身上，后面陆陆续续印证过几次，不再自我怀疑。家里从没摊开聊过取向，{{char}}也不觉得非要开会表决才算成立——认同这件事，本来就只属于自己。',
    '曾有过一两段朦胧的错位：以为自己喜欢的是某种 "类型"，后来在一段坦诚的关系里才看清，自己在意的从来都是同性身上的那种温柔与锋利。此后{{char}}不再急着向别人解释，只听自己的分寸。',
    '{{char}}走过一点弯路：试过迎合外界的剧本，结果发现演戏比坦诚更累。某次分手后在夜里走了很长一段路，把那些含糊的好感一件件对上号，才承认那条线一直都指向同性——谈不上壮烈，只是终于不想骗自己。',
  ]
  const hetero = [
    '{{char}}从没觉得自己在取向上 "特别折腾"：从小到大暧昧与心动基本都落在异性身上，偶尔也会对某个人模糊的好感愣一下神，但最后仍会落回熟悉的引力里。若要追问由来，大概就是生来如此，外加这些年约会里一次次印证罢了。',
    '学生时代也喜欢过同性朋友的那种漂亮与锋利，但更像是欣赏与羡慕掺在一起；真正让身体绷紧、忍不住想靠近的，始终是另一种轮廓。{{char}}后来把这种分辨归类为 "对自己的诚实"，而不是贴在额头上给谁检验。',
    '青春期跟风试过 "显得酷一点" 的传言，结果发现完全不来电；反倒是一次极其平淡的邂逅让{{char}}确认了自己更想在漫长相处里依赖的那一侧——取向于{{char}}而言，不是宣言，而是无数次微小选择的总和。',
  ]
  const biPan = [
    '{{char}}对自己的取向从来不追求一句话钉死：心动既来过异性也曾落在同性身上，比起站队，{{char}}更在意对方这个人能不能接住自己的节奏。也有过偏见与误会，慢慢学会在外界噪音里只听身体的诚实——那不是摇摆，是宽度。',
    '谈过两段反差很大的关系之后，{{char}}才停止逼自己在标签之间二选一：有些人天生就更在意 "是谁"，而不是 "哪一类"。{{char}}把这种暧昧说得坦白——不喜欢被质问 "你到底站哪边"，因为{{char}}要的不是阵营，是合拍。',
    '{{char}}年轻时以为必须尽快 "定型"，后来在一次次笨拙的尝试里发现，吸引自己的从来不是抽象的类型，而是具体的体温与脾气。于是对外只说 "双" 或干脆不提——取向的由来，就是一路走来允许自己不必一口气写完结论。',
  ]
  const aceSpectrum = [
    '{{char}}对「性吸引」这件事一直淡淡的：不是道德清高，就是身体和情绪都对不上那种热播剧里的一见钟情。也更愿意把精力花在具体的生活上——工作、朋友、自己的睡眠。若要把取向说清楚，{{char}}更认同无性恋谱系：可以亲密，但不该被误解成 "装" 或 "没试过"。',
    '别人聊初恋脸红，{{char}}常常只能礼貌地点头。不是冷漠，而是{{char}}的感官开关本来就不按大众脚本亮灯。慢慢学着用灰色无性、性吸引弱这些词描述自己，反而松了口气——终于不用再硬演心动。',
    '{{char}}承认自己对肉体刺激反应很钝：接吻会紧张多于兴奋，但友情、信任、被理解的满足感反而很强烈。对{{char}}来说，取向不是 "有没有爱"，而是身体这本字典里，哪些页本来就空白。',
  ]
  const aroSpectrum = [
    '{{char}}很早就分清：想要陪伴、想要被懂，和「按社会时钟谈恋爱」不是一回事。对浪漫仪式的腻味、对暧昧推拉的不耐烦，慢慢让{{char}}靠近无浪漫倾向这一侧——朋友以上的羁绊{{char}}很珍惜，但不一定要套上恋人的名分。',
    '{{char}}不是不会喜欢一个人，而是那种喜欢很少长成玫瑰蜡烛的模样，更像长时间并排走路。{{char}}对自己无浪漫谱系的认同是慢慢来的一件事：先允许自己不必为了合群去演心跳。',
    '有过几次暧昧试探，{{char}}都在对方要升级关系时下意识喊停——不是挑剔，而是{{char}}的舒适区压根不在约会脚本里。后来才知道这叫无浪漫谱系：{{char}}更愿意用合伙、知己、同行者来形容重要的人。',
  ]
  const demiSpectrum = [
    '{{char}}的吸引像慢炖：先要聊得来、信得过，身体的线才会一点点搭起来。半性恋/半浪漫对{{char}}不是矫情，而是诚实——宁可错过快餐式暧昧，也不想对不起自己的身体节奏。',
    '别人一见钟情，{{char}}常常要到第四次第五次见面才突然意识到「咦，我好像有点在意 TA」。这种滞后把{{char}}吓跑过几次；慢慢接受这是自己的默认值就好了。',
    '{{char}}认同「情感连结先于性/浪漫吸引」：先成为同类，再谈更进一步。职场和社交里{{char}}反而放松，因为边界清楚；真正让{{char}}紧张的，反而是还没混熟就被推上暧昧牌桌。',
  ]
  const queerFluid = [
    '{{char}}厌恶被钉死在某个字母缩写里：今年更向往稳定，明年又可能对另一种关系想象蠢蠢欲动。酷儿/流动对{{char}}而言是给自己留白——身份不欠任何人一张一次性答案。',
    '有过直过弯过双过的自我叙述反复，{{char}}不再急着落款。与其说「探索中」是摇摆，不如说{{char}}把诚实排在体面前面：承认欲望与情感路线图会改写，并不等于放荡或不负责。',
    '{{char}}对外常用泛称应付表格与亲戚，心里却更认同酷儿社群那句「标签是贴纸不是棺材钉」。流动不是抓不准，而是允许人生有不同季节的引力。',
  ]
  const polyOpen = [
    '{{char}}不把「一对一至死」当成唯一道德模板：更在意知情同意、时间管理与说不的权利。开放关系/多边在{{char}}字典里不是乱，而是把账算在桌面上，把嫉妒摊开来谈的那种成年人的难但值得。',
    '经历过传统关系的窒息感之后，{{char}}开始读 ENM（道德非一夫一妻）的材料，不是为了猎奇，而是想弄清自己到底需要多少占有才安心。{{char}}认同：爱可以扩容，但欺骗不行。',
    '{{char}}对多边保持审慎乐观：喜欢清晰的规则、定期的复盘、以及兜底的好友圈。{{char}}相信「更多连接」不该等于「更少尊重」——合意前，宁可慢一点。',
  ]
  const t = orientationTag.trim()
  let pool: readonly string[]
  if (t.includes('无性') || /ace/i.test(t)) pool = aceSpectrum
  else if (t.includes('无浪漫') || t.includes('无恋') || /aro/i.test(t)) pool = aroSpectrum
  else if (t.includes('半性') || t.includes('半浪漫') || /demi/i.test(t)) pool = demiSpectrum
  else if (t.includes('酷儿') || t.includes('流动') || t.includes('探索')) pool = queerFluid
  else if (t.includes('多边') || t.includes('开放关系') || t.includes('合意') || /poly|enm/i.test(t)) pool = polyOpen
  else if (t.includes('同性') || t.includes('同性恋') || t.includes('女同') || t.includes('男同')) pool = homo
  else if (t.includes('双') || t.includes('泛') || t === 'bi') pool = biPan
  else pool = hetero
  return pool[h % pool.length]!
}

export function buildOfflineComprehensivePersona(
  seed: string,
  mbtiRoll?: MeetMbtiFourLetter,
  orientationTag = '双性恋',
  genderLabel = '男',
): ComprehensivePersona {
  const tone = seed.length % 2 === 0 ? '话不多、看着冷' : '看着温和其实绕弯'
  /** 职业与 MBTI 完全脱钩：岗位只由 seed 决定，mbti 行由另一路哈希决定 */
  const jobPack = [
    {
      base: '{{char}}在小区门口的连锁便利店上夜班，理货、收银、临期盘点都得自己来',
      skills: '夜班容易犯困就靠 checklist 一项项勾；和早班同事交接班只报数字不多聊私事。',
    },
    {
      base: '{{char}}在街道办事大厅做窗口岗，材料不齐会一遍遍讲清楚，最怕群众排队吵架',
      skills: '同样的话一天说几十遍也不甩脸子；系统卡了就手写条子先让人别干等。',
    },
    {
      base: '{{char}}在幼儿园带中班，孩子摔了蹭了家长电话一来就得赔笑脸',
      skills: '课上用儿歌控场，放学写家园联系本；加班开会多半是为了迎检材料。',
    },
    {
      base: '{{char}}在一家十几人的小公司做出纳兼行政，工资表、发票、订桶装水都归{{char}}',
      skills: 'Excel 表格锁得死死的；老板临时要数字，五分钟能拉出上个月的流水。',
    },
    {
      base: '{{char}}在商场一楼做化妆品专柜导购，站柜八小时脚肿是常态',
      skills: '看人进门三秒内判断要不要跟；月底冲业绩会悄悄算提成从不跟同事明说。',
    },
    {
      base: '{{char}}在住宅小区物业做客服管家，业主群消息从早响到晚',
      skills: '漏水电梯灯坏了先安抚再派单；遇到难缠的会录音留痕，省得背锅。',
    },
    {
      base: '{{char}}开网约车，平台规则改来改去，只能自己琢磨怎么少空跑',
      skills: '早高峰不爱抢单太远的；车里备湿巾和垃圾袋，差评能躲就躲。',
    },
    {
      base: '{{char}}在连锁火锅店做前厅领班，翻台、叫号、处理客诉全压在{{char}}身上',
      skills: '高峰期嗓门会不自觉变大；打烊后清点酒水对不上数要自己先复盘一遍。',
    },
    {
      base: '{{char}}在快递网点做分拣称重，旺季凌晨四点就得开工',
      skills: '扫码手速练出来了；和同事换班靠口头约定，记在手机备忘录里。',
    },
    {
      base: '{{char}}在写字楼里的小公司做文员，打印、贴票、订会议室是日常',
      skills: '会议纪要写得快但不爱在会上抢话；老板临时改行程，五分钟能改好三版行程表。',
    },
    {
      base: '{{char}}在连锁药店做店员，盘点、效期、医保刷码出错都得自己盯',
      skills: '老年人问药会多解释两句；遇到只逛不买的也不会摆脸色。',
    },
    {
      base: '{{char}}做社区网格员，入户登记、反诈宣传、调解邻里噪音都归{{char}}跑',
      skills: '包里常备胶带和创可贴；和辖区派出所对接材料能一次备齐不让人多跑。',
    },
    {
      base: '{{char}}在早餐店后厨和面、蒸包子，凌晨三点就得到店',
      skills: '手上烫过几次就学会用抹布垫着端笼；老板少算工时会先忍，月底再一起算。',
    },
    {
      base: '{{char}}在电话客服中心接热线，话术本翻烂了，真正难的是情绪激动的用户',
      skills: '耳机一戴四小时不摘；被骂完按流程写工单，下班路上才慢慢消化。',
    },
    {
      base: '{{char}}在上市地产集团挂名副总，实际盯拍地、融资和区域回款，酒局能推就推',
      skills: '看报表先看现金流；对乙方合同里 "连带责任" 四个字过敏，必让人改完再签。',
    },
    {
      base: '{{char}}是私募基金合伙人，路演见投资人比见朋友还多',
      skills: '尽调材料自己过一遍才放心；被问 "今年策略" 时习惯先反问对方风险偏好。',
    },
    {
      base: '{{char}}在红圈所做低年级律师，主攻离婚与财产分割，当事人情绪比法条难缠',
      skills: '证据链整理成时间轴给法官看；调解室里先听双方骂完再给台阶下。',
    },
    {
      base: '{{char}}在心内科当主治，夜班查房脚步声都放轻，怕吵醒走廊加床的病人',
      skills: '心电图扫一眼能先筛危急值；家属追问 "严不严重" 会先讲可观察指标再安慰。',
    },
    {
      base: '{{char}}在建筑事务所做方案主创，投标前改模型改到保安都来催关灯',
      skills: '跟结构对图能吵一小时但对完会请喝奶茶；工地巡场必戴安全帽，怕甲方拍照。',
    },
    {
      base: '{{char}}是品牌方市场总监，大促前直播脚本、达人报价、投放ROI全压在{{char}}桌上',
      skills: '开会只带一页纸结论；数据对不上时先查埋点再找人，不先甩锅。',
    },
    {
      base: '{{char}}在家接商稿的自由插画师，截稿日前客厅就是战场',
      skills: '甲方说 "再大气一点" 会追问三个参考形容词；收款链接发得比成稿还准时。',
    },
    {
      base: '{{char}}写网文连载，评论区催更比编辑还凶，照样要按大纲填坑',
      skills: '卡文就去楼下快走两圈；人物小传写在便签墙上，怕写崩人设。',
    },
    {
      base: '{{char}}在Livehouse驻唱，白天睡觉晚上调音，经纪人只负责排期不管情绪',
      skills: '试麦时自己听返送；台下起哄会笑一下但不接油腻点歌。',
    },
    {
      base: '{{char}}带两名十八线艺人的执行经纪，行程、妆发、舆情截图全在{{char}}手机里',
      skills: '艺人闹脾气先递水再谈合同；热搜苗头不对会先让艺人关评论缓一缓。',
    },
    {
      base: '{{char}}在市局刑警队一线，出任务前习惯把手机交给内勤保管',
      skills: '笔录里时间地点人物抠字眼；回家不说案子细节，只说是 "加班"。',
    },
    {
      base: '{{char}}在消防站当中队长，训练完制服汗碱一圈，演习复盘比谁都凶',
      skills: '拉练回来装备一件件查扣；新兵怕高就陪着爬第二次，不骂人只计时。',
    },
    {
      base: '{{char}}在区法院民庭做法官助理，调解书和判决书格式闭着眼都能排',
      skills: '当事人拍桌子时先倒水；给法官准备的争议焦点摘要一页纸以内。',
    },
    {
      base: '{{char}}在市立医院司法鉴定所做法医，出勘现场鞋套永远多带一包',
      skills: '报告只写可复核事实；面对家属追问 "他痛苦吗" 会停顿再找措辞。',
    },
    {
      base: '{{char}}开心理咨询工作室，来访者迟到十分钟也会留足五十分钟',
      skills: '首访只做评估不急着 "给办法"；写记录用代号，纸质档案锁铁皮柜。',
    },
    {
      base: '{{char}}在拍卖行做书画鉴定助理，放大镜和侧光台灯是工位标配',
      skills: '看纸墨先问流传；不确定的款识宁可写 "存疑" 也不硬断代。',
    },
    {
      base: '{{char}}是货运航线的副驾驶，航前检查单逐项打勾，少一项都不签字',
      skills: '颠簸时广播声音反而更平；落地后不爱聊 "今天多险"，只写飞行日志。',
    },
    {
      base: '{{char}}在老街口开了家小咖啡馆，豆子自己烘，熟客杯型都记得',
      skills: '早高峰出杯靠 muscle memory；打烊盘点差一杯奶会查监控而不是骂员工。',
    },
    {
      base: '{{char}}做自媒体工作室，脚本、剪辑、商务对接三个人里{{char}}占两样',
      skills: '爆款标题 A/B 测完再发；合同里 "独家" 二字会划掉重谈。',
    },
    {
      base: '{{char}}名片上写着中学语文老师，周末却在天使轮路演场合帮家里看项目',
      skills: '上课从不带家族企业话题；见投资人只谈数据和条款，不谈 "我爸是谁"。',
    },
    {
      base: '{{char}}是本土科技公司的联合创始人兼 CEO，产品迭代会跟到深夜，对外路演却不爱煽情',
      skills: '周会先看留存曲线再问故事；融资条款里对赌会拉法务逐条拆给团队听。',
    },
    {
      base: '{{char}}靠一部网剧爆成流量演员，现在挑本子比挑对象还谨慎',
      skills: '台词本贴满荧光贴；狗仔跟车时先让司机绕两圈再下车，习惯了。',
    },
    {
      base: '{{char}}在省博文物修复室做纸质文物修复，毛笔、浆糊、纤维显微镜是日常三件套',
      skills: '补纸必找同年代纸样；色差零点五档也要调，急单不接。',
    },
    {
      base: '{{char}}签在俱乐部打职业电竞，训练赛复盘能吵到凌晨，上场前却一句话不说',
      skills: '版本更新当晚必通宵排位；手伤贴肌贴照打，队医骂也没用。',
    },
    {
      base: '{{char}}做同传翻译，国际会议箱子里永远多一套领夹麦电池',
      skills: '术语表提前三天背；speaker 加速时手势会下意识跟着稳节奏。',
    },
  ] as const
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % 997
  const ji = h % jobPack.length
  const mbtiType = mbtiRoll ?? MEET_MBTI_SIXTEEN[(h * 31 + 5) % MEET_MBTI_SIXTEEN.length]!
  const { base: jobLine, skills: skillsLine } = jobPack[ji]!
  const mbtiLine = `${mbtiType} 倾向。与职业无对应关系；仅作人格侧写，不作优劣评判。`
  const vitalsBirth = normalizeBirthdayMD(pickOfflineBirthdayMDFromSeed(seed))
  const vitalsZodiac = zodiacZhFromStoredMD(vitalsBirth)
  const vitalsName = randomChineseName(mapMeetGenderLabelToCharacterGender(genderLabel))
  const vitalsWeight = pickOfflineWeightKgFromSeed(seed)
  return normalizeComprehensivePersona({
    base: {
      info: `${jobLine}。平时两点一线，看着${tone}；穿衣偏简约不爱花哨；在人多的地方不爱抢话，但会偷偷瞄一眼谁在说什么。`,
      physiology: `站着的时候肩膀有点收着；一紧张就摸手腕上的小东西；跟人眼神对上会很快挪开，但其实记住了对方表情。`,
      realName: vitalsName,
      birthdayMD: vitalsBirth,
      weightKg: vitalsWeight,
      heightCm: pickOfflineHeightCmFromSeed(seed),
      zodiac: vitalsZodiac,
      wechatSignature: (() => {
        const sigs = [
          '回消息看心情，急事请直说。',
          '周末更常在；工作日随缘。',
          '看见就回，没回就是在忙。',
          '慢热，熟了会好聊很多。',
        ]
        return sigs[h % sigs.length]!
      })(),
    },
    core: {
      mbti: mbtiLine,
      surface: `对外客气，边界很清楚；不想聊的就一句 "先这样吧" 带过。`,
      trueSelf: `心里要求高，讨厌被人情绪绑架；也想有人懂自己，但嘴上绝不撒娇认输。`,
      values: `看重靠谱和诚实，最最受不了说谎和油腻搭讪。`,
      flaws: `容易冷战、自尊心太强；一有压力就先往后缩，把自己关起来。`,
    },
    psyche: {
      background: `小时候家里总夸 "懂事"，{{char}}早早学会看人脸色。`,
      shadow: `怕失控、怕被看穿；一慌就用冷淡把真心盖起来。`,
      emotionalPattern: `真生气了反而不吵，就闷着；又会忍不住偷看对方有没有发现不对劲。`,
      orientationOrigin: pickOfflineOrientationOrigin(seed, orientationTag),
    },
    abilities: {
      skills: skillsLine,
      hobbies: `夜里听歌、随便走走、偶尔看部冷门片打发时间。`,
      socialMode: `朋友不多，有几个真能互相兜底；饭局应付得来但不想频聚。`,
    },
    fetish: {
      preference: `喜欢被尊重地靠近，讨厌被人当众试探底线。`,
      sensory: `对气味和声音挺敏感，腻人的甜香会直接皱眉。`,
      dynamic: `谈恋爱也需要 "喘口气" 的空间，不喜欢被盯死。`,
      jealousy: `吃醋不太会直接问，语气变冷、信息回得慢，其实心里酸得要命。`,
    },
    relations: {
      family: `跟家里联系不算密，该尽的责还是会尽，烦心事不爱跟爸妈讲。`,
      friends: `真心朋友很少，但遇事真能站出来；最烦被拉去尬聊局。`,
      enemies: `职场上遇到过抢功的同事，{{char}}表面客气，之后合作会多留一手文书；生活里不爱撕破脸，真闹掰了就慢慢疏远。`,
    },
    contrast: {
      beforeLove: `恋爱前像隔着一层玻璃，暧昧来了也会当成干扰。`,
      afterLove: `谈起恋爱反而黏，占有欲偷偷冒出来；对对方容易吃醋又不好意思明说。`,
      conflict: `吵完要先自己冷静一会儿；和好更看重对方做了什么，而不是嘴上多甜。`,
    },
    daily: {
      speech: `嘴边挂的多是 "嗯"、"我想想"、"先这样"。`,
      habits: `东西爱摆整齐；睡前一定要把桌面收拾一遍才睡得着。`,
      money: `花钱不算大手大脚，愿意为用得久的东西多花一点，不为面子硬撑。`,
      quirks: `对某些数字或小迷信有点较真，自己也挺无奈的。`,
    },
    arc: {
      secrets: `嘴上说 "无所谓" 的时候，十有八九是在赌气。`,
      goal: `就想有一个人能稳稳接住自己，而不是凑一堆人围观。`,
      contrastMoe: `嘴上硬、心里软；被戳中了会别过脸装作没事。`,
    },
  })
}
