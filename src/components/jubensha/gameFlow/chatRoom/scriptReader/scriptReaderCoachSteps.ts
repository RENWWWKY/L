import type { ScriptReaderCoachStep } from './scriptReaderCoachTypes'

export const SCRIPT_READER_COACH_STEPS: ScriptReaderCoachStep[] = [
  {
    target: 'read-page',
    title: '正文标注与高亮',
    body: '阅读时可在正文上选取文字，添加下划线或画圈标记，并用便签记录线索。接下来会依次高亮正文与工具栏。',
  },
  {
    target: 'body',
    title: '选取正文',
    body: '在正文区域拖选一段文字。选区会保留，便于接着点下方工具栏添加标记。',
  },
  {
    target: 'toolbar-select',
    title: '选取模式',
    body: '「选取」为默认模式：先选文字，再点下划线或画圈。若已选中，也可直接点对应工具。',
  },
  {
    target: 'toolbar-underline',
    title: '下划线高亮',
    body: '为选中文字添加下划线，适合标出时间线、人名或关键信息，翻页后仍保留在本页。',
  },
  {
    target: 'toolbar-circle',
    title: '画圈强调',
    body: '为选中区域画椭圆圈，适合突出疑点或需要反复查看的段落。',
  },
  {
    target: 'toolbar-sticky',
    title: '手写便签',
    body: '点「便签」新建；在便签内长按可粘贴已复制内容，或直接手写。按住顶部 MEMO 条拖动可移动。未编辑时半透明，「常驻」可改为实色显示。',
  },
  {
    target: 'toolbar-undo',
    title: '撤回与重做',
    body: '误操作时点工具栏「撤回」或「重做」即可，逐步撤销标记与便签操作。',
  },
  {
    target: 'header-tutorial',
    title: '随时回看',
    body: '标题栏「教程」可随时打开文字说明，或再跑一遍界面高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '需要温习时点「教程」。现在可以开始标注正文，或继续翻阅剧本。',
  },
]
