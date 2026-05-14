import {
  deriveMeetWechatSignatureFromPersona,
  ensureMeetHeightCmValue,
  ensureMeetWeightKgValue,
  isMeetProfilePlaceholder,
  sanitizeLoveBlocksForStaticLore,
  sanitizeMeetCoreMbtiTone,
  type ComprehensivePersona,
} from './comprehensivePersona'
import { rewriteMeetWorldbookNamesToPlaceholders } from './meetWorldbookPlaceholders'

/**
 * 写入档案法则 / 世界书的 Markdown 正文（结构清晰、无 Emoji）。
 * 正文内角色实名与网名统一为 `{{char}}`；体重缺省时按 `loreSeedCharacterId` 稳定补全；个性签名缺省时从人设摘句。
 */
export function formatComprehensivePersonaMarkdown(
  displayName: string,
  p: ComprehensivePersona,
  loreSeedCharacterId: string,
): string {
  p = sanitizeLoveBlocksForStaticLore(p)
  const wKg = ensureMeetWeightKgValue(p.base.weightKg, loreSeedCharacterId)
  const hCm = ensureMeetHeightCmValue(p.base.heightCm, loreSeedCharacterId)
  const sigBody = isMeetProfilePlaceholder(p.base.wechatSignature)
    ? deriveMeetWechatSignatureFromPersona(p)
    : p.base.wechatSignature.trim()

  const h = (n: string, t: string) => `\n## ${n} ${t}\n`
  const f = (labelEn: string, labelZh: string, body: string) =>
    `**${labelEn}** ${labelZh}\n${body.trim()}\n`

  const md = [
    `# 核心人设档案 · {{char}}`,
    '',
    '> 来源：遇见 Lumi Meet · 九维立体人格矩阵',
    '',
    h('01', 'BASE · 基础核心设定'),
    f('REAL NAME', '真实姓名', '{{char}}'),
    f('WECHAT SIGNATURE', '微信个性签名', sigBody),
    f('BIRTHDAY', '生日', p.base.birthdayMD),
    f('ZODIAC', '星座', p.base.zodiac),
    f('HEIGHT', '身高', `${hCm} cm`),
    f('WEIGHT', '体重', `${wKg} kg`),
    f('PHYSICAL & STYLE', '体征与风格', `${p.base.info}\n\n${p.base.physiology}`),
    h('02', 'CORE · 人格内核'),
    f('MBTI TENDENCY', '倾向', sanitizeMeetCoreMbtiTone(p.core.mbti)),
    f('SURFACE PERSONA', '外显人格', p.core.surface),
    f('TRUE SELF', '内在自我', p.core.trueSelf),
    f('VALUES & BOUNDARIES', '三观与底线', p.core.values),
    f('FLAWS & TRIGGERS', '缺陷与雷点', p.core.flaws),
    h('03', 'PSYCHE · 心理与情感'),
    f('BACKGROUND', '成长与经历', p.psyche.background),
    f('SHADOW', '阴影与心结', p.psyche.shadow),
    f('EMOTIONAL PATTERN', '情绪模式', p.psyche.emotionalPattern),
    f('ORIENTATION ORIGIN', '性取向由来', p.psyche.orientationOrigin),
    h('04', 'ABILITIES · 能力与偏好'),
    f('SKILLS', '技能与天赋', p.abilities.skills),
    f('HOBBIES', '爱好', p.abilities.hobbies),
    f('SOCIAL MODE', '社交分寸', p.abilities.socialMode),
    h('05', 'DESIRE · 欲念与底线'),
    f('PREFERENCE', '亲密偏好', p.fetish.preference),
    f('SENSORY', '感官', p.fetish.sensory),
    f('DYNAMIC', '关系动态', p.fetish.dynamic),
    f('JEALOUSY', '吃醋与占有欲', p.fetish.jealousy),
    h('06', 'SOCIAL · 人际法则'),
    f('FAMILY', '家庭', p.relations.family),
    f('FRIENDS', '友人', p.relations.friends),
    f('ENEMIES', '对立与记仇', p.relations.enemies),
    h('07', 'CONTRAST · 恋爱镜像反差'),
    `**BEFORE** 恋爱前\n${p.contrast.beforeLove}\n\n**AFTER** 恋爱后\n${p.contrast.afterLove}\n\n**CONFLICT & REPAIR** 冲突与和好\n${p.contrast.conflict}\n`,
    h('08', 'DETAILS · 日常侧写'),
    f('SPEECH', '口吻与口头禅', p.daily.speech),
    f('HABITS', '习惯与洁癖', p.daily.habits),
    f('MONEY', '消费观', p.daily.money),
    f('QUIRKS', '仪式感与怪癖', p.daily.quirks),
    h('09', 'ARC · 隐藏弧光'),
    f('SECRETS', '伪装与秘密', p.arc.secrets),
    f('GOAL', '动机与恐惧', p.arc.goal),
    f('CONTRAST MOE', '反差萌', p.arc.contrastMoe),
  ].join('\n')

  return rewriteMeetWorldbookNamesToPlaceholders(md, {
    nickname: displayName,
    realName: p.base.realName,
  })
}
