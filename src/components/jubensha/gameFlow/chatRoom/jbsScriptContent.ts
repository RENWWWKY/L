import type { ScriptSection } from './jbsFlowTypes'

const CHENGYUAN_INTRO = `你叫程予安，二十七岁，林晚星总裁助理。工牌尾号 0903，主卡可刷酒窖门禁——在归零科技，这两串数字几乎等于你的第二姓名。四年前你从行政岗被林晚星亲手挑进总裁办，面试那天林晚星只问了一句：「你能不能把麻烦挡在门外？」

你跟了林晚星四年。你喜欢林晚星——这件事埋在比 API 密钥更深的地方，不是今晚能说的。三周前，林晚星把一叠旧信交给你，信封泛黄，笔迹你一眼就认出：苏晚晴，多年前写给林晚星，从未寄出。你计划 19:41 从酒窖通风旁旧信箱取走——与香槟无关。

今晚玻璃湾七号还有陆景川、沈知意、苏晚晴。你来玻璃湾七号，穿深色西装，口袋里是林晚星要的未盖章协议。雨夜会很长。`

const CHENGYUAN_ACT1 = `你坐在沙发上，工牌还在口袋里。林晚星已被救护车带走二十多分钟，客厅里却好像仍回荡着林晚星掐住喉咙时，指甲刮过桌布的那一声轻响。

（回溯 · 19:48）林晚星对你说：「去拿香槟，程予安，陪我。」C-2 架上多了一瓶贴着法文小标的进口香槟，标签一角手写「陆景川贺酒」。你提醒过未登记，林晚星仍选「就用陆景川送的」。19:55 回餐厅，林晚星自己先喝了一口，再示意众人干杯。

（回到此刻）门禁记录会显示主卡两次——一次 19:41，一次 19:48 前后。你还不知道真凶是谁，只知道：若你此刻乱了，林晚星醒来时会少一个能替她说话的人。`

const CHENGYUAN_ACT2 = `22:00，手机刚回到掌心。平板在茶几上，周启上楼，碎纸声未停。

你开始核对时间线：19:41 取信与 19:48 下酒窖之间，电梯井的钢索微响是否意味着还有第三人动线？瓶底若有码，此刻是否该在讨论中引出，还是再等一轮？`

const LUJINGCHUAN_INTRO = `你是陆景川，三十一岁，归零科技联合创始人兼首席技术官。API 接口采购账目与对赌延期条款正压在肩上，今夜需在席观察资方态度。

你为林晚星准备了一瓶进口香槟，标签写着「陆景川贺酒」——庆功夜的惊喜，也是你想在签字室前缓和气氛的姿态。`

const LUJINGCHUAN_ACT1 = `19:45 前后你曾离席透气，海风和雨味从阳台灌入。你回到餐厅时，香槟已开，林晚星倒下。

你记得 C-2 架上的那瓶酒——是你送的。可你并未在 19:48 与林晚星一同下窖。谁在瓶上动了手脚，你必须在讨论中弄清。`

const GENERIC_INTRO = (name: string, blurb: string) =>
  `【${name}】\n\n${blurb}\n\n今夜玻璃湾七号暴雨未歇，香槟塔尚未撤下，女主人已倒下。请以你的身份在群内完成自我介绍，勿提前透露未解锁章节中的隐秘。`

const GENERIC_ACT1 = `第一幕已开启。请根据主持人节奏，在脑海中回放今夜时间线：晚宴、离席、酒窖、回到客厅的那一刻。

所有尚未写入你剧本的细节，在讨论中只可推测，不可捏造已读内容。`

const GENERIC_ACT2 = `第二幕已开启。新的矛盾点浮出水面——请结合公共线索区已发放的证据，审视每一个人的动线与说辞。`

const GENERIC_ACT3 = `第三幕已开启。关键物证与时间点开始闭合，请准备进入最后一轮集中讨论。`

const GENERIC_FINALE = `终局将至。请整理手稿中的疑点，准备投票。真相将在主持人宣读后揭晓。`

function sectionsForRole(
  roleName: string,
  blurb: string,
  overrides?: Partial<Record<'intro' | 'act1' | 'act2', string>>,
): ScriptSection[] {
  return [
    {
      id: 'intro',
      title: '我的自我介绍',
      body: overrides?.intro ?? GENERIC_INTRO(roleName, blurb),
    },
    {
      id: 'act1',
      title: '第一幕 · 起风之时',
      body: overrides?.act1 ?? GENERIC_ACT1,
    },
    {
      id: 'act2',
      title: '第二幕 · 缺口',
      body: overrides?.act2 ?? GENERIC_ACT2,
    },
    { id: 'act3', title: '第三幕 · 收束', body: GENERIC_ACT3 },
    { id: 'finale', title: '终极线索', body: GENERIC_FINALE },
  ]
}

/** 按剧本与角色 id 返回分幕个人剧本正文 */
export function buildRoleScriptSections(
  scriptId: string,
  roleName: string,
  blurb: string,
): ScriptSection[] {
  if (scriptId === 'yuye-guiling') {
    if (roleName === '程予安') {
      return sectionsForRole(roleName, blurb, {
        intro: CHENGYUAN_INTRO,
        act1: CHENGYUAN_ACT1,
        act2: CHENGYUAN_ACT2,
      })
    }
    if (roleName === '陆景川') {
      return sectionsForRole(roleName, blurb, {
        intro: LUJINGCHUAN_INTRO,
        act1: LUJINGCHUAN_ACT1,
      })
    }
  }
  return sectionsForRole(roleName, blurb)
}
