import { ImagePlus, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { submitUserReport } from '../../userSystem/userSystemApi'
import type { userAccountThemeTokens } from '../../userSystem/userAccountTheme'
import type { UserReportType } from '../../userSystem/types'

type ThemeTokens = ReturnType<typeof userAccountThemeTokens>

type Props = {
  t: ThemeTokens
  inputCls: string
  onInfo: (message: string) => void
  onError: (message: string) => void
}

const REPORT_TYPE_OPTIONS: { value: UserReportType; label: string }[] = [
  { value: 'reship', label: '二传' },
  { value: 'commercial', label: '商业化/倒卖' },
  { value: 'both', label: '二传及商业化' },
]

const MAX_FILE_BYTES = 5 * 1024 * 1024

async function compressDataUrl(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法处理图片'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('无法读取图片'))
    img.src = dataUrl
  })
}

async function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请上传 JPG、PNG 或 WebP 图片')
  if (file.size > MAX_FILE_BYTES) throw new Error('单张图片不能超过 5MB')

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })

  if (dataUrl.length > 900_000) {
    return compressDataUrl(dataUrl, 1400, 0.82)
  }
  return dataUrl
}

export function UserAccountReportPanel({ t, inputCls, onInfo, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [reportType, setReportType] = useState<UserReportType>('reship')
  const [suspectQq, setSuspectQq] = useState('')
  const [suspectDcId, setSuspectDcId] = useState('')
  const [suspectPlatformInfo, setSuspectPlatformInfo] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handlePickImages = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    onError('')
    setUploading(true)
    try {
      const next = [...evidenceImages]
      for (const file of Array.from(files)) {
        const dataUrl = await readImageFile(file)
        next.push(dataUrl)
      }
      setEvidenceImages(next)
    } catch (e) {
      onError(e instanceof Error ? e.message : '上传图片失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [evidenceImages, onError])

  const removeImage = useCallback((index: number) => {
    setEvidenceImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    onError('')
    onInfo('')
    if (!suspectQq.trim() && !suspectDcId.trim() && !suspectPlatformInfo.trim()) {
      onError('请至少填写被举报人的 QQ、Discord ID 或交易平台信息')
      return
    }
    if (description.trim().length < 10) {
      onError('请填写至少 10 字的举报说明')
      return
    }

    setSubmitting(true)
    try {
      const r = await submitUserReport({
        reportType,
        suspectQq: suspectQq.trim(),
        suspectDcId: suspectDcId.trim(),
        suspectPlatformInfo: suspectPlatformInfo.trim(),
        description: description.trim(),
        evidenceImages,
      })
      if (!r.ok) {
        onError(r.error)
        return
      }
      onInfo(r.message)
      setSuspectQq('')
      setSuspectDcId('')
      setSuspectPlatformInfo('')
      setDescription('')
      setEvidenceImages([])
      setReportType('reship')
    } finally {
      setSubmitting(false)
    }
  }, [
    description,
    evidenceImages,
    onError,
    onInfo,
    reportType,
    suspectDcId,
    suspectPlatformInfo,
    suspectQq,
  ])

  return (
    <div className="space-y-4">
      <div className={`rounded-[16px] border p-4 ${t.card}`}>
        <h2 className="text-[16px] font-semibold">举报二传 / 商业化</h2>
        <p className={`mt-2 text-[13px] leading-6 ${t.muted}`}>
          若发现有人二传 Lumi 资源、倒卖激活码或在闲鱼等平台进行商业化售卖，请在此提交举报。请尽量提供对方 QQ、Discord ID 或交易平台信息，并上传截图证据。
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>举报类型</span>
            <select
              className={inputCls}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as UserReportType)}
            >
              {REPORT_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>被举报人 QQ（选填）</span>
            <input
              className={inputCls}
              value={suspectQq}
              onChange={(e) => setSuspectQq(e.target.value)}
              placeholder="例如：123456789"
              inputMode="numeric"
            />
          </label>

          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>被举报人 Discord ID（选填）</span>
            <input
              className={inputCls}
              value={suspectDcId}
              onChange={(e) => setSuspectDcId(e.target.value)}
              placeholder="例如：username 或 数字 ID"
            />
          </label>

          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>交易平台 / 其他信息（选填）</span>
            <input
              className={inputCls}
              value={suspectPlatformInfo}
              onChange={(e) => setSuspectPlatformInfo(e.target.value)}
              placeholder="例如：闲鱼店铺名、商品链接、微信号等"
            />
          </label>

          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>举报说明</span>
            <textarea
              className={`min-h-[110px] w-full rounded-[10px] border px-3 py-2 text-[14px] outline-none focus:border-[#4F46E5] ${t.input}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请描述发现二传或商业化的经过、时间、渠道等（至少 10 字）"
            />
          </label>

          <div>
            <span className={`mb-2 block text-[12px] ${t.label}`}>截图证据</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              className="hidden"
              onChange={(e) => void handlePickImages(e.target.files)}
            />
            <button
              type="button"
              className={`inline-flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[13px] disabled:opacity-50 ${t.secondaryBtn}`}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {uploading ? '处理中…' : '上传截图'}
            </button>
            <p className={`mt-2 text-[12px] leading-5 ${t.subtitle}`}>
              建议上传包含 QQ/DC 账号、闲鱼商品页、聊天记录等关键信息的截图。
            </p>

            {evidenceImages.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {evidenceImages.map((src, index) => (
                  <div key={`${index}-${src.slice(0, 24)}`} className="relative overflow-hidden rounded-[10px] border">
                    <img src={src} alt={`证据截图 ${index + 1}`} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/55 text-white"
                      aria-label="删除截图"
                      onClick={() => removeImage(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`mt-2 h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
            disabled={submitting || uploading}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '提交中…' : '提交举报'}
          </button>
        </div>
      </div>
    </div>
  )
}
