import type { AppSlot, DockFillMode, DockStyle, PhoneTheme } from '../types'
import { AppIconTile } from './AppIconTile'
import { DockCapsule } from './DockCapsule'
import { Pressable } from './Pressable'
import { SettingToggle } from './SettingToggle'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.16em] opacity-75">
      {children}
    </label>
  )
}

type Props = {
  theme: PhoneTheme
  apps: AppSlot[]
  dockStyle: DockStyle
  setDockStyle: (patch: Partial<DockStyle>) => void
  onPickDockImage: () => void
}

export function DockStyleSection({ theme, apps, dockStyle, setDockStyle, onPickDockImage }: Props) {
  return (
    <div
      className="rounded-[14px] border p-3"
      style={{ borderColor: theme.border, background: theme.surface }}
    >
      <p className="text-[12px] font-medium" style={{ color: theme.text }}>
        Dock 胶囊样式
      </p>
      <p className="mt-1 text-[11px] opacity-70">
        下方为 Dock 胶囊预览（不含桌面壁纸）；实际桌面上毛玻璃会透出后方壁纸。
      </p>

      <div className="mt-3 flex justify-center py-1">
        <DockCapsule theme={theme} dockStyle={dockStyle} scale={1.1}>
          <nav className="grid grid-cols-4 items-stretch gap-1.5">
            {apps.slice(0, 4).map((a) => (
              <div key={a.id} className="flex min-w-0 flex-col items-center gap-0.5">
                <AppIconTile appId={a.id} bgSize={30} glyphSize={18} />
                <span
                  className="w-full truncate text-center text-[8px] leading-none"
                  style={{ color: theme.appLabelColor }}
                >
                  {a.label}
                </span>
              </div>
            ))}
          </nav>
        </DockCapsule>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <FieldLabel>胶囊底色模式</FieldLabel>
          <select
            className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
            style={{
              borderColor: theme.border,
              background: theme.surfaceMuted,
              color: theme.text,
            }}
            value={dockStyle.fillMode}
            onChange={(e) => setDockStyle({ fillMode: e.target.value as DockFillMode })}
          >
            <option value="theme">跟随主题（卡片底色）</option>
            <option value="solid">纯色</option>
            <option value="gradient">渐变色</option>
            <option value="image">背景图</option>
          </select>
        </div>

        {dockStyle.fillMode === 'solid' ? (
          <div>
            <FieldLabel>胶囊纯色</FieldLabel>
            <input
              type="color"
              value={dockStyle.dockSolidColor}
              onChange={(e) => setDockStyle({ dockSolidColor: e.target.value })}
              className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
            />
          </div>
        ) : null}

        {dockStyle.fillMode === 'gradient' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>渐变起点色</FieldLabel>
              <input
                type="color"
                value={dockStyle.gradientFrom}
                onChange={(e) => setDockStyle({ gradientFrom: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
              />
            </div>
            <div>
              <FieldLabel>渐变终点色</FieldLabel>
              <input
                type="color"
                value={dockStyle.gradientTo}
                onChange={(e) => setDockStyle({ gradientTo: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
              />
            </div>
            <div>
              <FieldLabel>起点色位置（{dockStyle.gradientFromStop}%）</FieldLabel>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="w-full"
                value={dockStyle.gradientFromStop}
                onChange={(e) => setDockStyle({ gradientFromStop: Number(e.target.value) })}
              />
            </div>
            <div>
              <FieldLabel>终点色位置（{dockStyle.gradientToStop}%）</FieldLabel>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="w-full"
                value={dockStyle.gradientToStop}
                onChange={(e) => setDockStyle({ gradientToStop: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>过渡自然度（{dockStyle.gradientNaturalness}，50 均衡）</FieldLabel>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="w-full"
                value={dockStyle.gradientNaturalness}
                onChange={(e) =>
                  setDockStyle({ gradientNaturalness: Number(e.target.value) })
                }
              />
              <p className="mt-1 text-[10px] leading-snug opacity-60">
                50 为均衡。调低时终点色铺开更多，调高时起点色铺开更多（常用 0→100% 色标时）。
              </p>
            </div>
            <div className="col-span-2">
              <FieldLabel>渐变角度（{dockStyle.gradientAngle}°）</FieldLabel>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                className="w-full"
                value={dockStyle.gradientAngle}
                onChange={(e) => setDockStyle({ gradientAngle: Number(e.target.value) })}
              />
            </div>
          </div>
        ) : null}

        {dockStyle.fillMode === 'image' ? (
          <div>
            <FieldLabel>胶囊背景图 URL</FieldLabel>
            <input
              className="w-full rounded-[12px] border px-3 py-2 text-base outline-none"
              style={{
                borderColor: theme.border,
                background: theme.surfaceMuted,
                color: theme.text,
              }}
              placeholder="https://... / data:image..."
              value={dockStyle.bgImageUrl}
              onChange={(e) =>
                setDockStyle({ fillMode: 'image', bgImageUrl: e.target.value })
              }
            />
            <div className="mt-2 flex gap-2">
              <Pressable
                onClick={onPickDockImage}
                className="flex-1 rounded-[12px] border px-3 py-2 text-[12px]"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
              >
                本地上传并裁剪
              </Pressable>
              <Pressable
                onClick={() => setDockStyle({ bgImageUrl: '' })}
                className="rounded-[12px] border px-3 py-2 text-[12px]"
                style={{
                  borderColor: theme.border,
                  background: theme.surfaceMuted,
                  color: theme.textMuted,
                }}
              >
                清除图片
              </Pressable>
            </div>
          </div>
        ) : null}

        <SettingToggle
          label="毛玻璃效果"
          description="在底色之上叠加半透明模糊层，透出后方桌面壁纸"
          checked={dockStyle.glass}
          onChange={(v) => setDockStyle({ glass: v })}
        />
        <div>
          <FieldLabel>毛玻璃模糊强度</FieldLabel>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            className="w-full"
            value={dockStyle.blur}
            onChange={(e) => setDockStyle({ blur: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}

