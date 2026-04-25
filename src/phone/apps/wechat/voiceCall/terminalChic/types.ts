export type VoiceLogMessage = {
  id: string
  role: 'user' | 'character'
  /** 终端式前缀，例如 YOU / Lumi */
  prefix: string
  text: string
  /** 用户语音原音频（对象 URL） */
  audioUrl?: string
  /** 音频 mime */
  audioMime?: string
  /** 仅供模型使用的转写文本（默认不在 UI 展示） */
  asrText?: string
  /** 语音识别提取的情绪标签（仅用户语音消息可选） */
  voiceEmotion?: string
  createdAt: number
}

