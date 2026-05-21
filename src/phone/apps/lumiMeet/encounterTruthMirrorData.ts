/** TRUTH · 交换真心话 — 题库（每次抽卡随机取三题上牌面） */
export const TRUTH_MIRROR_QUESTIONS: readonly string[] = [
  // 一、轻松日常（1-15）
  '最近一次偷偷熬夜是为了什么？',
  '手机里最新一张自拍长啥样？',
  '现在身上最值钱的东西是什么？',
  '最喜欢自己身上哪个部位？',
  '最讨厌别人对你做什么动作？',
  '一天之中最懒的时间段是几点？',
  '有没有偷偷暗恋过身边朋友？',
  '出门必带的三样东西是什么？',
  '最近一顿吃的最贵的饭多少钱？',
  '朋友圈屏蔽过几个人？',
  '睡觉喜欢朝左边还是右边睡？',
  '有没有偷偷模仿过别人穿搭？',
  '最喜欢晴天还是下雨天？',
  '随口说过最违心的一句话是什么？',
  '独处时最爱做的傻事是什么？',
  // 二、情感恋爱（16-30）
  '谈过几段正经恋爱？',
  '第一眼会先看异性哪里？',
  '心里藏着最喜欢的人是谁？',
  '有没有对朋友对象心动过？',
  '最长一次单身多久？',
  '理想型身高多少？',
  '接吻时最在意什么细节？',
  '被表白最离谱的一次经历是什么？',
  '会介意对象有异性闺蜜吗？',
  '分手最快多久走出来？',
  '喜欢主动还是被动谈恋爱？',
  '有没有偷偷视奸前任动态？',
  '恋爱里最容易吃醋的点是什么？',
  '能接受异地恋吗？',
  '最想和喜欢的人做什么事？',
  // 三、社死八卦（31-40）
  '当众出过最糗的一件事是什么？',
  '偷偷吐槽过哪个在场的人？',
  '网购最踩雷的一样东西是什么？',
  '上学时有没有被罚站过？',
  '假装成熟其实很幼稚的事是什么？',
  '撒谎最多的一件事是什么？',
  '上次当众认错人是什么时候？有多尴尬？',
  '偷偷哭过最委屈的一次是什么？',
  '有没有偷偷蹭过别人东西？',
  '最怕被别人揭穿什么秘密？',
  // 四、大胆私密（41-50）
  '有没有过一夜情想法？',
  '谈过年龄差最大的对象几岁？',
  '心里藏着最龌龊的小想法是什么？',
  '第一次心动是几岁？',
  '有没有对同性动过心？',
  '暧昧过最多同时几个人？',
  '洗澡最快和最慢分别多久？',
  '最不能接受对象哪个癖好？',
  '手机里有没有不能见人的照片？',
  '现在在场最想谈恋爱的人是谁？',
  // 五、深度向（原有题库）
  '如果现在可以看透我心里的一个秘密，你希望是什么？',
  '在感情里，你更害怕「被抛弃」还是「被完全看透」？',
  '你会在什么情况下，毫不犹豫地拉黑一个人？',
  '你目前对外展现的性格，有几分是真实的？',
  '如果发现对方有一个不可原谅的谎言，你会听解释还是直接走人？',
  '遇见心动的人，你会步步为营试探，还是直接打直球出击？',
  '你觉得「肉体出轨」和「精神出轨」，哪个绝对不能原谅？',
  '你最近一次失眠，是因为什么？',
  '在你眼里，目前的我是一个怎样的人？请说最真实的直觉。',
  '你做过最疯狂或最失控的一件事是什么？',
  '如果我们真的在一起，你直觉我们会因为什么原因而分开？',
  '你更容易被对方的哪种隐秘特质（非外貌）瞬间吸引？',
  '你心里有没有一个，绝对不能让任何人触碰的「逆鳞」？',
  '面对喜欢的人展露出的软弱，你会觉得麻烦，还是会产生病态的保护欲？',
  '你认为「门当户对」或「势均力敌」在如今的感情里重要吗？',
  '你是一个会在深夜独自消化情绪的人，还是必须要寻找发泄出口？',
  '假设我现在就在你面前，你最想对我做什么动作？',
  '你有没有曾经为了达到某个目的，而刻意伪装或利用过别人的感情？',
  '遇到冷战，你会主动低头给台阶，还是会比对方更冷漠？',
  '现在的你，更渴望轰轰烈烈的危险浪漫，还是平平淡淡的安稳底色？',
]

/** 从题库中不重复抽取 n 个索引 */
export function pickTruthMirrorQuestionIndices(count: number, seed: number): number[] {
  const n = TRUTH_MIRROR_QUESTIONS.length
  const idx = Array.from({ length: n }, (_, i) => i)
  let h = seed >>> 0
  for (let i = idx.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0
    const j = h % (i + 1)
    ;[idx[i], idx[j]] = [idx[j]!, idx[i]!]
  }
  return idx.slice(0, Math.min(count, n))
}

/** 交换真心话：按邂逅对象性别生成「Ta 的真心 / 正在书写」等中英标签（未知性别用中性「对方」） */
export type MeetTruthPeerCeremonyCopy = {
  peerTruthLabelEn: string
  peerTruthLabelZh: string
  peerWritingEn: string
  peerWritingZh: string
  /** 用户已封存、等待对方 AI 作答 */
  peerAwaitingEn: string
  peerAwaitingZh: string
}

export function resolveMeetTruthPeerCeremonyCopy(npcGenderRaw: string): MeetTruthPeerCeremonyCopy {
  const t = npcGenderRaw.trim()
  const c = t.replace(/\s/g, '')
  const isFemale =
    /^(女|女性|女生)$/u.test(c) || /^female$/i.test(t) || (c.includes('女') && !c.includes('男'))
  const isMale =
    /^(男|男性|男生)$/u.test(c) || /^male$/i.test(t) || (c.includes('男') && !c.includes('女'))
  if (isFemale && !isMale) {
    return {
      peerTruthLabelEn: 'Her Truth',
      peerTruthLabelZh: '她的真心',
      peerWritingEn: 'She is writing...',
      peerWritingZh: '她正在书写...',
      peerAwaitingEn: 'She is submitting her answer…',
      peerAwaitingZh: '她正在提交答案…',
    }
  }
  if (isMale && !isFemale) {
    return {
      peerTruthLabelEn: 'His Truth',
      peerTruthLabelZh: '他的真心',
      peerWritingEn: 'He is writing...',
      peerWritingZh: '他正在书写...',
      peerAwaitingEn: 'He is submitting his answer…',
      peerAwaitingZh: '他正在提交答案…',
    }
  }
  return {
    peerTruthLabelEn: 'Their Truth',
    peerTruthLabelZh: '对方的真心',
    peerWritingEn: 'They are writing...',
    peerWritingZh: '对方正在书写...',
    peerAwaitingEn: 'They are submitting their answer…',
    peerAwaitingZh: '对方正在提交答案…',
  }
}
