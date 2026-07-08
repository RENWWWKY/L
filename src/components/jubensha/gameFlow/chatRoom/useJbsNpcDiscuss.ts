import { useCallback, useRef, useState } from 'react'

import type { LockedRole } from '../gameFlowTypes'
import { expandNpcReplyToBubbleSegments } from './jbsDiscussBubbleSplit'
import { JbsDiscussGenerationError, nextDiscussBubbleDelayMs, requestJbsDiscussNpcReplies } from './jbsDiscussAi'
import type { JBSChatMessage } from './jbsFlowTypes'
import type { PublicDiscussPhase } from './jbsPublicDiscuss'

export type DiscussSendPayload = {
  body: string
  actionLine?: string
}

export type UseJbsNpcDiscussParams = {
  locked: LockedRole
  discussPhase: PublicDiscussPhase | null
  messages: JBSChatMessage[]
  collectedClueIds: string[]
  playerRoleName: string
  pushMessage: (msg: Omit<JBSChatMessage, 'id' | 'at'> & { id?: string }) => void
  openingContext?: string
}

export function useJbsNpcDiscuss({
  locked,
  discussPhase,
  messages,
  collectedClueIds,
  playerRoleName,
  pushMessage,
  openingContext,
}: UseJbsNpcDiscussParams) {
  const [discussAiBusy, setDiscussAiBusy] = useState(false)
  const [discussAiGenerating, setDiscussAiGenerating] = useState(false)
  const [awaitingNpcReply, setAwaitingNpcReply] = useState(false)
  const [discussGenerationFailed, setDiscussGenerationFailed] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const abortRef = useRef(0)
  const pendingActionRef = useRef<string | null>(null)
  const lastDiscussTranscriptRef = useRef<JBSChatMessage[] | null>(null)
  pendingActionRef.current = pendingAction

  const clearPendingAction = useCallback(() => setPendingAction(null), [])

  const appendPendingAction = useCallback((label: string) => {
    setPendingAction((prev) => (prev ? `${prev}；${label}` : label))
  }, [])

  const runDiscussNpcGeneration = useCallback(
    async (transcriptMessages: JBSChatMessage[]) => {
      if (!discussPhase?.discussReady) return

      const requestId = ++abortRef.current
      lastDiscussTranscriptRef.current = transcriptMessages
      setDiscussAiBusy(true)
      setDiscussAiGenerating(true)
      setDiscussGenerationFailed(false)
      setAwaitingNpcReply(false)

      try {
        const result = await requestJbsDiscussNpcReplies({
          scriptTitle: locked.script.title,
          round: discussPhase.round,
          playerRoleName,
          messages: transcriptMessages,
          openingContext,
          collectedClueIds,
          scriptId: locked.script.id,
        })

        if (requestId !== abortRef.current) return
        setDiscussAiGenerating(false)

        let bubbleIndex = 0
        for (let i = 0; i < result.replies.length; i += 1) {
          if (requestId !== abortRef.current) return

          const reply = result.replies[i]!
          const segments = expandNpcReplyToBubbleSegments(reply)
          if (segments.length === 0) continue

          const groupId = `discuss-${requestId}-${i}`

          for (let j = 0; j < segments.length; j += 1) {
            if (requestId !== abortRef.current) return
            if (bubbleIndex > 0) {
              await new Promise((r) => window.setTimeout(r, nextDiscussBubbleDelayMs()))
            }
            const seg = segments[j]!
            pushMessage({
              kind: 'npc',
              roleName: reply.speaker,
              body: seg.body,
              actionLine: seg.actionLine,
              discussBubbleGroup: groupId,
              bubbleContinued: seg.bubbleContinued,
            })
            bubbleIndex += 1
          }
        }
        setAwaitingNpcReply(false)
      } catch (err) {
        if (requestId !== abortRef.current) return
        setDiscussGenerationFailed(true)
        setAwaitingNpcReply(true)
        const body =
          err instanceof JbsDiscussGenerationError
            ? err.message
            : err instanceof Error
              ? `讨论生成失败：${err.message}`
              : '讨论生成失败：未知错误，请稍后重试。'
        pushMessage({ kind: 'system', body })
      } finally {
        if (requestId === abortRef.current) {
          setDiscussAiBusy(false)
          setDiscussAiGenerating(false)
        }
      }
    },
    [
      collectedClueIds,
      discussPhase,
      locked.script.id,
      locked.script.title,
      openingContext,
      playerRoleName,
      pushMessage,
    ],
  )

  /** 回车：仅把玩家发言落入聊天室，不触发 NPC 回复 */
  const postDiscussPlayerLine = useCallback(
    ({ body, actionLine }: DiscussSendPayload): boolean => {
      const text = body.trim()
      const action = actionLine?.trim() || pendingActionRef.current?.trim() || undefined
      if (!text && !action) return false
      if (!discussPhase?.discussReady) return false
      if (discussAiBusy) return false

      setPendingAction(null)
      setDiscussGenerationFailed(false)
      pushMessage({
        kind: 'player',
        roleName: playerRoleName,
        body: text,
        actionLine: action,
      })
      setAwaitingNpcReply(true)
      return true
    },
    [discussAiBusy, discussPhase, playerRoleName, pushMessage],
  )

  /** 发送键：先补发输入框未落盘内容，再请求 NPC 接话 */
  const triggerDiscussNpcReplies = useCallback(
    async ({ body = '' }: { body?: string } = {}) => {
      if (!discussPhase?.discussReady) return
      if (discussAiBusy) return

      const text = body.trim()
      const action = pendingActionRef.current?.trim() || undefined
      let transcriptMessages = messages

      if (text || action) {
        setPendingAction(null)
        const flushed: JBSChatMessage = {
          id: 'discuss-flush',
          kind: 'player',
          roleName: playerRoleName,
          body: text,
          actionLine: action,
          at: Date.now(),
        }
        pushMessage(flushed)
        transcriptMessages = [...messages, flushed]
      } else if (!awaitingNpcReply) {
        return
      }

      await runDiscussNpcGeneration(transcriptMessages)
    },
    [
      awaitingNpcReply,
      discussAiBusy,
      discussPhase,
      messages,
      playerRoleName,
      pushMessage,
      runDiscussNpcGeneration,
    ],
  )

  /** 生成失败后，用上一轮 transcript 重试 */
  const retryDiscussNpcReplies = useCallback(async () => {
    if (!discussPhase?.discussReady || discussAiBusy) return
    const transcript = lastDiscussTranscriptRef.current
    if (!transcript?.length) return
    await runDiscussNpcGeneration(transcript)
  }, [discussAiBusy, discussPhase, runDiscussNpcGeneration])

  return {
    discussAiBusy,
    discussAiGenerating,
    discussGenerationFailed,
    awaitingNpcReply,
    pendingAction,
    setPendingAction,
    appendPendingAction,
    clearPendingAction,
    postDiscussPlayerLine,
    triggerDiscussNpcReplies,
    retryDiscussNpcReplies,
  }
}
