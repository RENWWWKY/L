import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'

export type MeetResetEncounterPanelPhase = 'confirm' | 'busy' | 'result'

export function MeetResetEncounterPanel({
  open,
  phase,
  resultMessage,
  totalNpcCount,
  wechatAddedCount,
  onClose,
  onConfirm,
}: {
  open: boolean
  phase: MeetResetEncounterPanelPhase
  resultMessage: string | null
  totalNpcCount: number
  wechatAddedCount: number
  onClose: () => void
  onConfirm: () => void
}) {
  const portalEl = getLumiMeetPortalTarget()
  if (!portalEl) return null

  const busy = phase === 'busy'
  const isResult = phase === 'result'

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-reset-panel"
          className="fixed inset-0 z-[340] flex flex-col justify-end bg-black/22 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meet-reset-panel-title"
            className="flex max-h-[min(88vh,640px)] w-full flex-col overflow-hidden rounded-t-[22px] border border-white/70 bg-[#faf9f7]/95 shadow-[0_-24px_80px_rgba(28,24,18,0.18)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-black/10" aria-hidden />

            <div className="flex items-start justify-between gap-3 border-b border-black/[0.05] px-5 pb-3 pt-3">
              <div className="min-w-0 flex-1">
                <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">
                  {isResult ? 'Done | 完成' : 'Data | 数据管理'}
                </p>
                <p id="meet-reset-panel-title" className="mt-1 font-elegant-serif text-[16px] font-medium text-[#2c2a26]">
                  {isResult ? '重置已完成' : '重置遇见应用'}
                </p>
              </div>
              {!busy ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full p-2 text-[#a39e96] hover:bg-black/[0.04]"
                  aria-label="关闭"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="meet-scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {isResult ? (
                <p className="py-6 text-center text-[13px] font-light leading-relaxed text-[#5c534c]" role="status">
                  {resultMessage ?? '遇见已重置。'}
                </p>
              ) : (
                <>
                  <p className="text-center text-[12px] font-light leading-relaxed text-[#8a847b]">
                    等同重新开始寻觅。此操作不可撤销。
                  </p>
                  <p className="meet-caption-en mt-4 text-[9px] uppercase tracking-[0.24em] text-[#c4bfb8]">将清除</p>
                  <ul className="mt-2 space-y-2 text-[12px] font-light leading-relaxed text-[#5c534c]">
                    <li className="flex gap-2">
                      <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden />
                      全部邂逅角色、临时会话、擦肩而过、广场帖子
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden />
                      档案法则中的遇见专属条目
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden />
                      各角色已总结的「[遇见]」长期记忆
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[0.45em] size-1 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden />
                      回溯次数等将恢复默认
                    </li>
                  </ul>
                  <p className="meet-caption-en mt-5 text-[9px] uppercase tracking-[0.24em] text-[#c4bfb8]">仍会保留</p>
                  <p className="mt-2 text-[12px] font-light leading-relaxed text-[#7a756d]">
                    你在 01 / 02 / 03 填写的遇见个人资料、雷达筛选。
                  </p>
                  <p className="meet-caption-en mt-4 text-[9px] uppercase tracking-[0.24em] text-[#c4bfb8]">不会删除</p>
                  <p className="mt-2 text-[12px] font-light leading-relaxed text-[#7a756d]">
                    微信通讯录人设、微信私聊记录、不含 [遇见] 的其它长期记忆。
                  </p>
                  {wechatAddedCount > 0 ? (
                    <p
                      className="mt-4 border-l-2 pl-3 text-[11px] font-light italic leading-relaxed text-[#8a847b]"
                      style={{ borderLeftColor: '#D4AF37' }}
                    >
                      当前有 {wechatAddedCount} 位已加微信的角色：微信侧资料与聊天不受影响，仅清除其遇见记忆与在本应用内的邂逅记录。
                    </p>
                  ) : null}
                  {totalNpcCount > 0 ? (
                    <p className="mt-3 text-center text-[11px] tracking-[0.06em] text-[#9a9590]">
                      将移除 {totalNpcCount} 位邂逅角色记录
                    </p>
                  ) : (
                    <p className="mt-3 text-center text-[11px] tracking-[0.06em] text-[#9a9590]">
                      当前没有邂逅角色记录，但仍会清除可能残留的遇见记忆
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 border-t border-black/[0.05] px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {isResult ? (
                <button type="button" onClick={onClose} className="meet-btn-primary w-full py-3 text-[12px]">
                  知道了
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    className="meet-btn-secondary flex-1 py-3 text-[12px] disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onConfirm}
                    className="meet-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 py-3 text-[12px] disabled:opacity-50"
                  >
                    <RotateCcw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.35} aria-hidden />
                    {busy ? '重置中…' : '确认重置'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
