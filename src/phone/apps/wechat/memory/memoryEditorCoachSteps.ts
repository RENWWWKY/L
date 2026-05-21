import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryEditorCoachTargetId =
  | 'attribution'
  | 'tabs'
  | 'tab-identity'
  | 'tab-user'
  | 'tab-content'
  | 'save'
  | 'editor-tutorial'

export const MEMORY_EDITOR_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '刻录 / 修订记忆',
    body: '编辑面板分三块：绑定身份、user 表达式槽位、正文与预览。高亮将依次说明；可随时跳过。',
  },
  {
    target: 'attribution',
    title: '记忆归属角色',
    body: '本条记忆挂在哪位联系人名下，仅在与 TA 私聊时注入。编辑已有记忆时归属不可改挂到他人。',
  },
  {
    target: 'tabs',
    title: '三个编辑分区',
    body: '用顶部 Tab 切换：先定默认马甲，再逐条改 {{user}} 绑定，最后在正文里写线索并看替换预览。',
  },
  {
    target: 'tab-identity',
    title: '绑定身份',
    body: '若该角色关联多个微信马甲，在此选择默认身份。新插入的 {{user}} 与未绑定槽位保存时按此补全。',
  },
  {
    target: 'tab-user',
    title: 'user 表达式绑定',
    body: '正文每出现一处 {{user}}，可在此指定对应马甲。须先在「正文与预览」插入「用户」按钮。',
  },
  {
    target: 'tab-content',
    title: '正文与预览',
    body: '设置始终/关键词触发，编写记忆正文，用工具栏插入占位符；底部预览与注入时展开效果一致。',
  },
  {
    target: 'save',
    title: '写入档案库',
    body: '保存后写入 IndexedDB，并参与该角色的私聊召回（含向量语义筛选，若已在配置中开启）。',
  },
  {
    target: 'editor-tutorial',
    title: '随时回看',
    body: '标题栏「教程」可随时打开文字说明，或再跑一遍界面高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '需要温习时点开「教程」。现在可以开始刻录，或直接关闭面板。',
  },
]

/** 进入某一步前切换到对应编辑 Tab */
export function memoryEditorCoachTabForTarget(
  target: string | null,
): 'identity' | 'user' | 'content' | null {
  if (target === 'tab-identity') return 'identity'
  if (target === 'tab-user') return 'user'
  if (target === 'tab-content') return 'content'
  return null
}
