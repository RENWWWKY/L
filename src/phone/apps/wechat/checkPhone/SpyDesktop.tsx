import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Globe, Map, MessageCircle, Music2, NotebookPen, PhoneCall, ShoppingBag, UtensilsCrossed } from 'lucide-react'

import { AppIcon } from './AppIcon'
import './spyDesktop.css'
import { getOrInitSpyWallpaperUrl } from './spyWallpaper'
import { Pressable } from '../../../components/Pressable'
import { NotesApp } from './notes/NotesApp'
import { MirrorWeChatApp } from './mirrorWechat/MirrorWeChatApp'
import { SpyTutorial } from './SpyTutorial'
import { personaDb } from '../newFriendsPersona/idb'

type DesktopApp = {
  id: string
  label: string
  Icon: typeof MessageCircle
}

type ActiveSpyApp = 'notes' | 'wechat' | null
const SPY_TUTORIAL_SEEN_KEY = 'checkPhone.spyTutorialSeen.v1'
const SPY_TUTORIAL_STEPS = [
  {
    title: '偷偷查手机说明',
    text:
      '你已进入偷偷查看模式。\n请尽量快速浏览关键内容，任何拖延都可能提升暴露风险。\n点击「下一步」查看抓包规则。',
  },
  {
    title: '抓包机制与扫描',
    text:
      '系统每 60 秒会发起一次扫描，扫描持续 10 秒。\n扫描期间禁止触碰屏幕；任何点击都会被立即判定抓包并强制退出。',
  },
  {
    title: '计时器可长按拖动',
    text:
      '长按右上角计时器约 0.2 秒即可拖动位置。\n将它移动到不遮挡按钮的区域，方便持续观察扫描倒计时。',
  },
] as const

export function SpyDesktop({
  characterId,
  characterName,
  playerIdentityId,
  playerDisplayName,
  useLumiProjectAssistantPrompt,
  onToast,
  onExit,
}: {
  characterId: string
  characterName: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  onToast: (msg: string) => void
  onExit: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  const [caughtOpen, setCaughtOpen] = useState(false)
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null)
  const [nextScanAtMs, setNextScanAtMs] = useState(() => Date.now() + 60_000)
  const [scanActive, setScanActive] = useState(false)
  const [scanEndsAtMs, setScanEndsAtMs] = useState<number | null>(null)
  const [activeApp, setActiveApp] = useState<ActiveSpyApp>(null)
  const [timerManualPos, setTimerManualPos] = useState<{ x: number; y: number } | null>(null)
  const [timerDragging, setTimerDragging] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [tutorialTargetEl, setTutorialTargetEl] = useState<HTMLElement | null>(null)
  const timerDragStartRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null)
  const timerLongPressRef = useRef<number | null>(null)
  const prevBodyUserSelectRef = useRef<string>('')
  const prevBodyWebkitUserSelectRef = useRef<string>('')
  const backButtonRef = useRef<HTMLButtonElement | null>(null)
  const timerRef = useRef<HTMLDivElement | null>(null)
  const onExitRef = useRef(onExit)
  useEffect(() => {
    onExitRef.current = onExit
  }, [onExit])

  const apps = useMemo<DesktopApp[]>(
    () => [
      { id: 'wechat', label: '微信', Icon: MessageCircle },
      { id: 'notes', label: '备忘录', Icon: NotebookPen },
      { id: 'shopping', label: '网购', Icon: ShoppingBag },
      { id: 'takeout', label: '外卖', Icon: UtensilsCrossed },
      { id: 'browser', label: '浏览器', Icon: Globe },
      { id: 'calls', label: '通话', Icon: PhoneCall },
      { id: 'music', label: '音乐', Icon: Music2 },
      { id: 'maps', label: '地图', Icon: Map },
    ],
    [],
  )

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const url = await getOrInitSpyWallpaperUrl(characterId)
        if (!alive) return
        setWallpaperUrl(url)
      } catch {
        if (!alive) return
        setWallpaperUrl(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [characterId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const seen = await personaDb.getPhoneKv(`${SPY_TUTORIAL_SEEN_KEY}:${characterId}`)
      if (cancelled) return
      if (seen !== true) {
        setTutorialStep(0)
        setTutorialOpen(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [characterId])

  useEffect(() => {
    if (caughtOpen) return
    if (scanActive) return
    const waitMs = Math.max(0, nextScanAtMs - Date.now())
    const t = window.setTimeout(() => {
      const endAt = Date.now() + 10_000
      setScanEndsAtMs(endAt)
      setScanActive(true)
    }, waitMs)
    return () => window.clearTimeout(t)
  }, [caughtOpen, scanActive, nextScanAtMs])

  useEffect(() => {
    if (!scanActive) return
    const endAt = scanEndsAtMs ?? Date.now() + 10_000
    const t = window.setTimeout(() => {
      setScanActive(false)
      setScanEndsAtMs(null)
      setNextScanAtMs(Date.now() + 60_000)
    }, Math.max(0, endAt - Date.now()))
    return () => window.clearTimeout(t)
  }, [scanActive, scanEndsAtMs])

  useEffect(() => {
    if (!caughtOpen) return
    const t = window.setTimeout(() => onExitRef.current(), 3000)
    return () => window.clearTimeout(t)
  }, [caughtOpen])
  useEffect(() => {
    if (!tutorialOpen) return
    let id = 0
    const tick = () => {
      if (tutorialStep === 0) setTutorialTargetEl(backButtonRef.current)
      else setTutorialTargetEl(timerRef.current)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [tutorialOpen, tutorialStep])


  useEffect(() => {
    return () => {
      if (timerLongPressRef.current != null) window.clearTimeout(timerLongPressRef.current)
      document.body.style.userSelect = prevBodyUserSelectRef.current
      document.body.style.webkitUserSelect = prevBodyWebkitUserSelectRef.current
    }
  }, [])

  useEffect(() => {
    if (!timerDragging) return
    prevBodyUserSelectRef.current = document.body.style.userSelect
    prevBodyWebkitUserSelectRef.current = document.body.style.webkitUserSelect
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    return () => {
      document.body.style.userSelect = prevBodyUserSelectRef.current
      document.body.style.webkitUserSelect = prevBodyWebkitUserSelectRef.current
    }
  }, [timerDragging])

  const scanCountdownSec = scanActive
    ? Math.max(0, Math.ceil(((scanEndsAtMs ?? now.getTime()) - now.getTime()) / 1000))
    : Math.max(0, Math.ceil((nextScanAtMs - now.getTime()) / 1000))

  const timerAutoStyle = activeApp
    ? ({ right: 16, bottom: 14 } as const)
    : ({ right: 16, top: 14 } as const)

  const closeTutorial = () => {
    setTutorialOpen(false)
    void personaDb.setPhoneKv(`${SPY_TUTORIAL_SEEN_KEY}:${characterId}`, true)
  }

  const onTimerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (timerLongPressRef.current != null) window.clearTimeout(timerLongPressRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    timerDragStartRef.current = { pointerId: e.pointerId, dx, dy }
    timerLongPressRef.current = window.setTimeout(() => {
      setTimerDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }, 220)
  }

  const onTimerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = timerDragStartRef.current
    if (!s || !timerDragging || s.pointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    const w = 164
    const h = 34
    const minX = 8
    const minY = 8
    const maxX = window.innerWidth - w - 8
    const maxY = window.innerHeight - h - 8
    const x = Math.min(maxX, Math.max(minX, e.clientX - s.dx))
    const y = Math.min(maxY, Math.max(minY, e.clientY - s.dy))
    setTimerManualPos({ x, y })
  }

  const stopTimerDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = timerDragStartRef.current
    if (!s || s.pointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    if (timerLongPressRef.current != null) {
      window.clearTimeout(timerLongPressRef.current)
      timerLongPressRef.current = null
    }
    if (timerDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    setTimerDragging(false)
    timerDragStartRef.current = null
  }

  return (
    <motion.div
      className="fixed inset-0 z-[1400] overflow-hidden bg-[#070707] text-white"
      style={
        wallpaperUrl
          ? {
              backgroundImage: `url(${wallpaperUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onPointerDownCapture={() => {
        if (!scanActive || caughtOpen || tutorialOpen) return
        setCaughtOpen(true)
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/55" />
      <div className="pointer-events-none fixed inset-0 z-[1409] spy-red-vignette" />
      <div
        ref={timerRef}
        className={`fixed z-[1412] rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-white/85 backdrop-blur-sm select-none ${
          timerDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={
          timerManualPos
            ? {
                left: timerManualPos.x,
                top: timerManualPos.y,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'none',
              }
            : {
                ...timerAutoStyle,
                top: timerAutoStyle.top != null ? 'max(14px, env(safe-area-inset-top))' : undefined,
                bottom: timerAutoStyle.bottom != null ? 'max(14px, env(safe-area-inset-bottom))' : undefined,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'none',
              }
        }
        onPointerDown={onTimerPointerDown}
        onPointerMove={onTimerPointerMove}
        onPointerUp={stopTimerDrag}
        onPointerCancel={stopTimerDrag}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className={`text-[11px] tracking-[0.08em] ${scanActive ? 'text-red-200' : 'text-white/75'}`}>
          {scanActive ? `系统扫描中 ${scanCountdownSec}s` : `下次扫描 ${scanCountdownSec}s`}
        </span>
      </div>

      <div className="relative z-[1] flex h-full w-full flex-col">
        {/* top controls */}
        <div
          className="flex items-center justify-between px-5"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <Pressable
            ref={backButtonRef}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/85 backdrop-blur-sm active:scale-[0.98]"
            onClick={onExit}
            aria-label="返回聊天室"
          >
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
          </Pressable>
          <div className="w-9" />
        </div>

        {/* desktop header */}
        <div className="px-5 pt-5">
          <div className="text-[12px] tracking-[0.32em] text-white/35">FOREIGN DEVICE</div>
          <div className="mt-1 text-[14px] text-white/80">{characterName} 的桌面</div>
        </div>

        {/* app grid */}
        <div className="mt-6 grid grid-cols-4 gap-x-4 gap-y-6 px-5">
          {apps.map(({ id, label, Icon }) => (
            <AppIcon
              key={id}
              label={label}
              onClick={() => {
                if (id === 'wechat') {
                  setActiveApp('wechat')
                  return
                }
                if (id === 'notes') {
                  setActiveApp('notes')
                  return
                }
                onToast('即将揭秘')
              }}
              icon={<Icon size={26} strokeWidth={1.6} className="text-[#e8d9b6]" aria-hidden />}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeApp === 'notes' ? (
          <NotesApp
            onClose={() => setActiveApp(null)}
            characterId={characterId}
            playerIdentityId={playerIdentityId}
            playerDisplayName={playerDisplayName}
            useLumiProjectAssistantPrompt={useLumiProjectAssistantPrompt}
          />
        ) : null}

        {activeApp === 'wechat' ? (
          <MirrorWeChatApp
            onClose={() => setActiveApp(null)}
            characterId={characterId}
            playerIdentityId={playerIdentityId}
            playerDisplayName={playerDisplayName}
            useLumiProjectAssistantPrompt={useLumiProjectAssistantPrompt}
            onToast={onToast}
          />
        ) : null}

        {scanActive && !caughtOpen ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[1413] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            <div className="rounded-[14px] border border-red-300/20 bg-black/55 px-4 py-3 text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-sm">
              <div className="text-[12px] tracking-[0.22em] text-red-200/80">SYSTEM SCAN</div>
              <div className="mt-1 text-[13px] text-white/85">扫描进行中，请勿触碰屏幕</div>
              <div className="mt-1 text-[12px] tracking-[0.18em] text-white/55">{scanCountdownSec}s</div>
            </div>
          </motion.div>
        ) : null}

        {caughtOpen ? (
          <motion.div
            className="fixed inset-0 z-[1415]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08, ease: 'linear' }}
          >
            {/* red flash + glitch */}
            <motion.div
              className="absolute inset-0 bg-red-600/20"
              animate={{ opacity: [0, 1, 0.2, 1, 0] }}
              transition={{ duration: 0.48, times: [0, 0.18, 0.4, 0.62, 1], ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-0"
              animate={{ x: [0, -6, 8, -4, 0], filter: ['contrast(1)', 'contrast(1.4)', 'contrast(1.2)', 'contrast(1.5)', 'contrast(1)'] }}
              transition={{ duration: 0.38, ease: 'easeInOut' }}
            />

            <div className="absolute inset-0 flex items-center justify-center px-6">
              <motion.div
                className="w-full max-w-[420px] rounded-[12px] border border-red-400/35 bg-[#090909]/92 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.7)] backdrop-blur-md"
                initial={{ scale: 0.98, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.99, opacity: 0, y: 6 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              >
                <div className="font-mono text-[11px] leading-relaxed tracking-[0.14em] text-red-200/80">
                  [系统安全警告]
                </div>
                <div className="mt-3 font-mono text-[13px] leading-relaxed tracking-[0.08em] text-white/90">
                  {'> 检测到扫描期间存在未授权触碰'}
                </div>
                <div className="mt-1 font-mono text-[13px] leading-relaxed tracking-[0.08em] text-white/90">
                  {'> 当前会话已暴露，正在强制退出'}
                </div>
                <div className="mt-3 h-px w-full bg-red-300/30" />
                <div className="mt-2 font-mono text-[11px] tracking-[0.16em] text-red-200/75">
                  3秒后返回聊天室...
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}

        <SpyTutorial
          open={tutorialOpen && !caughtOpen}
          step={tutorialStep}
          title={SPY_TUTORIAL_STEPS[tutorialStep]?.title ?? '查手机教程'}
          text={SPY_TUTORIAL_STEPS[tutorialStep]?.text ?? ''}
          targetElement={tutorialTargetEl}
          canPrev={tutorialStep > 0}
          onPrev={() => setTutorialStep((v) => Math.max(0, v - 1))}
          onNext={() => {
            setTutorialStep((v) => {
              const next = v + 1
              if (next >= SPY_TUTORIAL_STEPS.length) {
                closeTutorial()
                return v
              }
              return next
            })
          }}
          onClose={closeTutorial}
          nextLabel={tutorialStep >= SPY_TUTORIAL_STEPS.length - 1 ? '完成' : '下一步'}
        />
      </AnimatePresence>
    </motion.div>
  )
}

