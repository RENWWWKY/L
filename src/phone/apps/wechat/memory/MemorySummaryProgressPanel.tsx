import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { ListenNumericText, ListenPlainNum } from '../../../../components/discoverListen/ListenNum'
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
  roundsUntilNext,
  autoSummaryEnabled,
  ready,
  badges,
}: {
  displayName: string
  avatarUrl?: string
  accountLineLabel?: string
  memoryCountLabel: string
  interval: number
  roundsSinceLastSummary: number
  roundsUntilNext: number
  autoSummaryEnabled: boolean
  ready: boolean
  badges: Array<{ key: string; label: string; className: string }>
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
            {ready ? (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                下轮可触发
              </span>
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

          <p className="mt-2.5 text-[13px] leading-relaxed text-gray-600">
            {!autoSummaryEnabled ? (
              <span className="text-gray-400">自动总结已关闭（请在「配置」页开启）</span>
            ) : roundsUntilNext <= 0 ? (
              <>
                已达间隔阈值，<span className="font-medium text-gray-900">下一次 AI 回复</span>将尝试写入记忆
              </>
            ) : (
              <>
                还需 <ListenPlainNum className="font-semibold text-gray-900">{roundsUntilNext}</ListenPlainNum> 轮 AI 回复触发总结
                <span className="text-gray-400">
                  {' '}
                  （
                  <ListenPlainNum>
                    {roundsSinceLastSummary}/{interval}
                  </ListenPlainNum>
                  ）
                </span>
              </>
            )}
          </p>

          {autoSummaryEnabled && badges.length ? (
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

function PrivateProgressRowCard({ row }: { row: WechatMemorySummaryProgressRow }) {
  const ready = row.autoSummaryEnabled && row.roundsUntilNext <= 1
  const hasPending = row.hasPendingChat || row.hasPendingOfflinePlot
  const badges: Array<{ key: string; label: string; className: string }> = []

  if (row.datingCountsTowardRounds) {
    badges.push({ key: 'dating', label: '微信 + 约会计轮', className: 'bg-gray-100 text-gray-600' })
  } else {
    badges.push({ key: 'chat-only', label: '仅微信计轮', className: 'bg-gray-100 text-gray-600' })
  }
  if (row.hasPendingChat) {
    badges.push({ key: 'chat', label: '有待总结私聊', className: 'bg-emerald-50 text-emerald-800' })
  }
  if (row.hasPendingOfflinePlot) {
    badges.push({ key: 'plot', label: '有待总结约会剧情', className: 'bg-indigo-50 text-indigo-800' })
  }
  if (!hasPending) {
    badges.push({ key: 'none', label: '暂无待总结摘录', className: 'bg-gray-50 text-gray-400' })
  }

  return (
    <ProgressMetricCard
      displayName={row.displayName}
      avatarUrl={row.avatarUrl}
      accountLineLabel={row.accountLineLabel}
      memoryCountLabel={row.memoryCount > 0 ? `已收录 ${row.memoryCount} 条角色记忆` : '尚无角色记忆'}
      interval={row.interval}
      roundsSinceLastSummary={row.roundsSinceLastSummary}
      roundsUntilNext={row.roundsUntilNext}
      autoSummaryEnabled={row.autoSummaryEnabled}
      ready={ready}
      badges={badges}
    />
  )
}

function GroupProgressRowCard({ row }: { row: WechatGroupMemorySummaryProgressRow }) {
  const ready = row.autoSummaryEnabled && row.roundsUntilNext <= 1
  const badges: Array<{ key: string; label: string; className: string }> = [
    { key: 'group', label: '群聊计轮', className: 'bg-orange-50 text-orange-800' },
  ]
  if (row.hasPendingChat) {
    badges.push({ key: 'chat', label: '有待总结群消息', className: 'bg-emerald-50 text-emerald-800' })
  } else {
    badges.push({ key: 'none', label: '暂无待总结摘录', className: 'bg-gray-50 text-gray-400' })
  }
  if (row.memberCount > 0) {
    badges.push({
      key: 'members',
      label: `${row.memberCount} 名成员`,
      className: 'bg-gray-100 text-gray-600',
    })
  }

  return (
    <ProgressMetricCard
      displayName={row.displayName}
      avatarUrl={row.avatarUrl}
      accountLineLabel={row.accountLineLabel}
      memoryCountLabel={row.memoryCount > 0 ? `已收录 ${row.memoryCount} 条群聊记忆` : '尚无群聊记忆'}
      interval={row.interval}
      roundsSinceLastSummary={row.roundsSinceLastSummary}
      roundsUntilNext={row.roundsUntilNext}
      autoSummaryEnabled={row.autoSummaryEnabled}
      ready={ready}
      badges={badges}
    />
  )
}

export function MemorySummaryProgressPanel({
  contacts,
  currentWechatAccountId,
}: {
  contacts: WeChatContactRow[]
  currentWechatAccountId?: string
  playerIdentityId?: string | null
}) {
  const [privateRows, setPrivateRows] = useState<WechatMemorySummaryProgressRow[]>([])
  const [groupRows, setGroupRows] = useState<WechatGroupMemorySummaryProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [interval, setInterval] = useState(10)
  const [intervalScope, setIntervalScope] = useState<'global' | 'per_character'>('global')
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [datingCountsTowardRounds, setDatingCountsTowardRounds] = useState(true)
  const [accountScope, setAccountScope] = useState<MemoryProgressAccountScope>('main')
  const [progressKind, setProgressKind] = useState<ProgressKind>('private')
  const [hasSubAccounts, setHasSubAccounts] = useState(false)
  const [scopeBootstrapped, setScopeBootstrapped] = useState(false)
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
      const [settings, allMemories, accountContexts] = await Promise.all([
        personaDb.getMemorySettings(),
        personaDb.listAllCharacterMemories(),
        resolveMemoryProgressAccountsForScope(accountScope, contacts, currentWechatAccountId),
      ])
      if (seq !== reloadSeqRef.current) return

      const intervalN = Math.max(1, Math.floor(settings.autoSummaryInterval))
      const autoOn = settings.autoSummaryEnabled !== false
      setInterval(intervalN)
      setIntervalScope(settings.autoSummaryIntervalScope === 'per_character' ? 'per_character' : 'global')
      setAutoSummaryEnabled(autoOn)
      setDatingCountsTowardRounds(autoOn && settings.datingAutoSummaryEnabled !== false)

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

  const activeRows = progressKind === 'private' ? privateRows : groupRows
  const readyCount = useMemo(
    () => activeRows.filter((r) => r.autoSummaryEnabled && r.roundsUntilNext <= 1).length,
    [activeRows],
  )

  const introText =
    progressKind === 'private'
      ? intervalScope === 'per_character'
        ? `每完成一轮 AI 回复（微信私聊${datingCountsTowardRounds ? '或约会剧情' : ''}）计 1 轮；满各角色在配置页设定的间隔轮数后，合并写入长期记忆。`
        : `每完成一轮 AI 回复（微信私聊${datingCountsTowardRounds ? '或约会剧情' : ''}）计 1 轮；满 ${interval} 轮后合并写入长期记忆。`
      : `群聊每完成一轮 NPC AI 回复计 1 轮；满 ${interval} 轮后为各成员写入群聊长期记忆。`

  const emptyHint =
    progressKind === 'private'
      ? accountScope === 'sub'
        ? '暂无小号，或小号通讯录还没有角色。'
        : '主号通讯录暂无角色。添加联系人并开始私聊后，这里会显示各角色的总结进度。'
      : accountScope === 'sub'
        ? '暂无小号，或小号下还没有群聊。'
        : '主号下还没有群聊。创建或加入群聊后，这里会显示各群的总结进度。'

  return (
    <div
      className="mx-auto max-w-xl px-4 py-5"
      style={{ background: ARCHIVE_BG, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex flex-col items-center gap-3">
        <ScopeTabs value={accountScope} onChange={setAccountScope} showSub={hasSubAccounts} />
        <KindTabs value={progressKind} onChange={setProgressKind} />
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-gray-500">
        <ListenNumericText text={`${introText}下方按${accountScope === 'main' ? '主号' : '小号'}分别统计，不与其它马甲混计。`} />
        {!autoSummaryEnabled ? (
          <span className="mt-1 block text-red-700/80">当前自动总结已关闭，进度仅作参考。</span>
        ) : null}
      </p>

      {readyCount > 0 && autoSummaryEnabled ? (
        <p className="mt-3 text-center text-[11px] font-medium tracking-wide text-amber-800">
          <ListenNumericText
            text={`${readyCount} ${progressKind === 'private' ? '位角色' : '个群聊'} · 下一条 AI 回复可能触发总结`}
          />
        </p>
      ) : null}

      {loading || !scopeBootstrapped ? (
        <p className="py-16 text-center text-[13px] text-gray-400">正在读取总结进度…</p>
      ) : activeRows.length === 0 ? (
        <p className="py-16 text-center text-[13px] leading-relaxed text-gray-400">{emptyHint}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {progressKind === 'private'
            ? privateRows.map((row) => <PrivateProgressRowCard key={`${row.accountLineLabel ?? ''}:${row.charId}`} row={row} />)
            : groupRows.map((row) => <GroupProgressRowCard key={`${row.accountLineLabel ?? ''}:${row.groupId}`} row={row} />)}
        </ul>
      )}
    </div>
  )
}
