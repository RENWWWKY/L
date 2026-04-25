import { Pressable } from '../../../components/Pressable'

type KeyId = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back'

/**
 * 自定义数字键盘：避免金额输入框触发系统键盘。
 * variant `amount`：含小数点；`pin`：仅 0-9 + 删除。
 */
const PLATINUM_GOLD = '#c9a76a'
const PLATINUM_BORDER = 'rgba(201, 167, 106, 0.35)'

export function CustomNumericKeyboard({
  variant,
  onKey,
  className = '',
  tone = 'default',
}: {
  variant: 'amount' | 'pin'
  onKey: (key: KeyId) => void
  className?: string
  /** 白金风：浅底 + 香槟金描边 */
  tone?: 'default' | 'platinum'
}) {
  const keys: (KeyId | null)[][] =
    variant === 'pin'
      ? [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          [null, '0', 'back'],
        ]
      : [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['.', '0', 'back'],
        ]

  const cellClass =
    tone === 'platinum'
      ? 'flex h-12 items-center justify-center rounded-xl border bg-white text-[20px] font-medium tracking-wide text-[#333] transition-transform duration-100 ease-out active:scale-[0.98] active:bg-[#faf8f4]'
      : 'flex h-12 items-center justify-center rounded-xl border border-[#e8e8e8] bg-white text-[20px] font-medium tracking-wide text-black transition-transform duration-100 ease-out active:scale-[0.98] active:bg-[#f5f5f5]'
  const cellStyle =
    tone === 'platinum'
      ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', borderColor: PLATINUM_BORDER, color: '#333' }
      : { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }

  return (
    <div className={`grid gap-2 ${className}`}>
      {keys.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-2">
          {row.map((k, ki) =>
            k == null ? (
              <div key={`e-${ki}`} className="h-12" aria-hidden />
            ) : (
              <Pressable
                key={k}
                type="button"
                onClick={() => onKey(k)}
                className={cellClass}
                style={cellStyle}
              >
                {k === 'back' ? (
                  <span className="text-[15px] font-normal" style={{ color: tone === 'platinum' ? PLATINUM_GOLD : '#666' }}>
                    删除
                  </span>
                ) : (
                  k
                )}
              </Pressable>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
