import { personaDb } from '../../wechat/newFriendsPersona/idb'
import { create } from 'zustand'
import {
  buildInitialAgencyState,
  DATE_STORY_PRESETS,
  randomScoutCandidate,
  STORY_CHAPTERS,
  TRAIN_CONFIGS,
} from './agentPresets'
import type {
  AgencyState,
  Artist,
  ChatMessage,
  ChoiceEffects,
  HotSearchItem,
  StatDeltaEvent,
  StoryScene,
  TrainType,
} from './agentTypes'
import {
  DATE_AFFECTION_THRESHOLD,
  GIG_STAMINA_COST,
  MAX_STAMINA,
  RECRUIT_COST,
} from './agentTypes'
import { fetchAIStoryContinuation, fetchAIHotSearch, fetchAIChatReply } from './agentAi'

const KV_KEY = 'idol-producer-agent-v1'
let persistTimer: ReturnType<typeof setTimeout> | null = null

type AgentStore = AgencyState & {
  hydrated: boolean
  floatingDeltas: StatDeltaEvent[]
  recruitCandidate: Artist | null

  hydrate: () => Promise<void>
  selectArtist: (id: string | null) => void
  pushFloatingDelta: (label: string, value: string, tone: StatDeltaEvent['tone'], x?: number, y?: number) => void
  removeFloatingDelta: (id: string) => void

  applyChoiceEffects: (effects: ChoiceEffects) => void
  advanceStoryLine: () => void
  pickStoryChoice: (choiceId: string) => void

  trainArtist: (artistId: string, type: TrainType) => boolean
  signRecruitCandidate: () => boolean
  refreshRecruitCandidate: () => void
  sendChatMessage: (artistId: string, text: string) => Promise<void>
  startDateStory: (artistId: string) => { title: string; lines: string[] } | null
  acceptGig: (artistId: string) => boolean

  withdrawHotSearch: (id: string) => boolean
  lawyerLetter: (id: string) => boolean
  buyHype: (id: string) => boolean
  tickHotSearches: () => void
  regenerateHotSearches: (hint?: string) => Promise<void>

  findArtistByCharacterId: (characterId: string) => Artist | undefined
  getSelectedArtist: () => Artist | undefined
  isDateUnlocked: (artistId: string) => boolean
}

function schedulePersist(state: AgencyState) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const { hydrated, floatingDeltas, recruitCandidate, ...persistable } = state as AgentStore
    void personaDb.setPhoneKv(KV_KEY, persistable)
  }, 280)
}

function findScene(chapterId: string, sceneId: string): StoryScene | null {
  const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId)
  if (!chapter) return null
  return chapter.scenes.find((s) => s.id === sceneId) ?? null
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  ...buildInitialAgencyState(),
  hydrated: false,
  floatingDeltas: [],
  recruitCandidate: null,

  async hydrate() {
    if (get().hydrated) return
    try {
      const raw = await personaDb.getPhoneKv(KV_KEY)
      if (raw && typeof raw === 'object') {
        set({ ...(raw as AgencyState), hydrated: true })
      } else {
        set({ hydrated: true })
      }
    } catch {
      set({ hydrated: true })
    }
    get().refreshRecruitCandidate()
  },

  selectArtist(id) {
    set({ selectedArtistId: id })
    schedulePersist(get())
  },

  pushFloatingDelta(label, value, tone, x = 50, y = 40) {
    const id = uid()
    set((s) => ({
      floatingDeltas: [...s.floatingDeltas, { id, label, value, tone, x, y }],
    }))
    window.setTimeout(() => get().removeFloatingDelta(id), 2200)
  },

  removeFloatingDelta(id) {
    set((s) => ({ floatingDeltas: s.floatingDeltas.filter((d) => d.id !== id) }))
  },

  applyChoiceEffects(effects) {
    const state = get()
    let budget = state.budget
    let reputation = state.reputation
    const artists = [...state.artists]

    if (effects.budget) {
      budget += effects.budget
      if (effects.budget < 0) {
        get().pushFloatingDelta('资金', `${effects.budget}`, 'loss')
      }
    }
    if (effects.reputation) {
      reputation = Math.max(0, Math.min(100, reputation + effects.reputation))
      get().pushFloatingDelta(
        '声望',
        effects.reputation > 0 ? `+${effects.reputation}` : `${effects.reputation}`,
        effects.reputation > 0 ? 'gain' : 'loss',
      )
    }
    if (effects.artistId && effects.affection) {
      const idx = artists.findIndex((a) => a.id === effects.artistId)
      if (idx >= 0) {
        const a = { ...artists[idx] }
        a.metrics = {
          ...a.metrics,
          affection: Math.min(100, a.metrics.affection + effects.affection),
        }
        artists[idx] = a
        get().pushFloatingDelta('好感', `+${effects.affection}`, 'gain')
        if (a.metrics.affection >= DATE_AFFECTION_THRESHOLD && !state.dateUnlockedArtistIds.includes(a.id)) {
          set({ dateUnlockedArtistIds: [...state.dateUnlockedArtistIds, a.id] })
        }
      }
    }

    set({ budget, reputation, artists })
    schedulePersist(get())

    if (effects.triggerHotSearch) {
      void get().regenerateHotSearches(effects.hotSearchHint)
    }
  },

  advanceStoryLine() {
    const { storyChapterId, storySceneId, storyLineIndex } = get()
    const scene = findScene(storyChapterId, storySceneId)
    if (!scene) return
    if (storyLineIndex < scene.lines.length - 1) {
      set({ storyLineIndex: storyLineIndex + 1 })
      schedulePersist(get())
      return
    }
    if (scene.choices?.length) return
    if (scene.nextSceneId) {
      set({ storySceneId: scene.nextSceneId, storyLineIndex: 0 })
      schedulePersist(get())
    }
  },

  pickStoryChoice(choiceId) {
    const { storyChapterId, storySceneId } = get()
    const scene = findScene(storyChapterId, storySceneId)
    if (!scene?.choices) return
    const choice = scene.choices.find((c) => c.id === choiceId)
    if (!choice) return
    get().applyChoiceEffects(choice.effects)

    const chapter = STORY_CHAPTERS.find((c) => c.id === storyChapterId)
    const sceneIdx = chapter?.scenes.findIndex((s) => s.id === storySceneId) ?? -1
    const nextScene = chapter?.scenes[sceneIdx + 1]
    if (nextScene) {
      set({ storySceneId: nextScene.id, storyLineIndex: 0 })
    } else {
      set({ storyLineIndex: scene.lines.length })
    }
    schedulePersist(get())

    void fetchAIStoryContinuation({
      chapterId: storyChapterId,
      sceneId: storySceneId,
      choiceLabel: choice.label,
    }).then((continuation) => {
      if (continuation?.lines?.length) {
        // 预留：将 LLM 续写注入剧情队列
        console.debug('[IdolProducer] story continuation', continuation)
      }
    })
  },

  trainArtist(artistId, type) {
    const cfg = TRAIN_CONFIGS.find((t) => t.type === type)
    if (!cfg) return false
    const state = get()
    if (state.budget < cfg.cost) return false

    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      return {
        ...a,
        stats: { ...a.stats, [cfg.statKey]: Math.min(99, a.stats[cfg.statKey] + cfg.delta) },
      }
    })

    set({ artists, budget: state.budget - cfg.cost })
    get().pushFloatingDelta(cfg.label, `+${cfg.delta}`, 'gain', 55, 35)
    get().pushFloatingDelta('资金', `-${cfg.cost}`, 'loss', 45, 45)
    schedulePersist(get())
    return true
  },

  refreshRecruitCandidate() {
    set({ recruitCandidate: randomScoutCandidate() })
  },

  signRecruitCandidate() {
    const state = get()
    const candidate = state.recruitCandidate
    if (!candidate) return false
    if (state.budget < RECRUIT_COST) return false
    if (state.artists.some((a) => a.name === candidate.name)) return false

    set({
      artists: [...state.artists, candidate],
      budget: state.budget - RECRUIT_COST,
      recruitCandidate: randomScoutCandidate(),
      selectedArtistId: candidate.id,
    })
    get().pushFloatingDelta('签约', candidate.name, 'gain')
    get().pushFloatingDelta('资金', `-${RECRUIT_COST}`, 'loss')
    schedulePersist(get())
    return true
  },

  async sendChatMessage(artistId, text) {
    const trimmed = text.trim()
    if (!trimmed) return
    const state = get()
    const artist = state.artists.find((a) => a.id === artistId)
    if (!artist) return

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed, ts: Date.now() }
    const thread = [...(state.chatThreads[artistId] ?? []), userMsg]
    set({ chatThreads: { ...state.chatThreads, [artistId]: thread } })
    schedulePersist(get())

    const reply = await fetchAIChatReply({
      artist,
      transcript: thread,
    })

    const artistMsg: ChatMessage = { id: uid(), role: 'artist', content: reply.text, ts: Date.now() }
    const affectionDelta = reply.affectionDelta ?? (reply.text.length > 20 ? 2 : 1)

    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      const affection = Math.min(100, a.metrics.affection + affectionDelta)
      return { ...a, metrics: { ...a.metrics, affection } }
    })

    const updatedThread = [...thread, artistMsg]
    const dateIds = [...state.dateUnlockedArtistIds]
    const newAffection = artists.find((a) => a.id === artistId)?.metrics.affection ?? 0
    if (newAffection >= DATE_AFFECTION_THRESHOLD && !dateIds.includes(artistId)) {
      dateIds.push(artistId)
    }

    set({
      artists,
      chatThreads: { ...state.chatThreads, [artistId]: updatedThread },
      dateUnlockedArtistIds: dateIds,
    })
    if (affectionDelta > 0) get().pushFloatingDelta('好感', `+${affectionDelta}`, 'gain')
    schedulePersist(get())
  },

  startDateStory(artistId) {
    if (!get().isDateUnlocked(artistId)) return null
    const preset = DATE_STORY_PRESETS[artistId]
    if (!preset) return { title: '专属约会', lines: ['月色温柔，他/她忽然握住了你的手。', '这一刻，经纪人的身份似乎变得模糊。'] }
    const artist = get().artists.find((a) => a.id === artistId)
    if (artist) {
      const artists = get().artists.map((a) =>
        a.id === artistId ? { ...a, metrics: { ...a.metrics, affection: Math.min(100, a.metrics.affection + 5) } } : a,
      )
      set({ artists })
      get().pushFloatingDelta('好感', '+5', 'gain')
      schedulePersist(get())
    }
    return preset
  },

  acceptGig(artistId) {
    const state = get()
    if (state.stamina < GIG_STAMINA_COST) return false
    const fanGain = 800 + Math.floor(Math.random() * 1200)
    const pay = 3000 + Math.floor(Math.random() * 4000)

    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      return {
        ...a,
        metrics: {
          ...a.metrics,
          fans: a.metrics.fans + fanGain,
          commercialValue: Math.min(99, a.metrics.commercialValue + 3),
        },
      }
    })

    set({
      artists,
      budget: state.budget + pay,
      stamina: state.stamina - GIG_STAMINA_COST,
    })
    get().pushFloatingDelta('粉丝', `+${fanGain}`, 'gain')
    get().pushFloatingDelta('资金', `+${pay}`, 'gain')
    schedulePersist(get())
    return true
  },

  withdrawHotSearch(id) {
    const cost = 12000
    const state = get()
    if (state.budget < cost) return false
    const hotSearches = state.hotSearches.filter((h) => h.id !== id)
    set({ hotSearches, budget: state.budget - cost })
    get().pushFloatingDelta('撤热搜', `-${cost}`, 'loss')
    schedulePersist(get())
    return true
  },

  lawyerLetter(id) {
    const state = get()
    const item = state.hotSearches.find((h) => h.id === id)
    if (!item || item.type !== 'negative') return false
    const repCost = 6
    if (state.reputation < repCost) return false
    const hotSearches = state.hotSearches.filter((h) => h.id !== id)
    set({ hotSearches, reputation: state.reputation - repCost })
    get().pushFloatingDelta('声望', `-${repCost}`, 'loss')
    schedulePersist(get())
    return true
  },

  buyHype(id) {
    const cost = 6000
    const state = get()
    if (state.budget < cost) return false
    const item = state.hotSearches.find((h) => h.id === id)
    if (!item || item.type !== 'positive') return false

    const artists = state.artists.map((a) => {
      if (item.artistId && a.id !== item.artistId) return a
      if (!item.artistId) return a
      const fanBoost = 2000 + Math.floor(Math.random() * 3000)
      return { ...a, metrics: { ...a.metrics, fans: a.metrics.fans + fanBoost } }
    })

    set({ artists, budget: state.budget - cost })
    get().pushFloatingDelta('水军加热', '粉丝暴涨', 'gain')
    get().pushFloatingDelta('资金', `-${cost}`, 'loss')
    schedulePersist(get())
    return true
  },

  tickHotSearches() {
    const now = Date.now()
    const state = get()
    const elapsed = (now - state.lastHotSearchTick) / 1000
    if (elapsed < 1) return

    let artists = state.artists
    for (const hs of state.hotSearches) {
      if (hs.type === 'negative' && hs.artistId && hs.fanDrainPerSec) {
        const drain = Math.floor(hs.fanDrainPerSec * elapsed)
        if (drain > 0) {
          artists = artists.map((a) => {
            if (a.id !== hs.artistId) return a
            return { ...a, metrics: { ...a.metrics, fans: Math.max(0, a.metrics.fans - drain) } }
          })
        }
      }
    }

    set({ artists, lastHotSearchTick: now, stamina: Math.min(MAX_STAMINA, state.stamina + (elapsed >= 3600 ? 1 : 0)) })
    if (artists !== state.artists) schedulePersist(get())
  },

  async regenerateHotSearches(hint?: string) {
    const state = get()
    const aiItems = await fetchAIHotSearch({
      artists: state.artists,
      hint: hint,
    })

    const newItems: HotSearchItem[] = aiItems.map((item, i) => ({
      id: uid(),
      rank: i + 1,
      keyword: item.keyword,
      heat: item.heat,
      type: item.type,
      artistId: item.artistId,
      fanDrainPerSec: item.type === 'negative' ? 3 + Math.floor(Math.random() * 5) : undefined,
      createdAt: Date.now(),
    }))

    if (newItems.length) {
      set({ hotSearches: newItems.slice(0, 8) })
      schedulePersist(get())
    }
  },

  findArtistByCharacterId(characterId) {
    return get().artists.find((a) => a.characterId === characterId)
  },

  getSelectedArtist() {
    const id = get().selectedArtistId
    return id ? get().artists.find((a) => a.id === id) : undefined
  },

  isDateUnlocked(artistId) {
    const state = get()
    return state.dateUnlockedArtistIds.includes(artistId) || (state.artists.find((a) => a.id === artistId)?.metrics.affection ?? 0) >= DATE_AFFECTION_THRESHOLD
  },
}))

export function buildAgencyContextBlock(artist: Artist): string {
  const lines = [
    '【金牌经纪人模拟器 · 艺人上下文】',
    `艺人：${artist.name}（${artist.tags.join('、')}）`,
    `好感度：${artist.metrics.affection}/100`,
    `粉丝：${artist.metrics.fans}`,
    artist.personaSummary ? `人设：${artist.personaSummary}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}
