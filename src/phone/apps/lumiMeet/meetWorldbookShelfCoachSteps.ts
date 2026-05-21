export type MeetWbShelfCoachTargetId = 'overview' | 'matrix' | 'volumes' | 'tutorial'

export type MeetWbShelfCoachStep = {
  target: MeetWbShelfCoachTargetId | null
  title: string
  body: string
  centered?: boolean
  isOutro?: boolean
}

export const MEET_WB_SHELF_COACH_STEPS: MeetWbShelfCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '欢迎来到灵魂侧写',
    body: '这里汇总了 ta 的九维人设与已写入人设库的分册。接下来用高亮带你认一圈，大约半分钟；可随时跳过。',
  },
  {
    target: 'overview',
    title: '分册总览',
    body: '顶部卡片说明共有 12 个分册：vol01–vol09 在下方九维矩阵里展开；vol10–vol12 在更下面的「人设库分册」里点开看正文。',
  },
  {
    target: 'matrix',
    title: '九维人设矩阵',
    body: '逐条展开可看性格、日常、关系网等。标题栏「情感共鸣」越高，**深层分册**解锁越多；匹配后就能浏览表层内容。',
  },
  {
    target: 'volumes',
    title: '人设库分册 vol10–12',
    body: '**vol10** 结业初印象（加微信后由 AI 撰写）；**vol11** 匹配时你对外展示的遇见档案；**vol12** 交换真心话纪要。与微信「人设 · 世界书」同源，不进档案室 App。',
  },
  {
    target: 'tutorial',
    title: '随时回看',
    body: '右上角「教程」可打开文字说明，也能再开一遍你现在看到的高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '平时想查详细说明，点右上角「教程」即可。下面可以打开文字版小抄，也可以直接开始翻阅档案。',
  },
]

export const MEET_WB_COACH_TARGET_ATTR = 'data-meet-wb-coach'

export function meetWbCoachTargetSelector(id: MeetWbShelfCoachTargetId): string {
  return `[${MEET_WB_COACH_TARGET_ATTR}="${id}"]`
}
