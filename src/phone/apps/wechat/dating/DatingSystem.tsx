import { useEffect, useState } from 'react'
import { DatingProvider } from './DatingContext'
import { DatingRoleSelectPage } from './DatingRoleSelectPage'
import { DatingStoryPage } from './DatingStoryPage'

type Page = 'select' | 'story'

function DatingSystemInner({
  onVnChromeChange,
}: {
  onVnChromeChange?: (hidden: boolean) => void
}) {
  const [page, setPage] = useState<Page>('select')

  useEffect(() => {
    const hidden = page === 'story'
    onVnChromeChange?.(hidden)
    return () => {
      onVnChromeChange?.(false)
    }
  }, [onVnChromeChange, page])

  return page === 'select' ? (
    <DatingRoleSelectPage onEnterStory={() => setPage('story')} />
  ) : (
    <DatingStoryPage onBackToSelect={() => setPage('select')} />
  )
}

export function DatingSystem({
  onVnChromeChange,
}: {
  onVnChromeChange?: (hidden: boolean) => void
}) {
  return (
    <DatingProvider>
      <DatingSystemInner onVnChromeChange={onVnChromeChange} />
    </DatingProvider>
  )
}

export default DatingSystem

