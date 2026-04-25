import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Delete } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { maskRealName, toMoneyText } from './redPacketUtils'

const EASE = [0.4, 0, 0.2, 1] as const

function NumberKeypad({
  onInput,
  onDelete,
}: {
  onInput: (n: string) => void
  onDelete: () => void
}) {
  const cells = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
  return (
    <div className="grid grid-cols-3 border-t border-[#ececec] bg-white">
      {cells.map((c, i) =>
        c ? (
          <Pressable
            key={`${c}-${i}`}
            type="button"
            onClick={c === 'del' ? onDelete : () => onInput(c)}
            className="flex h-14 items-center justify-center border-b border-r border-[#f0f0f0] text-[22px] text-black active:bg-[#f3f3f3]"
          >
            {c === 'del' ? <Delete size={18} /> : c}
          </Pressable>
        ) : (
          <div key={`empty-${i}`} className="h-14 border-b border-r border-[#f0f0f0] bg-[#fafafa]" />
        ),
      )}
    </div>
  )
}

export function RedPacketSendScreen({
  peerName,
  peerRealName,
  peerAvatarUrl,
  balance,
  hasPaymentPassword,
  onBack,
  onSetPassword,
  onVerifyPassword,
  onSubmit,
}: {
  peerName: string
  peerRealName: string
  peerAvatarUrl?: string
  balance: number
  hasPaymentPassword: boolean
  onBack: () => void
  onSetPassword: (pwd: string) => void
  onVerifyPassword: (pwd: string) => Promise<boolean>
  onSubmit: (payload: { amount: number; remark: string }) => Promise<boolean>
}) {
  const [amountText, setAmountText] = useState('')
  const [remark, setRemark] = useState('恭喜发财，大吉大利')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [settingPwd, setSettingPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const amount = useMemo(() => Number(amountText || 0), [amountText])
  const canSubmit = amount > 0 && amount <= balance
  const realMasked = maskRealName(peerRealName || peerName)

  const pushPwd = async (digit: string) => {
    if (loading) return
    if (settingPwd) {
      if (pwd.length < 6) {
        const next = `${pwd}${digit}`.slice(0, 6)
        setPwd(next)
        if (next.length === 6) setError('请再次输入支付密码')
        return
      }
      const next2 = `${pwd2}${digit}`.slice(0, 6)
      setPwd2(next2)
      if (next2.length === 6) {
        if (next2 !== pwd) {
          setPwd('')
          setPwd2('')
          setError('两次输入不一致，请重试')
          return
        }
        onSetPassword(next2)
        setError('支付密码已设置')
        setSettingPwd(false)
        setPwd('')
        setPwd2('')
      }
      return
    }
    if (pwd.length >= 6) return
    const next = `${pwd}${digit}`.slice(0, 6)
    setPwd(next)
    if (next.length === 6) {
      setLoading(true)
      const ok = await onVerifyPassword(next)
      if (!ok) {
        setError('支付密码错误')
        setPwd('')
        setLoading(false)
        return
      }
      const sent = await onSubmit({ amount, remark: remark.trim() || '恭喜发财，大吉大利' })
      setLoading(false)
      if (!sent) {
        setError('余额不足或发送失败')
        setPwd('')
        return
      }
      onBack()
    }
  }

  const backspacePwd = () => {
    if (settingPwd && pwd.length >= 6 && pwd2.length > 0) {
      setPwd2((s) => s.slice(0, -1))
      return
    }
    if (settingPwd && pwd.length > 0 && pwd.length < 6) {
      setPwd((s) => s.slice(0, -1))
      return
    }
    if (!settingPwd) setPwd((s) => s.slice(0, -1))
  }

  const pwDots = settingPwd ? (pwd.length < 6 ? pwd.length : pwd2.length) : pwd.length

  return (
    <div className="absolute inset-0 z-[1400] flex min-h-0 flex-col bg-[#f9f9f9]">
      <div className="flex h-12 items-center justify-between border-b border-[#ececec] bg-white px-2">
        <Pressable type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center active:opacity-70">
          <ChevronLeft size={20} />
        </Pressable>
        <div className="text-[17px] font-medium text-black">发红包</div>
        <div className="w-10" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-[#e6e6e6]">
            {peerAvatarUrl ? <img src={peerAvatarUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] text-black">给 {peerName}（{realMasked}）</p>
            <p className="mt-1 text-[12px] text-[#888]">零钱余额 ￥{toMoneyText(balance)}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white">
          <label className="flex items-center gap-3 border-b border-[#efefef] px-4 py-4">
            <span className="text-[15px] text-black">金额</span>
            <input
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, '').replace(/^(\d+\.\d{0,2}).*$/, '$1'))}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-right text-[20px] text-black outline-none placeholder:text-[#bbb]"
            />
            <span className="text-[15px] text-[#666]">元</span>
          </label>
          <label className="flex items-center gap-3 px-4 py-4">
            <span className="text-[15px] text-black">备注</span>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value.slice(0, 64))}
              className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-[#555] outline-none"
            />
          </label>
        </div>

        <div className="mt-8 text-center text-[44px] font-semibold tabular-nums text-black">￥{toMoneyText(amount)}</div>

        <Pressable
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            setError('')
            setPwd('')
            if (!hasPaymentPassword) {
              setSettingPwd(true)
              setSheetOpen(true)
              return
            }
            setSettingPwd(false)
            setSheetOpen(true)
          }}
          className={`mt-auto mb-6 h-12 w-full rounded-[12px] text-[16px] ${canSubmit ? 'bg-black text-white active:bg-[#222]' : 'bg-[#e9e9e9] text-[#9d9d9d]'}`}
        >
          塞钱进红包
        </Pressable>
      </div>

      <AnimatePresence>
        {sheetOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-0 z-[1450] flex flex-col justify-end bg-black/20"
          >
            <Pressable type="button" className="min-h-0 flex-1" onClick={() => setSheetOpen(false)}>
              {null}
            </Pressable>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.24, ease: EASE }}
              className="bg-white"
            >
              <div className="px-4 pb-3 pt-4 text-center">
                <p className="text-[15px] text-black">{settingPwd ? '设置支付密码' : '输入支付密码'}</p>
                <p className="mt-1 text-[12px] text-[#888]">
                  {settingPwd ? (pwd.length < 6 ? '请输入 6 位数字密码' : '请再次输入确认') : '红包金额将从零钱中扣除'}
                </p>
                <div className="mt-3 grid grid-cols-6 overflow-hidden rounded-[10px] border border-[#e6e6e6]">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex h-11 items-center justify-center border-r border-[#efefef] last:border-r-0">
                      {i < pwDots ? <span className="h-2.5 w-2.5 rounded-full bg-black" /> : null}
                    </div>
                  ))}
                </div>
                {error ? <p className="mt-2 text-[12px] text-[#d23b3b]">{error}</p> : null}
              </div>
              <NumberKeypad onInput={(n) => void pushPwd(n)} onDelete={backspacePwd} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
