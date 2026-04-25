export type PaperStyle = 'solid' | 'lined' | 'grid'

export type MemoTextModifier =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'highlight-yellow'
  | 'highlight-blue'
  | 'highlight-pink'

export type MemoBlock =
  | { type: 'h1'; content: string }
  | { type: 'h2'; content: string }
  | { type: 'text'; content: string; modifiers?: MemoTextModifier[]; color?: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'voice'; duration: string; transcript: string }
  | { type: 'file'; fileType: 'pdf' | 'doc' | 'docx' | 'txt' | 'other'; fileName: string; size: string }

export interface PrivateMemo {
  id: string
  title: string
  date: string
  paperStyle: PaperStyle
  paperColor: string
  blocks: MemoBlock[]
}

