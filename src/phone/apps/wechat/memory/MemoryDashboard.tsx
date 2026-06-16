import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import type { MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { MemoryArchivePanel } from './MemoryArchivePanel'

export function MemoryDashboard({
  contacts,
  playerIdentityId,
  currentWechatAccountId,
  activeCharacterPageId,
  onCharacterPageChange,
  onRegisterCharacterNav,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string
  playerDisplayName: string
  currentWechatAccountId?: string
  activeCharacterPageId?: string | null
  onCharacterPageChange?: (meta: MemoryCharacterPageMeta | null) => void
  onRegisterCharacterNav?: (nav: { prev: () => void; next: () => void } | null) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MemoryArchivePanel
        contacts={contacts}
        currentWechatAccountId={currentWechatAccountId}
        playerIdentityId={playerIdentityId === '__none__' ? undefined : playerIdentityId}
        activeCharacterPageId={activeCharacterPageId}
        onCharacterPageChange={onCharacterPageChange}
        onRegisterCharacterNav={onRegisterCharacterNav}
      />
    </div>
  )
}
