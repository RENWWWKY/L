import { AnimatePresence, motion } from 'framer-motion'
import { Image, Link as LinkIcon, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (payload: { url: string; description: string }) => Promise<void> | void
}

export function StickerUploadSheet({ open, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'local' | 'link'>('local')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const canSave = url.trim().length > 0 && description.trim().length > 0 && !busy

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
            className="rounded-t-[28px] border-t border-[#eee] bg-white px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-0 shadow-sm"
          >
            <div
              className="-mx-5 mb-2 border-b border-[#eee] bg-white/95 px-5 pb-3 backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)]"
              style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
            >
              <p className="text-[11px] tracking-[0.24em] text-gray-500">UPLOAD</p>
              <h3 className="mt-1 text-[22px] font-semibold text-black">添加表情</h3>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Pressable
                type="button"
                onClick={() => setTab('local')}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${tab === 'local' ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
              >
                Local
              </Pressable>
              <Pressable
                type="button"
                onClick={() => setTab('link')}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${tab === 'link' ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
              >
                Link
              </Pressable>
            </div>

            {tab === 'local' ? (
              <Pressable
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 flex h-24 items-center justify-center rounded-[16px] border border-dashed border-[#ddd] bg-[#fafafa] text-[13px] text-gray-600"
              >
                <Image className="mr-2 size-4" />
                选择本地图片上传
              </Pressable>
            ) : (
              <label className="mt-3 flex h-12 items-center gap-2 rounded-[14px] border border-[#eee] bg-white px-3 text-[13px] text-gray-700">
                <LinkIcon className="size-4 shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="粘贴图片 URL"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-gray-400"
                />
              </label>
            )}

            <div className="mt-3 rounded-[16px] border border-[#eee] bg-[#fafafa] p-3">
              <div className="aspect-square overflow-hidden rounded-[12px] border border-[#eee] bg-white">
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
                className="mt-2 h-24 w-full resize-none rounded-[14px] border border-[#eee] bg-white px-3 py-2 text-[13px] text-black outline-none placeholder:text-gray-400"
              />
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#eee] bg-white px-2 py-1 text-[11px] text-gray-600">
                <Sparkles className="size-3" />
                AI 预览：用户发送了一个表情包：[{url || '图片链接'}] (描述：{description || '...'})
              </div>
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <Pressable type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-full border border-[#eee] bg-white px-5 text-[13px] text-gray-700">
                取消
              </Pressable>
              <Pressable
                type="button"
                onClick={async () => {
                  if (!canSave) return
                  setBusy(true)
                  try {
                    await onSave({ url: url.trim(), description: description.trim() })
                    setDescription('')
                    setUrl('')
                    onClose()
                  } finally {
                    setBusy(false)
                  }
                }}
                className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[13px] font-medium ${
                  canSave ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {busy ? '保存中…' : '保存表情'}
              </Pressable>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const local = URL.createObjectURL(f)
                setUrl(local)
                e.currentTarget.value = ''
              }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

