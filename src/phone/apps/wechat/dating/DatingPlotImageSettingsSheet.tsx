import { ImageIcon, Settings2, User, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppearanceRefSettingsPanel } from '../appearanceRef/AppearanceRefSettingsPanel'
import { SharedImageGenStyleSection } from '../appearanceRef/SharedImageGenStyleSection'
import { useAppearanceReferenceStatus } from '../appearanceRef/useAppearanceReferenceStatus'
import { DatingCapsuleSwitch } from './DatingCapsuleSwitch'
import {
  DATING_PLOT_IMAGE_COUNT_MAX,
  DATING_PLOT_IMAGE_COUNT_MIN,
  formatDatingPlotImageCountLabel,
  parseDatingPlotImageCountRange,
} from './datingPlotImageCount'

type RefTab = 'character' | 'user'

type Props = {
  open: boolean
  onClose: () => void
  characterId: string
  playerIdentityId?: string
  plotImageGenEnabled: boolean
  plotImageCountMin?: number
  plotImageCountMax?: number
  onPatch: (patch: {
    plotImageGenEnabled?: boolean
    plotImageCountMin?: number
    plotImageCountMax?: number
  }) => void
}

function RefTabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof UserRound
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-white text-[#262626] shadow-sm' : 'text-[#8e8e8e]'
      }`}
    >
      <Icon className="size-4" strokeWidth={1.65} />
      {label}
    </button>
  )
}

export function DatingPlotImageSettingsSheet({
  open,
  onClose,
  characterId,
  playerIdentityId,
  plotImageGenEnabled,
  plotImageCountMin,
  plotImageCountMax,
  onPatch,
}: Props) {
  const [refTab, setRefTab] = useState<RefTab>('character')
  const range = useMemo(
    () => parseDatingPlotImageCountRange(plotImageCountMin, plotImageCountMax),
    [plotImageCountMin, plotImageCountMax],
  )
  const { hasReference: hasAppearanceReference } = useAppearanceReferenceStatus({
    context: 'dating',
    characterId,
    playerIdentityId,
  })

  if (!open) return null

  const showUserTab = !!playerIdentityId?.trim()

  return (
    <div className="fixed inset-0 z-[360] flex flex-col justify-end bg-black/30 backdrop-blur-[1px]">
      <button type="button" className="min-h-0 flex-1" aria-label="关闭" onClick={onClose} />
      <div className="max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-stone-200/80 bg-[#fafafa] px-4 pb-8 pt-4 shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-5 text-stone-500" strokeWidth={1.65} />
            <p className="text-[17px] font-medium text-[#262626]">剧情配图</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white px-3.5 py-3">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[14px] text-[#262626]">剧情生成后穿插配图</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#8e8e8e]">
              电影级第三人称镜头插画；配图与正文一并展示，非角色手机 POV 随手拍
            </p>
          </div>
          <DatingCapsuleSwitch
            checked={plotImageGenEnabled}
            onToggle={() => onPatch({ plotImageGenEnabled: !plotImageGenEnabled })}
          />
        </div>

        {plotImageGenEnabled ? (
          <div className="mt-3 rounded-2xl border border-stone-200/90 bg-white px-3.5 py-3">
            <p className="text-[14px] text-[#262626]">每轮配图张数</p>
            <p className="mt-0.5 text-[12px] text-[#8e8e8e]">当前：{formatDatingPlotImageCountLabel(range)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[12px] text-[#8e8e8e]">最少</span>
                <input
                  type="number"
                  min={DATING_PLOT_IMAGE_COUNT_MIN}
                  max={DATING_PLOT_IMAGE_COUNT_MAX}
                  value={range.min}
                  onChange={(e) => {
                    const min = Number(e.target.value)
                    onPatch({
                      plotImageCountMin: min,
                      plotImageCountMax: range.max,
                    })
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-200/90 bg-[#fafafa] px-3 py-2 text-[14px] text-[#262626] outline-none transition-colors focus:border-stone-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-[12px] text-[#8e8e8e]">最多</span>
                <input
                  type="number"
                  min={DATING_PLOT_IMAGE_COUNT_MIN}
                  max={DATING_PLOT_IMAGE_COUNT_MAX}
                  value={range.max}
                  onChange={(e) => {
                    const max = Number(e.target.value)
                    onPatch({
                      plotImageCountMin: range.min,
                      plotImageCountMax: max,
                    })
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-200/90 bg-[#fafafa] px-3 py-2 text-[14px] text-[#262626] outline-none transition-colors focus:border-stone-400 focus:bg-white"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] text-[#8e8e8e]">
            <Settings2 className="size-3.5 text-stone-400" />
            形象参考
          </div>

          <div className="rounded-2xl border border-stone-200/90 bg-white p-3.5">
            {showUserTab ? (
              <div className="mb-3 flex gap-1 rounded-xl bg-stone-100/90 p-1">
                <RefTabButton
                  active={refTab === 'character'}
                  onClick={() => setRefTab('character')}
                  icon={UserRound}
                  label="角色"
                />
                <RefTabButton
                  active={refTab === 'user'}
                  onClick={() => setRefTab('user')}
                  icon={User}
                  label="我"
                />
              </div>
            ) : null}

            <p className="mb-3 text-[11px] leading-relaxed text-[#8e8e8e]">
              {refTab === 'character'
                ? '锁定角色在剧情插画中的外貌；可独立于聊天页配置。'
                : '锁定你在剧情插画中的外貌；默认与身份页同步。同框时会分别用 reference character / reference player 区分男女与站位。'}
            </p>

            {refTab === 'character' || !showUserTab ? (
              <AppearanceRefSettingsPanel
                subject="character"
                context="dating"
                characterId={characterId}
                playerIdentityId={playerIdentityId}
                variant="dating"
                hideHeader
              />
            ) : (
              <AppearanceRefSettingsPanel
                subject="user"
                context="dating"
                characterId={characterId}
                playerIdentityId={playerIdentityId}
                variant="dating"
                hideHeader
              />
            )}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-stone-200/90 bg-white px-3.5 py-3.5">
          <SharedImageGenStyleSection
            className="mt-0 border-0 pt-0"
            variant="dating"
            hasAppearanceReference={hasAppearanceReference}
          />
        </div>
      </div>
    </div>
  )
}
