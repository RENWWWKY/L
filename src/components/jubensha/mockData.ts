import type { PlayRecord, JubenshaScript } from './types'

const YUYE_COVER = new URL('../../../剧本杀/《雨夜归零》/剧本杀封面.png', import.meta.url).href
const YUYE_CHENGYUAN = new URL('../../../剧本杀/《雨夜归零》/程予安个人剧本封面.png', import.meta.url).href
const YUYE_LUJINGCHUAN = new URL('../../../剧本杀/《雨夜归零》/陆景川个人剧本封面.png', import.meta.url).href

export const MOCK_JUBENSHA_SCRIPTS: JubenshaScript[] = [
  {
    id: 'yuye-guiling',
    title: '雨夜归零',
    subtitle: '现代言情 · 轻推理',
    shelfCategory: 'tears',
    tags: ['情感', '推理', '现代'],
    logicDifficulty: 3,
    tearsDepth: 4,
    playerCount: 4,
    maleCount: 2,
    femaleCount: 2,
    durationMinutes: 20,
    coverImageUrl: YUYE_COVER,
    loreIntro:
      '林氏集团顶层酒窖，暴雨将城市浇成一片模糊的霓虹。香槟塔尚未撤下，女主人林晚星已倒在丝绒沙发旁——毒理报告显示，她摄入的剂量足以在午夜前归零。\n\n你们四人曾是彼此最信任的同盟：品牌、资本、技术、秘书。手机被收走，监控被调取，每一句公开发言都可能成为呈堂证供。真凶就坐在你们中间，而记忆正在雨夜里一点点褪色。',
    roles: [
      {
        name: '苏晚晴',
        gender: '女',
        publicIdentity: '归零科技品牌总监',
        blurb:
          '苏晚晴，二十八岁，现任归零科技品牌总监，统管集团对外形象、发布会口径与重大场合的舆情应对。上月自上海分公司调回滨海总部，以业务负责人身份受邀赴玻璃湾七号。业内称她「会把故事讲进投资人的幻灯片里」——从容、克制，擅长时间线与公众叙述的缝合。',
      },
      {
        name: '陆景川',
        gender: '男',
        publicIdentity: '联合创始人 / 首席技术官',
        roleScriptCoverUrl: YUYE_LUJINGCHUAN,
        blurb:
          '陆景川，三十一岁，归零科技联合创始人兼首席技术官，长期主抓研发架构、核心算法与关键技术壁垒。因 API 接口采购账目与对赌延期条款正承受内部审计压力。今夜以合伙人名义出席酒窖庆功宴，需在席观察资方态度，并确认周一签字室前的公司续命条款是否仍可落地。',
      },
      {
        name: '沈知意',
        gender: '女',
        publicIdentity: '沈厚泽基金派驻代表',
        blurb:
          '沈知意，二十六岁，沈厚泽基金派驻代表，专责对赌延期补充协议、回购触发线与现金流核查。此行奉命旁听玻璃湾七号晚宴，评估归零科技是否仍具投资价值，并以条款口径约束创始团队与合伙人的每一项承诺。对外只谈数字与签字，不谈私交。',
      },
      {
        name: '程予安',
        gender: '男',
        publicIdentity: '总裁助理（机要 / 现场统筹）',
        roleScriptCoverUrl: YUYE_CHENGYUAN,
        blurb:
          '程予安，二十七岁，总裁助理，跟随便行已四年，负责机要行程、合同备份、急救物资与酒窖动线表。工牌可刷负二层门禁，是现场后勤与机要文件的实际调度人。今夜名义上统筹摆席、对表与未盖章协议，实则担任封闭宴席内最后一道流程把关者。',
      },
    ],
    comments: [
      {
        id: 'c1',
        authorName: '匿名旅人',
        body: '第三幕翻出来时全场安静了三秒——那种“我早就怀疑你”的眼神太好品了。',
        createdAtIso: '2026-04-12T20:11:00.000Z',
        isMarginalia: true,
      },
      {
        id: 'c2',
        authorName: '批注者',
        body: '情感线不抢推理线，适合短局破冰。DM 记得隐藏真凶姓名到投票前。',
        createdAtIso: '2026-04-18T09:02:00.000Z',
      },
    ],
  },
  {
    id: 'mist-harbor',
    title: '雾港来信',
    subtitle: '民国悬疑 · 群像',
    shelfCategory: 'suspense',
    tags: ['推理', '机制'],
    logicDifficulty: 4,
    tearsDepth: 2,
    playerCount: 6,
    maleCount: 3,
    femaleCount: 3,
    durationMinutes: 180,
    loreIntro:
      '一九三七年，租界码头飘着煤油与桐油混合的气味。一封没有署名的信被塞进领事馆信箱，收件人却在昨夜死于密室——门从内侧拴死，窗玻璃完好，只有地毯上多了一行尚未干透的鞋印。',
    roles: [
      { name: '沈砚', gender: '男', blurb: '报社主编，笔比子弹更快。' },
      { name: '顾湄', gender: '女', blurb: '舞女，知晓每个包厢的秘密。' },
      { name: '陆巡', gender: '男', blurb: '巡捕房探长，程序与正义之间摇摆。' },
    ],
    comments: [
      {
        id: 'c3',
        authorName: '旧纸堆',
        body: '机制本但叙事没有断层，适合喜欢还原时间线的玩家。',
        createdAtIso: '2026-03-02T14:00:00.000Z',
      },
    ],
  },
  {
    id: 'silent-choir',
    title: '无声唱诗班',
    shelfCategory: 'horror',
    tags: ['恐怖', '情感'],
    logicDifficulty: 5,
    tearsDepth: 3,
    playerCount: 5,
    maleCount: 2,
    femaleCount: 3,
    durationMinutes: 240,
    loreIntro:
      '废弃修道院的唱诗班从未真正解散。每当午夜钟声少敲一下，走廊尽头的肖像画就会更换一张脸——而这一次，被画进去的是你们中的一个。',
    roles: [
      { name: '艾拉', gender: '女', blurb: '修复师，专门修补破碎的圣像。' },
      { name: '马库斯', gender: '男', blurb: '调音师，他说自己听不见钟声。' },
    ],
    comments: [],
  },
  {
    id: 'bamboo-debt',
    title: '竹简债簿',
    shelfCategory: 'casual',
    tags: ['古风', '机制', '情感'],
    logicDifficulty: 2,
    tearsDepth: 3,
    playerCount: 4,
    maleCount: 2,
    femaleCount: 2,
    durationMinutes: 90,
    loreIntro:
      '边城客栈来了一位不付银两的客人，只押上一卷竹简。掌柜翻开债簿，发现每一页都写着在座某人的名字——而落款日期，是十年后的今天。',
    roles: [
      { name: '谢青璃', gender: '女', blurb: '行商，箱底永远比表面多一层。' },
      { name: '燕迟', gender: '男', blurb: '镖师，刀鞘里藏着半张婚书。' },
    ],
    comments: [
      {
        id: 'c4',
        authorName: '茶客',
        body: '新手友好，机制轻，但反转温柔——适合带第一次玩本的朋友。',
        createdAtIso: '2026-05-01T11:30:00.000Z',
        isMarginalia: true,
      },
    ],
  },
  {
    id: 'moonlit-contract',
    title: '月下契约',
    subtitle: '都市轻喜 · 机制',
    shelfCategory: 'casual',
    tags: ['现代', '机制'],
    logicDifficulty: 2,
    tearsDepth: 2,
    playerCount: 5,
    maleCount: 2,
    femaleCount: 3,
    durationMinutes: 120,
    loreIntro:
      '五名租客在旧公寓楼下签下同一份租约，条款第七条写着：「午夜前不得询问隔壁房门后的声音。」物业说，这条款已经贴在那里三十年了。',
    roles: [
      { name: '周可', gender: '女', blurb: '插画师，总听见墙里有人翻画册。' },
      { name: '韩渡', gender: '男', blurb: '夜班司机，熟悉每一条绕路。' },
    ],
    comments: [],
  },
  {
    id: 'last-platform',
    title: '末班站台',
    shelfCategory: 'suspense',
    tags: ['推理', '现代'],
    logicDifficulty: 4,
    tearsDepth: 1,
    playerCount: 4,
    maleCount: 2,
    femaleCount: 2,
    durationMinutes: 150,
    loreIntro:
      '地铁末班车的广播多报了一站。车厢里只有你们四个人，而站台上站着的是十分钟前已经下车的人。',
    roles: [
      { name: '许遥', gender: '女', blurb: '档案管理员，记得每一张票根。' },
      { name: '唐砺', gender: '男', blurb: '轨道检修工，口袋里有别人的工牌。' },
    ],
    comments: [],
  },
]

export function createDefaultPlayRecord(): PlayRecord {
  return {
    totalPlayMinutes: 138,
    scriptsCompleted: 12,
    endingsUnlocked: 34,
    completedScriptIds: ['yuye-guiling', 'bamboo-debt'],
    roleHistory: [
      { id: 'rh1', roleName: '苏晚晴', scriptId: 'yuye-guiling', scriptTitle: '雨夜归零' },
      { id: 'rh2', roleName: '谢青璃', scriptId: 'bamboo-debt', scriptTitle: '竹简债簿' },
      { id: 'rh3', roleName: '沈砚', scriptId: 'mist-harbor', scriptTitle: '雾港来信' },
      { id: 'rh4', roleName: '许遥', scriptId: 'last-platform', scriptTitle: '末班站台' },
    ],
    achievements: [
      {
        id: 'a1',
        scriptId: 'yuye-guiling',
        scriptTitle: '雨夜归零',
        label: '扮演 · 苏晚晴',
        unlockedAtIso: '2026-04-20T22:40:00.000Z',
      },
      {
        id: 'a2',
        scriptId: 'yuye-guiling',
        scriptTitle: '雨夜归零',
        label: '结局称号 · 雨歇人散',
        unlockedAtIso: '2026-04-20T23:05:00.000Z',
      },
      {
        id: 'a3',
        scriptId: 'bamboo-debt',
        scriptTitle: '竹简债簿',
        label: '扮演 · 谢青璃',
        unlockedAtIso: '2026-05-10T19:12:00.000Z',
      },
    ],
    companions: [
      { characterId: '__mock_companion_1__', sharedHours: 18, scriptsPlayedTogether: 5 },
      { characterId: '__mock_companion_2__', sharedHours: 4.5, scriptsPlayedTogether: 1 },
    ],
  }
}

export function hydrateRecordCompanions(
  record: PlayRecord,
  characterIds: string[],
): PlayRecord {
  if (characterIds.length === 0) return record
  const companions = record.companions.map((c, i) => ({
    ...c,
    characterId: characterIds[i % characterIds.length] ?? c.characterId,
  }))
  return { ...record, companions }
}

/** @deprecated */
export const createDefaultJubenshaRecord = createDefaultPlayRecord
