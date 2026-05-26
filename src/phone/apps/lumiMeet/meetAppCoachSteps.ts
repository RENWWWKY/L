import type { MeetTab } from './meetAppTabs'

export type MeetAppCoachTargetId =
  | 'tutorial'
  | 'nav-match'
  | 'match-filters'
  | 'match-search'
  | 'match-spark-actions'
  | 'nav-inbox'
  | 'inbox-header'
  | 'nav-profile'
  | 'profile-shell'
  | 'profile-contact-bindings'
  | 'nav-archive'
  | 'archive-tabs'
  | 'archive-summary-progress'
  | 'nav-discover'

export type MeetProfileCoachTab = 'mask' | 'aesthetic' | 'contact'
export type MeetArchiveCoachTab = 'memories' | 'progress'

export type MeetAppCoachStep = {
  target: MeetAppCoachTargetId | null
  title: string
  body: string
  /** 切到该底栏页再量高亮（避免目标不在 DOM） */
  tab?: MeetTab
  /** 「我的」内子页（如联络绑定） */
  profileTab?: MeetProfileCoachTab
  /** 「记忆」内子页（邂逅残卷 / 总结进度） */
  archiveTab?: MeetArchiveCoachTab
  /** 目标不在 DOM 时展示的示意 UI（如匹配卡上的心动/错过） */
  coachPreview?: 'match-spark'
  centered?: boolean
  isOutro?: boolean
}

export const MEET_APP_COACH_TARGET_ATTR = 'data-meet-app-coach'
export const MEET_APP_COACH_ROOT_ATTR = 'data-meet-app-coach-root'

export function meetAppCoachTargetSelector(id: MeetAppCoachTargetId): string {
  return `[${MEET_APP_COACH_TARGET_ATTR}="${id}"]`
}

export function meetAppCoachScopedTargetSelector(scopeRoot: string, targetId: MeetAppCoachTargetId): string {
  return `[${MEET_APP_COACH_ROOT_ATTR}="${scopeRoot}"] ${meetAppCoachTargetSelector(targetId)}`
}

export const MEET_APP_START_COACH_EVENT = 'meet-app-start-coach'
export const MEET_APP_OPEN_TUTORIAL_EVENT = 'meet-app-open-tutorial'

export const MEET_APP_COACH_STEPS: MeetAppCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '欢迎来到遇见',
    body: '这是一个「先邂逅、再聊天、再决定要不要加微信」的约会向 App。接下来用大约一分钟带你认一圈底栏和核心玩法；随时可跳过。',
  },
  {
    target: 'nav-match',
    tab: 'match',
    title: '寻觅 · 匹配',
    body: '大部分故事从这里开始：设好筛选偏好后点「开启寻觅」，等星轨转出本轮对象，再在档案卡上选「心动」或「错过」。',
  },
  {
    target: 'match-filters',
    tab: 'match',
    title: '筛选偏好',
    body: '点这里打开抽屉：年龄、取向、你想找的关系类型（浪漫、友谊等）。改完记得点「应用」保存，下一轮寻觅才会按新条件抽人。',
  },
  {
    target: 'match-search',
    tab: 'match',
    title: '开启寻觅',
    body: '偏好保存后点这里开始本轮搜索。同频成功会进「消息」；若对方无感，卡片会进入「擦肩而过」，以后还能消耗回溯机会再试。',
  },
  {
    target: 'match-spark-actions',
    tab: 'match',
    coachPreview: 'match-spark',
    title: '心动与错过',
    body: '开启寻觅并转出档案卡后，底部会出现这两个按钮（引导中会先显示示意）。「错过」= 本轮结束，人进擦肩而过；「心动」= 请求同频判定，成功则自动开临时会话并往往有对方先开口的几条消息。判定中要稍等，别连点。',
  },
  {
    target: 'nav-inbox',
    tab: 'inbox',
    title: '消息 · 临时会话',
    body: '所有已匹配对象都在这里。点进某人即可聊天；列表右侧角标是未读。聊得好再考虑换微信——详细发消息、缔结契约、真心话等，进会话后点右上角书本图标查看聊天说明。',
  },
  {
    target: 'inbox-header',
    tab: 'inbox',
    title: '临时会话列表',
    body: '这里只显示「已匹配」的人。缔结微信成功后，条目可能标 WECHAT，表示已互换号，但你是否已在微信里通过好友，还需自己去「新的朋友」或搜索微信号确认。',
  },
  {
    target: null,
    tab: 'inbox',
    centered: true,
    title: '加微信后对方看见什么',
    body: '通过好友验证、进入微信私聊后：对方（AI）[[只读取]]你微信「我」页的[[昵称与个性签名]]，[[不会]]注入「玩家身份」的[[世界书设定]]。联系人资料卡同样只展示[[微信资料]]，不是世界书。遇见假面与微信主页不一致时，剧情里可以写掉马反差。',
  },
  {
    target: 'nav-profile',
    tab: 'profile',
    profileTab: 'mask',
    title: '我的 · 对外形象',
    body: '编辑遇见里展示给对方的假面：昵称、头像、简介、公开意向。下方三个子页：社交假面、沉浸氛围（聊天背景）、联络绑定（玩家身份 + 微信马甲）。匹配前建议至少填好假面并绑定身份。',
  },
  {
    target: 'profile-contact-bindings',
    tab: 'profile',
    profileTab: 'contact',
    title: '联络绑定很重要',
    body: '高亮区域即绑定操作区：先选[[微信账号]]（交换联络方式时展示你的号），再选[[玩家身份]]（好友验证、私聊会话键）。注意：玩家身份[[不是]]把身份世界书全文给对方看；进微信私聊后对方[[只看见]]你「我」页的[[微信昵称与个性签名]]。',
  },
  {
    target: 'nav-archive',
    tab: 'archive',
    archiveTab: 'memories',
    title: '记忆 · 邂逅档案',
    body: '底栏「记忆」汇总你和各角色的遇见交汇。上方两个子页：[[邂逅残卷]]看已写入的 `[遇见]` 长期记忆与交汇卡片；[[总结进度]]看每位对象距离下一次自动总结还需几轮 NPC 回复。',
  },
  {
    target: 'archive-tabs',
    tab: 'archive',
    archiveTab: 'progress',
    title: '邂逅残卷 / 总结进度',
    body: '高亮为档案分页。点「总结进度」可查看各匹配角色：遇见独立计数（每 N 轮 NPC 文字回复计 1 轮），满轮后合并写入 `[遇见]` 长期记忆；成功时会有居中「记忆总结成功」提示。',
  },
  {
    target: 'archive-summary-progress',
    tab: 'archive',
    archiveTab: 'progress',
    title: '总结进度怎么看',
    body: '每位角色一张进度卡：金色条为距上次总结已积累的 NPC 回复轮数；文案会写「还需 X 轮」或「下轮可触发」。计数按你在「联络绑定」选的[[微信账号 + 玩家身份]]对齐，不会混入其它马甲。若关闭遇见自动总结，此处会提示在记忆页上方开启。',
  },
  {
    target: 'nav-discover',
    tab: 'discover',
    title: '广场',
    body: '偏氛围向的碎片动态，右上角可让 AI 按风格生成一批帖子，纯阅读，不参与匹配流程。',
  },
  {
    target: 'tutorial',
    title: '随时回看',
    body: '顶栏「教程」可打开遇见 App 的完整文字说明，也能再开一遍你现在看到的高亮引导。临时会话里点右上角书本图标可看聊天说明；灵魂侧写弹层里另有「教程」。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '建议先去「我的」补全资料并做完联络绑定，再到「寻觅」开一轮试试。加微信后对方[[只认微信主页资料]]，别误以为会读取身份世界书——细则见顶栏「教程」里「加微信后对方看见什么」。',
  },
]
