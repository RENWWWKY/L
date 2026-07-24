import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Gift, LogOut, Pencil, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import type { ApiConfig } from '../api/types'
import { usePublishKeyboardInset } from '../lumiPulse/hooks/usePublishKeyboardInset'
import { PaymentKeyboard } from '../wechat/wallet/PaymentKeyboard'
import {
  useWalletMockStore,
  walletReadSnapshot,
  walletSpend,
} from '../wechat/wallet/walletMockStore'
import { LIVE_FAN_INTERVAL_MS, LIVE_HOST_COOLDOWN_MS, LIVE_HOST_IDLE_INTERVAL_MS, LIVE_PLATINUM, LIVE_Z } from './constants'
import { GiftBottomSheet } from './GiftBottomSheet'
import {
  commitHostBatch,
  commitUserBatch,
  emptyLiveChatContext,
  noteFanBatch,
  noteHostReaction,
  noteUserDanmaku,
  prepareFanBatchContext,
  type LiveChatContext,
} from './liveChatContext'
import { generateFanDanmakuBatch, generateHostIdleLine, generateHostLine } from './liveChatAi'
import { LiveChatStream } from './LiveChatStream'
import { sendLiveSponsorshipAftercare } from './liveAftercare'
import { loadLiveRoomSettings, saveLiveRoomSettings } from './liveRoomSettings'
import { coverToneForId, formatViewerLabel } from './liveRooms'
import { LiveRoomSettingsSheet } from './LiveRoomSettingsSheet'
import { LiveSceneStage } from './LiveSceneStage'
import { loadLivePersonaSnapshot, type LivePersonaSnapshot } from './livePersonaContext'
import { generateLiveScenePlayback, isLiveChatApiReady } from './sceneAi'
import { SponsorshipCeremony } from './SponsorshipCeremony'
import type {
  LiveChatLine,
  LiveGift,
  LiveRoom,
  LiveRoomSettings,
  LiveScenePlayback,
  SponsorshipCeremonyPayload,
  StreamerEvent,
} from './types'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 画面进度条占高，弹幕 bottom 需额外抬这么多，避免被挡住 */
const SCENE_PROGRESS_RESERVE_PX = 72

export function ImmersiveLiveRoom({
  room,
  active,
  userNick,
  apiConfig,
  danmakuApiConfig,
  onExit,
  className = '',
}: {
  room: LiveRoom
  /** 是否为当前可见/激活直播间（驱动弹幕与主播 mock） */
  active: boolean
  userNick: string
  apiConfig?: ApiConfig | null
  /** 弹幕专用；缺省时与 apiConfig 相同 */
  danmakuApiConfig?: ApiConfig | null
  onExit: () => void
  className?: string
}) {
  const { snapshot, balanceText, verifyPaymentPassword } = useWalletMockStore()
  const [lines, setLines] = useState<LiveChatLine[]>([])
  const [draft, setDraft] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [pendingGift, setPendingGift] = useState<LiveGift | null>(null)
  const [payError, setPayError] = useState('')
  const [ceremony, setCeremony] = useState<SponsorshipCeremonyPayload | null>(null)
  const [inputFocus, setInputFocus] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<LiveRoomSettings>(() => loadLiveRoomSettings(room.id))
  const [scene, setScene] = useState<LiveScenePlayback | null>(null)
  const [sceneProgressMs, setSceneProgressMs] = useState(0)
  const [scenePlaying, setScenePlaying] = useState(false)
  /** 首次进入先静默；点「生成画面」后再开弹幕与主播循环 */
  const [liveReady, setLiveReady] = useState(false)
  const [sceneBusy, setSceneBusy] = useState(false)
  const { composerRef, keyboardPadPx } = usePublishKeyboardInset(
    active && liveReady && !giftOpen && !payOpen && !settingsOpen,
  )

  const hostBusyRef = useRef(false)
  const lastHostAtRef = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const apiConfigRef = useRef(apiConfig)
  apiConfigRef.current = apiConfig
  const danmakuApiConfigRef = useRef(danmakuApiConfig ?? apiConfig)
  danmakuApiConfigRef.current = danmakuApiConfig ?? apiConfig
  const chatCtxRef = useRef<LiveChatContext>(emptyLiveChatContext())
  const personaRef = useRef<LivePersonaSnapshot | null>(null)
  const sceneGenSeqRef = useRef(0)
  const chatLoopEpochRef = useRef(0)
  const fanRevealTimersRef = useRef<number[]>([])
  const sceneApiHintRef = useRef<string | null>(null)

  const clearFanRevealTimers = useCallback(() => {
    for (const t of fanRevealTimersRef.current) window.clearTimeout(t)
    fanRevealTimersRef.current = []
  }, [])

  useEffect(() => {
    setSettings(loadLiveRoomSettings(room.id))
    setLiveReady(false)
    setSceneBusy(false)
    setLines([])
    setDraft('')
    setScene(null)
    sceneGenSeqRef.current += 1
    chatLoopEpochRef.current += 1
    clearFanRevealTimers()
    setSceneProgressMs(0)
    setScenePlaying(false)
    chatCtxRef.current = emptyLiveChatContext()
    personaRef.current = null
    hostBusyRef.current = false
    lastHostAtRef.current = 0
  }, [room.id, clearFanRevealTimers])

  useEffect(() => {
    let cancelled = false
    const cid = room.characterId?.trim()
    if (!cid) {
      personaRef.current = null
      return
    }
    void loadLivePersonaSnapshot(cid).then((snap) => {
      if (!cancelled) personaRef.current = snap
    })
    return () => {
      cancelled = true
    }
  }, [room.characterId, room.id])

  const updateSettings = useCallback(
    (next: LiveRoomSettings) => {
      const saved = saveLiveRoomSettings(room.id, next)
      setSettings(saved)
    },
    [room.id],
  )

  const pushLine = useCallback((line: Omit<LiveChatLine, 'id' | 'at'> & { id?: string; at?: number }) => {
    setLines((prev) => [
      ...prev,
      {
        id: line.id ?? uid('line'),
        at: line.at ?? Date.now(),
        nick: line.nick,
        text: line.text,
        kind: line.kind,
      },
    ])
  }, [])

  /** 一批弹幕按间隔逐条出现（不是一次性砸满） */
  const revealFanLinesOneByOne = useCallback(
    (batch: Array<{ nick: string; text: string }>, epoch: number) => {
      clearFanRevealTimers()
      const gap = 720
      batch.forEach((fan, i) => {
        const t = window.setTimeout(() => {
          if (epoch !== chatLoopEpochRef.current) return
          pushLine({ nick: fan.nick, text: fan.text, kind: 'fan' })
        }, i * gap)
        fanRevealTimersRef.current.push(t)
      })
      return batch.length * gap
    },
    [clearFanRevealTimers, pushLine],
  )

  const pushFanBatchAsync = useCallback(
    async (epoch: number) => {
      const { danmakuBatchCount, danmakuStyle } = settingsRef.current
      chatCtxRef.current = prepareFanBatchContext(chatCtxRef.current)
      const batch = await generateFanDanmakuBatch({
        count: danmakuBatchCount,
        style: danmakuStyle,
        room,
        ctx: chatCtxRef.current,
        persona: personaRef.current,
        apiConfig: danmakuApiConfigRef.current,
      })
      if (epoch !== chatLoopEpochRef.current || !batch.length) return []
      chatCtxRef.current = noteFanBatch(
        chatCtxRef.current,
        batch.map((b) => b.text),
      )
      revealFanLinesOneByOne(batch, epoch)
      return batch
    },
    [revealFanLinesOneByOne, room],
  )

  const runHost = useCallback(
    async (event: StreamerEvent) => {
      if (!active) return
      const now = Date.now()
      if (hostBusyRef.current && event.type === 'fan_prompt') return
      if (event.type === 'fan_prompt' && now - lastHostAtRef.current < LIVE_HOST_COOLDOWN_MS) return
      hostBusyRef.current = true
      chatCtxRef.current = commitUserBatch(chatCtxRef.current)
      try {
        const text = await generateHostLine({
          room,
          event,
          ctx: chatCtxRef.current,
          persona: personaRef.current,
          apiConfig: apiConfigRef.current,
        })
        if (!active) return
        pushLine({ nick: room.hostName, text, kind: 'host' })
        chatCtxRef.current = noteHostReaction(chatCtxRef.current, text)
        lastHostAtRef.current = Date.now()
      } finally {
        hostBusyRef.current = false
      }
    },
    [active, pushLine, room],
  )

  // 开播后：只先出一条系统提示，再逐条接主播 / 网友（不整批 seed）
  useEffect(() => {
    if (!active || !liveReady) return
    const epoch = ++chatLoopEpochRef.current
    setLines([])
    pushLine({
      nick: '浮光',
      text: `已进入 ${room.hostName} 的连线`,
      kind: 'system',
    })
    const hint = sceneApiHintRef.current
    sceneApiHintRef.current = null
    if (hint) {
      pushLine({ nick: '浮光', text: hint, kind: 'system' })
    }

    const tEnter = window.setTimeout(() => {
      if (epoch !== chatLoopEpochRef.current) return
      void runHost({ type: 'enter' })
    }, 900)

    return () => {
      window.clearTimeout(tEnter)
    }
  }, [active, liveReady, pushLine, room.hostName, runHost])

  useEffect(() => {
    if (!active || !liveReady) return
    const epoch = chatLoopEpochRef.current
    let cancelled = false
    let timeoutId = 0

    const scheduleNext = (delay: number) => {
      timeoutId = window.setTimeout(() => {
        void (async () => {
          if (cancelled || epoch !== chatLoopEpochRef.current) return
          const batch = await pushFanBatchAsync(epoch)
          if (cancelled || epoch !== chatLoopEpochRef.current) return
          const last = batch[batch.length - 1]
          const revealMs = Math.max(0, (batch.length - 1) * 720)
          if (last && Math.random() < 0.5) {
            window.setTimeout(() => {
              if (cancelled || epoch !== chatLoopEpochRef.current) return
              void runHost({ type: 'fan_prompt', text: last.text })
            }, revealMs + 480)
          }
          const nextDelay =
            LIVE_FAN_INTERVAL_MS + revealMs + 900 + Math.floor(Math.random() * 800)
          scheduleNext(nextDelay)
        })()
      }, delay)
    }

    scheduleNext(1600 + Math.floor(Math.random() * 600))
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      clearFanRevealTimers()
    }
  }, [active, liveReady, pushFanBatchAsync, runHost, clearFanRevealTimers])

  useEffect(() => {
    if (!active || !liveReady) return
    const epoch = chatLoopEpochRef.current
    let cancelled = false

    const tick = () => {
      if (cancelled || epoch !== chatLoopEpochRef.current) return
      if (hostBusyRef.current) return
      const now = Date.now()
      if (now - lastHostAtRef.current < LIVE_HOST_COOLDOWN_MS) return
      hostBusyRef.current = true
      chatCtxRef.current = commitUserBatch(chatCtxRef.current)
      void generateHostIdleLine({
        room,
        ctx: chatCtxRef.current,
        persona: personaRef.current,
        apiConfig: apiConfigRef.current,
      })
        .then((text) => {
          if (cancelled || epoch !== chatLoopEpochRef.current) return
          pushLine({ nick: room.hostName, text, kind: 'host' })
          chatCtxRef.current = noteHostReaction(chatCtxRef.current, text)
          lastHostAtRef.current = Date.now()
        })
        .finally(() => {
          hostBusyRef.current = false
        })
    }

    const first = window.setTimeout(tick, 6200)
    const iv = window.setInterval(tick, LIVE_HOST_IDLE_INTERVAL_MS + Math.floor(Math.random() * 4000))
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(iv)
    }
  }, [active, liveReady, pushLine, room])

  const generateOpeningScene = () => {
    if (!active || liveReady || sceneBusy) return
    const seq = ++sceneGenSeqRef.current
    setSceneBusy(true)
    const durationMs = Math.round(settingsRef.current.sceneDurationSec * 1000)
    void generateLiveScenePlayback({
      room,
      userText: '开场',
      durationMs,
      recentUserBatch: [],
      recentFanBatch: [],
      recentHostBatch: [],
      persona: personaRef.current,
      apiConfig: apiConfigRef.current,
    })
      .then(({ scene: next, viaApi, error }) => {
        if (seq !== sceneGenSeqRef.current) return
        setScene(next)
        setSceneProgressMs(0)
        setScenePlaying(true)
        sceneApiHintRef.current = viaApi
          ? null
          : error
            ? `画面未走 API：${error}`
            : '画面未走 API，已用本地文案'
        setLiveReady(true)
        setSceneBusy(false)
      })
      .catch(() => {
        if (seq !== sceneGenSeqRef.current) return
        setSceneBusy(false)
      })
  }

  const submitDanmaku = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    // 仅进入用户本轮批次，不立刻结算/反应，便于连发组成「一批」
    chatCtxRef.current = noteUserDanmaku(chatCtxRef.current, text)
    pushLine({ nick: userNick || '我', text, kind: 'user' })
  }

  const reactWithScene = () => {
    const text = draft.trim()
    if (!text || sceneBusy) return
    setDraft('')
    chatCtxRef.current = noteUserDanmaku(chatCtxRef.current, text)
    pushLine({ nick: userNick || '我', text, kind: 'user' })
    // 反应前先把上一轮角色 pending 收成 lastHostBatch，再开本轮反应
    chatCtxRef.current = commitHostBatch(chatCtxRef.current)
    void runHost({ type: 'danmaku', text })
    const durationMs = Math.round(settingsRef.current.sceneDurationSec * 1000)
    const seq = ++sceneGenSeqRef.current
    setSceneBusy(true)
    void generateLiveScenePlayback({
      room,
      userText: text,
      durationMs,
      recentUserBatch: chatCtxRef.current.lastUserBatch.length
        ? chatCtxRef.current.lastUserBatch
        : chatCtxRef.current.pendingUserBatch,
      recentFanBatch: chatCtxRef.current.lastFanBatch,
      recentHostBatch: chatCtxRef.current.lastHostBatch,
      persona: personaRef.current,
      apiConfig: apiConfigRef.current,
    }).then(({ scene: next, viaApi, error }) => {
      if (seq !== sceneGenSeqRef.current) return
      setScene(next)
      setSceneProgressMs(0)
      setScenePlaying(true)
      setSceneBusy(false)
      pushLine({
        nick: '浮光',
        text: viaApi
          ? `已生成 ${settingsRef.current.sceneDurationSec}s 画面时间轴`
          : `画面未走 API${error ? `：${error}` : ''}，已用本地文案`,
        kind: 'system',
      })
    }).catch(() => {
      if (seq !== sceneGenSeqRef.current) return
      setSceneBusy(false)
    })
  }

  // 画面时间轴播放
  useEffect(() => {
    if (!active || !scene || !scenePlaying) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      setSceneProgressMs((prev) => {
        const next = prev + dt
        if (next >= scene.durationMs) {
          setScenePlaying(false)
          return scene.durationMs
        }
        return next
      })
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [active, scene, scenePlaying])

  const openGiftPay = (gift: LiveGift) => {
    setPayError('')
    const snap = walletReadSnapshot()
    if (!snap.isPaymentPasswordSet) {
      setPayError('请先在微信 · 我 · 卡包中设定 6 位支付密码')
      return
    }
    if (snap.balance < gift.priceYuan) {
      setPayError('钱包余额不足')
      return
    }
    setPendingGift(gift)
    setGiftOpen(false)
    setPayOpen(true)
  }

  const finalizeGift = () => {
    const gift = pendingGift
    if (!gift) return
    const ok = walletSpend(gift.priceYuan, `浮光直播 · ${gift.name}`)
    if (!ok) {
      setPayError('支付失败')
      setPendingGift(null)
      return
    }
    setCeremony({
      id: uid('ceremony'),
      userNick: userNick || '我',
      hostName: room.hostName,
      giftLabel: gift.ceremonyLabel,
    })
    pushLine({
      nick: '系统',
      text: `${userNick || '我'} 赞助了「${gift.ceremonyLabel}」`,
      kind: 'system',
    })
    void runHost({ type: 'gift', giftName: gift.ceremonyLabel, priceYuan: gift.priceYuan })
    if (room.characterId) {
      window.setTimeout(() => {
        void sendLiveSponsorshipAftercare({ characterId: room.characterId!, gift })
      }, 1800)
    }
    setPendingGift(null)
  }

  const mediaUrl =
    settings.backgroundUrl.trim() || room.videoUrl || room.coverUrl || room.avatarUrl
  const isVideo = Boolean(!settings.backgroundUrl.trim() && room.videoUrl)
  // 有画面进度条时把弹幕整体抬到进度条上方（固定预留，不跟播放进度变，避免抖）
  const chatBottomExtra = keyboardPadPx + (scene ? SCENE_PROGRESS_RESERVE_PX : 0)
  const hasDraft = Boolean(draft.trim())
  const apiReady = isLiveChatApiReady(apiConfig)

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#0c0c0d] ${className}`}>
      {/* Canvas */}
      <div className="absolute inset-0" style={{ zIndex: LIVE_Z.canvas }}>
        {isVideo && mediaUrl ? (
          <video
            className="h-full w-full object-cover"
            src={mediaUrl}
            autoPlay={active}
            muted
            loop
            playsInline
          />
        ) : mediaUrl ? (
          <motion.img
            src={mediaUrl}
            alt=""
            className="h-full w-full object-cover"
            animate={active ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="h-full w-full"
            style={{ background: coverToneForId(room.id) }}
            animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* Top chrome */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
        style={{ zIndex: LIVE_Z.chrome }}
      >
        <div className="flex items-center gap-2">
          <div className="size-9 overflow-hidden rounded-full border border-white/25 bg-white/10">
            {room.avatarUrl ? (
              <img src={room.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[12px] text-white/70"
                style={{ background: coverToneForId(room.id) }}
              >
                {room.hostName.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium tracking-wide text-white/95">{room.hostName}</p>
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-white/55">
              <span
                className="inline-block size-1.5 rounded-full bg-white"
                style={{
                  animation: active ? 'lumiLivePulse 1.8s ease-in-out infinite' : undefined,
                  boxShadow: '0 0 6px rgba(255,255,255,0.7)',
                }}
              />
              LIVE
            </p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 pt-0.5">
          <p className="flex items-center gap-1 text-[12px] tabular-nums text-white/75">
            <Eye className="size-3.5 opacity-70" strokeWidth={1.5} />
            {formatViewerLabel(room.viewerCount)}
          </p>
          <Pressable
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white/85 backdrop-blur-2xl"
            aria-label="直播间设置"
          >
            <Settings2 className="size-4" strokeWidth={1.5} />
          </Pressable>
        </div>
      </div>

      {liveReady ? <LiveChatStream lines={lines} bottomOffsetPx={chatBottomExtra} /> : null}

      <LiveSceneStage
        scene={scene}
        progressMs={sceneProgressMs}
        playing={scenePlaying}
        bottomOffsetPx={keyboardPadPx}
        onSeek={(ms) => {
          setSceneProgressMs(ms)
          setScenePlaying(false)
        }}
        onTogglePlay={() => {
          if (!scene) return
          if (sceneProgressMs >= scene.durationMs) {
            setSceneProgressMs(0)
            setScenePlaying(true)
            return
          }
          setScenePlaying((p) => !p)
        }}
      />

      {/* 首次进入：居中主按钮，不铺弹幕 */}
      {!liveReady ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-8"
          style={{ zIndex: LIVE_Z.actionBar + 2 }}
        >
          <Pressable
            type="button"
            onClick={generateOpeningScene}
            disabled={sceneBusy}
            className="rounded-full border border-white/40 bg-black/55 px-10 py-4 text-[15px] font-medium tracking-[0.2em] backdrop-blur-2xl active:scale-[0.98] disabled:opacity-60"
            style={{
              color: '#F5E6C8',
              boxShadow: `0 0 0 1px ${LIVE_PLATINUM}66, 0 16px 48px rgba(0,0,0,0.45)`,
            }}
            aria-label="生成直播画面"
          >
            {sceneBusy ? '生成中…' : '生成直播画面'}
          </Pressable>
          <p className="pointer-events-none mt-4 text-center text-[11px] leading-relaxed tracking-[0.08em] text-white/45">
            {sceneBusy
              ? apiReady
                ? '正在通过 API 编写画面时间轴'
                : '未配置聊天 API，使用本地兜底'
              : apiReady
                ? '将调用聊天 API 生成画面 / 对白 / 动作'
                : '请先在 API 设置配置聊天模型；未配置时用本地文案'}
          </p>
        </div>
      ) : null}

      {/* Action bar：生成后再开放互动；未生成时仅保留退出 */}
      {liveReady ? (
        <div
          ref={composerRef}
          className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-[bottom] duration-150 ease-out"
          style={{ zIndex: LIVE_Z.actionBar, bottom: keyboardPadPx }}
        >
          <div
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 py-2.5 backdrop-blur-2xl ${
              inputFocus ? 'border-[#D4AF37]/40' : ''
            }`}
          >
            <Pencil className="size-3.5 shrink-0 text-white/40" strokeWidth={1.5} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setInputFocus(true)}
              onBlur={() => setInputFocus(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitDanmaku()
                }
              }}
              placeholder="互动…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/35"
            />
            {hasDraft ? (
              <div className="flex shrink-0 items-center gap-2">
                <Pressable
                  type="button"
                  onClick={submitDanmaku}
                  className="text-[12px] tracking-wide text-white/75"
                >
                  发送
                </Pressable>
                <Pressable
                  type="button"
                  onClick={reactWithScene}
                  disabled={sceneBusy}
                  className="text-[12px] tracking-wide disabled:opacity-50"
                  style={{ color: LIVE_PLATINUM }}
                >
                  {sceneBusy ? '生成中' : '反应'}
                </Pressable>
              </div>
            ) : null}
          </div>
          <Pressable
            type="button"
            onClick={() => {
              setPayError('')
              setGiftOpen(true)
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white/85 backdrop-blur-2xl"
            aria-label="心意赞助"
          >
            <Gift className="size-4" strokeWidth={1.5} />
          </Pressable>
          <Pressable
            type="button"
            onClick={onExit}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white/85 backdrop-blur-2xl"
            aria-label="退出直播间"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
          </Pressable>
        </div>
      ) : (
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
          style={{ zIndex: LIVE_Z.actionBar + 3 }}
        >
          <Pressable
            type="button"
            onClick={onExit}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white/85 backdrop-blur-2xl"
            aria-label="退出直播间"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
          </Pressable>
        </div>
      )}

      <SponsorshipCeremony payload={ceremony} onDone={() => setCeremony(null)} />

      <GiftBottomSheet
        open={giftOpen}
        balanceYuan={snapshot.balance}
        balanceLabel={balanceText}
        error={payError}
        onClose={() => setGiftOpen(false)}
        onSelect={openGiftPay}
      />

      <LiveRoomSettingsSheet
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
      />

      <AnimatePresence>
        {payOpen ? (
          <div className="absolute inset-0" style={{ zIndex: LIVE_Z.payment }}>
            <PaymentKeyboard
              open={payOpen}
              title="确认心意赞助"
              subtitle={pendingGift ? pendingGift.name : undefined}
              amountLabel={pendingGift ? `¥${pendingGift.priceYuan}` : undefined}
              onClose={() => {
                setPayOpen(false)
                setPendingGift(null)
              }}
              verifyPin={verifyPaymentPassword}
              onVerified={finalizeGift}
            />
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
