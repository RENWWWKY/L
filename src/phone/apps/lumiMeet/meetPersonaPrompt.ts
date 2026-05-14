/**
 * 九维人格生成：大模型 JSON 协议（与 ComprehensivePersona 对齐）
 */

import {
  MEET_ENCOUNTER_AI_AGE_AND_BIRTHDAY_RULES,
  MEET_ENCOUNTER_AI_MOTTO_STYLE_TAIL,
  NPC_AI_HEIGHT_WEIGHT_MOTTO_RULES_CORE,
} from '../wechat/newFriendsPersona/npcBasicProfileAiRules'

const MEET_NINE_DIMENSION_JSON_SCHEMA_BODY = `
你必须输出**单个 JSON 对象**（不要 Markdown 代码围栏以外的文字），顶层字段：
- nickname：2–4 字中文**社交昵称 / 网名**（用于卡片与列表主标题；语气可疏离文艺，**不要**像身份证姓名）
- realName：2–4 字中文**真实姓名**（合法生活感即可；须同时写入 comprehensive.base.realName，两处一致）
- age：整数年龄（须落在用户筛选年龄区间内；若筛选为不限则取 20–38 之间合理值）
- gender：男 / 女 / 其他
- orientation：简短取向或态度标签（须与下文 psyche.orientationOrigin 叙事一致；可写如：异性恋、同性恋、双性/泛性、无性恋谱系、无浪漫谱系、半性恋/半浪漫、酷儿/流动/探索中、开放关系或多边（诚实合意）等；拒绝对任一群体污名或猎奇化）。
- wechatId：虚构微信号，英数字下划线，8–16 位，必须以 Lm_ 开头
- mutualSpark：**布尔，必填**。在你已经写完整套人设与 comprehensive 之后，由你兼任**匹配裁判**：若本次「滑动用户」凭 user 里给出的公开资料向你生成的 NPC 表达心动、想认真认识，该 NPC 是否也会在情理与人设上**愿意接住、形成双向心动的起手**（不是婚约，只是「这一轮愿意正向回应」）。须与 persona、comprehensive 中对亲密关系与边界的态度**一致**，禁止无理由全员 true 或全员 false；禁止与 core/恋爱相关段落明显矛盾。
- persona：80–200 字第三人称电梯陈述，供列表预览（必须与 comprehensive 一致，不矛盾）
- occupation：6–28 字**职业/岗位对外称呼**（用于同步微信「职业/身份」字段），须与 comprehensive.abilities.skills 中的具体岗位一致，忌空壳头衔
- motto：8–40 字**座右铭**（偏人生态度或行事原则；**禁止**与 comprehensive.base.wechatSignature 个性签名雷同或互相复制）
- comprehensive：九维立体人格对象，结构如下（**每一叶子字段均为中文 prose，拒绝标签堆砌；写的是都市里能碰得着的正常人：有小毛病、会吃醋、会冷战，但三观正、行为合法、尊重他人边界**）：

{
  "base": {
    "info": "",
    "physiology": "",
    "realName": "",
    "birthdayMD": "MM-DD",
    "heightCm": "",
    "weightKg": "",
    "zodiac": "",
    "wechatSignature": ""
  },
  "core": { "mbti": "", "surface": "", "trueSelf": "", "values": "", "flaws": "" },
  "psyche": { "background": "", "shadow": "", "emotionalPattern": "", "orientationOrigin": "" },
  "abilities": { "skills": "", "hobbies": "", "socialMode": "" },
  "fetish": { "preference": "", "sensory": "", "dynamic": "", "jealousy": "" },
  "relations": { "family": "", "friends": "", "enemies": "" },
  "contrast": { "beforeLove": "", "afterLove": "", "conflict": "" },
  "daily": { "speech": "", "habits": "", "money": "", "quirks": "" },
  "arc": { "secrets": "", "goal": "", "contrastMoe": "" }
}

**命名刚性（须全局遵守）**：顶层 **nickname** 是对外网名（卡片/列表标题用）；**realName** 是生活用真实姓名（须与 comprehensive.base.realName 一致）。除 **daily.speech** 可作第一人称口语（可顺带提网名）、**persona** 电梯句可用一句区分「网名 vs 实名」外，**comprehensive 内凡第三人称档案叙述**（含 **base.info**、**base.physiology**、psyche、abilities 叙事、relations、contrast、arc、fetish 等）在指「本角色本人」时**一律使用真实姓名汉字**，**禁止**用 nickname 当叙事主语或当档案里的正式称呼（错误示例：「叙白在市局……」；正确：用 realName 写「戚某某在市局……」）。同事喊「小某」、患者喊「某医生」等可保留，但旁白主语仍为实名。

维度说明（生成时须落实，禁止空壳）：
一 base：**info** 写外貌体征、穿搭气质、小动作、癖好（开头用一句年龄自述 "×× 岁。"，数字须与顶层 age 完全一致；**不要**在这里用 MBTI 解释职业）。**info 与 physiology 须遵守上文「命名刚性」：第三人称指本人只用真实姓名。** **realName** 与顶层 realName 一致（真实姓名）。**birthdayMD** 为公历月日 \`MM-DD\`（须与 age、学生/职场身份常识一致）。**heightCm** 为厘米纯数字字符串（如 "172"），须与 info 里身高/身形描写一致、忌夸张；**禁止**留空。**weightKg** 为千克数字字符串（如 "52"），与身形描写匹配、忌夸张；**禁止**留空或写占位。**wechatSignature** 为 12–40 字的微信「个性签名」式短句：态度、轻微自嘲或生活切片均可，须与人设语气一致；**禁止**网址、引流、无意义符号堆叠。**zodiac** 写中文星座名（可与生日一致）。**physiology** 写体态动作习惯。
二 core：**仅**人格侧写：表里反差、三观底线、缺陷与雷点；**core.mbti 禁止写职业、禁止写行业**。MBTI 硬性（16 型全覆盖，禁止偷懒扎堆）：字段 core.mbti 须且仅能体现**下列四字母之一**作为类型标签——ISTJ、ISFJ、INFJ、INTJ、ISTP、ISFP、INFP、INTP、ESTJ、ESFJ、ENFJ、ENTJ、ESTP、ESFP、ENFP、ENTP；写法示例："ENFP，话多爱联想但会看场合" 或 "ISTP 倾向（仅供参考）—手比嘴快"。**禁止**无依据地把 INTJ、ISTJ、INFJ、INTP 当成 "安全默认" 反复使用；**禁止**一连多轮只生成 I 人、只生成 xSTJ/xNTJ、或几乎不出现 F/P 维（须让 T/F、J/P、E/I、S/N 在长期多轮里都能出现）。若用户消息里指定了本轮必选四字母，则 core.mbti 必须以该四字母为类型标签（不可偷换成其它型）。
三 psyche：成长经历与常见心结、压力下的反应；开心与难过时的不同表现（禁止创伤猎奇、禁止为惨而惨）。**orientationOrigin（性取向由来）**：单独一段叙事，写清当前取向自我认同如何在时间里成形——可以是自幼稳定、也曾有过试探或错位后的澄清、环境与人际变迁带来的重新认识等；**必须与顶层 orientation 字段一致**，尊重多元与边界；禁止猎奇、禁止污名化任一群体；篇幅建议约 120–420 字，口语具体，忌标语口号。
四 abilities：**skills** 写清 "做什么工作 / 岗位" 以及**在这份工里的具体干法**（和同事怎么配合、忙季怎么扛、出错怎么补救等）；**hobbies / socialMode** 写爱好与社交。**MBTI 只允许影响 "工作场合下的习惯与表现" 的描写**（例如压力大时更爱闷头自己查还是爱拉人讨论），**绝对禁止**用 MBTI 反推或 "搭配" 职业：禁止 INTJ=建筑师、ENTP=销售、INFP=心理咨询师等一切刻板配对；**职业与 MBTI 无因果关系**，现实中任何类型的人都可能从事任何常见职业。
五 fetish：健康底线的亲密观与节奏、感官上的舒适/排斥、关系里的空间感、吃醋的分寸（禁止病态控制、禁止美化违法、强迫或不尊重 consent 的内容）
六 relations：家庭、友人、职场或社交里合常理的小摩擦（误会、不对付的同事）；禁止血海深仇、禁止为戏剧感编造离奇仇敌
七 contrast：恋爱前 vs 恋爱后反差、吵架与和好模式
八 daily：口头禅、洁癖/习惯、消费观、仪式感或迷信
九 arc：日常里的小伪装或嘴硬、对未来的务实期待、无伤大雅的反差萌

职业与社会身份（**与 MBTI 完全无关**：先定岗位，再单独写 MBTI 对工作习惯的影响；可从下列都市言情常见谱系择一，也可写接地气的日常工种，**避免全员同一赛道**）：
- 在 **abilities.skills**（推荐）或 base.info 里写清：**具体单位/职级 + 日常在干什么**（忌空壳头衔）。
- **一、高冷精英霸总向（男主高频）**：集团总裁/副总、继承人、财团少主；投行总裁、风投大佬、私募基金创始人；上市公司董事长、地产大亨、科技公司 CEO；豪门掌权人、家族企业掌舵人。
- **二、职场白领精英（男女通用）**：律师（刑事/民事/离婚专攻）、法律顾问；外科/心内/神经/急诊/儿科/医美医师；建筑师、室内设计师、景观设计师；策划总监、品牌总监、市场运营、新媒体主编；人力总监、行政高管、总裁特助/首席秘书；翻译、外企高管、商务谈判。
- **三、文艺气质（女主/温柔向多）**：插画师、原画师、漫画作者、自由画师；作家、网文作者、编剧、文案策划；钢琴/小提琴老师、独立音乐人、驻唱；舞蹈老师、汉服设计师、珠宝/服装设计师；花艺师、烘焙师、调香师、手作匠人、书店店主。
- **四、娱乐圈爱豆向**：顶流影帝/影后、实力派演员；男团/女团爱豆、唱作人、流量明星；经纪人、娱乐公司老板、公关总监、造型师；网红博主、探店达人、美妆博主、直播主播。
- **五、体制内与安稳禁欲向**：警察、刑警、经侦、特警、缉毒警；消防员、现役/退役军人；检察官、法官、政务机关公职人员；大学教授、高中老师、辅导员。
- **六、小众酷感（反差人设，须写清真实业务内容）**：法医、痕迹检验师、心理/心理咨询师；赛车手、职业电竞选手、私人保镖；古董鉴定、文物修复、拍卖行鉴定；私家侦探、危机公关、谈判专家；飞行员、空乘、邮轮船长。
- **七、市井烟火与创业向**：咖啡店老板、清吧/酒馆老板、民宿店主；宠物店、猫咖、茶馆掌柜；自媒体创业者、工作室创始人、独立摄影师；甜品店主理、花店、文创店主。
- **八、反差与 "隐藏线"（合法合理，忌违法美化）**：可写对外公开职业与较少人知的副业/身份形成反差（如表面普通职员实为家族企业实际话事人、表面老师副业做投资顾问等）；**禁止**美化黑客攻击、雇佣暴力、贩毒洗钱等违法犯罪行为；"隐藏大佬" 仍须符合常识与法律。
- **禁止**：神秘学家、雇佣兵、杀手、异能血统、为噱头硬编且无工作细节的 "××实验家" 等脱离现实底色的设定；为酷而酷的生造头衔、脱离常识的 "全能天才少年"。
- **禁止**模仿二游式夸张：不要堆叠 "被选中的命运"、反物理设定；不要为了 "有梗" 把人物写成 caricature。

人设基调硬性：
- 立体 = 有优点也有可改正的小缺点，**整体健康、符合生活常识**，像会在地铁、写字楼、小区里遇到的人。
- 禁止三观歪曲：不美化欺骗、操控、跟踪骚扰、职场霸凌施害；不把极端占有欲写成 "甜"。
- 叙事克制：少用华丽比喻与玄学大词；缺陷写具体事（如 "压力大时说话冲"），不要写成漫画反派。

占位符与称谓（与微信人设世界书对齐，但恋爱向客观条目单独约定）：
- 除下条外，comprehensive 各 prose 及 persona：指本人可写 {{char}}；**凡第三人称档案叙述**（尤其 base.info、physiology）{{char}} 的语义须等同 **realName 实名**，**禁止**把 {{char}} 理解成 nickname 网名来写。指 "当前滑动用户 / 匹配对象" 且属于**可变、随会话延展**的语境时可用 {{user}}（勿写真实昵称汉字）。
- **恋爱关系客观设定**（世界书固定陈述，不是尾声可变条目）：comprehensive 的 **fetish 四个字段**与 **contrast 三个字段** 中，凡指恋爱/亲密关系里的另一方，**一律直接写汉字对方**（不要用 {{user}}），以免模型误以为角色开局就对当前滑动用户抱有 "已经锁定要处对象" 的指向性。
- persona 电梯陈述里若出现 "对恋爱对象 / 暧昧对象" 的泛化描述，同样写对方而非 {{user}}。
- **nickname 与实名**：顶层 nickname 仅为对外网名。comprehensive 与 persona 中凡**第三人称档案叙事**指「本角色」时，须与 **realName**、**comprehensive.base.realName** 使用同一真实姓名称呼；**禁止**在 base.info、physiology 等段用 nickname 作主语（错误：「叙白在鉴定所……」）。**daily.speech** 可作第一人称、可顺带提网名；协议里写 {{char}} 指本人时，语义上仍须等同该 **真实姓名**，不得用网名顶替。
- 自然口语自称 "我" 可以保留。

文风硬性：
- **对白与口语直接引语**：角色说出的话、以及本协议中的示例句式，一律用英文半角双引号 "..."；**禁止**用中文方头引号（直角引号）包裹对白或示例（以免模型仿写）。
- 口语化、像在跟朋友交代自己的事：具体习惯、小动作、说话方式；少用论文腔、少用空洞形容词堆砌（避免 "宿命感"、"本体论" 一类读者看不懂的词）。
- 禁止油腻霸总语录；禁止全员 "完美圣人"；允许误会与小摩擦，但人物须在常识框架内可沟通、可让步。
`.trim()

const MEET_NPC_BASIC_ALIGNED_WITH_NETWORK = `
---------------------
【与人脉 AI 基础信息对齐】
以下条文与「人设 · 人脉」页 \`generateNpcNetworkWithAi\` / \`npcNetworkGenerate\` 使用**同源**条款（年龄参照锚点已替换为遇见场景；身高体重与座右铭句法与人脉一致）。
---------------------
${MEET_ENCOUNTER_AI_AGE_AND_BIRTHDAY_RULES}

${NPC_AI_HEIGHT_WEIGHT_MOTTO_RULES_CORE}

${MEET_ENCOUNTER_AI_MOTTO_STYLE_TAIL}
`.trim()

export const MEET_NINE_DIMENSION_JSON_SCHEMA = `${MEET_NINE_DIMENSION_JSON_SCHEMA_BODY}\n\n${MEET_NPC_BASIC_ALIGNED_WITH_NETWORK}`.trim()

/** 遇见生成用：16 型四字母（与职业无关，仅作 core.mbti 标签池） */
export const MEET_MBTI_SIXTEEN = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
] as const

export type MeetMbtiFourLetter = (typeof MEET_MBTI_SIXTEEN)[number]

export function rollMeetMbtiType(): MeetMbtiFourLetter {
  return MEET_MBTI_SIXTEEN[Math.floor(Math.random() * MEET_MBTI_SIXTEEN.length)]!
}

/** 外向热情类（与用户填「热情」等关键词相容） */
const MBTI_WARM_OUTWARD: MeetMbtiFourLetter[] = ['ENFP', 'ESFP', 'ENFJ', 'ESFJ', 'ESTP', 'ENTP']
/** 内敛克制类 */
const MBTI_RESERVED: MeetMbtiFourLetter[] = ['INFJ', 'INTJ', 'ISTJ', 'ISFJ', 'ISTP', 'INTP']
/** 温和细腻偏暖（非攻击性外向） */
const MBTI_WARM_SOFT: MeetMbtiFourLetter[] = ['ENFJ', 'ESFJ', 'ISFJ', 'ENFP', 'INFP']

/**
 * 按雷达「氛围关键词」倾向锚定本轮必选四字母（仍与职业无关）。
 * 例如含热情/外向 → 优先 ENFP、ESFP、ENFJ 等；含内敛/慢热 → 优先 INFJ、ISTJ 等。
 * 无关键词或语义冲突时退回均匀随机。
 */
export function rollMeetMbtiAnchoredByKeywords(keywords: string): MeetMbtiFourLetter {
  const z = keywords.trim()
  if (!z) return rollMeetMbtiType()

  const hasWarmOut =
    /热情|外向|活泼|开朗|阳光|社牛|热络|外放|话痨|话多|嗨|显眼包|自来熟|E人|E型/i.test(z)
  const hasReserved =
    /内敛|冷静|克制|慢热|疏离|冷淡|孤僻|社恐|安静|低调|疏离感/i.test(z)
  const hasSoftWarm =
    /温柔|暖和|暖心|体贴|细腻/i.test(z) && !/冷淡|冷感/.test(z)

  if (hasWarmOut && !hasReserved) {
    return MBTI_WARM_OUTWARD[Math.floor(Math.random() * MBTI_WARM_OUTWARD.length)]!
  }
  if (hasReserved && !hasWarmOut) {
    return MBTI_RESERVED[Math.floor(Math.random() * MBTI_RESERVED.length)]!
  }
  if (hasSoftWarm && !hasReserved && !hasWarmOut) {
    return MBTI_WARM_SOFT[Math.floor(Math.random() * MBTI_WARM_SOFT.length)]!
  }
  return rollMeetMbtiType()
}
