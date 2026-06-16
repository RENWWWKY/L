import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { IdolProducerApp } from './idolProducer/IdolProducerApp'

type HubView = 'hub' | 'idol-producer'

/**
 * 幻境引擎 — 内置高阶玩法应用入口
 */
export function SandboxHub({ onBack }: { onBack: () => void }) {
  const { themeStyle } = useCustomization()
  const [view, setView] = useState<HubView>('hub')

  if (view === 'idol-producer') {
    return <IdolProducerApp onBack={() => setView('hub')} />
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#fafafa]"
      data-phone-page="app"
      data-app-id="sandbox"
      style={{ ...themeStyle, fontFamily: 'var(--phone-font)' }}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b border-black/5 px-3 pb-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full" aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="text-[17px] font-semibold text-stone-800">幻境引擎</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[13px] text-stone-500 mb-4">官方内置高阶玩法，在幻境中体验完整模拟器。</p>

        <Pressable onClick={() => setView('idol-producer')}>
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="overflow-hidden rounded-[22px] bg-gradient-to-br from-rose-50 via-white to-rose-100 p-5 shadow-lg shadow-rose-200/30 ring-1 ring-rose-200/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400 text-white shadow-md shadow-rose-300/40">
                <Sparkles size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold text-stone-800">金牌经纪人模拟器</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
                  AVG 剧情 · 艺人养成 · 公关热搜。扮演顶尖经纪人，在柔和粉色的演艺圈里书写你的篇章。
                </p>
                <span className="mt-3 inline-block rounded-full bg-rose-400/90 px-3 py-1 text-[12px] font-medium text-white">
                  进入游戏
                </span>
              </div>
            </div>
          </motion.div>
        </Pressable>
      </div>
    </div>
  )
}
