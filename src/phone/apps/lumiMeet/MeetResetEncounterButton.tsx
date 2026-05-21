import { RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { MeetResetEncounterPanel, type MeetResetEncounterPanelPhase } from './MeetResetEncounterPanel'
import { useMeetStore } from './LumiMeetStore'

export function MeetResetEncounterButton({ className = '' }: { className?: string }) {
  const { state, clearMeetEncounterDataKeepingWechatAdded } = useMeetStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const [phase, setPhase] = useState<MeetResetEncounterPanelPhase>('confirm')
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const totalNpcCount = state.npcs.length
  const wechatAddedCount = state.npcs.filter((n) => n.status === 'wechat_added').length
  const busy = phase === 'busy'

  const closePanel = useCallback(() => {
    if (busy) return
    setPanelOpen(false)
    setPhase('confirm')
    setResultMessage(null)
  }, [busy])

  const openPanel = useCallback(() => {
    setPhase('confirm')
    setResultMessage(null)
    setPanelOpen(true)
  }, [])

  const onConfirmReset = useCallback(async () => {
    setPhase('busy')
    setResultMessage(null)
    try {
      const { removedNpcCount, removedMeetMemoryCount, protectedWechatContactCount } =
        await clearMeetEncounterDataKeepingWechatAdded()
      if (removedNpcCount === 0 && removedMeetMemoryCount === 0) {
        setResultMessage('遇见已重置；没有需要移除的邂逅或记忆数据。')
      } else {
        const parts = ['遇见已重置']
        if (removedNpcCount > 0) parts.push(`移除 ${removedNpcCount} 位邂逅记录`)
        if (removedMeetMemoryCount > 0) parts.push(`删除 ${removedMeetMemoryCount} 条遇见记忆`)
        if (protectedWechatContactCount > 0) {
          parts.push(`${protectedWechatContactCount} 位微信通讯录角色未动`)
        }
        setResultMessage(`${parts.join('；')}。`)
      }
      setPhase('result')
    } catch {
      setResultMessage('重置失败，请稍后重试。')
      setPhase('result')
    }
  }, [clearMeetEncounterDataKeepingWechatAdded])

  return (
    <>
      <button
        type="button"
        disabled={busy && panelOpen}
        onClick={openPanel}
        className={`meet-caption-en flex shrink-0 items-center gap-1 rounded-full border border-black/[0.08] px-2.5 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[#8a847b] transition-colors hover:border-[rgba(212,175,55,0.35)] hover:text-[#5c534c] disabled:opacity-50 ${className}`}
        aria-label="重置遇见应用数据"
        title="重置遇见应用数据"
      >
        <RotateCcw className={`size-3.5 ${busy && panelOpen ? 'animate-spin' : ''}`} strokeWidth={1.35} aria-hidden />
        <span className="hidden min-[340px]:inline">{busy && panelOpen ? '重置中' : '重置'}</span>
      </button>

      <MeetResetEncounterPanel
        open={panelOpen}
        phase={phase}
        resultMessage={resultMessage}
        totalNpcCount={totalNpcCount}
        wechatAddedCount={wechatAddedCount}
        onClose={closePanel}
        onConfirm={() => void onConfirmReset()}
      />
    </>
  )
}
