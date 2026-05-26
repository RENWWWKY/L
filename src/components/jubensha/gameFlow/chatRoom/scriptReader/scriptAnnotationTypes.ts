export type ScriptStickyNote = {
  id: string
  pageId: string
  /** 相对页内区域的百分比位置 */
  x: number
  y: number
  width: number
  height: number
  /** 局内手写便签正文（可粘贴、可编辑） */
  text: string
  /** true = 实底编辑态；false = 半透明预览态 */
  opaque: boolean
}

export type ScriptTextMark = {
  id: string
  pageId: string
  kind: 'underline' | 'circle'
  start: number
  end: number
}

export type ScriptAnnotationStore = {
  notes: ScriptStickyNote[]
  marks: ScriptTextMark[]
  /** 开启后：未编辑的便签也以实色常驻显示；默认关闭为半透明预览 */
  persistStickyNotes: boolean
}

export type ScriptAnnotationTool = 'select' | 'underline' | 'circle'
