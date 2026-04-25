import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  WECHAT_LUMI_ASSISTANT_CONTACT,
  type WeChatContactRow,
} from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
} as const

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div
      className="sticky top-0 z-30 shrink-0 border-b"
      style={{
        borderColor: COLORS.border,
        background: COLORS.card,
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" color={COLORS.text} strokeWidth={1.75} />
        </Pressable>
        <p className="flex-1 text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
          {title}
        </p>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

/** 与通讯录一致：Lumi 置顶，其余按备注拼音序 */
function buildAddressBookRows(contacts: WeChatContactRow[]): WeChatContactRow[] {
  const lumi = contacts.find((c) => c.id === WECHAT_LUMI_ASSISTANT_CONTACT.id)
  const rest = contacts.filter((c) => c.id !== WECHAT_LUMI_ASSISTANT_CONTACT.id)
  rest.sort((a, b) => a.remarkName.localeCompare(b.remarkName, 'zh-CN'))
  return lumi ? [lumi, ...rest] : rest
}

export function MemoryManagementApp({
  contacts,
  onBack,
  onOpenCharacter,
}: {
  /** 与微信通讯录 `WeChatContactsInstagram` 相同的合并列表（人设同步联系人等） */
  contacts: WeChatContactRow[]
  onBack: () => void
  onOpenCharacter: (characterId: string, titleRemark?: string) => void
}) {
  const [intervalN, setIntervalN] = useState(10)
  const [memories, setMemories] = useState<CharacterMemory[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [settings, allMem] = await Promise.all([
        personaDb.getMemorySettings(),
        personaDb.listAllCharacterMemories(),
      ])
      setIntervalN(settings.autoSummaryInterval)
      setMemories(allMem)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onEvt = () => {
      void reload()
    }
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])

  const countByCharacter = useMemo(() => {
    const m = new Map<string, number>()
    for (const mem of memories) {
      m.set(mem.characterId, (m.get(mem.characterId) ?? 0) + 1)
    }
    return m
  }, [memories])

  const addressRows = useMemo(() => buildAddressBookRows(contacts), [contacts])

  const commitInterval = async (raw: number) => {
    const n = Math.max(1, Math.min(100, Math.floor(Number.isFinite(raw) ? raw : 10)))
    setIntervalN(n)
    await personaDb.putMemorySettings({ autoSummaryInterval: n })
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ background: COLORS.bg, color: COLORS.text }}
    >
      <TopBar title="记忆管理" onBack={onBack} />
      <div
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom,0px))' }}
      >
        <div
          className="mx-4 mt-4 rounded-[12px] border bg-white px-5 py-5"
          style={{ borderColor: COLORS.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <p className="text-[16px] font-semibold" style={{ color: COLORS.text }}>
            全局设置
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 text-[16px]" style={{ color: COLORS.text }}>
              每{intervalN}轮自动总结一次记忆（微信聊天 AI 回复 + 约会线下剧情 AI 生成合计）
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={intervalN}
              onChange={(e) => setIntervalN(Number(e.target.value))}
              onBlur={() => {
                void commitInterval(intervalN)
              }}
              className="w-[80px] shrink-0 rounded-[8px] border px-2 py-2 text-center text-[16px] outline-none transition-all duration-200 ease-out focus:border-black"
              style={{
                borderColor: COLORS.border,
                background: COLORS.card,
                color: COLORS.text,
              }}
              aria-label="自动总结间隔轮数"
            />
          </div>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: COLORS.faint }}>
            每达到设定次数后，系统会把「尚未总结」的微信消息与约会线下剧情合并总结为一条长期记忆；若同时包含两类来源，列表中会显示为高亮来源标签，例如{' '}
            <span className="inline-flex items-center gap-1 align-middle">
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                style={{ background: '#07c160' }}
              >
                线上
              </span>
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                style={{ background: '#6366f1' }}
              >
                线下
              </span>
            </span>
            （只有一种来源则只显示对应一枚标签；入库仍带简短前缀，界面会自动拆开高亮）。
          </p>
        </div>

        <p className="mx-4 mt-6 text-[16px] font-semibold" style={{ color: COLORS.text }}>
          通讯录
        </p>
        <p className="mx-4 mt-1 text-[13px] leading-relaxed" style={{ color: COLORS.sub }}>
          点击联系人查看长期记忆与当前身份下最近50条对话
        </p>

        {loading ? (
          <div
            className="mx-4 mt-3 rounded-[12px] border bg-white px-5 py-8 text-center text-[14px]"
            style={{ borderColor: COLORS.border, color: COLORS.sub }}
          >
            加载中…
          </div>
        ) : addressRows.length === 0 ? (
          <div
            className="mx-4 mt-3 flex flex-col items-center rounded-[12px] border bg-white px-6 py-12"
            style={{ borderColor: COLORS.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <BookOpen className="size-12" color={COLORS.faint} strokeWidth={1.5} aria-hidden />
            <p className="mt-4 text-[16px]" style={{ color: COLORS.sub }}>
              暂无联系人
            </p>
            <p className="mt-2 text-center text-[14px] leading-relaxed" style={{ color: COLORS.faint }}>
              请先在通讯录同步人设角色
            </p>
          </div>
        ) : (
          <div
            className="mx-4 mt-3 overflow-hidden rounded-[12px] border bg-white"
            style={{ borderColor: COLORS.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <ul>
              {addressRows.map((row, idx) => {
                const n = countByCharacter.get(row.id) ?? 0
                return (
                  <li key={row.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
                    <Pressable
                      onClick={() => onOpenCharacter(row.id, row.remarkName)}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                    >
                      <div
                        className="h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-white"
                        style={{ borderColor: COLORS.border }}
                      >
                        {row.avatarUrl ? (
                          <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center text-[12px]"
                            style={{ color: COLORS.faint }}
                          >
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[16px]" style={{ color: COLORS.text }}>
                            {row.remarkName}
                          </p>
                          {row.tag ? (
                            <span
                              className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                              style={{ background: '#000000' }}
                            >
                              {row.tag}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[14px]" style={{ color: COLORS.sub }}>
                          {n}条记忆
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0" color={COLORS.sub} strokeWidth={1.75} aria-hidden />
                    </Pressable>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
