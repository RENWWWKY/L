import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Link as LinkIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { Pressable } from '../../../components/Pressable'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (payload: { name: string; coverUrl: string }) => Promise<void> | void
}

export function CreateGroupModal({ open, onClose, onCreate }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const creatingRef = useRef(false)
  const [name, setName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const canCreate = name.trim().length > 0 && coverUrl.trim().length > 0 && !busy

  const pickLocal = () => inputRef.current?.click()

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[160] flex flex-col justify-end bg-black/30"
          >
            <Pressable type="button" className="min-h-0 flex-1" onClick={onClose}>
              <span className="sr-only">关闭</span>
            </Pressable>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[28px] border-t border-[#eee] bg-white px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5 shadow-sm"
            >
              <p className="text-[11px] tracking-[0.24em] text-gray-500">NEW GROUP</p>
              <h3 className="mt-1 text-[22px] font-semibold text-black">新建表情组</h3>

              <label className="mt-4 block">
                <p className="text-[11px] tracking-[0.18em] text-gray-500">COLLECTION NAME</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：委屈猫猫"
                  className="mt-2 w-full border-0 border-b border-[#eee] bg-transparent px-0 py-2 text-[16px] text-black outline-none placeholder:text-gray-400"
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Pressable
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    pickLocal()
                  }}
                  className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#eee] bg-white text-[13px] text-gray-700"
                >
                  <ImagePlus className="size-4" />
                  本地上传
                </Pressable>
                <label className="flex h-11 items-center gap-2 rounded-[14px] border border-[#eee] bg-white px-3 text-[13px] text-gray-700">
                  <LinkIcon className="size-4 shrink-0" />
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="粘贴封面链接"
                    className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-gray-400"
                  />
                  <Pressable
                    type="button"
                    onClick={() => setCoverUrl(urlInput.trim())}
                    className="rounded-full border border-[#eee] px-2 py-0.5 text-[11px] text-gray-600"
                  >
                    应用
                  </Pressable>
                </label>
              </div>

              <div className="mt-4 rounded-[18px] border border-[#eee] bg-[#fafafa] p-3">
                <p className="text-[11px] tracking-[0.18em] text-gray-500">COVER PREVIEW</p>
                <div className="mt-2 aspect-square overflow-hidden rounded-[14px] border border-[#eee] bg-white">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[12px] text-gray-400">上传后预览封面</div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Pressable
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-[#eee] bg-white px-5 text-[13px] text-gray-700"
                >
                  取消
                </Pressable>
                <Pressable
                  type="button"
                  onClick={async () => {
                    if (!canCreate || creatingRef.current) return
                    creatingRef.current = true
                    setBusy(true)
                    try {
                      await onCreate({ name: name.trim(), coverUrl: coverUrl.trim() })
                      setName('')
                      setCoverUrl('')
                      setUrlInput('')
                      onClose()
                    } finally {
                      creatingRef.current = false
                      setBusy(false)
                    }
                  }}
                  className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[13px] font-medium ${
                    canCreate ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {busy ? '创建中…' : '创建分组'}
                </Pressable>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const src = URL.createObjectURL(f)
                  setCropSrc(src)
                  e.currentTarget.value = ''
                }}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ImageCropperModal
        open={!!cropSrc}
        imageSrc={cropSrc ?? ''}
        title="裁剪分组封面"
        aspect={1}
        maxSide={640}
        objectFit="contain"
        onCancel={() => setCropSrc(null)}
        onConfirm={(dataUrl) => {
          setCoverUrl(dataUrl)
          setCropSrc(null)
        }}
      />
    </>
  )
}

