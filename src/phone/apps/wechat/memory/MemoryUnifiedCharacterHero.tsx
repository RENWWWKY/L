import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { MemoryUnifiedRosterItem } from './memoryUnifiedSummaryArchive'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import {
  ARCHIVE_SOURCE_OFFLINE_CHIP,
  ARCHIVE_SOURCE_ONLINE_CHIP,
} from './memoryArchiveSourceLabels'

export function MemoryUnifiedCharacterHero({
  character,
  rosterIndex,
  rosterTotal,
}: {
  character: MemoryUnifiedRosterItem
  rosterIndex: number
  rosterTotal: number
}) {
  const { onlineMemoryCount, offlineRowCount } = character

  return (
    <div className="px-4 pt-2" style={{ background: ARCHIVE_BG }}>
      <div className="overflow-hidden rounded-[28px] bg-white px-4 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-gray-50">
            {character.avatarUrl ? (
              <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[13px] font-semibold text-gray-400">
                {character.displayName.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-400">
              <ListenNumericText
                text={
                  (rosterIndex >= 0 ? `${rosterIndex + 1} / ${rosterTotal} · ` : '') +
                  `共 ${character.memoryCount} 条记录`
                }
              />
            </p>
            <p className="mt-1 text-[17px] font-semibold text-gray-900">{character.displayName}</p>
            {character.wechatRemarkName ? (
              <p className="mt-0.5 text-[12px] text-gray-400">备注 {character.wechatRemarkName}</p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {onlineMemoryCount > 0 ? (
                <span className={ARCHIVE_SOURCE_ONLINE_CHIP}>
                  线上总结 {onlineMemoryCount}
                </span>
              ) : null}
              {offlineRowCount > 0 ? (
                <span className={ARCHIVE_SOURCE_OFFLINE_CHIP}>
                  线下摘要 {offlineRowCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
