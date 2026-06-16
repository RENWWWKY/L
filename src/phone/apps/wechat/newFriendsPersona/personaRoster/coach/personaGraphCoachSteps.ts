import type { MemoryCoachStep } from '../../../memory/memoryCoachTypes'

export const PERSONA_GRAPH_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '关系图谱怎么用',
    body: '头像 + 连线 + 关系词，适合一眼看清人脉。下面教你平移缩放、排版、保存布局、拉连线。',
  },
  {
    target: 'graph-header',
    title: '当前角色是谁',
    body: '标题是入口角色的名字。默认是「全景 · 当前角色高亮」——整张关系网都在，只是把 TA 和相关连线加亮。',
  },
  {
    target: 'graph-tutorial-btn',
    title: '教程按钮',
    body: '右上角「教程」= 文字小抄 + 可重开高亮引导。',
  },
  {
    target: 'graph-canvas',
    title: '平移与缩放画布',
    body: '在空白处按下并拖动即可平移画布；只有两根手指同时捏合才会缩放。拖头像或关系词时不会触发缩放。',
  },
  {
    target: 'graph-canvas',
    title: '拖头像排版',
    body: '没开连线模式时，按住头像可拖动位置。连线会跟着走，关系词标签也会留在连线上。',
  },
  {
    target: 'graph-save-layout',
    title: '保存布局',
    body: '排版或缩放满意后，点右上角「保存布局」写入本地。有改动时按钮会亮起；未保存就返回，会弹窗问你要不要保存。',
  },
  {
    target: 'graph-edge-label',
    title: '关系词标签',
    body: '按住标签可沿连线滑动到空位；轻点标签打开快速编辑。标签挡线了就拖开一点。',
  },
  {
    target: 'graph-link-mode',
    title: '编辑关系连线',
    body: '点这个按钮进入连线模式：在起点头像按下并按住，拖到高亮的目标头像松手。没有的关系会新建，有的会打开编辑。',
  },
  {
    target: 'graph-exit-focus',
    title: '退出聚焦',
    body: '轻点头像可进入聚焦视角；聚焦后点「退出聚焦」回到纯全景，不再保留高亮。',
  },
  {
    target: 'graph-tutorial-btn',
    title: '随时重看',
    body: '忘了怎么排版、怎么保存、怎么拉线，点「教程」再来一遍。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '图谱入门完成',
    body: '多练两次：平移缩放、拖标签、保存布局、拉连线。回列表用「编辑关系」细改文字也行。',
  },
]
