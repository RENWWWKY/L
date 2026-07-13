import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, MapPin } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { PULSE_MODAL_SPRING } from './constants'
import { usePublishKeyboardInset } from './hooks/usePublishKeyboardInset'
import { PublishAiImageModal } from './components/publish/PublishAiImageModal'
import { PublishFacePickerSheet } from './components/publish/PublishFacePickerSheet'
import { PublishFloatingToolbox } from './components/publish/PublishFloatingToolbox'
import { PublishImagePickerSheet } from './components/publish/PublishImagePickerSheet'
import { PublishLocationSheet } from './components/publish/PublishLocationSheet'
import { PublishMediaMatrix } from './components/publish/PublishMediaMatrix'
import {
  PublishMentionSheet,
  type PublishMentionCandidate,
} from './components/publish/PublishMentionSheet'
import { PublishRichEditor } from './components/publish/PublishRichEditor'
import { PublishUrlImageModal } from './components/publish/PublishUrlImageModal'
import { filesToPulseImageDataUrls, MAX_PULSE_POST_IMAGES } from './pulsePublishImages'
import { insertAtTextareaCursor } from './pulseWeiboRichText'
import { usePulseStore } from './usePulseStore'

type PublishPhase = 'edit' | 'publishing' | 'exit'

export function PublishPostPage({
  authorPovId,
  authorName,
  authorAvatarUrl,
  mentionCandidates,
  onClose,
  onPublished,
}: {
  authorPovId: string
  authorName: string
  authorAvatarUrl?: string
  mentionCandidates?: PublishMentionCandidate[]
  onClose: () => void
  onPublished: () => void
}) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [locationLabel, setLocationLabel] = useState<string | undefined>()
  const [addingImages, setAddingImages] = useState(false)
  const [phase, setPhase] = useState<PublishPhase>('edit')

  const [mentionOpen, setMentionOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [urlModalOpen, setUrlModalOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const publishPost = usePulseStore((s) => s.publishPost)
  const { composerRef, keyboardPadPx } = usePublishKeyboardInset(phase === 'edit')

  const canPublish = text.trim().length > 0 || images.length > 0
  const mentions = useMemo(() => mentionCandidates ?? [], [mentionCandidates])

  const applyInsert = (insert: string) => {
    const el = textareaRef.current
    const { next, cursor } = insertAtTextareaCursor(text, insert, el)
    setText(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  const openImagePicker = () => {
    if (addingImages || images.length >= MAX_PULSE_POST_IMAGES || phase !== 'edit') return
    setImagePickerOpen(true)
  }

  const pickLocalImages = () => {
    setImagePickerOpen(false)
    fileInputRef.current?.click()
  }

  const appendImage = (url: string) => {
    setImages((prev) => (prev.length >= MAX_PULSE_POST_IMAGES ? prev : [...prev, url]))
  }

  const onPickImages = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    const remaining = MAX_PULSE_POST_IMAGES - images.length
    if (remaining <= 0) return

    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, remaining)
    if (!files.length) return

    setAddingImages(true)
    try {
      const urls = await filesToPulseImageDataUrls(files)
      setImages((prev) => [...prev, ...urls].slice(0, MAX_PULSE_POST_IMAGES))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '图片处理失败，请换一张试试')
    } finally {
      setAddingImages(false)
    }
  }

  const submit = () => {
    if (!canPublish || phase !== 'edit' || addingImages) return
    const content = text.trim()
    setPhase('publishing')
    publishPost({
      authorPovId,
      authorName,
      authorAvatarUrl,
      content,
      imageUrls: images.length ? images : undefined,
      locationLabel,
    })
    window.setTimeout(() => setPhase('exit'), 1000)
  }

  const handleExitComplete = () => {
    if (phase === 'exit') onPublished()
  }

  return (
    <motion.div
      className="fixed inset-0 z-[1250] flex flex-col bg-white"
      initial={{ opacity: 0, y: 24 }}
      animate={phase === 'exit' ? { opacity: 0, y: '100vh' } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100vh' }}
      transition={phase === 'exit' ? { duration: 0.55, ease: [0.32, 0.72, 0, 1] } : PULSE_MODAL_SPRING}
      onAnimationComplete={handleExitComplete}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onPickImages(e.target.files)
          e.target.value = ''
        }}
      />

      <header
        className="flex shrink-0 items-center justify-between bg-white/90 px-5 py-3 backdrop-blur-xl"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          onClick={onClose}
          disabled={phase !== 'edit'}
          className="text-[13px] text-neutral-400 disabled:opacity-40"
        >
          取消
        </Pressable>
        <span className="text-[11px] uppercase tracking-[0.28em] text-neutral-300">Publish</span>
        <Pressable
          type="button"
          disabled={!canPublish || phase !== 'edit' || addingImages}
          onClick={submit}
          className={`text-[13px] transition-colors duration-300 ${
            canPublish && phase === 'edit'
              ? 'font-semibold text-[#1C1C1E]'
              : 'font-normal text-neutral-300'
          }`}
        >
          {phase === 'publishing' ? (
            <Loader2
              className="size-4 animate-spin"
              style={{ color: '#D4AF37' }}
              strokeWidth={2}
            />
          ) : (
            '发布'
          )}
        </Pressable>
      </header>

      <div
        ref={composerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{
          paddingBottom: `calc(16px + env(safe-area-inset-bottom, 0px) + ${keyboardPadPx}px)`,
        }}
      >
        <PublishRichEditor
          value={text}
          onChange={setText}
          textareaRef={textareaRef}
          autoFocus
        />

        {phase === 'edit' ? (
          <PublishFloatingToolbox
            onOpenEmoji={() => setEmojiOpen(true)}
            onImage={openImagePicker}
            onHashtag={() => applyInsert('#')}
            onMention={() => setMentionOpen(true)}
            onLocation={() => setLocationOpen(true)}
            imageDisabled={addingImages || images.length >= MAX_PULSE_POST_IMAGES}
          />
        ) : null}

        <PublishMediaMatrix
          urls={images}
          adding={addingImages}
          onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
        />

        {locationLabel ? (
          <div className="flex items-center gap-1.5 px-6 pb-4 text-[11px] text-neutral-400">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>{locationLabel}</span>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {mentionOpen ? (
          <PublishMentionSheet
            candidates={mentions}
            onPick={(name) => {
              applyInsert(`@${name} `)
              setMentionOpen(false)
            }}
            onClose={() => setMentionOpen(false)}
          />
        ) : null}
        {emojiOpen ? (
          <PublishFacePickerSheet
            onPick={(token) => {
              applyInsert(token)
              requestAnimationFrame(() => textareaRef.current?.focus())
            }}
            onClose={() => setEmojiOpen(false)}
          />
        ) : null}
        {locationOpen ? (
          <PublishLocationSheet
            selected={locationLabel}
            onPick={(label) => {
              setLocationLabel(label)
              setLocationOpen(false)
            }}
            onClear={() => {
              setLocationLabel(undefined)
              setLocationOpen(false)
            }}
            onClose={() => setLocationOpen(false)}
          />
        ) : null}
        {imagePickerOpen ? (
          <PublishImagePickerSheet
            onPickLocal={pickLocalImages}
            onPickUrl={() => {
              setImagePickerOpen(false)
              setUrlModalOpen(true)
            }}
            onPickAi={() => {
              setImagePickerOpen(false)
              setAiModalOpen(true)
            }}
            onClose={() => setImagePickerOpen(false)}
          />
        ) : null}
        {aiModalOpen ? (
          <PublishAiImageModal
            onClose={() => setAiModalOpen(false)}
            onGenerated={(url) => appendImage(url)}
          />
        ) : null}
        {urlModalOpen ? (
          <PublishUrlImageModal
            onClose={() => setUrlModalOpen(false)}
            onSubmit={(url) => {
              appendImage(url)
              setUrlModalOpen(false)
            }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
