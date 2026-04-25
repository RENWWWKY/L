import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../../components/Pressable'

const CODE_LINES = [
  'bind_relations();',
  'decrypt_fragments();',
  'index_private_nodes();',
  'render_mirror_state();',
] as const

export function DataSyncModal({
  open,
  busy,
  title,
  subtitle,
  contactCount,
  onContactCountChange,
  showContactCountSlider,
  relationPresetLabels,
  selectedRelations,
  onSelectedRelationsChange,
  walletBiasText,
  onWalletBiasTextChange,
  includeBlocked,
  includeHideFromUser,
  includeOnlyTaVisible,
  countLabel = '联系人数量',
  chatContactsCount,
  minMessagesPerContact,
  onChatContactsCountChange,
  onMinMessagesPerContactChange,
  onIncludeBlockedChange,
  onIncludeHideFromUserChange,
  onIncludeOnlyTaVisibleChange,
  onClose,
  onSubmit,
  onUpdate,
}: {
  open: boolean
  busy: boolean
  title: string
  subtitle: string
  /** 4–20，仅在 `showContactCountSlider` 时展示滑杆 */
  contactCount: number
  onContactCountChange: (n: number) => void
  showContactCountSlider: boolean
  /** 非空时展示关系多选（通讯录/聊天/朋友圈）；空则隐藏 */
  relationPresetLabels?: readonly string[]
  selectedRelations: string[]
  onSelectedRelationsChange: (next: string[]) => void
  /** 「我」页钱包补充说明 */
  walletBiasText: string
  onWalletBiasTextChange: (v: string) => void
  includeBlocked?: boolean
  includeHideFromUser?: boolean
  includeOnlyTaVisible?: boolean
  countLabel?: string
  chatContactsCount?: string
  minMessagesPerContact?: string
  onChatContactsCountChange?: (v: string) => void
  onMinMessagesPerContactChange?: (v: string) => void
  onIncludeBlockedChange?: (v: boolean) => void
  onIncludeHideFromUserChange?: (v: boolean) => void
  onIncludeOnlyTaVisibleChange?: (v: boolean) => void
  onClose: () => void
  onSubmit: () => void
  onUpdate?: () => void
}) {
  const toggleRelation = (label: string) => {
    if (selectedRelations.includes(label)) {
      onSelectedRelationsChange(selectedRelations.filter((x) => x !== label))
    } else {
      onSelectedRelationsChange([...selectedRelations, label])
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1460] flex items-center justify-center bg-black/18 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.55 }}
            className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-[#d9dadd] bg-white/90 shadow-[0_24px_80px_rgba(10,10,10,0.12)] backdrop-blur-xl"
          >
            {busy ? (
              <div className="px-5 py-6">
                <div className="text-center text-[11px] tracking-[0.24em] text-[#8d8f95]">数据同步中</div>
                <div className="mt-2 text-center text-[18px] font-medium text-[#18191b]">{title}</div>
                <div className="mt-5 rounded-[20px] bg-[#f4f5f7] p-4">
                  <div className="space-y-2 font-mono text-[12px] leading-6 text-[#585b61]">
                    {CODE_LINES.map((line, index) => (
                      <motion.div
                        key={line}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.25, 1, 0.55] }}
                        transition={{ duration: 1.1, delay: index * 0.12, repeat: Infinity, repeatDelay: 0.3 }}
                      >
                        {`> ${line}`}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-5">
                <div className="text-[11px] tracking-[0.24em] text-[#8d8f95]">MIRROR WECHAT</div>
                <div className="mt-1 text-[22px] font-medium text-[#151618]">{title}</div>
                <div className="mt-2 text-[13px] leading-6 text-[#6b6e74]">{subtitle}</div>

                {showContactCountSlider ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] text-[#8b8e93]">{countLabel}</div>
                      <div className="text-[14px] font-medium tabular-nums text-[#121315]">{contactCount}</div>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={20}
                      step={1}
                      value={contactCount}
                      onChange={(e) => onContactCountChange(Number(e.target.value))}
                      className="mt-2 h-9 w-full cursor-pointer accent-[#16171a]"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-[#a0a3a8]">
                      <span>4</span>
                      <span>20</span>
                    </div>
                  </div>
                ) : null}

                {onChatContactsCountChange ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] text-[#8b8e93]">有聊天记录的联系人数量</div>
                      <div className="text-[14px] font-medium tabular-nums text-[#121315]">{Math.min(20, Math.max(1, Number(chatContactsCount ?? '6') || 6))}</div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={Math.min(20, Math.max(1, Number(chatContactsCount ?? '6') || 6))}
                      onChange={(e) => onChatContactsCountChange(String(Math.round(Number(e.target.value))))}
                      className="mt-2 h-9 w-full cursor-pointer accent-[#16171a]"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-[#a0a3a8]">
                      <span>1</span>
                      <span>20</span>
                    </div>
                  </div>
                ) : null}

                {onMinMessagesPerContactChange ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] text-[#8b8e93]">每个联系人最少气泡消息数</div>
                      <div className="text-[14px] font-medium tabular-nums text-[#121315]">{Math.min(80, Math.max(1, Number(minMessagesPerContact ?? '12') || 12))}</div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={80}
                      step={1}
                      value={Math.min(80, Math.max(1, Number(minMessagesPerContact ?? '12') || 12))}
                      onChange={(e) => onMinMessagesPerContactChange(String(Math.round(Number(e.target.value))))}
                      className="mt-2 h-9 w-full cursor-pointer accent-[#16171a]"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-[#a0a3a8]">
                      <span>1</span>
                      <span>80</span>
                    </div>
                  </div>
                ) : null}

                {relationPresetLabels?.length ? (
                  <div className="mt-4">
                    <div className="text-[12px] text-[#8b8e93]">关系偏向（可多选）</div>
                    <div className="mt-1 text-[11px] leading-[1.45] text-[#a0a3a8]">
                      不选则额外联系人在常见关系里随机组合；已绑定的人脉 NPC 仍会全部出现在通讯录中。
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {relationPresetLabels.map((label) => {
                        const on = selectedRelations.includes(label)
                        return (
                          <Pressable
                            key={label}
                            type="button"
                            onClick={() => toggleRelation(label)}
                            className={`rounded-full px-3.5 py-2 text-[13px] transition-colors ${
                              on
                                ? 'bg-[#16171a] text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)]'
                                : 'border border-[#e4e6ea] bg-white text-[#3a3c42]'
                            }`}
                          >
                            {label}
                          </Pressable>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {onWalletBiasTextChange ? (
                  <div className="mt-4">
                    <div className="text-[12px] text-[#8b8e93]">钱包 / 账单补充说明（可选）</div>
                    <textarea
                      rows={3}
                      value={walletBiasText}
                      onChange={(e) => onWalletBiasTextChange(e.target.value)}
                      placeholder="不填则按人设自然生成"
                      className="mt-1 w-full resize-none rounded-[16px] border border-[#e4e6ea] bg-white px-4 py-3 text-[14px] text-[#121315] outline-none placeholder:text-[#b4b7bd]"
                    />
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  {onIncludeBlockedChange ? (
                    <label className="flex items-center justify-between rounded-[16px] bg-[#f5f6f8] px-4 py-3 text-[13px] text-[#25272b]">
                      <span>包含黑名单联系人</span>
                      <input type="checkbox" checked={!!includeBlocked} onChange={(e) => onIncludeBlockedChange(e.target.checked)} />
                    </label>
                  ) : null}
                  {onIncludeHideFromUserChange ? (
                    <label className="flex items-center justify-between rounded-[16px] bg-[#f5f6f8] px-4 py-3 text-[13px] text-[#25272b]">
                      <span>生成“屏蔽了你”朋友圈</span>
                      <input
                        type="checkbox"
                        checked={!!includeHideFromUser}
                        onChange={(e) => onIncludeHideFromUserChange(e.target.checked)}
                      />
                    </label>
                  ) : null}
                  {onIncludeOnlyTaVisibleChange ? (
                    <label className="flex items-center justify-between rounded-[16px] bg-[#f5f6f8] px-4 py-3 text-[13px] text-[#25272b]">
                      <span>生成“仅 XX 可见”黑盒动态</span>
                      <input
                        type="checkbox"
                        checked={!!includeOnlyTaVisible}
                        onChange={(e) => onIncludeOnlyTaVisibleChange(e.target.checked)}
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <Pressable
                    type="button"
                    onClick={onClose}
                    className="h-11 flex-1 rounded-[16px] border border-[#dfe1e5] text-[14px] text-[#60636a]"
                  >
                    取消
                  </Pressable>
                  {onUpdate ? (
                    <Pressable
                      type="button"
                      onClick={onUpdate}
                      className="h-11 flex-1 rounded-[16px] border border-[#d7d9de] bg-white text-[14px] text-[#2f3137] shadow-[0_8px_20px_rgba(0,0,0,0.05)]"
                    >
                      ♻ 更新
                    </Pressable>
                  ) : null}
                  <Pressable
                    type="button"
                    onClick={onSubmit}
                    className="h-11 flex-1 rounded-[16px] bg-[#16171a] text-[14px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                  >
                    ✨ 生成
                  </Pressable>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
