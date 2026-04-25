/**
 * 全局手势动效：点击爆炸 + 滑动拖尾
 * - pointer-events: none，不拦截交互
 * - 在 document 捕获阶段监听事件，动效节点挂于固定层内
 * - 开关与颜色来自 Customization（`gestureEffects`）
 */
import { useEffect, useRef } from 'react'
import { useCustomization } from '../phone/CustomizationContext'
import type { GestureEffectsSettings } from '../phone/types'

// ---------------------------------------------------------------------------
// 非 UI 持久化参数（粒子数量、时长等）
// ---------------------------------------------------------------------------

export const gestureEffectsConfig = {
  click: {
    minParticles: 5,
    maxParticles: 8,
    minSize: 2,
    maxSize: 6,
    minDistance: 20,
    maxDistance: 50,
    minDuration: 300,
    maxDuration: 400,
  },
  swipe: {
    trailLength: 12,
    minSize: 1,
    maxSize: 4,
    opacity: 0.6,
    fadeDuration: 200,
    minSpacing: 8,
    maxSpacing: 12,
  },
}

const MAX_DOM_NODES = 50

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

export function GlobalGestureEffects() {
  const { state } = useCustomization()
  const geRef = useRef<GestureEffectsSettings>(state.gestureEffects)
  geRef.current = state.gestureEffects

  const overlayRef = useRef<HTMLDivElement | null>(null)
  const trailElsRef = useRef<HTMLDivElement[]>([])
  const mouseDownRef = useRef(false)
  const touchActiveRef = useRef(false)
  const lastTrailSampleRef = useRef(0)
  const lastTrailPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastTrailTimeRef = useRef(0)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBurstRef = useRef<{ t: number; x: number; y: number }>({ t: 0, x: -1, y: -1 })

  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const layer: HTMLDivElement = el

    function pruneOverlay() {
      while (layer.childNodes.length > MAX_DOM_NODES) {
        const first = layer.firstChild
        if (first) layer.removeChild(first)
      }
    }

    function shouldDedupeBurst(x: number, y: number) {
      const { t, x: lx, y: ly } = lastBurstRef.current
      const now = performance.now()
      if (now - t < 320 && Math.hypot(x - lx, y - ly) < 24) return true
      lastBurstRef.current = { t: now, x, y }
      return false
    }

    function spawnBurst(clientX: number, clientY: number) {
      const ge = geRef.current
      if (!ge.clickEnabled) return
      if (shouldDedupeBurst(clientX, clientY)) return

      const cfg = gestureEffectsConfig.click
      const n = randomInt(cfg.minParticles, cfg.maxParticles)
      const duration = randomBetween(cfg.minDuration, cfg.maxDuration)
      const colors = [ge.burstColorDark, ge.burstColorMid, ge.burstColorLight]

      for (let i = 0; i < n; i += 1) {
        const node = document.createElement('div')
        const size = randomBetween(cfg.minSize, cfg.maxSize)
        const dist = randomBetween(cfg.minDistance, cfg.maxDistance)
        const angle = Math.random() * Math.PI * 2
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        const color = colors[randomInt(0, colors.length - 1)]

        node.style.position = 'absolute'
        node.style.left = `${clientX}px`
        node.style.top = `${clientY}px`
        node.style.width = `${size}px`
        node.style.height = `${size}px`
        node.style.marginLeft = `-${size / 2}px`
        node.style.marginTop = `-${size / 2}px`
        node.style.borderRadius = '50%'
        node.style.background = color
        node.style.pointerEvents = 'none'
        node.style.willChange = 'transform, opacity'
        node.setAttribute('data-gesture-burst', '1')

        layer.appendChild(node)
        pruneOverlay()

        const anim = node.animate(
          [
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) scale(0.65)`, opacity: 0 },
          ],
          { duration, easing: 'ease-out', fill: 'forwards' },
        )
        anim.onfinish = () => {
          node.remove()
        }
      }
    }

    function updateTrailStyles() {
      const trail = trailElsRef.current
      const cfg = gestureEffectsConfig.swipe
      const len = trail.length
      if (len === 0) return
      trail.forEach((node, i) => {
        const ageRatio = len <= 1 ? 1 : i / (len - 1)
        const size = cfg.minSize + ageRatio * (cfg.maxSize - cfg.minSize)
        const op = ageRatio * cfg.opacity
        node.style.width = `${size}px`
        node.style.height = `${size}px`
        node.style.marginLeft = `-${size / 2}px`
        node.style.marginTop = `-${size / 2}px`
        node.style.opacity = String(op)
      })
    }

    function clearTrailFade() {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
        fadeTimeoutRef.current = null
      }
    }

    function fadeTrailAndRemove() {
      clearTrailFade()
      const trail = trailElsRef.current
      const fadeMs = gestureEffectsConfig.swipe.fadeDuration
      trail.forEach((node) => {
        node.style.transition = `opacity ${fadeMs}ms ease-out`
        node.style.opacity = '0'
      })
      fadeTimeoutRef.current = setTimeout(() => {
        trail.forEach((node) => node.remove())
        trailElsRef.current = []
        fadeTimeoutRef.current = null
      }, fadeMs)
    }

    function pushTrailDot(clientX: number, clientY: number) {
      if (!geRef.current.trailEnabled) return
      clearTrailFade()

      const cfg = gestureEffectsConfig.swipe
      const ge = geRef.current
      const node = document.createElement('div')
      node.style.position = 'absolute'
      node.style.left = `${clientX}px`
      node.style.top = `${clientY}px`
      node.style.borderRadius = '50%'
      node.style.background = ge.trailColor
      node.style.pointerEvents = 'none'
      node.style.willChange = 'transform, opacity'
      node.setAttribute('data-gesture-trail', '1')

      const trail = trailElsRef.current
      trail.push(node)
      layer.appendChild(node)
      while (trail.length > cfg.trailLength) {
        const old = trail.shift()
        old?.remove()
      }
      updateTrailStyles()
      pruneOverlay()
    }

    function maybeSampleTrail(clientX: number, clientY: number) {
      if (!geRef.current.trailEnabled) return
      const now = performance.now()
      if (now - lastTrailSampleRef.current < 16) return
      lastTrailSampleRef.current = now

      const cfg = gestureEffectsConfig.swipe
      const lastPos = lastTrailPosRef.current
      const lastT = lastTrailTimeRef.current
      if (!lastPos) {
        lastTrailPosRef.current = { x: clientX, y: clientY }
        lastTrailTimeRef.current = now
        pushTrailDot(clientX, clientY)
        return
      }
      const dt = Math.max(1, now - lastT)
      const dist = Math.hypot(clientX - lastPos.x, clientY - lastPos.y)
      const speed = dist / dt
      const span = cfg.maxSpacing - cfg.minSpacing
      const spacing = Math.min(cfg.maxSpacing, cfg.minSpacing + Math.min(1, speed / 3) * span)

      if (dist >= spacing) {
        lastTrailPosRef.current = { x: clientX, y: clientY }
        lastTrailTimeRef.current = now
        pushTrailDot(clientX, clientY)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      mouseDownRef.current = true
      lastTrailPosRef.current = { x: e.clientX, y: e.clientY }
      lastTrailTimeRef.current = performance.now()
      spawnBurst(e.clientX, e.clientY)
      if (geRef.current.trailEnabled) {
        pushTrailDot(e.clientX, e.clientY)
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      touchActiveRef.current = true
      const t = e.touches[0]
      lastTrailPosRef.current = { x: t.clientX, y: t.clientY }
      lastTrailTimeRef.current = performance.now()
      spawnBurst(t.clientX, t.clientY)
      if (geRef.current.trailEnabled) {
        pushTrailDot(t.clientX, t.clientY)
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDownRef.current || (e.buttons & 1) === 0) return
      maybeSampleTrail(e.clientX, e.clientY)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!touchActiveRef.current || e.touches.length < 1) return
      const t = e.touches[0]
      maybeSampleTrail(t.clientX, t.clientY)
    }

    const endMouseTrail = () => {
      if (mouseDownRef.current) {
        mouseDownRef.current = false
        lastTrailPosRef.current = null
        fadeTrailAndRemove()
      }
    }

    const endTouchTrail = () => {
      if (touchActiveRef.current) {
        touchActiveRef.current = false
        lastTrailPosRef.current = null
        fadeTrailAndRemove()
      }
    }

    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mousemove', onMouseMove, true)
    window.addEventListener('mouseup', endMouseTrail, true)
    window.addEventListener('mouseleave', endMouseTrail, true)

    const touchListenOpts: AddEventListenerOptions = { capture: true, passive: true }

    window.addEventListener('touchstart', onTouchStart, touchListenOpts)
    window.addEventListener('touchmove', onTouchMove, touchListenOpts)
    window.addEventListener('touchend', endTouchTrail, touchListenOpts)
    window.addEventListener('touchcancel', endTouchTrail, touchListenOpts)

    return () => {
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mousemove', onMouseMove, true)
      window.removeEventListener('mouseup', endMouseTrail, true)
      window.removeEventListener('mouseleave', endMouseTrail, true)
      window.removeEventListener('touchstart', onTouchStart, touchListenOpts)
      window.removeEventListener('touchmove', onTouchMove, touchListenOpts)
      window.removeEventListener('touchend', endTouchTrail, touchListenOpts)
      window.removeEventListener('touchcancel', endTouchTrail, touchListenOpts)
      clearTrailFade()
      trailElsRef.current.forEach((node) => node.remove())
      trailElsRef.current = []
      while (layer.firstChild) layer.removeChild(layer.firstChild)
    }
  }, [])

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden"
      aria-hidden
      data-global-gesture-effects
    />
  )
}
