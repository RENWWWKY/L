/** 注册页微信昵称 · 随机骰子姓名池（按风格归档，掷骰时均匀抽取） */
const WECHAT_NICKNAME_RANDOM_POOL = [
  // 温柔治愈风
  '晚风叙旧',
  '山野赴星',
  '雾里藏月',
  '屿风',
  '落日邮递员',
  'Soft 晚风',
  '云间小憩',
  '半盏清梦',
  '拾光',
  '星河寄信',
  // 清冷高级风
  '零度疏离',
  '人间过客',
  '赴野',
  '无声序章',
  '冷屿',
  'Ethereal',
  '迟遇',
  '山野留白',
  '寡欢',
  'Silent 浅念',
  // 可爱软萌风
  '奶盖小星球',
  '偷吃一口甜',
  '小熊打盹',
  '芋泥团子',
  '桃雾',
  'Sweet 崽崽',
  '元气小眠',
  '云朵收藏家',
  '糯叽叽',
  '橘味晚风',
  // 小众英文简约
  'Limerence',
  'Echo',
  'Nebula',
  'Amo',
  'Aurora',
  'Windy',
  'Mirait',
  'Serendipity',
  'Dusk',
  'Lucky',
  // 个性潮流酷感
  '游离世俗',
  '随性度日',
  '人间叛逆者',
  '失意玩家',
  '偏爱自由',
  'Zero 执念',
  '浪漫失格',
  '人间观察员',
  '随性野行',
] as const

export const WECHAT_NICKNAME_RANDOM_POOL_SIZE = WECHAT_NICKNAME_RANDOM_POOL.length

/** 从姓名池随机抽取一个昵称（≤32 字） */
export function pickRandomWechatNickname(): string {
  const i = Math.floor(Math.random() * WECHAT_NICKNAME_RANDOM_POOL.length)
  return WECHAT_NICKNAME_RANDOM_POOL[i] ?? WECHAT_NICKNAME_RANDOM_POOL[0]
}
