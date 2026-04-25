import { apiTheme } from '../theme'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        className="w-full max-w-[520px] rounded-2xl bg-white p-4"
        style={{ boxShadow: apiTheme.shadow, border: `1px solid ${apiTheme.border}` }}
      >
        <p className="text-center text-[16px] font-semibold" style={{ color: apiTheme.text }}>
          {title}
        </p>
        <p className="mt-2 text-center text-[14px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
          {message}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[14px] transition-all duration-200 ease-out"
            style={{ border: `1px solid ${apiTheme.border}`, color: apiTheme.text, background: '#fff' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
            style={{ background: danger ? '#8e8e8e' : apiTheme.accent }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

