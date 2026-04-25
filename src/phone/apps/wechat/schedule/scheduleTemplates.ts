import type { ScheduleTable, TableCell } from '../newFriendsPersona/types'

export const SCHEDULE_TEMPLATE_STUDENT: ScheduleTable = {
  id: 'preset-student',
  name: '学生课程表',
  headers: ['节次', '时间', '周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  rows: [
    ['第1节', '08:00-08:45', '', '', '', '', '', '', ''],
    ['第2节', '08:55-09:40', '', '', '', '', '', '', ''],
    ['第3节', '10:00-10:45', '', '', '', '', '', '', ''],
    ['第4节', '10:55-11:40', '', '', '', '', '', '', ''],
    ['午休', '12:00-14:00', '', '', '', '', '', '', ''],
    ['第5节', '14:00-14:45', '', '', '', '', '', '', ''],
    ['第6节', '14:55-15:40', '', '', '', '', '', '', ''],
    ['第7节', '16:00-16:45', '', '', '', '', '', '', ''],
    ['晚自习', '19:00-21:00', '', '', '', '', '', '', ''],
  ].map((r) => r.map(toCell)),
  columnWidths: new Array(9).fill(90),
  rowHeights: new Array(9).fill(44),
  style: { headerStyle: 'dark', borderStyle: 'solid', rowHeight: 'normal' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export const SCHEDULE_TEMPLATE_DAILY: ScheduleTable = {
  id: 'preset-daily',
  name: '日常日程表',
  headers: ['时间', '周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  rows: [
    ['06:00-08:00', '', '', '', '', '', '', ''],
    ['08:00-12:00', '', '', '', '', '', '', ''],
    ['12:00-14:00', '', '', '', '', '', '', ''],
    ['14:00-18:00', '', '', '', '', '', '', ''],
    ['18:00-22:00', '', '', '', '', '', '', ''],
    ['22:00-06:00', '', '', '', '', '', '', ''],
  ].map((r) => r.map(toCell)),
  columnWidths: new Array(8).fill(96),
  rowHeights: new Array(6).fill(44),
  style: { headerStyle: 'dark', borderStyle: 'solid', rowHeight: 'normal' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

function toCell(content: string): TableCell {
  return {
    content: String(content ?? ''),
    style: {
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      highlight: false,
      align: 'left',
    },
    colspan: 1,
    rowspan: 1,
  }
}

export function cloneScheduleTemplate(t: ScheduleTable): ScheduleTable {
  const now = Date.now()
  return {
    id: `t-${now}`,
    name: t.name,
    headers: [...t.headers],
    rows: t.rows.map((r) => r.map((c) => ({ ...c, style: { ...c.style } }))),
    columnWidths: [...(t.columnWidths ?? new Array(t.headers.length).fill(96))],
    rowHeights: [...(t.rowHeights ?? new Array(t.rows.length).fill(44))],
    style: { ...t.style },
    createdAt: now,
    updatedAt: Date.now(),
  }
}

