import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

import { AlbumBook } from './AlbumBook'
import { AlbumHub } from './AlbumHub'
import { filterMemoryAlbumContacts } from './filterMemoryAlbumContacts'
import type { MemoryAlbumContact } from './memoryAlbumTypes'
import { useMemoryAlbumStore } from './useMemoryAlbumStore'

export function MemoryAlbumApp({
  contacts,
  currentAccountId,
  onBack,
}: {
  contacts: MemoryAlbumContact[]
  currentAccountId?: string
  onBack: () => void
}) {
  const [openBook, setOpenBook] = useState<MemoryAlbumContact | null>(null)
  const bindAccount = useMemoryAlbumStore((s) => s.bindAccount)
  const albumContacts = filterMemoryAlbumContacts(contacts)

  useEffect(() => {
    void bindAccount(currentAccountId)
  }, [bindAccount, currentAccountId])

  return (
    <>
      <AlbumHub
        contacts={albumContacts}
        onBack={onBack}
        onOpenBook={setOpenBook}
      />
      <AnimatePresence>
        {openBook ? (
          <AlbumBook
            key={openBook.id}
            characterId={openBook.id}
            characterName={openBook.remarkName}
            onClose={() => setOpenBook(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
