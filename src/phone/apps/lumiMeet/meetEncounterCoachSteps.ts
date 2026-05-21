export type MeetCoachTargetId =
  | 'intro'
  | 'affection'
  | 'toolbar'
  | 'profile'
  | 'connect'
  | 'truth'
  | 'tutorial'
  | 'composer'
  | 'outro'

export type MeetCoachStep = {
  target: MeetCoachTargetId | null
  title: string
  body: string
  /** 无高亮区（欢迎 / 收尾） */
  centered?: boolean
  isOutro?: boolean
}

export const MEET_ENCOUNTER_COACH_STEPS: MeetCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '欢迎来到临时会话',
    body: '这里是遇见里的「先聊聊再决定」空间。接下来会用高亮带你认一圈界面，大约一分钟；随时可点跳过。',
  },
  {
    target: 'affection',
    title: '情感共鸣',
    body: '这条进度表示对方现在有多愿意亲近你。数字会随聊天上下浮动，只是参考，不是硬性门槛。',
  },
  {
    target: 'toolbar',
    title: '功能栏',
    body: '灵魂侧写、缔结契约、交换真心话都收在这里，可左右滑动。下面几步会逐个介绍；文字版聊天说明在右上角书本图标。',
  },
  {
    target: 'profile',
    title: '灵魂侧写',
    body: '点开能看对方的九维档案——性格、日常、关系网等等，帮你判断 ta 是什么样的人。',
  },
  {
    target: 'connect',
    title: '缔结契约',
    body: '聊得想加微信时点这里。对方会按好感与人设决定同不同意；同意后能复制微信号，按钮会变成「已缔结」。不会自动进微信通讯录，需自行搜索添加或处理「新的朋友」验证。进微信私聊后对方[[只看见]]你「我」页的[[微信昵称与个性签名]]，[[不会]]读玩家身份的[[世界书设定]]。',
  },
  {
    target: 'truth',
    title: '交换真心话',
    body: '进入双盲问答小仪式：同一道题，双方各自写真心话，再一起揭晓，适合关系想再近一步时用。',
  },
  {
    target: 'tutorial',
    title: '聊天说明',
    body: '右上角书本图标：随时打开文字版小抄，也能再开一遍你现在看到的这种高亮引导。',
  },
  {
    target: 'composer',
    title: '发消息与图片',
    body: '在这里打字，点纸飞机发送；左侧可[[相册/拍摄]]发图，发图后同样点纸飞机催更。模型支持识图时对方能看懂图片；你在「社交假面」设的[[遇见头像]]也会在首轮被用来认人（换图后会再认）。长按气泡可复制或撤回。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '平时想查详细说明，点右上角书本图标即可；其中「加微信后对方看见什么」一节强调：进微信后对方[[只认微信昵称与个性签名]]，[[不会]]读玩家身份[[世界书设定]]。下面可打开说明面板，也可以直接开始聊天。',
  },
]

export const MEET_COACH_TARGET_ATTR = 'data-meet-coach'

export function meetCoachTargetSelector(id: MeetCoachTargetId): string {
  return `[${MEET_COACH_TARGET_ATTR}="${id}"]`
}
