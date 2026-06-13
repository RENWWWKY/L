import { ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { clearAllMomentMemoryArchives } from '../../phone/apps/wechat/memory/momentMemoryArchiveSuppression'
import { clearAllUserMomentDistributionRecords } from './userMomentDistributionStorage'
import { clearUserMoments } from './momentsFeedStorage'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { MomentsImageGenSettingsPanel } from './MomentsImageGenSettingsPanel'
import { MomentsMinimalSwitch } from './MomentsMinimalSwitch'
import { MomentsProactivePublishPanel } from './MomentsProactivePublishPanel'
import { MomentsUserEngagementRulesPanel } from './MomentsUserEngagementRulesPanel'
import { MomentsUserMomentDataPanel } from './MomentsUserMomentDataPanel'
import { SettingsMechanismAccordion } from './SettingsMechanismAccordion'
import { isMomentsDedicatedImageGenEnabled } from './resolveMomentsImageGenSettings'
import { useResolvedMomentsImageGenSettings } from './useResolvedMomentsImageGenSettings'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'

type SettingsTab = 'protocol' | 'proactive' | 'user-data'

type Props = {
  onBack: () => void
  accountId?: string | null
  onMomentsCleared?: () => void
}

function SettingsBlock({
  titleEn,
  titleZh,
  checked,
  onToggle,
  accordion,
  children,
}: {
  titleEn: string
  titleZh: string
  checked: boolean
  onToggle: (v: boolean) => void
  accordion: { trigger: string; body: string }
  children?: React.ReactNode
}) {
  return (
    <section className="rounded-3xl bg-white px-5 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">{titleEn}</p>
          <h2 className="mt-1 text-[16px] font-semibold tracking-[0.01em] text-[#111827]">{titleZh}</h2>
        </div>
        <MomentsMinimalSwitch checked={checked} onChange={onToggle} label={titleZh} />
      </div>
      <SettingsMechanismAccordion triggerLabel={accordion.trigger} body={accordion.body} />
      {children}
    </section>
  )
}

export function MomentsSettingsPage({ onBack, accountId, onMomentsCleared }: Props) {
  const { settings, patchSettings } = useMomentsSettingsStore()
  const { dedicatedImageGen, globalImageGen, patchDedicatedImageGen } = useResolvedMomentsImageGenSettings()
  const [clearing, setClearing] = useState(false)
  const [clearMemoriesToo, setClearMemoriesToo] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('protocol')
  const useDedicated = isMomentsDedicatedImageGenEnabled(dedicatedImageGen)
  const globalConfigured = isMomentsImageGenConfigured(globalImageGen)

  const handleClearMoments = () => {
    if (!accountId?.trim() || clearing) return
    const memoryLine = clearMemoriesToo
      ? '\n\n同时会删除所有已产生的朋友圈记忆（含角色侧归档与个人朋友圈分发记录）。'
      : ''
    const ok = window.confirm(
      `确定清除本账号下全部朋友圈动态数据吗？\n\n将删除所有已保存的动态、点赞、评论与 AI 互动记录。封面与法则设置不会受影响，此操作不可撤销。${memoryLine}`,
    )
    if (!ok) return

    setClearing(true)
    void (async () => {
      try {
        await clearUserMoments(accountId)
        let memoryCount = 0
        if (clearMemoriesToo) {
          memoryCount = await clearAllMomentMemoryArchives()
          await clearAllUserMomentDistributionRecords(accountId)
        }
        onMomentsCleared?.()
        window.alert(
          clearMemoriesToo
            ? `朋友圈内容数据已清除，并删除了 ${memoryCount} 条朋友圈记忆。`
            : '朋友圈内容数据已清除。',
        )
      } catch {
        window.alert('清除失败，请稍后重试。')
      } finally {
        setClearing(false)
      }
    })()
  }

  return (
    <motion.div
      className="absolute inset-0 z-[430] flex flex-col bg-white"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
    >
      <header className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-[max(10px,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full text-[#9CA3AF]"
          aria-label="返回朋友圈"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">Moments Protocol</p>
          <h1 className="text-[17px] font-semibold text-[#111827]">朋友圈法则</h1>
        </div>
        <div className="size-9 shrink-0" aria-hidden />
      </header>

      <div className="shrink-0 border-b border-[#F3F4F6] px-4">
        <div className="mx-auto flex max-w-[560px] gap-1 py-2">
          {(
            [
              { id: 'protocol' as const, label: '互动法则' },
              { id: 'proactive' as const, label: '主动发布' },
              { id: 'user-data' as const, label: '个人朋友圈数据' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-full py-2 text-[13px] font-medium transition-colors outline-none ${
                  active
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-[560px] py-4">
          {activeTab === 'proactive' ? (
            <MomentsProactivePublishPanel accountId={accountId} />
          ) : activeTab === 'user-data' ? (
            <MomentsUserMomentDataPanel accountId={accountId} />
          ) : (
            <div className="space-y-8">
          <MomentsUserEngagementRulesPanel />

          <SettingsBlock
            titleEn="DELAYED INTERACTION"
            titleZh="异步延时互动"
            checked={settings.enableDelayedInteraction}
            onToggle={(v) => patchSettings({ enableDelayedInteraction: v })}
            accordion={{
              trigger: '点击阅读底层原理 (View Mechanism)',
              body:
                '开启后，通讯录中的角色将脱离瞬时响应。点赞与评论会依据角色性格错开解锁，单条最晚约 10 分钟内出现，相邻角色之间也会留出刷圈间隔，以此拟真现实中不经意间的社交触达。',
            }}
          />

          <SettingsBlock
            titleEn="DEDICATED IMAGE API"
            titleZh="专属生图 API"
            checked={useDedicated}
            onToggle={(v) => patchDedicatedImageGen({ useDedicatedImageGen: v })}
            accordion={{
              trigger: '点击阅读配置说明 (View Protocol)',
              body:
                useDedicated
                  ? '已启用朋友圈专属生图 API：引擎、Key、模型与生图风格仅在本页配置，与 API 设置中的默认生图互不影响。'
                  : '未启用专属 API 时，朋友圈配图将使用「API 设置 → 生图 API」里当前预设的默认配置（与聊天室角色发图共用）。',
            }}
          >
            {useDedicated ? (
              <AnimatePresence initial={false}>
                <motion.div
                  key="image-form"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  className="overflow-hidden"
                >
                  <MomentsImageGenSettingsPanel
                    imageGen={dedicatedImageGen}
                    onPatch={patchDedicatedImageGen}
                    settingsContext="moments"
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <p className="mt-4 text-[12px] leading-relaxed text-[#9CA3AF]">
                {globalConfigured
                  ? '当前将使用 API 设置中的默认生图 API。如需单独为朋友圈指定引擎与 Key，请打开上方开关。'
                  : '专属 API 未开启，且 API 设置中尚未配置可用的生图 API；角色动态将仅生成纯文字。'}
              </p>
            )}
          </SettingsBlock>

          <section className="rounded-3xl bg-white px-5 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">FEED DATA</p>
            <h2 className="mt-1 text-[16px] font-semibold tracking-[0.01em] text-[#111827]">清除朋友圈内容</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF]">
              删除本账号下所有已保存的动态、点赞、评论与 AI 互动记录。封面与法则设置不受影响。
            </p>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-[#F9FAFB] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#374151]">同时清除朋友圈记忆</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#9CA3AF]">
                  删除角色记忆库中由朋友圈产生的归档，以及个人朋友圈分发记录
                </p>
              </div>
              <MomentsMinimalSwitch
                checked={clearMemoriesToo}
                onChange={setClearMemoriesToo}
                label="同时清除朋友圈记忆"
              />
            </div>
            <button
              type="button"
              disabled={!accountId?.trim() || clearing}
              onClick={handleClearMoments}
              className="mt-5 w-full rounded-full border border-[#E5E7EB] py-3 text-[13px] font-medium text-[#6B7280] transition-opacity outline-none disabled:opacity-40"
            >
              {clearing ? '清除中…' : '清除全部动态数据'}
            </button>
          </section>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
