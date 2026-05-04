import { Pressable } from '../../components/Pressable'

export function ShieldedMessageModal({
  open,
  text,
  variant = 'blocked',
  onClose,
}: {
  open: boolean
  text: string | null
  /** blocked：违禁屏蔽；muted：禁言期间未展示的发言 */
  variant?: 'blocked' | 'muted'
  onClose: () => void
}) {
  if (!open) return null
  const body = (text ?? '').trim() || '（无内容）'
  const title = variant === 'muted' ? '禁言期间未展示的发言' : '被自动屏蔽的消息'
  const subtitle =
    variant === 'muted'
      ? '以下为该成员在禁言期间生成的原文；会话内以系统灰条替代气泡，仅群主/管理员可通过「查看」打开本页。'
      : '以下为命中群规前的原文；会话内以系统灰条提示，仅群主/管理员可通过「查看」打开本页。'
  return (
    <div className="fixed inset-0 z-[1220] flex items-center justify-center bg-black/25 px-4" onMouseDown={onClose} role="presentation">
      <div
        className="w-full max-w-[360px] rounded-2xl border border-white/50 bg-white/75 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-center text-[15px] font-semibold text-[#111]">{title}</div>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-[#666]">{subtitle}</p>
        <div className="mt-3 max-h-[min(50vh,320px)] overflow-y-auto rounded-xl bg-white/70 px-3 py-2 text-left text-[14px] leading-[1.5] text-[#222] whitespace-pre-wrap break-words">
          {body}
        </div>
        <Pressable type="button" className="mt-4 w-full rounded-xl bg-[#f5f5f5] py-2 text-[14px] text-[#222] active:bg-[#ededed]" onClick={onClose}>
          关闭
        </Pressable>
      </div>
    </div>
  )
}
