import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import { loadAccountsBundle } from '../wechatAccountPersistence'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import {
  bundleHasSecondaryWechatAccounts,
  loadWechatGroupMemorySummaryProgress,
  loadWechatMemorySummaryProgress,
  resolveDefaultMemoryProgressAccountScope,
  resolveMemoryProgressAccountsForScope,
  type MemoryProgressAccountScope,
  type WechatGroupMemorySummaryProgressRow,
  type WechatMemorySummaryProgressRow,
} from './wechatMemorySummaryProgress'
import { runManualMemorySummaryFromProgress } from './memorySummaryRetry'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import {
  MEMORY_PROGRESS_COACH_STEPS,
  MEMORY_PROGRESS_START_COACH_EVENT,
  MEMORY_PROGRESS_TUTORIAL_SECTIONS,
} from './memoryProgressCoachSteps'
import { MEMORY_PROGRESS_COACH_SEEN_KEY } from './memoryCoachTypes'
import { useMemoryTabCoach } from './useMemoryTabCoach'

type ProgressKind = 'private' | 'group'

function ScopeTabs({
  value,
  onChange,
  showSub,
}: {
  value: MemoryProgressAccountScope
  onChange: (v: MemoryProgressAccountScope) => void
  showSub: boolean
}) {
  return (
    <nav
      className="inline-flex rounded-full bg-gray-100/80 p-1"
      aria-label="微信马甲"
    >
      {(
        [
          { id: 'main' as const, label: '主号' },
          ...(showSub ? [{ id: 'sub' as const, label: '小号' }] : []),
        ] as const
      ).map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative min-w-[72px] rounded-full px-4 py-2 text-[13px] transition-colors ${
              active ? 'font-semibold text-gray-900' : 'font-normal text-gray-500'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="memory-progress-account-slider"
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function KindTabs({
  value,
  onChange,
}: {
  value: ProgressKind
  onChange: (v: ProgressKind) => void
}) {
  return (
    <nav className="inline-flex rounded-full bg-gray-100/80 p-1" aria-label="总结类型">
      {(
        [
          { id: 'private' as const, label: '私聊' },
          { id: 'group' as const, label: '群聊' },
        ] as const
      ).map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative min-w-[72px] rounded-full px-4 py-2 text-[13px] transition-colors ${
              active ? 'font-semibold text-gray-900' : 'font-normal text-gray-500'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="memory-progress-kind-slider"
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function ProgressMetricCard({
  displayName,
  avatarUrl,
  accountLineLabel,
  memoryCountLabel,
  interval,
  roundsSinceLastSummary,
  badges,
  manualSummary,
}: {
  displayName: string
  avatarUrl?: string
  accountLineLabel?: string
  memoryCountLabel: string
  interval: number
  roundsSinceLastSummary: number
  badges: Array<{ key: string; label: string; className: string }>
  manualSummary?: {
    enabled: boolean
    busy: boolean
    onRun: () => void
  }
}) {
  const pct =
    interval > 0 ? Math.min(100, Math.round((roundsSinceLastSummary / interval) * 100)) : 0

  return (
    <li className="rounded-[20px] bg-white px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] font-medium text-gray-400">{displayName.slice(0, 2)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {accountLineLabel ? (
                <p className="truncate text-[10px] font-medium text-gray-400">{accountLineLabel}</p>
              ) : null}
              <p className="truncate text-[15px] font-semibold text-gray-900">{displayName}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                <ListenNumericText text={memoryCountLabel} />
              </p>
            </div>
            {manualSummary ? (
              <button
                type="button"
                disabled={!manualSummary.enabled || manualSummary.busy}
                onClick={manualSummary.onRun}
                className="shrink-0 rounded-full bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
              >
                {manualSummary.busy ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    总结中
                  </span>
                ) : (
                  '手动总结'
                )}
              </button>
            ) : null}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gray-900"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          {badges.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b.key} className={`rounded-md px-2 py-0.5 text-[10px] ${b.className}`}>
                  <ListenNumericText text={b.label} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function PrivateProgressRowCard({
  row,
  manualBusy,
  onManualSummary,
}: {
  row: WechatMemorySummaryProgressRow
  manualBusy: boolean
  onManualSummary: (row: WechatMemorySummaryProgressRow) => void
}) {
  const badges: Array<{ key: string; label: string; className: string }> = []

  if (row.autoSummaryEnabled) {
    badges.push({
      key: 'rounds',
      label: `线上计轮 ${row.roundsSinceLastSummary}/${row.interval}`,
      className: 'bg-gray-100 text-gray-600',
    })
  }
  if (row.hasPendingChat) {
    badges.push({ key: 'chat', label: '有待总结私聊', className: 'bg-emerald-50 text-emerald-800' })
  }
  if (!row.hasPendingChat) {
    badges.push({ key: 'none', label: '暂无待总结私聊摘录', className: 'bg-gray-50 text-gray-400' })
  }

  return (
    <ProgressMetricCard
      displayName={row.displayName}
      avatarUrl={row.avatarUrl}
      accountLineLabel={row.accountLineLabel}
      memoryCountLabel={row.memoryCount > 0 ? `已收录 ${row.memoryCount} 条角色记忆` : '尚无角色记忆'}
      interval={row.interval}
      roundsSinceLastSummary={row.roundsSinceLastSummary}
      badges={badges}
      manualSummary={{
        enabled: row.hasPendingChat && !!row.conversationKey.trim(),
        busy: manualBusy,
        onRun: () => onManualSummary(row),
      }}
    />
  )
}

function GroupProgressRowCard({
  row,
  manualBusy,
  onManualSummary,
}: {
  row: WechatGroupMemorySummaryProgressRow
  manualBusy: boolean
  onManualSummary: (row: WechatGroupMemorySummaryProgressRow) => void
}) {
  const badges: Array<{ key: string; label: string; className: string }> = []
  if (row.autoSummaryEnabled) {
    badges.push({
      key: 'rounds',
      label: `线上计轮 ${row.roundsSinceLastSummary}/${row.interval}`,
      className: 'bg-orange-50 text-orange-800',
    })
  }
  if (row.hasPendingChat) {
    badges.push({ key: 'chat', label: '有待总结群消息', className: 'bg-emerald-50 text-emerald-800' })
  } else {
    badges.push({ key: 'none', label: '暂无待总结摘录', className: 'bg-gray-50 text-gray-400' })
  }

  return (
    <ProgressMetricCard
      displayName={row.displayName}
      avatarUrl={row.avatarUrl}
      accountLineLabel={row.accountLineLabel}
      memoryCountLabel={row.memoryCount > 0 ? `已收录 ${row.memoryCount} 条群聊记忆` : '尚无群聊记忆'}
      interval={row.interval}
      roundsSinceLastSummary={row.roundsSinceLastSummary}
      badges={badges}
      manualSummary={{
        enabled: row.hasPendingChat && !!row.conversationKey.trim(),
        busy: manualBusy,
        onRun: () => onManualSummary(row),
      }}
    />
  )
}

export function MemorySummaryProgressPanel({
  contacts,
  currentWechatAccountId,
  coachActive = true,
}: {
  contacts: WeChatContactRow[]
  currentWechatAccountId?: string
  playerIdentityId?: string | null
  coachActive?: boolean
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [privateRows, setPrivateRows] = useState<WechatMemorySummaryProgressRow[]>([])
  const [groupRows, setGroupRows] = useState<WechatGroupMemorySummaryProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const coach = useMemoryTabCoach({
    seenKey: MEMORY_PROGRESS_COACH_SEEN_KEY,
    coachActive,
    loading,
    startCoachEvent: MEMORY_PROGRESS_START_COACH_EVENT,
  })
  const [accountScope, setAccountScope] = useState<MemoryProgressAccountScope>('main')
  const [progressKind, setProgressKind] = useState<ProgressKind>('private')
  const [hasSubAccounts, setHasSubAccounts] = useState(false)
  const [scopeBootstrapped, setScopeBootstrapped] = useState(false)
  const [manualBusyKey, setManualBusyKey] = useState<string | null>(null)
  const reloadSeqRef = useRef(0)

  const contactsKey = useMemo(
    () => contacts.map((c) => `${c.id}:${c.remarkName ?? ''}`).join('\u0001'),
    [contacts],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const scope = await resolveDefaultMemoryProgressAccountScope(currentWechatAccountId)
      const bundle = await loadAccountsBundle()
      if (cancelled) return
      setHasSubAccounts(bundleHasSecondaryWechatAccounts(bundle))
      setAccountScope(scope)
      setScopeBootstrapped(true)
    })()
    return () => {
      cancelled = true
    }
  }, [currentWechatAccountId])

  const reload = useCallback(async () => {
    const seq = ++reloadSeqRef.current
    setLoading(true)

    try {
      const [allMemories, accountContexts] = await Promise.all([
        personaDb.listAllCharacterMemories(),
        resolveMemoryProgressAccountsForScope(accountScope, contacts, currentWechatAccountId),
      ])
      if (seq !== reloadSeqRef.current) return

      const memoriesByChar = new Map<string, CharacterMemory[]>()
      const memoriesByGroupBucket = new Map<string, CharacterMemory[]>()
      for (const m of allMemories) {
        const cid = m.characterId?.trim()
        if (!cid) continue
        if (m.memoryScope === 'group') {
          if (!memoriesByGroupBucket.has(cid)) memoriesByGroupBucket.set(cid, [])
          memoriesByGroupBucket.get(cid)!.push(m)
        } else {
          if (!memoriesByChar.has(cid)) memoriesByChar.set(cid, [])
          memoriesByChar.get(cid)!.push(m)
        }
      }

      const privateOut: WechatMemorySummaryProgressRow[] = []
      const groupOut: WechatGroupMemorySummaryProgressRow[] = []

      for (const ctx of accountContexts) {
        const [priv, grp] = await Promise.all([
          loadWechatMemorySummaryProgress({
            contacts: ctx.contacts,
            wechatAccountId: ctx.accountId,
            sessionPlayerIdentityId: ctx.sessionPlayerIdentityId,
            accountLineLabel: accountContexts.length > 1 ? ctx.lineLabel : undefined,
            memoriesByChar,
          }),
          loadWechatGroupMemorySummaryProgress({
            wechatAccountId: ctx.accountId,
            sessionPlayerIdentityId: ctx.sessionPlayerIdentityId,
            accountLineLabel: accountContexts.length > 1 ? ctx.lineLabel : undefined,
            memoriesByGroupBucket,
          }),
        ])
        privateOut.push(...priv)
        groupOut.push(...grp)
      }

      if (seq === reloadSeqRef.current) {
        setPrivateRows(privateOut)
        setGroupRows(groupOut)
      }
    } catch (err) {
      console.warn('[wechat-memory-progress] reload failed', err)
      if (seq === reloadSeqRef.current) {
        setPrivateRows([])
        setGroupRows([])
      }
    } finally {
      if (seq === reloadSeqRef.current) setLoading(false)
    }
  }, [accountScope, contacts, contactsKey, currentWechatAccountId])

  useEffect(() => {
    if (!scopeBootstrapped) return
    void reload()
  }, [reload, scopeBootstrapped])

  useEffect(() => {
    const on = () => void reload()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [reload])

  const runPrivateManualSummary = useCallback(
    async (row: WechatMemorySummaryProgressRow) => {
      const key = `private:${row.conversationKey}`
      setManualBusyKey(key)
      try {
        await runManualMemorySummaryFromProgress({
          kind: 'private',
          apiConfig,
          conversationKey: row.conversationKey,
          characterId: row.charId,
          displayName: row.displayName,
          sessionPlayerIdentityId: row.sessionPlayerIdentityId,
          wechatAccountId: row.wechatAccountId,
        })
        await reload()
      } finally {
        setManualBusyKey(null)
      }
    },
    [apiConfig, reload],
  )

  const runGroupManualSummary = useCallback(
    async (row: WechatGroupMemorySummaryProgressRow) => {
      const key = `group:${row.conversationKey}`
      setManualBusyKey(key)
      try {
        await runManualMemorySummaryFromProgress({
          kind: 'group',
          apiConfig,
          conversationKey: row.conversationKey,
          characterId: row.groupId,
          groupId: row.groupId,
          displayName: row.displayName,
          sessionPlayerIdentityId: row.sessionPlayerIdentityId,
          wechatAccountId: row.wechatAccountId,
        })
        await reload()
      } finally {
        setManualBusyKey(null)
      }
    },
    [apiConfig, reload],
  )

  const activeRows = progressKind === 'private' ? privateRows : groupRows

  const emptyHint =
    progressKind === 'private'
      ? accountScope === 'sub'
        ? '暂无小号，或小号通讯录还没有角色。'
        : '主号通讯录暂无角色。添加联系人并开始私聊后，这里会显示各角色的线上总结进度。'
      : accountScope === 'sub'
        ? '暂无小号，或小号下还没有群聊。'
        : '主号下还没有群聊。创建或加入群聊后，这里会显示各群的线上总结进度。'

  return (
    <div
      data-memory-coach-root="memory-progress"
      className="mx-auto max-w-xl px-4 py-5"
      style={{ background: ARCHIVE_BG, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mb-3 flex items-center justify-end">
        <MemoryTutorialButton compact onClick={() => coach.setTutorialOpen(true)} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="max-w-md text-center text-[12px] leading-relaxed text-gray-500">
          仅统计微信私聊 / 群聊的 AI 回复轮数（及对应间隔）；线下约会不计入。有待总结消息时可点「手动总结」立即写入长期记忆，不额外消耗计轮。
        </p>
        <div data-memory-coach="progress-filters" className="flex flex-col items-center gap-3">
          <ScopeTabs value={accountScope} onChange={setAccountScope} showSub={hasSubAccounts} />
          <KindTabs value={progressKind} onChange={setProgressKind} />
        </div>
      </div>

      {loading || !scopeBootstrapped ? (
        <p className="py-16 text-center text-[13px] text-gray-400">正在读取线上总结进度…</p>
      ) : activeRows.length === 0 ? (
        <p
          data-memory-coach="progress-list"
          className="py-16 text-center text-[13px] leading-relaxed text-gray-400"
        >
          {emptyHint}
        </p>
      ) : (
        <ul data-memory-coach="progress-list" className="mt-5 space-y-3">
          {progressKind === 'private'
            ? privateRows.map((row) => (
                <PrivateProgressRowCard
                  key={`${row.accountLineLabel ?? ''}:${row.charId}`}
                  row={row}
                  manualBusy={manualBusyKey === `private:${row.conversationKey}`}
                  onManualSummary={(r) => void runPrivateManualSummary(r)}
                />
              ))
            : groupRows.map((row) => (
                <GroupProgressRowCard
                  key={`${row.accountLineLabel ?? ''}:${row.groupId}`}
                  row={row}
                  manualBusy={manualBusyKey === `group:${row.conversationKey}`}
                  onManualSummary={(r) => void runGroupManualSummary(r)}
                />
              ))}
        </ul>
      )}

      <MemoryTutorialModal
        open={coach.tutorialOpen}
        onClose={() => coach.setTutorialOpen(false)}
        title="线上总结进度 · 怎么看"
        subtitle="私聊与群聊的计轮"
        sections={MEMORY_PROGRESS_TUTORIAL_SECTIONS}
        onStartLiveCoach={coach.startLiveCoach}
        zIndex={55000}
      />

      <MemoryCoachPortal
        open={coach.coachOpen && coachActive}
        steps={MEMORY_PROGRESS_COACH_STEPS}
        stepIndex={coach.coachStepIndex}
        onStepChange={coach.setCoachStepIndex}
        onSkip={() => coach.finishCoach()}
        onComplete={(opts) => coach.finishCoach(opts)}
        scopeRoot="memory-progress"
        layoutEpoch={`${accountScope}-${progressKind}-${activeRows.length}`}
        zIndex={56000}
      />
    </div>
  )
}
