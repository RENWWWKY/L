import { TASTE_STORES, getStoreById } from './tasteCatalog'
import type { MenuItem, Store } from './types'

/** 按菜单精确匹配；模糊匹配仅在唯一命中时采用，避免张冠李戴 */
export function resolveMenuItemForOrder(store: Store, itemName: string): MenuItem | null {
  const raw = itemName.trim()
  if (!raw) return null

  const exact = store.menus.find((m) => m.name === raw)
  if (exact) return exact

  const compact = raw.replace(/\s+/g, '')
  const byCompact = store.menus.find((m) => m.name.replace(/\s+/g, '') === compact)
  if (byCompact) return byCompact

  const fuzzy = store.menus.filter((m) => m.name.includes(raw) || raw.includes(m.name))
  if (fuzzy.length === 1) return fuzzy[0]!
  return null
}

export function buildTakeoutCatalogPromptBlock(): string {
  if (TASTE_STORES.length === 0) {
    return '（寻味外卖：当前无可用店铺）'
  }

  const lines: string[] = []
  for (const store of TASTE_STORES) {
    lines.push(
      `■ ${store.name} · storeId=\`${store.id}\` · 起送¥${store.minOrder} · 配送约${store.deliveryMinutes}分钟`,
    )
    for (const item of store.menus) {
      lines.push(`  - ${item.name} · ¥${item.price}`)
    }
  }
  return lines.join('\n')
}

export function buildWeChatTakeoutOrderOutputBlock(): string {
  const catalog = buildTakeoutCatalogPromptBlock()
  return `
---------------------
【角色为用户点外卖 · 外卖卡片】
---------------------
- **何时宜主动点**：{{user}} 说饿/累/没吃/生病/加班需照顾；你想哄人、赔罪、惊喜、纪念日；关系够熟且你愿意（不必每聊必点）。
- **何时不宜**：刚认识硬点、对方拒、严重吵架未和好、不符人设经济能力。
- 当你要在剧情里**主动给用户点外卖**时：
  1. **口语铺垫**：可说「给你点了 XX」「记得趁热吃」等；**禁止在口语里编造具体金额或总价**（卡片与小票会按菜单自动显示真实价格）。
  2. **口语与指令必须一致**：同轮里口语提到的店/菜，须与下方 \`[TAKEOUT_ORDER]\` 指令中的 \`storeId\`、\`items[].name\` **完全一致**；禁止嘴上说是奶茶、指令却点寿司。
  3. 须**单独占一行**输出机器指令（用户看不到该行，界面会显示外卖卡片）：
     \`[TAKEOUT_ORDER]{"storeId":"店铺ID","items":[{"name":"菜单完整菜名","quantity":1}],"remark":"小票悄悄话","recipientName":"某位可爱小朋友"}\`
- \`storeId\`、菜名**只能**从下表「寻味菜单价目」选取；\`items[].name\` 须与表中菜名**完全一致**（复制表内名称，勿改写、勿缩写）。
- \`items\` 至少 1 项；\`quantity\` 选填默认 1。**勿在 JSON 里写 price/total**——系统按菜单单价 × 数量计算。
- \`remark\` / \`note\` 选填——**写入订单与小票，外卖卡片上不显示**；用户拆封看小票时才会读到。
- \`recipientName\` 选填——**外卖单上的收货昵称**（如「某位可爱小朋友」「肥肥先生」），可可爱、可颜文字；勿写街道门牌。
- **remark 的语义（重要）**：主要是角色借外卖**对用户说的悄悄话/心意**，不是给商家的厨房备注。须符合人设与双方关系，称呼用户时用**人设/theyCallYou**，**不要**用微信昵称或通讯录备注。可带可爱颜文字，例如：
  - \`宝宝，这杯奶茶代表我的心意，希望你开心！(๑•̀ㅂ•́)و✧\`
  - \`今天也要好好吃饭呀～ (｡･ω･｡)\`
  - 仅当人设/剧情需要向商家交代口味时，可在同一字段追加：\`……对商家：多放辣，她爱吃辣！\`（「对商家：」后的才是口播给店家的）
- **禁止**把 remark 写成纯厨房指令（如「少冰三分糖」）除非前面已有给用户的情话，且商家部分用「对商家：」标明。
- **不要**单独一行只写 \`[外卖]\` 预览文案；须用 \`[TAKEOUT_ORDER]\` 整行 JSON 才会发出卡片。
- 错误的 \`storeId\` 或表外菜名会导致**点单失败**，请勿编造未接入品牌。

【寻味 · 可用店铺与菜单价目（与 App 同步，上新店自动纳入）】
${catalog}
`.trim()
}

export function summarizeTakeoutOrderForPrompt(
  storeId: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  total: number,
): string {
  const store = getStoreById(storeId)
  const storeLabel = store?.name ?? storeId
  const dishList = items.map((i) => `${i.name}×${i.quantity}`).join('、')
  return `寻味订单已生成：${storeLabel} · ${dishList} · 合计¥${total}（以卡片为准，口语勿另报金额）`
}
