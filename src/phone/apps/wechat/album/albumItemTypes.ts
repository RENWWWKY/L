export type AlbumDisplayItem = {
  id: string
  messageId: string
  imageUrl: string
  sourceName: string
  senderKind: 'character' | 'player'
  timestamp: number
  savedAt: number
  isSticker: boolean
}
