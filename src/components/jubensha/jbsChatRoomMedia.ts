/** 《雨夜归零》· 聊天室氛围背景（Vite ?url） */
import yuyeChatRoomBgVideo from '../../../剧本杀/《雨夜归零》/聊天室背景视频.mp4?url'

export function getChatRoomVideoUrl(scriptId: string): string | undefined {
  if (scriptId === 'yuye-guiling') return yuyeChatRoomBgVideo
  return undefined
}
