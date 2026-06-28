import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import type { MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { MemoryArchivePanel } from './MemoryArchivePanel'

export function MemoryDashboard({
  contacts,
  playerIdentityId,
  currentWechatAccountId,
  apiConfig,
  activeCharacterPageId,
  onCharacterPageChange,
  onRegisterCharacterNav,
  coachActive = true,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string
  playerDisplayName: string
  currentWechatAccountId?: string
  apiConfig?: import('../../api/types').ApiConfig | null
  activeCharacterPageId?: string | null
  onCharacterPageChange?: (meta: MemoryCharacterPageMeta | null) => void
  onRegisterCharacterNav?: (nav: { prev: () => void; next: () => void } | null) => void
  coachActive?: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MemoryArchivePanel
        contacts={contacts}
        currentWechatAccountId={currentWechatAccountId}
        playerIdentityId={playerIdentityId === '__none__' ? undefined : playerIdentityId}
        apiConfig={apiConfig}
        activeCharacterPageId={activeCharacterPageId}
        onCharacterPageChange={onCharacterPageChange}
        onRegisterCharacterNav={onRegisterCharacterNav}
        coachActive={coachActive}
      />
    </div>
  )
}
