import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import {
  loadMeetMemorySummaryProgress,
  type MeetMemorySummaryProgressRow,
} from './meetMemorySummaryProgress'
import type { EncounterMemory, MeetPublicProfile } from './meetTypes'
import { MEET_APP_COACH_TARGET_ATTR } from './meetAppCoachSteps'

const PLATINUM = '#D4AF37'

function ProgressRowCard({ row }: { row: MeetMemorySummaryProgressRow }) {
  const pct =
    row.interval > 0
      ? Math.min(100, Math.round((row.roundsSinceLastSummary / row.interval) * 100))
      : 0
  const ready = row.autoSummaryEnabled && row.roundsUntilNext <= 1

  return (
    <li className="rounded-[14px] border border-black/[0.06] bg-white/85 px-4 py-3.5 shadow-[0_8px_28px_rgba(22,18,14,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-elegant-serif text-[15px] tracking-[0.06em] text-[#2c2a26]">
            {row.displayName}
          </p>
          <p className="meet-caption-en mt-0.5 text-[8px] uppercase tracking-[0.2em] text-[#b8b5ad]">
            {row.meetMemoryCount > 0 ? `${row.meetMemoryCount} memories logged` : 'no [遇见] memory yet'}
          </p>
        </div>
        {ready ? (
          <span
            className="meet-caption-en shrink-0 rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.16em]"
            style={{ borderColor: 'rgba(212, 175, 55, 0.5)', color: '#9a7d3a' }}
          >
            下轮可触发
          </span>
        ) : null}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#efece6]">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${PLATINUM} 0%, rgba(212,175,55,0.55) 100%)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <p className="mt-2.5 text-[13px] font-light leading-relaxed text-[#5c574f]">
        {!row.autoSummaryEnabled ? (
          <span className="text-[#a39e96]">自动总结已关闭（微信记忆引擎中开启后才会计数）</span>
        ) : row.roundsUntilNext <= 0 ? (
          <>
            已达间隔阈值，<span className="text-[#9a7d3a]">下一次 NPC 回复</span>将尝试写入记忆
          </>
        ) : (
          <>
            还需{' '}
            <span className="font-medium text-[#9a7d3a]">{row.roundsUntilNext}</span> 轮 NPC 回复触发下一次总结
            <span className="text-[#a8a39c]">
              {' '}
              （{row.roundsSinceLastSummary}/{row.interval}）
            </span>
          </>
        )}
      </p>

      {!row.hasPendingMeetTranscript && row.autoSummaryEnabled ? (
        <p className="mt-1.5 text-[11px] font-light leading-relaxed text-[#b0aba3]">
          临时会话暂无游标后的新摘录；若曾加微信，历史遇见对话可能已标为「已纳入总结区间」。
        </p>
      ) : null}
    </li>
  )
}

export function DestinyArchiveSummaryProgressPanel(props: {
  archiveRows: EncounterMemory[]
  meetProfile: MeetPublicProfile
  memoriesByChar: Map<string, CharacterMemory[]>
}) {
  const [progressRows, setProgressRows] = useState<MeetMemorySummaryProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [interval, setInterval] = useState(5)
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const reloadSeqRef = useRef(0)

  const archiveCharKey = useMemo(
    () => props.archiveRows.map((r) => r.charId).join('\u0001'),
    [props.archiveRows],
  )
  const memoryCountsKey = useMemo(
    () =>
      props.archiveRows
        .map((r) => `${r.charId}:${props.memoriesByChar.get(r.charId)?.length ?? 0}`)
        .join(';'),
    [props.archiveRows, props.memoriesByChar],
  )

  const reload = useCallback(async () => {
    const seq = ++reloadSeqRef.current
    const archiveSnapshot = props.archiveRows

    if (!archiveSnapshot.length) {
      if (seq === reloadSeqRef.current) {
        setProgressRows([])
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const settings = await personaDb.getMemorySettings()
      if (seq !== reloadSeqRef.current) return
      setInterval(Math.max(1, Math.floor(settings.autoSummaryInterval)))
      setAutoSummaryEnabled(settings.autoSummaryEnabled !== false)

      const rows = await loadMeetMemorySummaryProgress({
        rows: archiveSnapshot.map((r) => ({ charId: r.charId, nickname: r.nickname })),
        meetProfileBaseWeChatIdentityId: props.meetProfile.baseWeChatIdentityId,
        meetProfileContactWechatId: props.meetProfile.contactWechatId,
        memoriesByChar: props.memoriesByChar,
      })
      if (seq === reloadSeqRef.current) setProgressRows(rows)
    } catch (err) {
      console.warn('[meet-progress] reload failed', err)
      if (seq === reloadSeqRef.current) {
        setProgressRows(
          archiveSnapshot.map((r) => ({
            charId: r.charId,
            displayName: r.nickname.trim() || '未命名',
            conversationKey: '',
            interval: 5,
            roundsSinceLastSummary: 0,
            roundsUntilNext: 5,
            autoSummaryEnabled: true,
            hasPendingMeetTranscript: false,
            meetMemoryCount: props.memoriesByChar.get(r.charId)?.length ?? 0,
          })),
        )
      }
    } finally {
      if (seq === reloadSeqRef.current) setLoading(false)
    }
  }, [
    archiveCharKey,
    memoryCountsKey,
    props.archiveRows,
    props.meetProfile.baseWeChatIdentityId,
    props.meetProfile.contactWechatId,
    props.memoriesByChar,
  ])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const on = () => void reload()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [reload])

  const readyCount = useMemo(
    () => progressRows.filter((r) => r.autoSummaryEnabled && r.roundsUntilNext <= 1).length,
    [progressRows],
  )

  return (
    <div {...{ [MEET_APP_COACH_TARGET_ATTR]: 'archive-summary-progress' }} className="px-4 pb-8">
      <p className="text-center text-[12px] font-light leading-relaxed text-[#8a847b]">
        与微信私聊共用计数：每完成一轮
        <span className="text-[#9a7d3a]"> NPC 文字回复 </span>
        计 1 轮；满 {interval} 轮后合并写入
        <span className="text-[#9a7d3a]"> [遇见] </span>
        长期记忆。
        {!autoSummaryEnabled ? (
          <span className="mt-1 block text-[#c45c5c]">当前全局自动总结已关闭。</span>
        ) : null}
      </p>

      {readyCount > 0 && autoSummaryEnabled ? (
        <p className="meet-caption-en mt-3 text-center text-[9px] uppercase tracking-[0.22em] text-[#9a7d3a]">
          {readyCount} character{readyCount > 1 ? 's' : ''} · next npc reply may summarize
        </p>
      ) : null}

      {loading ? (
        <p className="meet-caption-en py-16 text-center text-[10px] tracking-[0.24em] text-[#c4bfb8]">
          正在读取总结进度…
        </p>
      ) : progressRows.length === 0 ? (
        <p className="py-16 text-center text-[13px] font-light leading-relaxed text-[#a39e96]">
          尚无邂逅角色。完成匹配后，这里会显示各角色距离下一次记忆总结还需几轮 NPC 回复。
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {progressRows.map((row) => (
            <ProgressRowCard key={row.charId} row={row} />
          ))}
        </ul>
      )}
    </div>
  )
}
