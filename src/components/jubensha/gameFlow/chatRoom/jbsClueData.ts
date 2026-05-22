import type { JBSClue } from './jbsFlowTypes'

const KEY_THUMB = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#1a1814"/><path d="M48 40h24v12c8 4 14 14 14 26 0 18-12 32-26 36-14-4-26-18-26-36 0-12 6-22 14-26V40z" fill="none" stroke="#8b7355" stroke-width="2"/></svg>`,
)}`

const GLASS_THUMB = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#0d0c0b"/><path d="M38 28h44l-8 88H46L38 28z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/></svg>`,
)}`

const LEDGER_THUMB = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#1a1814"/><rect x="28" y="24" width="64" height="112" rx="2" fill="#ebe6dc" opacity="0.12" stroke="#8b6914" stroke-width="1"/></svg>`,
)}`

const BADGE_THUMB = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#121110"/><rect x="34" y="44" width="52" height="72" rx="6" fill="none" stroke="#c0b8a8" stroke-width="1.5"/></svg>`,
)}`

const MONITOR_THUMB = LEDGER_THUMB
const GLOVE_THUMB = KEY_THUMB
const PHONE_THUMB = BADGE_THUMB
const BOTTLE_THUMB = GLASS_THUMB
const FAX_THUMB = LEDGER_THUMB
const CAR_THUMB = KEY_THUMB
const EMAIL_THUMB = LEDGER_THUMB

/** 《雨夜归零》· 与 DM 主持剧本「公共线索」三批一致 */
const YUYE_CLUES: JBSClue[] = [
  {
    id: 'yuye-c1-access',
    title: '酒窖门禁刷卡记录',
    description:
      '19:42–19:51：19:42 程予安工牌主卡刷开酒窖；19:48 前后主卡再次刷卡；19:43 有一张未登记副卡刷卡失败，门未开。',
    imageUrl: BADGE_THUMB,
    unlockStep: 6,
  },
  {
    id: 'yuye-c1-bottle',
    title: 'C-2 架空香槟瓶',
    description:
      '已倒空的进口香槟，常备酒水单查无此款。瓶口残留物检出金盏花粉，与林晚星血检初步结果成分一致。',
    imageUrl: BOTTLE_THUMB,
    unlockStep: 6,
  },
  {
    id: 'yuye-c1-waiter',
    title: '服务员书面证词',
    description:
      '19:48–19:52 仅林晚星、程予安进酒窖；19:45–19:50 陆景川离席；苏晚晴离席去洗手间一次；沈知意未离席。',
    imageUrl: LEDGER_THUMB,
    unlockStep: 6,
  },
  {
    id: 'yuye-c1-allergy',
    title: '林晚星过敏档案摘录',
    description: '林晚星对金盏花过敏；知情范围仅限核心圈，未向一般宾客公开。',
    imageUrl: FAX_THUMB,
    unlockStep: 6,
  },
  {
    id: 'yuye-c2-cctv',
    title: '物业监控录像',
    description:
      '19:30–20:15：餐厅通道完整；酒窖门口 19:40–19:46 缺 30 秒画面；负二层 19:44–19:47 拍到深色西装背影，袖口有水渍。',
    imageUrl: MONITOR_THUMB,
    unlockStep: 7,
    unlockLoopRound: 2,
  },
  {
    id: 'yuye-c2-glove',
    title: '负二层乳胶手套',
    description: '手套内侧检出金盏花粉；外侧指纹与陆景川部分吻合。',
    imageUrl: GLOVE_THUMB,
    unlockStep: 7,
    unlockLoopRound: 2,
  },
  {
    id: 'yuye-c2-cheng',
    title: '程予安当面向周启陈述',
    description:
      '程予安称 19:41 开通风间取私人信件，未碰香槟；周启备注信封厚度可验，与商业、香槟无关。',
    imageUrl: LEDGER_THUMB,
    unlockStep: 7,
    unlockLoopRound: 2,
  },
  {
    id: 'yuye-c2-search',
    title: '陆景川手机浏览记录',
    description: '19:46 搜索「金盏花粉 过敏性休克 剂量」；本地已删，云端备份仍可读取。',
    imageUrl: PHONE_THUMB,
    unlockStep: 7,
    unlockLoopRound: 2,
  },
  {
    id: 'yuye-c3-code',
    title: 'C-2 瓶底隐形码',
    description:
      '境外代购渠道；收货手机尾号 7031（陆景川备用支付宝）；备注「派对用香槟」；留言「不要发票」。',
    imageUrl: BOTTLE_THUMB,
    unlockStep: 8,
  },
  {
    id: 'yuye-c3-lab',
    title: '沈厚泽基金实验室传真',
    description:
      '花粉为人工浓缩添加，非酿造污染；周一 10:00 须沈厚泽本人到场签署对赌延期补充协议，否则作废。',
    imageUrl: FAX_THUMB,
    unlockStep: 8,
  },
  {
    id: 'yuye-c3-car',
    title: '陆景川轿车后座香槟',
    description: '与毒瓶同批次未开封一瓶；检验未检出金盏花粉。',
    imageUrl: CAR_THUMB,
    unlockStep: 8,
  },
  {
    id: 'yuye-c3-email',
    title: '书房废纸篓旁半张打印图',
    description:
      '庆功宴酒水单邮件曾删除后恢复；操作记录指向陆景川旧机（仅当苏晚晴先前主动交出时公布）。',
    imageUrl: EMAIL_THUMB,
    unlockStep: 8,
  },
]

export function buildScriptClues(scriptId: string): JBSClue[] {
  if (scriptId === 'yuye-guiling') return YUYE_CLUES
  return [
    {
      id: 'c-generic-1',
      title: '现场照片',
      description: '一张曝光过度的照片，角落里有未被擦去的鞋印。',
      imageUrl: LEDGER_THUMB,
      unlockStep: 6,
    },
  ]
}
