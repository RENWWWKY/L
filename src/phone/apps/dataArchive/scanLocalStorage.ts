import { utf8ByteLength } from './constants'

export type StorageSegment = {
  /** 面向用户的中文归类名 */
  name: string
  size: number
  /** 0–100，相对本页合并分项合计的占比 */
  percentage: number
}

/**
 * 将单条 localStorage key 映射为可读中文桶名（同一桶会合并体积）。
 * 顺序：先匹配更具体的规则。
 */
function friendlyCategoryForKey(key: string): string {
  const k = key

  if (k.startsWith('minimax:')) return '语音合成与声纹（MiniMax）'

  if (k.startsWith('lumi_app_')) {
    const rest = k.slice('lumi_app_'.length).trim()
    return rest ? `扩展应用 · ${rest}` : '扩展应用'
  }

  if (k.startsWith('lumi_sys_')) return '系统统计与用量记录'

  if (k.startsWith('lumi-phone-custom')) return '手机外观与个性化'

  if (k.startsWith('lumi-home-widget')) return '主屏幕小组件布局'

  if (k === 'wechat-dating-archives-v1' || k.includes('wechat-dating-archives')) return '约会模式 · 剧情存档'

  if (k === 'wechat-dating-characters-v1' || k.includes('wechat-dating-characters')) return '约会模式 · 人设与列表'

  if (k.startsWith('wechat-dating-heart-whisper')) return '约会模式 · 心语与轻提示'

  if (k.startsWith('wechat-dating-vn-progress')) return '约会模式 · 视觉小说进度'

  if (k.startsWith('wechat-dating-vn-sprite')) return '约会模式 · 立绘与精灵配置'

  if (k.startsWith('wechat-dating-vn-bgm')) return '约会模式 · 背景音乐与音量'

  if (k.startsWith('wechat-dating-plot-tail')) return '约会模式 · 剧情续接位置'

  if (k.startsWith('wechat-dating-style-tuning')) return '约会模式 · 画风与提示词微调'

  if (k.startsWith('wechat-dating')) return '约会模式 · 其他缓存'

  if (k.startsWith('wechat-wallet') || k === 'wx-wallet-mock-v1') return '微信 · 钱包与卡片（模拟）'

  if (k.startsWith('wechat-wealth')) return '微信 · 资产看板与教程'

  if (k.startsWith('wechat-sticker')) return '微信 · 表情包中心'

  if (k.startsWith('wechat-lumi-transfers')) return '微信 · Lumi 转账记录'

  if (k.startsWith('wx_recent_forwards')) return '微信 · 最近转发'

  if (k.startsWith('wechat-transfer-return') || k.startsWith('wechat-redpacket')) return '微信 · 转账与红包提醒'

  if (k.startsWith('lumi-wechat-')) return '微信 · 界面引导与标记'

  if (k.startsWith('ai-api-presets')) return 'AI 接口与密钥预设'

  if (k.startsWith('entry-notice')) return '入口须知与确认'

  if (k.startsWith('lumi-decision-wheel')) return '抉择之轮选项'

  if (k.startsWith('checkPhone') || k.includes('spyTutorial')) return '查手机 · 教程与状态'

  if (k.toLowerCase().includes('anonymous') || k.toLowerCase().includes('qna')) return '匿名提问墙'

  if (k.startsWith('lumi-')) return 'Lumi 其他本地缓存'

  return '其他本地数据'
}

/**
 * 扫描 localStorage，按用途聚合成扇区数据。
 */
export function scanLocalStorageSegments(): { segments: StorageSegment[]; totalBytes: number } {
  if (typeof localStorage === 'undefined') return { segments: [], totalBytes: 0 }

  const bucket = new Map<string, number>()
  let total = 0
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key) continue
    const raw = localStorage.getItem(key)
    const bytes = utf8ByteLength(raw ?? '')
    total += bytes
    const label = friendlyCategoryForKey(key)
    bucket.set(label, (bucket.get(label) ?? 0) + bytes)
  }

  const entries = [...bucket.entries()].sort((a, b) => b[1] - a[1])
  const segments: StorageSegment[] = entries.map(([name, size]) => ({
    name,
    size,
    percentage: total > 0 ? (size / total) * 100 : 0,
  }))

  return { segments, totalBytes: total }
}

/** 按展示名合并多来源（如 IndexedDB + localStorage）的同名分项 */
export function mergeStorageSegments(parts: StorageSegment[]): StorageSegment[] {
  const m = new Map<string, number>()
  for (const s of parts) {
    m.set(s.name, (m.get(s.name) ?? 0) + s.size)
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0)
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, size]) => ({
      name,
      size,
      percentage: total > 0 ? (size / total) * 100 : 0,
    }))
}
