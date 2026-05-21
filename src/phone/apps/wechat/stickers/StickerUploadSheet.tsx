import { AnimatePresence, motion } from 'framer-motion'
import { Image, Link as LinkIcon, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

import { useCustomization } from '../../../CustomizationContext'
import { Pressable } from '../../../components/Pressable'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (payload: { url: string; description: string }) => Promise<void> | void
}

type BatchRow = { name: string; url: string; description: string }

function fileNameNoExt(name: string): string {
  const n = String(name ?? '').trim()
  if (!n) return ''
  return n.replace(/\.[^.]+$/, '').trim()
}

function isLikelyStickerUrl(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (/^data:image\//i.test(t)) return true
  if (/^https?:\/\//i.test(t)) return true
  return t.startsWith('/')
}

function linkDisplayName(url: string, index: number): string {
  const raw = url.trim()
  if (!raw) return `链接${index + 1}`
  try {
    const u = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://local')
    const base = u.pathname.split('/').pop() ?? ''
    const label = fileNameNoExt(base)
    if (label) return label
  } catch {
    /* relative path or invalid URL */
  }
  const base = raw.split('/').pop()?.split('?')[0] ?? ''
  const label = fileNameNoExt(base)
  return label || `链接${index + 1}`
}

/** 单行：URL；可选 Tab / | / 首个逗号 后接描述 */
function splitLinkLine(line: string): { url: string; description: string } {
  const trimmed = line.trim()
  if (!trimmed) return { url: '', description: '' }

  const tabIdx = trimmed.indexOf('\t')
  if (tabIdx > 0) {
    const left = trimmed.slice(0, tabIdx).trim()
    const right = trimmed.slice(tabIdx + 1).trim()
    if (isLikelyStickerUrl(left)) return { url: left, description: right }
  }

  const pipeIdx = trimmed.indexOf('|')
  if (pipeIdx > 0) {
    const left = trimmed.slice(0, pipeIdx).trim()
    const right = trimmed.slice(pipeIdx + 1).trim()
    if (isLikelyStickerUrl(left)) return { url: left, description: right }
  }

  const commaIdx = trimmed.indexOf(',')
  if (commaIdx > 0) {
    const left = trimmed.slice(0, commaIdx).trim()
    const right = trimmed.slice(commaIdx + 1).trim()
    if (isLikelyStickerUrl(left)) return { url: left, description: right }
  }

  return { url: trimmed, description: '' }
}

function parseLinkLines(text: string): BatchRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows: BatchRow[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const { url, description } = splitLinkLine(lines[i]!)
    if (!url || !isLikelyStickerUrl(url)) continue
    rows.push({ name: linkDisplayName(url, i), url, description })
  }
  return rows
}

function serializeLinkRows(rows: BatchRow[]): string {
  return rows
    .map((r) => {
      const u = r.url.trim()
      const d = r.description.trim()
      if (!u) return ''
      return d ? `${u}|${d}` : u
    })
    .filter(Boolean)
    .join('\n')
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('readAsDataURL failed'))
    reader.readAsDataURL(file)
  })
}

export function StickerUploadSheet({ open, onClose, onSave }: Props) {
  const { state } = useCustomization()
  const disableTransitions = state.ui.disablePageTransitions
  const [tab, setTab] = useState<'local' | 'link'>('local')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [localFiles, setLocalFiles] = useState<BatchRow[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [linkRows, setLinkRows] = useState<BatchRow[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const batchRows = tab === 'local' ? localFiles : linkRows
  const batchMode = batchRows.length > 1
  const singleLinkRow = tab === 'link' && linkRows.length === 1 ? linkRows[0]! : null
  const previewUrl = tab === 'link' ? (singleLinkRow?.url ?? linkRows[0]?.url ?? '') : url

  const canSave =
    !busy &&
    (tab === 'local'
      ? (batchMode && batchRows.every((x) => x.url.trim().length > 0 && x.description.trim().length > 0)) ||
        (!batchMode && url.trim().length > 0 && description.trim().length > 0)
      : batchMode
        ? batchRows.every((x) => x.url.trim().length > 0 && x.description.trim().length > 0)
        : Boolean(singleLinkRow?.url.trim() && (singleLinkRow.description.trim() || description.trim())))

  const resetDraft = () => {
    setDescription('')
    setUrl('')
    setLocalFiles([])
    setLinkInput('')
    setLinkRows([])
  }

  const updateBatchRowDescription = (idx: number, next: string) => {
    if (tab === 'local') {
      setLocalFiles((prev) => prev.map((row, i) => (i === idx ? { ...row, description: next } : row)))
      return
    }
    setLinkRows((prev) => {
      const nextRows = prev.map((row, i) => (i === idx ? { ...row, description: next } : row))
      setLinkInput(serializeLinkRows(nextRows))
      return nextRows
    })
  }

  const onLinkInputChange = (text: string) => {
    setLinkInput(text)
    const parsed = parseLinkLines(text)
    setLinkRows(parsed)
    if (parsed.length === 1) {
      setUrl(parsed[0]!.url)
      setDescription(parsed[0]!.description)
    } else if (parsed.length > 1) {
      setUrl(parsed[0]?.url ?? '')
      setDescription('')
    } else {
      setUrl('')
      setDescription('')
    }
  }

  const updateSingleLinkDescription = (next: string) => {
    setDescription(next)
    if (singleLinkRow) {
      setLinkRows([{ ...singleLinkRow, description: next }])
    }
  }

  const saveBatch = async (rows: BatchRow[]) => {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!
      await onSave({ url: row.url.trim(), description: row.description.trim() })
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={disableTransitions ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={disableTransitions ? { opacity: 1 } : { opacity: 0 }}
          transition={disableTransitions ? { duration: 0 } : undefined}
          className="absolute inset-0 z-[170] flex flex-col justify-end bg-black/30"
        >
          <Pressable type="button" className="min-h-0 flex-1" onClick={onClose}>
            <span className="sr-only">关闭</span>
          </Pressable>
          <motion.div
            initial={disableTransitions ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={disableTransitions ? { y: 0 } : { y: '100%' }}
            transition={disableTransitions ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-h-[100dvh] overflow-y-auto border-t border-[#eee] bg-white px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-0 shadow-sm"
          >
            <div
              className="-mx-5 mb-2 border-b border-[#eee] bg-white/95 px-5 pb-3 backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)]"
              style={{ paddingTop: 'max(44px, env(safe-area-inset-top, 0px))' }}
            >
              <p className="text-[11px] tracking-[0.24em] text-gray-500">UPLOAD</p>
              <h3 className="mt-1 text-[22px] font-semibold text-black">添加表情</h3>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Pressable
                type="button"
                onClick={() => setTab('local')}
                className={`border px-3 py-1.5 text-[12px] ${tab === 'local' ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
              >
                Local
              </Pressable>
              <Pressable
                type="button"
                onClick={() => setTab('link')}
                className={`border px-3 py-1.5 text-[12px] ${tab === 'link' ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
              >
                Link
              </Pressable>
            </div>

            {tab === 'local' ? (
              <Pressable
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 flex h-24 items-center justify-center border border-dashed border-[#ddd] bg-[#fafafa] text-[13px] text-gray-600"
              >
                <Image className="mr-2 size-4" />
                {localFiles.length > 0 ? `已选择 ${localFiles.length} 张，点击可重选` : '选择本地图片上传（支持批量）'}
              </Pressable>
            ) : (
              <label className="mt-3 block border border-[#eee] bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-[13px] text-gray-700">
                  <LinkIcon className="size-4 shrink-0" />
                  <span className="text-[11px] tracking-[0.12em] text-gray-500">图片 URL（支持批量）</span>
                </div>
                <textarea
                  value={linkInput}
                  onChange={(e) => onLinkInputChange(e.target.value)}
                  placeholder={'每行一个图片 URL\n批量示例：\nhttps://example.com/a.png\nhttps://example.com/b.webp|开心\nhttps://example.com/c.gif,委屈'}
                  rows={linkRows.length > 1 ? 4 : 2}
                  className="mt-2 min-h-[52px] w-full resize-y border-0 bg-transparent text-[13px] text-black outline-none placeholder:text-gray-400"
                />
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  多行即批量导入；同一行可用 Tab、竖线 <span className="font-mono">|</span> 或逗号分隔描述（URL 须以 http(s) 或 data:image 开头）。
                </p>
              </label>
            )}

            {batchMode ? (
              <div className="mt-4 border border-[#eee] bg-[#fafafa] p-3">
                <p className="mb-2 text-[11px] tracking-[0.18em] text-gray-500">BATCH EDIT</p>
                <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                  {batchRows.map((row, idx) => (
                    <div key={`${row.url}-${idx}`} className="flex items-start gap-2 border border-[#eee] bg-white p-2">
                      <div className="h-16 w-16 shrink-0 overflow-hidden border border-[#eee] bg-[#fafafa]">
                        <img src={row.url} alt="" className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-gray-500" title={row.url}>
                          {row.name}
                        </p>
                        <input
                          value={row.description}
                          onChange={(e) => updateBatchRowDescription(idx, e.target.value)}
                          placeholder="填写此表情描述"
                          className="mt-1 h-9 w-full border border-[#eee] px-2 text-[13px] text-black outline-none placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-3 border border-[#eee] bg-[#fafafa] p-3">
                  <div className="aspect-square overflow-hidden border border-[#eee] bg-white">
                    {previewUrl ? (
                      <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[12px] text-gray-400">预览区</div>
                    )}
                  </div>
                </div>

                <label className="mt-4 block">
                  <p className="text-[11px] tracking-[0.18em] text-gray-500">AI DESCRIPTION</p>
                  <textarea
                    value={tab === 'link' ? (singleLinkRow?.description ?? description) : description}
                    onChange={(e) => {
                      if (tab === 'link') updateSingleLinkDescription(e.target.value)
                      else setDescription(e.target.value)
                    }}
                    placeholder="填写此表情的描述（如：一只流泪的小猫，表达极度委屈）。这能帮助角色更好地理解你的情绪。"
                    className="mt-2 h-24 w-full resize-none border border-[#eee] bg-white px-3 py-2 text-[13px] text-black outline-none placeholder:text-gray-400"
                  />
                  <div className="mt-2 inline-flex items-center gap-1 border border-[#eee] bg-white px-2 py-1 text-[11px] text-gray-600">
                    <Sparkles className="size-3" />
                    AI 预览：用户发送了一个表情包：[{previewUrl || '图片链接'}] (描述：
                    {(tab === 'link' ? singleLinkRow?.description : description) || '...'})
                  </div>
                </label>
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Pressable type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center border border-[#eee] bg-white px-5 text-[13px] text-gray-700">
                取消
              </Pressable>
              <Pressable
                type="button"
                onClick={async () => {
                  if (!canSave) return
                  setBusy(true)
                  try {
                    if (batchMode) {
                      await saveBatch(batchRows)
                    } else if (tab === 'link') {
                      const row = singleLinkRow ?? linkRows[0]
                      const u = row?.url.trim() || url.trim()
                      const d = row?.description.trim() || description.trim()
                      await onSave({ url: u, description: d })
                    } else {
                      await onSave({ url: url.trim(), description: description.trim() })
                    }
                    resetDraft()
                    onClose()
                  } finally {
                    setBusy(false)
                  }
                }}
                className={`inline-flex h-11 items-center justify-center px-5 text-[13px] font-medium ${
                  canSave ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {busy ? '保存中…' : batchMode ? `批量导入 ${batchRows.length} 张` : '保存表情'}
              </Pressable>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? [])
                if (!files.length) return
                setBusy(true)
                try {
                  const urls = await Promise.all(files.map((f) => fileToDataUrl(f)))
                  const rows = files
                    .map((f, i) => {
                      const safeUrl = urls[i] ?? ''
                      if (!safeUrl) return null
                      const inferred = fileNameNoExt(f.name) || `表情${i + 1}`
                      return { name: f.name, url: safeUrl, description: files.length > 1 ? '' : inferred }
                    })
                    .filter((row): row is BatchRow => row != null)
                  if (!rows.length) return
                  setLocalFiles(rows)
                  setUrl(rows[0]?.url ?? '')
                  if (rows.length === 1) {
                    const inferred = rows[0]!.description
                    if (inferred) setDescription(inferred)
                  } else {
                    setDescription('')
                  }
                } finally {
                  setBusy(false)
                  e.currentTarget.value = ''
                }
              }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
