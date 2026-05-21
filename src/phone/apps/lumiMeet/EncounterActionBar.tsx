import { Aperture, Link2, UserRound } from 'lucide-react'
import { ActionPill } from './ActionPill'

export type EncounterActionBarProps = {
  onProfile: () => void
  onConnect: () => void
  connectDisabled: boolean
  /** 已缔结：仍展示「已缔结」，按钮保持可点（仅 loading 时禁用） */
  connectLinked?: boolean
  /** 对方已同意契约，但你日常使用的微信里尚未完成添加 / 结业未走完 */
  connectPendingWechatSync?: boolean
  onTruthMirror: () => void
  anyLoading?: boolean
}

export function EncounterActionBar({
  onProfile,
  onConnect,
  connectDisabled,
  connectLinked,
  connectPendingWechatSync,
  onTruthMirror,
  anyLoading,
}: EncounterActionBarProps) {
  const linked = !!connectLinked
  const pendingSync = !!connectPendingWechatSync
  return (
    <div
      className="pointer-events-auto relative z-20 shrink-0 border-b border-gray-200/80 bg-gradient-to-b from-white via-white/95 to-white/0 px-2 py-2 shadow-[0_10px_28px_rgba(28,24,20,0.06)]"
      role="toolbar"
      aria-label="遇见会话工具栏"
      data-meet-coach="toolbar"
    >
      <div className="flex overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-min items-stretch gap-2 px-1">
          <ActionPill
            icon={UserRound}
            cnLabel="灵魂侧写"
            coachTarget="profile"
            isDisabled={anyLoading}
            onClick={onProfile}
          />
          <ActionPill
            icon={Link2}
            cnLabel={linked ? '已缔结' : '缔结契约'}
            coachTarget="connect"
            isDisabled={anyLoading || connectDisabled}
            className={
              linked
                ? 'ring-1 ring-[#D4AF37]/35 ring-offset-1 ring-offset-white/80'
                : undefined
            }
            onClick={onConnect}
          />
          <ActionPill
            icon={Aperture}
            cnLabel="交换真心话"
            coachTarget="truth"
            isDisabled={anyLoading}
            onClick={onTruthMirror}
          />
        </div>
      </div>
      {linked && pendingSync ? (
        <p className="pointer-events-none px-2 pt-1 text-center text-[10px] tracking-[0.06em] text-[#9a8b6a]/95">
          已知微信号 · 请自行添加或处理验证
        </p>
      ) : linked ? (
        <p className="pointer-events-none px-2 pt-1 text-center text-[10px] tracking-[0.06em] text-[#b8973a]/90">
          契约已定
        </p>
      ) : (
        <p className="pointer-events-none px-2 pt-1 text-center text-[10px] tracking-[0.06em] text-[#c9c4bc]">
          共鸣阈
        </p>
      )}
    </div>
  )
}
