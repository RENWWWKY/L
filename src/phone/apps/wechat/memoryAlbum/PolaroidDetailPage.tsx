import { motion } from 'framer-motion'

import { ArrowLeft, Trash2 } from 'lucide-react'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TextareaAutosize from 'react-textarea-autosize'



import { Pressable } from '../../../components/Pressable'

import { WeChatConfirmDialog } from '../WeChatConfirmDialog'

import { deleteSavedAlbumPhoto } from './loadCharacterChatPhotos'

import './memoryAlbum.css'

import { formatDefaultPolaroidTitle, type PhotoItem } from './memoryAlbumTypes'

import { PolaroidCard } from './PolaroidCard'

import { useMemoryAlbumStore } from './useMemoryAlbumStore'



type PolaroidDetailPageProps = {

  photo: PhotoItem

  characterId: string

  characterName: string

  onBack: () => void

  onDeleted: () => void

}



export function PolaroidDetailPage({

  photo,

  characterId,

  characterName,

  onBack,

  onDeleted,

}: PolaroidDetailPageProps) {

  const getPolaroidDetail = useMemoryAlbumStore((s) => s.getPolaroidDetail)

  const updatePolaroidDetail = useMemoryAlbumStore((s) => s.updatePolaroidDetail)

  const removePolaroidDetail = useMemoryAlbumStore((s) => s.removePolaroidDetail)



  const defaultTitle = useMemo(

    () => formatDefaultPolaroidTitle(photo.timestamp, characterName),

    [photo.timestamp, characterName],

  )



  const stored = getPolaroidDetail(characterId, photo.messageId)

  const [title, setTitle] = useState(stored?.customTitle ?? '')

  const [essay, setEssay] = useState(stored?.essay ?? '')

  const [deleteOpen, setDeleteOpen] = useState(false)

  const [deleting, setDeleting] = useState(false)



  useEffect(() => {

    const detail = getPolaroidDetail(characterId, photo.messageId)

    setTitle(detail?.customTitle ?? '')

    setEssay(detail?.essay ?? '')

  }, [characterId, getPolaroidDetail, photo.messageId])



  const persist = useCallback(

    (patch: { customTitle?: string; essay?: string }) => {

      updatePolaroidDetail(characterId, photo.messageId, patch)

    },

    [characterId, photo.messageId, updatePolaroidDetail],

  )



  useEffect(() => {

    const timer = window.setTimeout(() => {

      persist({ customTitle: title, essay })

    }, 320)

    return () => window.clearTimeout(timer)

  }, [essay, persist, title])



  const displayTitle = title.trim() || defaultTitle



  const handleDelete = useCallback(async () => {

    if (deleting) return

    setDeleting(true)

    try {

      await deleteSavedAlbumPhoto(photo.messageId)

      removePolaroidDetail(characterId, photo.messageId)

      setDeleteOpen(false)

      onDeleted()

    } finally {

      setDeleting(false)

    }

  }, [characterId, deleting, onDeleted, photo.messageId, removePolaroidDetail])



  return (

    <motion.div

      className="fixed inset-0 z-[56000] flex flex-col bg-[#F0EFEA]"

      initial={{ opacity: 0, y: 24 }}

      animate={{ opacity: 1, y: 0 }}

      exit={{ opacity: 0, y: 24 }}

    >

      <div

        className="shrink-0 border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl"

        style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}

      >

        <div className="flex items-center gap-2 px-3 py-3">

          <Pressable

            onClick={onBack}

            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100"

            aria-label="返回相册"

          >

            <ArrowLeft className="size-5 text-neutral-800" strokeWidth={1.75} />

          </Pressable>

          <div className="min-w-0 flex-1">

            <p className="truncate text-[16px] font-medium text-neutral-900">拍立得详情</p>

            <p className="text-[10px] tracking-[0.18em] text-neutral-400">POLAROID DETAIL</p>

          </div>

          <Pressable

            onClick={() => setDeleteOpen(true)}

            className="flex h-10 w-10 items-center justify-center rounded-full text-red-500 hover:bg-red-50"

            aria-label="删除相片"

          >

            <Trash2 className="size-5" strokeWidth={1.75} />

          </Pressable>

        </div>

      </div>



      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-6">

        <div className="mx-auto flex w-full max-w-full flex-col gap-6">

          <div className="flex w-full justify-center">

            <PolaroidCard

              imageUrl={photo.imageUrl}

              timestamp={photo.timestamp}

              characterName={characterName}

              messageId={photo.messageId}

              customTitle={displayTitle}

              interactive={false}

            />

          </div>



          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">

            <label className="block text-[12px] tracking-wide text-neutral-400">拍立得标题</label>

            <input

              value={title}

              onChange={(e) => setTitle(e.target.value)}

              placeholder={defaultTitle}

              className="mt-2 w-full border-0 border-b border-neutral-200 bg-transparent pb-2 font-serif text-[16px] text-neutral-800 outline-none placeholder:text-neutral-300"

            />

            <p className="mt-1 text-[11px] text-neutral-400">留空则显示默认：{defaultTitle}</p>

          </section>



          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">

            <label className="block text-[12px] tracking-wide text-neutral-400">随笔</label>

            <TextareaAutosize

              value={essay}

              onChange={(e) => setEssay(e.target.value)}

              minRows={5}

              placeholder="写下与此刻有关的文字…"

              className="mt-3 w-full resize-none border-0 bg-transparent font-serif text-[15px] italic leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-300"

            />

          </section>

        </div>

      </div>



      <WeChatConfirmDialog

        open={deleteOpen}

        title="删除这张相片？"

        description="将从相册中移除，标题与随笔也会一并删除。此操作不可撤销。"

        confirmText={deleting ? '删除中…' : '删除'}

        onCancel={() => {

          if (!deleting) setDeleteOpen(false)

        }}

        onConfirm={() => void handleDelete()}

      />

    </motion.div>

  )

}

