/** 《雨夜归零》· 入局 DM 语音（与 mockData 同级，用 Vite ?url 确保可访问） */
import dmVoice1Url from '../../../剧本杀/《雨夜归零》/dm语音开场白1.wav?url'
import dmVoice2Url from '../../../剧本杀/《雨夜归零》/dm语音开场白2.wav?url'
import storyBg1Url from '../../../剧本杀/《雨夜归零》/dm故事背景1.wav?url'
import storyBg2Url from '../../../剧本杀/《雨夜归零》/dm故事背景2.wav?url'

export const YUYE_DM_VOICE_INTRO_URLS = [dmVoice1Url, dmVoice2Url] as const
export const YUYE_STORY_BACKGROUND_URLS = [storyBg1Url, storyBg2Url] as const

export function getDmVoiceIntroUrls(scriptId: string): readonly string[] | null {
  if (scriptId === 'yuye-guiling') return YUYE_DM_VOICE_INTRO_URLS
  return null
}

export function getStoryBackgroundVoiceUrls(scriptId: string): readonly string[] | null {
  if (scriptId === 'yuye-guiling') return YUYE_STORY_BACKGROUND_URLS
  return null
}
