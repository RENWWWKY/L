/**
 * VN 氛围层：全屏雨天动效（仅当模型输出 `【VN雨】开`）；提示词见 `vnAtmospherePromptBlock.ts`。
 * 使用「竖向可无缝平铺」的 SVG 雨丝 + background-position 竖直滚动；
 * 纯 90° 横向重复渐变在 Y 向完全均匀，滚 background-position-y 会看起来静止。
 */

import { useMemo } from 'react'

/** y 坐标对 tileH 取模分布，保证竖向平铺周期与动画位移一致，循环无跳变 */
function rainTileDataUrl(tileW: number, tileH: number, lineCount: number, phase: number): string {
  const lines: string[] = []
  for (let i = 0; i < lineCount; i += 1) {
    const x = ((i * 47 + phase * 11) % tileW) + ((i % 4) * 0.15)
    const y = (i * 59 + phase * 17) % tileH
    const len = 10 + (i % 8) * 2.5
    const wind = (((i + phase) % 5) - 2) * 0.35
    const op = 0.18 + (i % 6) * 0.07
    const sw = 0.45 + (i % 5) * 0.28
    lines.push(
      `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + wind).toFixed(2)}" y2="${(y + len).toFixed(2)}" stroke="rgb(218,236,255)" stroke-opacity="${op.toFixed(2)}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`,
    )
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tileW} ${tileH}" width="${tileW}" height="${tileH}">${lines.join('')}</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

export function VnRainOverlay({ active }: { active: boolean }) {
  const urls = useMemo(
    () => ({
      near: rainTileDataUrl(140, 160, 95, 0),
      mid: rainTileDataUrl(180, 220, 110, 3),
      far: rainTileDataUrl(120, 140, 75, 7),
    }),
    [],
  )

  if (!active) return null

  return (
    <>
      <style>{`
        @keyframes vnRainScrollNear {
          0% { background-position: 0 0; }
          100% { background-position: 0 160px; }
        }
        @keyframes vnRainScrollMid {
          0% { background-position: 0 0; }
          100% { background-position: 0 220px; }
        }
        @keyframes vnRainScrollFar {
          0% { background-position: 0 0; }
          100% { background-position: 0 140px; }
        }
        @keyframes vnRainMist {
          0%, 100% { opacity: 0.09; }
          50% { opacity: 0.16; }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 z-[7] overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-gradient-to-b from-slate-900/8 via-transparent to-slate-900/18"
          style={{ animation: 'vnRainMist 5s ease-in-out infinite' }}
        />
        {/* 远处：细、快 */}
        <div
          className="absolute inset-0 opacity-[0.42]"
          style={{
            backgroundImage: urls.far,
            backgroundSize: '120px 140px',
            backgroundRepeat: 'repeat',
            animation: 'vnRainScrollFar 0.38s linear infinite',
            willChange: 'background-position',
          }}
        />
        {/* 中景 */}
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: urls.mid,
            backgroundSize: '180px 220px',
            backgroundRepeat: 'repeat',
            animation: 'vnRainScrollMid 0.52s linear infinite',
            willChange: 'background-position',
          }}
        />
        {/* 近处：略粗、稍慢，层次更明显 */}
        <div
          className="absolute inset-0 opacity-[0.38]"
          style={{
            backgroundImage: urls.near,
            backgroundSize: '140px 160px',
            backgroundRepeat: 'repeat',
            animation: 'vnRainScrollNear 0.65s linear infinite',
            willChange: 'background-position',
          }}
        />
      </div>
    </>
  )
}
