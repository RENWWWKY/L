import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '这是什么？',
    body: '「灵魂侧写」是 ta 在遇见里的完整人设档案：九维性格矩阵 + 已写入人设库的分册。帮你判断对方是什么样的人，也方便 AI 在临时会话和微信里保持一致的人设。',
  },
  {
    title: '九维矩阵与共鸣刻度',
    body: 'vol01–vol09 在页面中部的手风琴里逐条展开。临时会话顶部的「情感共鸣」越高，**深层分册**解锁越多；匹配后即可阅读表层内容，不必等加微信。',
  },
  {
    title: 'vol10 · 邂逅结业初印象',
    body: '匹配后先有占位稿；缔结契约或加为微信好友并完成结业同步后，系统会根据邂逅聊天记录写一段约百字的「对 TA 的初印象」，替换为真稿。可在下方「人设库分册」里展开 vol10 查看。',
  },
  {
    title: 'vol11 · 遇见对外档案',
    body: '记录**匹配成功瞬间**对方在遇见 App 里看到的你的对外展示（昵称、意向、简介等），即你的「遇见假面」。与微信玩家身份可能不一致，后续私聊可保留戏剧张力。',
  },
  {
    title: 'vol12 · 交换真心话',
    body: '在临时会话里完成「交换真心话」仪式后，双盲问答会归档到这里，无需先加微信。每多完成一次，纪要会追加一节。',
  },
  {
    title: '和档案室 App 的关系',
    body: '遇见匹配角色的人设**只存在该角色的「人设 · 世界书」**，不会同步进全局档案室 App，避免和九维分册重复占地方。',
  },
  {
    title: '界面高亮引导',
    body: '第一次打开灵魂侧写会自动走一圈高亮说明。想再看一遍，点右上角「教程」，在面板底部选「再走一遍界面引导」。',
  },
]

export type MeetWorldbookShelfTutorialModalProps = {
  open: boolean
  onClose: () => void
  onStartLiveCoach?: () => void
}

export function MeetWorldbookShelfTutorialModalPortal({
  open,
  onClose,
  onStartLiveCoach,
}: MeetWorldbookShelfTutorialModalProps) {
  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-wb-shelf-tutorial"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-wb-tutorial-title"
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/30 px-0 sm:items-center sm:px-5"
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
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ebe7e0] px-5 py-4">
              <div>
                <p id="meet-wb-tutorial-title" className="text-[13px] font-medium tracking-[0.12em] text-[#b8973a]">
                  灵魂侧写 · 怎么看
                </p>
                <p className="mt-0.5 text-[11px] tracking-[0.04em] text-[#9a9590]">九维档案小抄，随时可回看</p>
              </div>
              <Pressable
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ebe7e0] bg-white text-[#6e6860] active:bg-[#f4f2ee]"
                aria-label="关闭"
              >
                <X className="size-[18px]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            </div>

            <div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 [-webkit-overflow-scrolling:touch]">
              <p className="font-dossier-serif text-[14px] leading-relaxed tracking-[0.04em] text-[#4a463f]">
                从临时会话点「灵魂侧写」进入本页。下面按区域说明每一块在干什么。
              </p>
              <ol className="mt-5 space-y-5">
                {SECTIONS.map((sec, i) => (
                  <li key={sec.title} className="list-none">
                    <p className="text-[10px] font-medium tracking-[0.16em] text-[#b8973a]">
                      {String(i + 1).padStart(2, '0')} · {sec.title}
                    </p>
                    <p className="mt-2 font-dossier-serif text-[13px] leading-[1.75] tracking-[0.03em] text-[#5b574f]">
                      {sec.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="shrink-0 space-y-2 border-t border-[#ebe7e0] px-5 py-4">
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
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
