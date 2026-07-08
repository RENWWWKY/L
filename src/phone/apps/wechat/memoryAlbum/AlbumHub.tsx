import { motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { countSavedAlbumPhotosByCharacter } from './loadCharacterChatPhotos'
import './memoryAlbum.css'
import type { MemoryAlbumContact } from './memoryAlbumTypes'

type AlbumBookCoverProps = {
  name: string
  photoCount: number
  onOpen: () => void
}

function AlbumBookCover({ name, photoCount, onOpen }: Omit<AlbumBookCoverProps, 'index'>) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className="memory-album-shelf-book group relative aspect-[3/4] w-full text-left outline-none"
      aria-label={`打开 ${name} 的相册`}
    >
      <div className="memory-album-book-cover relative flex h-full flex-col items-center justify-center overflow-hidden rounded-r-md rounded-l-[3px] px-4">
        <div className="memory-album-book-spine absolute inset-y-0 left-0 w-4" aria-hidden />
        <div className="memory-album-cover-emboss pointer-events-none absolute inset-3 rounded-sm border border-white/40" aria-hidden />
        <p className="memory-album-cover-title relative z-10 text-center font-serif text-[15px] font-medium tracking-[0.12em] text-neutral-800">
          {name}
        </p>
        <p className="relative z-10 mt-2 text-[10px] tracking-[0.18em] text-neutral-500">
          {photoCount > 0 ? `${photoCount} PHOTOS` : 'EMPTY'}
        </p>
        <div className="memory-album-cover-band pointer-events-none absolute inset-x-6 top-[18%] h-px" aria-hidden />
        <div className="memory-album-cover-band pointer-events-none absolute inset-x-8 bottom-[22%] h-px opacity-60" aria-hidden />
      </div>
      <div className="memory-album-shelf-book-shadow pointer-events-none absolute -bottom-3 left-[12%] right-[8%] h-3 rounded-[50%]" aria-hidden />
    </motion.button>
  )
}

type AlbumHubProps = {
  contacts: MemoryAlbumContact[]
  onBack: () => void
  onOpenBook: (contact: MemoryAlbumContact) => void
}

export function AlbumHub({ contacts, onBack, onOpenBook }: AlbumHubProps) {
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const contactsRef = useRef(contacts)
  const loadedRef = useRef(false)

  contactsRef.current = contacts

  const refreshCounts = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true)
    try {
      setPhotoCounts(await countSavedAlbumPhotosByCharacter(contactsRef.current.map((c) => c.id)))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void refreshCounts(true)
    // 仅打开记忆相册预览时加载一次；不随父级 contacts 引用变化重刷
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onAlbumItemsChanged = () => {
      void refreshCounts(false)
    }
    window.addEventListener('wechat-album-items-changed', onAlbumItemsChanged)
    return () => window.removeEventListener('wechat-album-items-changed', onAlbumItemsChanged)
  }, [refreshCounts])

  return (
    <div className="memory-album-hub flex h-full min-h-0 flex-col">
      <div
        className="sticky top-0 z-20 shrink-0 bg-white/90 backdrop-blur-md"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
          boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
        }}
      >
        <div className="flex items-center gap-1 px-3 py-3">
          <Pressable
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50"
            aria-label="返回"
          >
            <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
          </Pressable>
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="truncate text-[17px] font-semibold tracking-tight text-gray-900">相册</p>
            <p className="text-[10px] tracking-[0.2em] text-neutral-400">MEMORY ALBUM</p>
          </div>
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gray-400" aria-hidden />
          </div>
        ) : contacts.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <p className="text-[15px] font-medium text-gray-700">暂无角色相册</p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
              在聊天中长按图片，选择「存相册」后才会出现在这里
            </p>
          </div>
        ) : (
          <div className="memory-album-shelf relative mx-auto max-w-[520px] pt-6 pb-8">
            <div className="memory-album-shelf-board pointer-events-none absolute inset-x-0 bottom-0 h-5 rounded-sm" aria-hidden />
            <div className="memory-album-shelf-lip pointer-events-none absolute inset-x-[-8px] bottom-[-6px] h-3 rounded-sm" aria-hidden />
            <div className="memory-album-shelf-grid grid grid-cols-2 gap-x-8 gap-y-12 px-2 pb-6 sm:grid-cols-3">
              {contacts.map((contact) => (
                <AlbumBookCover
                  key={contact.id}
                  name={contact.remarkName}
                  photoCount={photoCounts[contact.id] ?? 0}
                  onOpen={() => onOpenBook(contact)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
