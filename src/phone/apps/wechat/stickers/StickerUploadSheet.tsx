import { AnimatePresence, motion } from 'framer-motion'
import { Image, Link as LinkIcon, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (payload: { url: string; description: string }) => Promise<void> | void
}

function fileNameNoExt(name: string): string {
  const n = String(name ?? '').trim()
  if (!n) return ''
  return n.replace(/\.[^.]+$/, '').trim()
}

export function StickerUploadSheet({ open, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'local' | 'link'>('local')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [localFiles, setLocalFiles] = useState<Array<{ name: string; url: string; description: string }>>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const batchMode = tab === 'local' && localFiles.length > 1

  const canSave =
    !busy &&
    (tab === 'local'
      ? (batchMode && localFiles.every((x) => x.url.trim().length > 0 && x.description.trim().length > 0)) ||
        (!batchMode && url.trim().length > 0 && description.trim().length > 0)
      : url.trim().length > 0 && description.trim().length > 0)

  const resetDraft = () => {
    setDescription('')
    setUrl('')
    setLocalFiles([])
  }

  const updateLocalFileDescription = (idx: number, next: string) => {
    setLocalFiles((prev) => prev.map((row, i) => (i === idx ? { ...row, description: next } : row)))
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[170] flex flex-col justify-end bg-black/30">
          <Pressable type="button" className="min-h-0 flex-1" onClick={onClose}>
            <span className="sr-only">关闭</span>
          </Pressable>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
              <label className="mt-3 flex h-12 items-center gap-2 border border-[#eee] bg-white px-3 text-[13px] text-gray-700">
                <LinkIcon className="size-4 shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="粘贴图片 URL"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-gray-400"
                />
              </label>
            )}

            {batchMode ? (
              <div className="mt-4 border border-[#eee] bg-[#fafafa] p-3">
                <p className="mb-2 text-[11px] tracking-[0.18em] text-gray-500">BATCH EDIT</p>
                <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                  {localFiles.map((row, idx) => (
                    <div key={`${row.url}-${idx}`} className="flex items-start gap-2 border border-[#eee] bg-white p-2">
                      <div className="h-16 w-16 shrink-0 overflow-hidden border border-[#eee] bg-[#fafafa]">
                        <img src={row.url} alt="" className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-gray-500">{row.name}</p>
                        <input
                          value={row.description}
                          onChange={(e) => updateLocalFileDescription(idx, e.target.value)}
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
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[12px] text-gray-400">预览区</div>
                    )}
                  </div>
                </div>

                <label className="mt-4 block">
                  <p className="text-[11px] tracking-[0.18em] text-gray-500">AI DESCRIPTION</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="填写此表情的描述（如：一只流泪的小猫，表达极度委屈）。这能帮助角色更好地理解你的情绪。"
                    className="mt-2 h-24 w-full resize-none border border-[#eee] bg-white px-3 py-2 text-[13px] text-black outline-none placeholder:text-gray-400"
                  />
                  <div className="mt-2 inline-flex items-center gap-1 border border-[#eee] bg-white px-2 py-1 text-[11px] text-gray-600">
                    <Sparkles className="size-3" />
                    AI 预览：用户发送了一个表情包：[{url || '图片链接'}] (描述：{description || '...'})
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
                    if (tab === 'local' && localFiles.length > 1) {
                      for (let i = 0; i < localFiles.length; i += 1) {
                        const row = localFiles[i]!
                        await onSave({ url: row.url.trim(), description: row.description.trim() })
                      }
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
                {busy ? '保存中…' : batchMode ? `批量导入 ${localFiles.length} 张` : '保存表情'}
              </Pressable>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (!files.length) return
                const rows = files.map((f, i) => {
                  const inferred = fileNameNoExt(f.name) || `表情${i + 1}`
                  return { name: f.name, url: URL.createObjectURL(f), description: files.length > 1 ? '' : inferred }
                })
                setLocalFiles(rows)
                setUrl(rows[0]?.url ?? '')
                if (rows.length === 1) {
                  const inferred = rows[0]!.description
                  if (inferred) setDescription(inferred)
                } else {
                  setDescription('')
                }
                e.currentTarget.value = ''
              }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

