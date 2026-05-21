import type { MemoryCoachStep } from './memoryCoachTypes'

export type MemoryArchiveCoachTargetId =
  | 'search'
  | 'kind'
  | 'source'
  | 'focus'
  | 'align'
  | 'create'
  | 'list'
  | 'archive-tutorial'

export const MEMORY_ARCHIVE_COACH_STEPS: MemoryCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '欢迎来到记忆档案馆',
    body: '这里汇总各联系人的长期记忆：可检索、分轨查看角色记忆与关联记忆，并手动刻录或对齐 {{user}} 占位符。接下来用高亮带你认一圈，约半分钟；可随时跳过。',
  },
  {
    target: 'search',
    title: '检索记忆切片',
    body: '按正文、角色名、标签或触发词搜索。适合在记忆变多后快速定位某条线索。',
  },
  {
    target: 'kind',
    title: '角色记忆 / 关联记忆',
    body: '「角色记忆」挂在联系人名下，私聊时注入。「关联记忆」来自主角约会里对人脉 NPC 的摘录，分轨存储，其它角色不会自动看见。',
  },
  {
    target: 'source',
    title: '身份来源',
    body: '按主号微信、伪装小号或 Lumi Meet 分线筛选。与写入时的来源线一致，便于多马甲叙事不串线。',
  },
  {
    target: 'focus',
    title: '角色焦点',
    body: '横向滑动选择「全部」或某位联系人，列表只显示其名下记忆。点卡片可进入编辑。',
  },
  {
    target: 'align',
    title: '对齐 {{user}}',
    body: '一键把未绑定的玩家占位符按来源线或当前扮演身份补全；已有绑定不会被覆盖。',
  },
  {
    target: 'create',
    title: '刻录新记忆',
    body: '手动写入一条长期记忆。若已选中某位角色焦点，新建时会默认归属该联系人。',
  },
  {
    target: 'list',
    title: '记忆列表',
    body: '每张卡片展示展开预览、场景标签与触发方式。左滑或点按即可修订、删除。',
  },
  {
    target: 'archive-tutorial',
    title: '随时回看',
    body: '右上角「教程」可打开文字说明，也能再开一遍你现在看到的高亮引导。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '引导完成',
    body: '平时想查详细说明，点右上角「教程」即可。下面可以打开文字版小抄，也可以直接开始翻阅记忆。',
  },
]
