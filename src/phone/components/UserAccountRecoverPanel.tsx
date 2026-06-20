import { Copy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { recoverAccountByContact } from '../userSystem/userSystemApi'

type Props = {
  inputCls: string
  primaryBtnCls: string
  labelCls: string
  mutedCls?: string
  cardCls?: string
  onBack?: () => void
  onFillLogin?: (username: string, password: string) => void
}

export function UserAccountRecoverPanel({
  inputCls,
  primaryBtnCls,
  labelCls,
  mutedCls = 'text-[#1C1C1E]/55',
  cardCls = '',
  onBack,
  onFillLogin,
}: Props) {
  const [qq, setQq] = useState('')
  const [dcId, setDcId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ username: string; password: string } | null>(null)

  const handleRecover = useCallback(async () => {
    setError('')
    setResult(null)
    const qqTrim = qq.trim()
    const dcTrim = dcId.trim()
    if (!qqTrim && !dcTrim) {
      setError('请至少填写 QQ 号或 Discord ID')
      return
    }
    setLoading(true)
    try {
      const r = await recoverAccountByContact({ qq: qqTrim, dcId: dcTrim })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setResult({ username: r.username, password: r.password })
    } finally {
      setLoading(false)
    }
  }, [qq, dcId])

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className={`space-y-3 ${cardCls}`}>
      <p className={`text-[12px] leading-5 ${mutedCls}`}>
        输入注册时填写的 QQ 号或 Discord ID（两项都填则须完全匹配），即可找回账号与密码。
      </p>
      {error ? (
        <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="space-y-3 rounded-[12px] border border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <p className="text-[13px] font-medium text-[#166534]">已找到您的账号</p>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className={labelCls}>账号</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{result.username}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[8px] border border-black/10 px-2 py-1 text-[11px]"
                onClick={() => void copyText(result.username)}
              >
                <Copy className="size-3" />
                复制
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className={labelCls}>密码</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{result.password}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[8px] border border-black/10 px-2 py-1 text-[11px]"
                onClick={() => void copyText(result.password)}
              >
                <Copy className="size-3" />
                复制
              </button>
            </div>
          </div>
          {onFillLogin ? (
            <button
              type="button"
              className={`h-10 w-full rounded-[12px] text-[14px] font-medium ${primaryBtnCls}`}
              onClick={() => onFillLogin(result.username, result.password)}
            >
              填入并返回登录
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${labelCls}`}>QQ 号</span>
            <input
              className={inputCls}
              value={qq}
              onChange={(e) => setQq(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="与注册时一致"
            />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${labelCls}`}>Discord ID</span>
            <input
              className={inputCls}
              value={dcId}
              onChange={(e) => setDcId(e.target.value)}
              autoComplete="off"
              placeholder="与注册时一致"
            />
          </label>
          <button
            type="button"
            className={`h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${primaryBtnCls}`}
            disabled={loading}
            onClick={() => void handleRecover()}
          >
            {loading ? '查询中…' : '找回账号密码'}
          </button>
        </>
      )}
      {onBack ? (
        <p className={`text-center text-[12px] ${mutedCls}`}>
          <button type="button" className="text-[#4F46E5] underline" onClick={onBack}>
            返回登录
          </button>
        </p>
      ) : null}
    </div>
  )
}
