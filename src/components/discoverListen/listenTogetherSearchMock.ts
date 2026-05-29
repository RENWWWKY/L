export type SearchSuggestionType = 'character_vibe' | 'normal'

export type SearchSuggestion = {
  text: string
  isHot: boolean
  type: SearchSuggestionType
}

export type VibeCategory = {
  id: string
  title: string
  subtitle: string
  cover: string
  gradient: string
}

export const SEARCH_EXPLORE_MOCK = {
  searchSuggestions: [
    { text: '深夜循环歌单', isHot: true, type: 'character_vibe' as const },
    { text: '落日飞车', isHot: false, type: 'normal' as const },
    { text: '微醺暗恋期', isHot: true, type: 'normal' as const },
  ],
  categories: [
    {
      id: 'c1',
      title: '微醺 R&B',
      subtitle: 'Chilled & Romantic',
      cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=80',
      gradient: 'from-rose-900/40 to-stone-900/60',
    },
    {
      id: 'c2',
      title: '深夜 独处',
      subtitle: 'Midnight Emo',
      cover: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400&q=80',
      gradient: 'from-slate-900/40 to-stone-900/80',
    },
    {
      id: 'c3',
      title: '落日 公路',
      subtitle: 'Sunset Drive',
      cover: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80',
      gradient: 'from-amber-900/40 to-stone-900/60',
    },
    {
      id: 'c4',
      title: '古典 沉思',
      subtitle: 'Classical Mind',
      cover: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=400&q=80',
      gradient: 'from-stone-800/40 to-stone-900/60',
    },
  ],
} satisfies {
  searchSuggestions: SearchSuggestion[]
  categories: VibeCategory[]
}
