import { AnimatePresence, motion } from 'framer-motion'
import { Drama, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getNpcRoster, type YuyePlayerRole } from './jbsPublicDiscuss'

export type JBSDiscussActionPickerProps = {
  playerRoleName: string
  pendingAction: string | null
  disabled?: boolean
  onPickAction: (label: string) => void
  onClearAction: () => void
}

type ActionGroup = {
  title: string
  items: string[]
}

function buildActionGroups(
  npcRoles: YuyePlayerRole[],
  playerRoleName: string,
): ActionGroup[] {
  const gazeItems = [
    ...npcRoles.map((r) => `看向${r}`),
    '目光扫过全桌',
    '低头避开视线',
    '直视说话者',
  ]
  const exprItems = ['神情平静', '微微皱眉', '冷笑一声', '略显紧张', '故作轻松', '沉默不语']
  const postureItems = ['身体前倾', '端杯不饮', '交叉双臂', '指尖轻敲桌面', '靠回椅背']
  const misleadItems = [
    '刻意与某人对视以示同盟',
    '对质疑者微微摇头',
    '附和他人说法',
    '用动作转移话题',
    `向${npcRoles[0] ?? '某人'}使眼色`,
  ]

  return [
    { title: '目光', items: gazeItems },
    { title: '表情', items: exprItems },
    { title: '姿态', items: postureItems },
    {
      title: '迷惑（可选）',
      items: misleadItems.map((s) =>
        s.replace('某人', npcRoles.find((r) => r !== playerRoleName) ?? '对方'),
      ),
    },
  ]
}

export function JBSDiscussActionPicker({
  playerRoleName,
  pendingAction,
  disabled = false,
  onPickAction,
  onClearAction,
}: JBSDiscussActionPickerProps) {
  const [open, setOpen] = useState(false)
  const groups = useMemo(
    () => buildActionGroups(getNpcRoster(playerRoleName), playerRoleName),
    [playerRoleName],
  )

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`jbs-gf-discuss-action-btn flex size-11 items-center justify-center rounded-lg disabled:opacity-35 ${
          pendingAction ? 'jbs-gf-discuss-action-btn--active' : ''
        }`}
        aria-label="选择动作"
        aria-expanded={open}
      >
        <Drama className="size-4" strokeWidth={1.35} />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-black/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="关闭动作面板"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="jbs-gf-discuss-action-panel jbs-font-serif absolute bottom-[calc(100%+8px)] left-0 z-50 w-[min(320px,calc(100vw-2rem))] rounded-xl p-3 shadow-lg"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] tracking-[0.12em] text-[#f0e8d8]/75">非语言动作</p>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-[#f0e8d8]/55 hover:text-[#f0e8d8]"
                  aria-label="关闭"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {pendingAction ? (
                <div className="mb-2.5 flex items-start gap-2 rounded-lg bg-black/25 px-2.5 py-2">
                  <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-[#e8dcc8]">
                    已选：{pendingAction}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] tracking-wider text-[#c9a227]/90"
                    onClick={onClearAction}
                  >
                    清除
                  </button>
                </div>
              ) : null}

              <div className="max-h-[42vh] space-y-3 overflow-y-auto jbs-hide-scrollbar">
                {groups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-1.5 text-[10px] tracking-[0.14em] text-[#f0e8d8]/45">
                      {group.title}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="jbs-gf-discuss-action-chip rounded-full px-2.5 py-1 text-[11px]"
                          onClick={() => {
                            onPickAction(item)
                            setOpen(false)
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
