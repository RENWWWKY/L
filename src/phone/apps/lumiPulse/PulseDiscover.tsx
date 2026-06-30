import { motion } from 'framer-motion'
import { Search, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { TrendingItem } from './components/TrendingItem'
import { PULSE_COLORS, PULSE_STAGGER } from './constants'
import { aiGeneratePulseTrending } from './lumiPulseAi'
import type { PulseTrendingTopic } from './pulseTypes'
import { usePulseDiscoverPosts, usePulseTrendingTopics } from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

export function PulseDiscover({
  povName,
  currentPovId,
  onOpenTopic,
}: {
  povName: string
  currentPovId: string
  onOpenTopic?: (topic: PulseTrendingTopic) => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const trending = usePulseTrendingTopics()
  const allPosts = usePulseDiscoverPosts()
  const setTrending = usePulseStore((s) => s.setTrending)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allPosts.filter(
      (p) => p.authorName.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
    )
  }, [allPosts, query])

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await aiGeneratePulseTrending({ apiConfig, povName, count: 10 })
      const now = Date.now()
      const topics: PulseTrendingTopic[] = rows.map((r, i) => ({
        id: `pt-${now}-${i}`,
        rank: i + 1,
        title: r.title,
        tag: r.tag,
        excerpt: r.excerpt,
        createdAt: now,
        generatedForPovId: currentPovId,
      }))
      setTrending(topics, currentPovId)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }, [apiConfig, currentPovId, povName, setTrending])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFC]">
      <div className="shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2 rounded-full bg-gray-100/50 px-3.5 py-2.5">
          <Search className="size-4 text-neutral-400" strokeWidth={1.4} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索角色动态或关键词..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1C1C1E] outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
        {query.trim() ? (
          <div className="space-y-2">
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-neutral-400">搜索结果</p>
            {filteredPosts.length ? (
              filteredPosts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl bg-white px-4 py-3 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
                >
                  <p className="text-[13px] font-medium text-[#1C1C1E]">{p.authorName}</p>
                  <p className="mt-1 line-clamp-2 font-serif text-[13px] leading-relaxed text-neutral-600">
                    {p.content}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-[13px] text-neutral-400">未找到相关动态</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-[#1C1C1E]">热搜榜</h2>
                <p className="mt-0.5 text-[11px] tracking-[0.12em] text-neutral-400">实时舆论脉搏</p>
              </div>
              <Pressable
                type="button"
                onClick={() => void generate()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] tracking-wide text-neutral-600 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
                style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
              >
                <Sparkles className="size-3.5" strokeWidth={1.4} style={{ color: PULSE_COLORS.lightGold }} />
                {loading ? '演化中…' : '演化新的热搜'}
              </Pressable>
            </div>

            {trending.length ? (
              <motion.div
                className="space-y-2.5"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: PULSE_STAGGER } }}
              >
                {trending.map((topic, i) => (
                  <TrendingItem
                    key={topic.id}
                    topic={topic}
                    index={i}
                    onPress={onOpenTopic ? () => onOpenTopic(topic) : undefined}
                  />
                ))}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="font-serif text-[14px] text-neutral-500">舆论场尚未启动</p>
                <p className="mt-2 text-[12px] text-neutral-400">点击上方按钮，让 AI 演化热搜词条</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
