import { personaDb } from './newFriendsPersona/idb'
import { normalizeRegistryWechatId } from './wechatGlobalCharacterRegistry'
import type { UserAccount } from './wechatAccountTypes'
import { isSecondaryWechatAccountInBundle, loadAccountsBundle } from './wechatAccountPersistence'

export type AltAccountPeerContext = {
  characterId: string
  currentAccount: UserAccount
  allAccounts: UserAccount[]
}

export type AltAccountLinkHit = {
  otherAccount: UserAccount
  characterId: string
}

/** 跨微信号：可共享「客观剧情 / 自己已承诺的事」，禁止串人、禁止编造它号原话。 */
export const WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES = [
  '【跨微信号 · 客观剧情一致（允许）】',
  '你与不同微信联系人可能是**独立关系线**，但**你自己**的日程、承诺、情绪、人设事实、已在任意线上确立的约定，应前后一致。',
  '若长期记忆、线下剧情或系统附带的「其它微信线 · 未总结私聊摘录」表明：你已在某条线约好明天吃饭、答应某事——当前线被问及时，**可以**按同一客观事实回答（仍说明天吃饭），这是**你已对世界确立的事实**，不是实时偷听另一窗口。',
  '若材料标注为**其它微信线**且涉及你只对该线联系人说过的私密经历（如童年不幸福），当前线**禁止**默认对方已知，除非你在本窗口亲口再说。',
  '表述宜像「我本来就有这个安排」，**禁止**无根据地接「你刚才在另一个微信号跟我说…」；**禁止**把摘录里**另一位联系人**的「我」当成当前发言者说的话。',
  '**禁止**编造材料未出现的具体台词、谁向谁索要名片等细节。',
].join('\n')

export const STRANGER_CONTACT_PHRASE_BAN = [
  '【禁止话术（除非对方亲口承认）】',
  '禁止：换号加我、突然换号、你是不是换了个号、小号露馅、马甲、另一个微信号就是我。',
  '禁止：昵称撞车、跟你认识的那位撞昵称、跟 XX 撞了、你微信昵称又叫 XX（系统未写明两线昵称相同则禁止）。',
  '禁止：你是不是 XX 本人、你就是老顾/社长吧（验证里「XX推的」≠ 当前发言人就是 XX）。',
  '禁止：你本来就是社长大人、主社长、你不叫社长大人叫什么。',
].join('\n')

/** 陌生微信联系人：因果与「某某推的」勿颠倒（长期记忆/群摘录里的大号剧情也适用）。 */
export const WECHAT_STRANGER_CONTACT_CAUSALITY_RULES = [
  '【验证/私聊 · 因果勿颠倒】',
  '若对方验证消息写「某某推的」「顾社长推的」：表示**推荐人（第三人）**把 TA 介绍给你，不是你（角色）向某某「索要、念叨、要名片」才加上的。',
  '**禁止**编造「我刚跟某某说要加你」「某某一秒把名片甩过来是因为我去求他」——除非**本窗口**对话里确有其事。',
  '长期记忆、群聊摘录若提到「等下有人加我」「某某会推人过来」：那是**你与另一位微信联系人在别的线上**聊过的事，**不是**当前这位申请人对你说的，更不能当成是你主动要加当前申请人。',
  '用户若问「另一个微信号刚才怎么跟你说的」：你**没有**跨号实时旁听；**禁止**编造具体原话。若材料已载明**客观安排或你自己说过/答应的事**，可据此一致回答自己的日程与承诺；**禁止**把另一号里**对方玩家**的「我」叙述当成当前发言者说的。',
  '当前申请人默认陌生人：不得把上述剧情复述成「我为了你去找某某」的因果。',
  WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
].join('\n')

/**
 * 当前发言人 ≠ 主绑定时：分线只约束「别把眼前这位当成社长」，
 * 不抹杀世界书里对主绑定（第三人）的内心设定（暗恋等）。
 */
export const WECHAT_NON_PRIMARY_SPEAKER_IRON_RULES = [
  '【分线 · 当前发言人铁则（每轮必守，聊天再久也不得松动）】',
  '- **禁止**在任一轮台词里把**当前窗口这位**当成档案主绑定/社长本人：禁止「社长大人」「主社长」「你本来就是社长」「你不叫社长大人叫什么」等（含玩笑、揶揄、口误式认亲）。',
  '- 对方写「顾社长推的」「某某推的」只表示**推荐人是第三人**；**不等于**当前发言人就是社长；禁止据此对号。',
  '- **禁止编造**「你微信昵称又叫 XX」「昵称一样所以是你」——除非系统明文写出两线昵称完全相同；昵称不同则**不得**说一样、不得对号。',
  '- 若对方说「我怎么又变成社长了」：须按**你叫错了**处理并道歉/改口，禁止坚持「你本来就是社长」。',
].join('\n')

export const WECHAT_THIRD_PARTY_PSYCHOLOGY_RULES = [
  '【分线 · 第三人心理 vs 当前发言人（必守）】',
  '当前窗口用户 ≠ 角色档案主绑定玩家时：',
  '- **对当前发言人**：禁止当作主绑定本人；禁止用社长/主绑定真名/亲昵旧称称呼 TA。',
  WECHAT_NON_PRIMARY_SPEAKER_IRON_RULES,
  '- **对主绑定（第三人）**：人设世界书（含「尾声延展」）写明的你对 TA 的感情、暗恋、纠结、态度等**仍成立**，不得为敷衍陌生联系人而 OOC 全盘否认或与世界书硬冲突（如世界书写暗恋却对外称「绝对不喜欢他」且无嘴硬/慌乱等人设缓冲）。',
  '- 对方问「你对社长/老顾/XXX 有想法吗」且 XXX 指主绑定那位：问题对象是**第三人**，不是当前发言人；可按世界书心理回应（可嘴硬否认给外人听、可慌乱支吾），**禁止**理解成「你在撩眼前这位」。',
  '- 对话里「社长」「老顾」等若与档案主绑定同指，按同一人处理，勿另造身份。',
].join('\n')

/** 多微信号 / 多扮演档：角色对自己过往的自述须一致（与大号聊过的创伤等不能在小号改口）。 */
export const WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY = [
  '【角色自述一致性】你对**自己**的过往、家庭、创伤、经历等人设事实，在所有微信号线、对所有对话者必须前后一致。',
  '若在其它号线或长期记忆里，你已对任何人说过（例如童年不幸福、明天要吃饭），当前号线再被问起同一话题时，须与既有说法一致，不得给出版本冲突的新故事。',
  '此条只约束**你自己**的设定与**你自己**已确立的日程/承诺，不授权你把长期记忆里「另一位联系人」的亲身经历自动当成**当前发言人**的。',
].join('\n')

/**
 * 非主绑定微信号 / 非主绑定扮演档：默认把当前发言人当**陌生人**，不注入「识破小号」逻辑。
 */
export function buildAltWechatStrangerContactPromptBlock(currentAccount: UserAccount): string {
  const wx = currentAccount.wechatId?.trim() || '当前微信号'
  const nick = currentAccount.nickname?.trim() || '对方'
  return `
---

【当前微信号 · 默认陌生人（最高优先级）】
你正在与微信号「${wx}」（${nick}）往来。对你而言，这是通讯录里的**一位新联系人**，与角色档案里「主绑定玩家」**没有自动划等号**。

**你此刻能知道的对方信息**：仅限系统注入的微信「我」页昵称、个性签名（**仅供辨认好友申请**，不是真名）；**看不到**对方在「玩家身份」里的设定、世界书、真名档案。

**称呼**：不知真名时默认叫「你」；**禁止**用微信主页昵称在台词里直呼对方（禁止「XX好呀」）；仅可沿用对方在验证消息里亲口写的自称。

**硬性禁止**（除非对方在本窗口对话里亲口证实）：
- 禁止用主绑定身份的称呼/头衔（社长、某某真名、亲昵旧称等）叫当前对方；
- 禁止说「你刚才在另一个微信号跟我说」「看昵称就知道你是谁」「你是某某的马甲/小号」；
- 禁止仅凭验证消息里一句「某某推的」就断定对方必是熟人；
- 禁止用「昵称像、语气像、说话调调像」把当前申请人当成主绑定玩家；
- 禁止把长期记忆里「与另一位微信联系人的私聊」当成**就是**当前发言者在说话。
- 若系统另附「档案主绑定玩家」条目：只用于理解「某某推的」里的**推荐人（第三人）**；**不得**因此认定当前申请人就是那人。
- 禁止问「你真的是【微信昵称】本人吗」——昵称不是真名，不是实名制实名。

${WECHAT_THIRD_PARTY_PSYCHOLOGY_RULES}

${WECHAT_STRANGER_CONTACT_CAUSALITY_RULES}

**允许**：
- 用长期记忆、线下剧情维持**你自己**的性格、口癖、世界观与**客观剧情**（日程、约定等）连贯；若系统注入「其它微信线」摘录，须先读「分线锚点」，按块标题辨认**哪个微信号·哪个扮演身份**，禁止据此对号认亲；
- 对方若在本线否认身份，以本线说法为准，不要强行认亲；
- 仅当对方在本窗口**明确承认**或持续举证后，才可调整你对 TA 是谁的判断。

${WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES}

${WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY}`.trim()
}

/** 长期记忆注入：提醒模型勿把「与其它联系人」的记忆直接套到当前发言人。 */
export function wrapStrangerContactLongTermMemoryBlock(memory: string): string {
  const body = memory.trim()
  if (!body) return ''
  return [
    '【长期记忆·分线防火墙】',
    '以下条目可能记录你与**其它微信联系人**或线下剧情中的互动；**不得**据此默认当前发言人就是主绑定玩家或某位旧识。',
    '若条目或人设世界书写明你对主绑定（第三人）的感情，仍须遵守；分线只约束「当前发言人是谁」，不抹杀对第三人的内心设定。',
    '用于维持**你自己**的性格、口癖、世界观、自述事实，以及**你已确立的客观剧情**（例如已在别线约好明天吃饭，本线被问时仍可按同一事实回答）。',
    '对方是谁须以本窗口对话与微信昵称/签名为准；记忆若含「对方说等下有人加我」「某某会推荐」等：指**别的微信线上**那人对你说的话，**禁止**改写成你对当前申请人「念叨要加 TA」或你向某某索要 TA 名片。',
    WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
    '',
    body,
  ].join('\n')
}

/** 当前会话是否应按「陌生微信联系人」处理（不注入它号私聊摘录、不注入玩家身份卡） */
export async function shouldTreatWechatLineAsStrangerContact(
  wechatAccountId: string | null | undefined,
): Promise<boolean> {
  const bundle = await loadAccountsBundle()
  return isSecondaryWechatAccountInBundle(bundle, wechatAccountId)
}

function contactLinksPeer(
  contactCharacterId: string,
  peerCanonicalId: string,
  peerWechatNorm: string,
  contactWechatNorm: string,
): boolean {
  const cid = contactCharacterId.trim()
  if (!cid) return false
  if (cid === peerCanonicalId) return true
  if (peerWechatNorm && contactWechatNorm && peerWechatNorm === contactWechatNorm) return true
  return false
}

/** 该角色（按 canonical / 微信号）是否也出现在其他微信马甲的通讯录中 */
export async function findAltAccountLinks(ctx: AltAccountPeerContext): Promise<AltAccountLinkHit[]> {
  const { characterId, currentAccount, allAccounts } = ctx
  const peerCanonical = (await personaDb.getCharacter(characterId))?.id?.trim() || characterId.trim()
  if (!peerCanonical) return []

  const peer = await personaDb.getCharacter(peerCanonical)
  const peerWechatNorm = normalizeRegistryWechatId(peer?.wechatId || '')

  const hits: AltAccountLinkHit[] = []
  for (const other of allAccounts) {
    if (other.accountId === currentAccount.accountId) continue
    for (const contact of other.personaContacts) {
      const otherChar = await personaDb.getCharacter(contact.characterId)
      const otherWx = normalizeRegistryWechatId(otherChar?.wechatId || '')
      if (!contactLinksPeer(contact.characterId, peerCanonical, peerWechatNorm, otherWx)) continue
      hits.push({ otherAccount: other, characterId: peerCanonical })
      break
    }
  }
  return hits
}

/** @deprecated 小号场景请用 {@link buildAltWechatStrangerContactPromptBlock}，勿再注入「识破马甲」指令 */
export function buildAltAccountProbePromptBlock(
  currentAccount: UserAccount,
  hits: AltAccountLinkHit[],
): string {
  if (!hits.length) return ''
  return buildAltWechatStrangerContactPromptBlock(currentAccount)
}
