import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { MeetTutorialHighlightText } from './meetTutorialHighlight'

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '这是哪儿？',
    body: '这里是「遇见」里的临时会话——你和匹配对象先在这里聊一阵，彼此熟悉。聊得好，再决定要不要把联络方式换到日常用的微信里。这里的对话、好感，和你在微信里的正式好友是分开的。',
  },
  {
    title: '情感共鸣那条线',
    body: '标题栏下面有一条「情感共鸣」进度，大概可以理解成：对方现在有多愿意亲近你。数字越高，一般越容易聊开；但它不是硬性分数，真正怎么回你，还要看对方人设、你们刚才聊了什么。多聊几轮、聊得真诚，通常会慢慢涨；惹对方反感可能会掉。',
  },
  {
    title: '怎么发消息？',
    body: '底部输入框打字，点纸飞机发送。对方会按人设回复，有时分好几条气泡。若你刚发过话、对方还没回，在输入框为空时也可以再点一次发送，相当于轻轻催一下（别连点刷屏）。长按自己的文字气泡，可以复制或撤回最近一条。',
  },
  {
    title: '发图与识图',
    body: '输入栏左侧可[[从相册选图]]或[[拍摄]]。发图后默认[[不会]]立刻拉对方回复——和微信一样，点纸飞机或空输入时再催更。若当前回复模型支持识图，对方能「看见」你发的图并据此回应。你在「我的 → 社交假面」里设置的[[遇见头像]]，也会在合适时机让对方看一眼（换头像后会再认一次），帮助 ta 了解你是什么样的人——这与微信里对方看你头像的逻辑类似。',
  },
  {
    title: '灵魂侧写',
    body: '点工具栏「灵魂侧写」，能看对方的九维档案（性格、日常、关系网之类），帮你判断 ta 是什么样的人。档案内容会随剧情和真心话等慢慢解锁，好感高一些看得更全。',
  },
  {
    title: '缔结契约（换微信）',
    body: '想加微信时，点「缔结契约」：会先弹出确认，再在聊天里出现一张你的请求卡。对方会结合好感、人设和聊天氛围决定同意还是婉拒——不是好感一满就必过。同意后会出现对方微信号，点一下可复制；工具栏会变成「已缔结」，之后还能再点开看号。注意：缔结≠已是微信好友，不会自动进通讯录。',
  },
  {
    title: '对方也可能先找你换号',
    body: '聊得顺的时候，对方也可能主动发来「对方邀约」卡片，问你愿不愿意互换私下联络。你可以点「同意互换」或「暂缓」。暂缓不会把路堵死，以后对方或你仍可以再次发起。',
  },
  {
    title: '交换真心话',
    body: '点「交换真心话」会进入一个小仪式：系统出一道题，你和对方各自写下真心作答，再一起揭晓。适合关系想再近一步时用；作答内容会归档进会话，并可能影响后续对方对你的态度。',
  },
  {
    title: '和日常微信的关系',
    body: '缔结后若对方倾向先加你，可能会在真实微信的「新的朋友」里发来验证；若倾向你先加，请复制微信号到微信搜索发送申请。只有你在微信里通过验证后，才会进入通讯录。临时会话里的背景图、遇见头像，也和微信名片是两套设置。',
  },
  {
    title: '加微信后对方看见什么',
    body: '进入微信私聊后，对方（AI）[[只按]]你微信「我」页的[[微信昵称]]与[[个性签名]]认你——[[不会]]读取「玩家身份」里的[[世界书设定]]。微信联系人资料卡同样只见[[微信资料]]，不会在卡片里展开世界书。联络绑定选的玩家身份用于验证与会话键，[[不是]]把身份世界书展示给对方。',
  },
  {
    title: '小提示',
    body: '别指望一两句就换到微信；先像正常人一样聊天。对方拒绝换号时，看看聊天气氛，改天再试往往比硬缠管用。若同步或 API 报错，留意输入区上方的红字提示。',
  },
  {
    title: '界面高亮引导',
    body: '第一次进临时会话会自动带你走一圈高亮说明。想再看一遍，点本面板底部的「再走一遍界面引导」；文字说明随时可点聊天室右上角的书本图标重新打开。',
  },
]

export type MeetChatTutorialModalProps = {
  open: boolean
  onClose: () => void
  /** 关闭说明并开启界面高亮引导 */
  onStartLiveCoach?: () => void
}

export function MeetChatTutorialModalPortal({ open, onClose, onStartLiveCoach }: MeetChatTutorialModalProps) {
  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-chat-tutorial"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-tutorial-title"
          className="fixed inset-0 z-[360] flex items-end justify-center bg-black/30 px-0 sm:items-center sm:px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="flex max-h-[min(88dvh,640px)] w-full max-w-[min(400px,100vw)] flex-col overflow-hidden rounded-t-[20px] border-[0.5px] border-[#e8e4dc] bg-[#fdfcfa] shadow-[0_-12px_48px_rgba(22,18,14,0.12)] sm:rounded-[18px]"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ebe7e0] px-5 py-4">
              <motion.div>
                <p id="meet-tutorial-title" className="text-[13px] font-medium tracking-[0.12em] text-[#b8973a]">
                  临时会话 · 怎么聊
                </p>
                <p className="mt-0.5 text-[11px] tracking-[0.04em] text-[#9a9590]">遇见聊天小抄，随时可回看</p>
              </motion.div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ebe7e0] bg-white text-[#6e6860] active:bg-[#f4f2ee]"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            </motion.div>

            <motion.div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]">
              <p className="font-dossier-serif text-[14px] leading-relaxed tracking-[0.04em] text-[#4a463f]">
                第一次来也不用慌，按下面几块看就行——都是你现在这个界面里真能用到的功能。
              </p>
              <motion.ol className="mt-5 space-y-5">
                {SECTIONS.map((sec, i) => (
                  <motion.li key={sec.title} className="list-none">
                    <p className="text-[10px] font-medium tracking-[0.16em] text-[#b8973a]">
                      {String(i + 1).padStart(2, '0')} · {sec.title}
                    </p>
                    <p className="mt-2 font-dossier-serif text-[13px] leading-[1.75] tracking-[0.03em] text-[#5b574f]">
                      <MeetTutorialHighlightText text={sec.body} />
                    </p>
                  </motion.li>
                ))}
              </motion.ol>
            </motion.div>

            <motion.div className="shrink-0 space-y-2 border-t border-[#ebe7e0] px-5 py-4">
              {onStartLiveCoach ? (
                <Pressable
                  type="button"
                  onClick={() => {
                    onClose()
                    onStartLiveCoach()
                  }}
                  className="w-full rounded-full border border-[#D4AF37]/50 bg-[#faf6ee] py-3 text-[13px] tracking-[0.06em] text-[#8a7340] active:bg-[#f3ebe0]"
                >
                  再走一遍界面引导
                </Pressable>
              ) : null}
              <Pressable
                type="button"
                onClick={onClose}
                className="w-full rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] py-3 text-[13px] tracking-[0.08em] text-[#f7f4ef] active:opacity-90"
              >
                知道了
              </Pressable>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
