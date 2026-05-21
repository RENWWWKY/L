import { motion } from 'framer-motion'

import { Pressable } from '../../components/Pressable'
import type { MeetContractStatusPayload } from './meetTypes'

export function MeetContractUserRequestCard({
  selfAvatarUrl,
  showAvatar = true,
  avatarRadiusPx = 8,
}: {
  selfAvatarUrl?: string
  showAvatar?: boolean
  avatarRadiusPx?: number
}) {
  const avatarSrc = selfAvatarUrl?.trim()
  return (
    <motion.div className="flex w-full max-w-full shrink-0 justify-end overflow-x-visible">
      <motion.div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[min(300px,calc(100vw-24px-24px-40px-12px))] rounded-[14px] border-[0.5px] border-[#ebe7e0] bg-[#F9F8F6] px-4 py-3 shadow-[0_12px_36px_rgba(28,22,16,0.06)]"
        >
          <p className="text-[9px] tracking-[0.2em] text-[#a8a4a0]">系统投递</p>
          <p className="mt-2 font-dossier-serif text-[15px] italic leading-relaxed tracking-[0.05em] text-[#1a1918]">
            我希望能与你交换联络方式。
          </p>
        </motion.div>
        {showAvatar ? (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : (
            <motion.div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          )
        ) : null}
      </motion.div>
    </motion.div>
  )
}

export function MeetContractNpcResponseCard({
  payload,
  onCopyWechat,
  otherAvatarUrl,
  showAvatar = true,
  avatarRadiusPx = 8,
}: {
  payload: MeetContractStatusPayload
  onCopyWechat?: (id: string) => void
  otherAvatarUrl?: string
  showAvatar?: boolean
  avatarRadiusPx?: number
}) {
  const accepted = payload.outcome === 'accepted'
  const wx = payload.charWechatId?.trim() ?? ''
  const showWechatBlock = accepted && wx.length > 0
  const avatarSrc = otherAvatarUrl?.trim()

  return (
    <motion.div className="flex w-full max-w-full shrink-0 overflow-x-visible">
      <motion.div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-3">
        {showAvatar ? (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : (
            <motion.div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.06)',
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          )
        ) : null}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className={`min-w-0 max-w-[min(320px,calc(100vw-24px-24px-40px-12px))] overflow-hidden rounded-[14px] border-[0.5px] shadow-[0_14px_40px_rgba(22,18,14,0.07)] ${
            accepted
              ? 'border-[#ebe7e0] border-l-[3px] border-l-[#D4AF37] bg-white px-4 py-3'
              : 'border-[#ebe7e0] bg-[#FDFCFA] px-0 py-0'
          }`}
        >
          {accepted ? (
            <>
              <p className="text-[9px] tracking-[0.2em] text-[#b8973a]">契约已响应</p>
              {showWechatBlock ? (
                <>
                  <Pressable
                    type="button"
                    onClick={() => onCopyWechat?.(wx)}
                    className="mt-4 block w-full rounded-[12px] border border-[#f0ebe3] bg-[#faf9f7] px-3 py-3 text-left transition-colors active:bg-[#f3efe8]"
                    aria-label="复制对方微信号"
                  >
                    <p className="text-[10px] tracking-[0.14em] text-[#9a9590]">对方微信 · 点击复制</p>
                    <p className="mt-1 break-all font-mono text-[14px] tracking-[0.08em] text-[#1a1918]">{wx}</p>
                  </Pressable>
                  <p className="mt-3 text-[11px] leading-relaxed tracking-[0.04em] text-[#9a9590]">
                    缔结仅表示双方已知微信号，尚未自动成为微信好友。请复制后到微信搜索添加，或留意「新的朋友」里对方发来的验证。
                  </p>
                </>
              ) : null}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="relative px-4 py-3.5"
            >
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#e8e4dc] to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.12 }}
              />
              <motion.div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f0ebe3] bg-[#faf8f5]"
                  aria-hidden
                >
                  <span className="block h-1.5 w-1.5 rounded-full bg-[#c4bdb4]" />
                </span>
                <motion.div
                  className="min-w-0 flex-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                >
                  <p className="text-[9px] tracking-[0.18em] text-[#a8a4a0]">契约回响</p>
                  <p className="mt-2 font-dossier-serif text-[15px] italic leading-relaxed tracking-[0.05em] text-[#3d3a34]">
                    对方暂缓交换私下联络
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed tracking-[0.04em] text-[#9a9590]">
                    对方暂未应允互换；具体态度见下方回复，日后仍可再次尝试。
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function MeetContractCharRequestCard({
  resolved = false,
  otherAvatarUrl,
  showAvatar = true,
  avatarRadiusPx = 8,
  onAccept,
  onDecline,
  disabled = false,
}: {
  resolved?: boolean
  otherAvatarUrl?: string
  showAvatar?: boolean
  avatarRadiusPx?: number
  onAccept?: () => void
  onDecline?: () => void
  disabled?: boolean
}) {
  const avatarSrc = otherAvatarUrl?.trim()
  return (
    <motion.div className="flex w-full max-w-full shrink-0 overflow-x-visible">
      <motion.div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-3">
        {showAvatar ? (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : (
            <motion.div
              className="h-10 w-10 shrink-0"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                background: 'rgba(0,0,0,0.06)',
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          )
        ) : null}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 max-w-[min(320px,calc(100vw-24px-24px-40px-12px))] rounded-[14px] border-[0.5px] border-[#ebe7e0] bg-white px-4 py-3.5 shadow-[0_14px_40px_rgba(22,18,14,0.07)]"
        >
          <p className="text-[9px] tracking-[0.18em] text-[#b8973a]">对方邀约</p>
          <p className="mt-2 font-dossier-serif text-[15px] italic leading-relaxed tracking-[0.05em] text-[#1a1918]">
            希望能与你交换私下联络方式。
          </p>
          {!resolved ? (
            <motion.div className="mt-4 flex gap-2">
              <Pressable
                type="button"
                disabled={disabled}
                onClick={onDecline}
                className="flex-1 rounded-full border border-[#e8e4dc] bg-[#f7f5f2] py-2.5 text-[12px] tracking-[0.06em] text-[#6e6860] transition-opacity disabled:opacity-45"
              >
                暂缓
              </Pressable>
              <Pressable
                type="button"
                disabled={disabled}
                onClick={onAccept}
                className="flex-1 rounded-full border border-[#1a1918] bg-[#141312] py-2.5 text-[12px] tracking-[0.06em] text-[#f7f4ef] transition-opacity disabled:opacity-45"
              >
                同意互换
              </Pressable>
            </motion.div>
          ) : (
            <p className="mt-3 text-[11px] tracking-[0.04em] text-[#9a9590]">你已回应此邀约</p>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function MeetContractUserResponseCard({
  outcome,
  selfAvatarUrl,
  showAvatar = true,
  avatarRadiusPx = 8,
}: {
  outcome: 'accepted' | 'rejected'
  selfAvatarUrl?: string
  showAvatar?: boolean
  avatarRadiusPx?: number
}) {
  const accepted = outcome === 'accepted'
  const avatarSrc = selfAvatarUrl?.trim()
  return (
    <motion.div className="flex w-full max-w-full shrink-0 justify-end overflow-x-visible">
      <motion.div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-[min(300px,calc(100vw-24px-24px-40px-12px))] rounded-[14px] border-[0.5px] px-4 py-3 shadow-[0_12px_36px_rgba(28,22,16,0.06)] ${
            accepted ? 'border-[#ebe7e0] border-l-[3px] border-l-[#D4AF37] bg-[#FDFCFA]' : 'border-[#ebe7e0] bg-[#F9F8F6]'
          }`}
        >
          <p className={`text-[9px] tracking-[0.18em] ${accepted ? 'text-[#b8973a]' : 'text-[#a8a4a0]'}`}>
            {accepted ? '你已应允' : '你已暂缓'}
          </p>
          <p className="mt-2 font-dossier-serif text-[14px] italic leading-relaxed tracking-[0.05em] text-[#3d3a34]">
            {accepted ? '同意与对方交换联络方式。' : '暂不交换私下联络方式。'}
          </p>
        </motion.div>
        {showAvatar ? (
          avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-cover"
              style={{
                borderRadius: `${avatarRadiusPx}px`,
                border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
              }}
              aria-hidden
            />
          ) : null
        ) : null}
      </motion.div>
    </motion.div>
  )
}
