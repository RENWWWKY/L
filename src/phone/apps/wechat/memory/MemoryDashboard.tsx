import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { MemoryArchivePanel } from './MemoryArchivePanel'

export function MemoryDashboard({
  contacts,
  playerIdentityId,
  currentWechatAccountId,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string
  playerDisplayName: string
  currentWechatAccountId?: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MemoryArchivePanel
        contacts={contacts}
        currentWechatAccountId={currentWechatAccountId}
        playerIdentityId={playerIdentityId === '__none__' ? undefined : playerIdentityId}
      />
    </div>
  )
}
