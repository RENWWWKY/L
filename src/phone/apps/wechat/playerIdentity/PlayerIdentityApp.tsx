import { ArrowLeft, Check, Download, Edit, Plus, Trash2, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ApiConfig } from '../../api/types'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import { DEFAULT_WORLD_BACKGROUND_ID } from '../newFriendsPersona/worldBackgroundConstants'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import type { PlayerIdentity, Relationship } from '../newFriendsPersona/types'
import { daysInMonth, formatMD, randomChineseName, uid, zodiacFromMD } from '../newFriendsPersona/utils'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { WorldBooksEditor } from '../newFriendsPersona/WorldBooksEditor'
import type { ScheduleTable } from '../newFriendsPersona/types'
import { ScheduleEditorScreen } from '../schedule/ScheduleEditorScreen'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
} as const

const MBTI_LIST = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'] as const
const IDENTITY_OPTIONS = [
  '学生',
  '教师',
  '心理咨询师',
  '医生',
  '护士',
  '律师',
  '记者',
  '产品经理',
  'UI设计师',
  '插画师',
  '程序员',
  '建筑师',
  '摄影师',
  '咖啡师',
  '主理人',
  '市场策划',
  '新媒体编辑',
  '独立音乐人',
] as const
const INTEREST_OPTIONS = [
  '摄影',
  '电影',
  '旅行',
  '阅读',
  '健身',
  '跑步',
  '羽毛球',
  '游泳',
  '看展',
  '听音乐',
  '乐器演奏',
  '手作',
  '烘焙',
  '咖啡',
  '写作',
  '绘画',
  '桌游',
  '徒步',
  'Citywalk',
  '植物养护',
] as const
const PAIN_OPTIONS = [
  '迟到',
  '放鸽子',
  '不回消息',
  '已读不回',
  '失联',
  '情绪化',
  '冷暴力',
  '双标',
  '控制欲强',
  '说话阴阳怪气',
  '过度说教',
  '打断别人讲话',
  '推卸责任',
  '边界感差',
  '过度比较',
  '不尊重隐私',
  '爽约成习惯',
  '只索取不付出',
  '当众让人难堪',
  '习惯性否定',
] as const

const MBTI_IMAGE_URLS = import.meta.glob('../../../../../image/MBTI人格形象图/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function resolveMbtiImageUrl(mbti: string): string {
  const key = (mbti || '').trim().toUpperCase()
  if (!key) return ''
  for (const [path, url] of Object.entries(MBTI_IMAGE_URLS)) {
    const name = path.split('/').pop() || ''
    if (name.toUpperCase().startsWith(key)) return url
  }
  return ''
}

function isLargeMbtiAvatar(mbti?: string) {
  const key = String(mbti || '').trim().toUpperCase()
  return key === 'ISFJ' || key === 'ENTJ'
}

const MBTI_SUMMARY_4: Record<string, string> = {
  INTJ: '冷静谋略',
  INTP: '理性求真',
  ENTJ: '强势统筹',
  ENTP: '机智破局',
  INFJ: '洞察引导',
  INFP: '温柔理想',
  ENFJ: '亲和领航',
  ENFP: '热情探索',
  ISTJ: '稳重守序',
  ISFJ: '细致守护',
  ESTJ: '务实管理',
  ESFJ: '体贴社交',
  ISTP: '冷静实干',
  ISFP: '随性艺感',
  ESTP: '果断冒险',
  ESFP: '外向享乐',
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] bg-white"
      style={{ background: COLORS.card, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {children}
    </div>
  )
}

function TopBar({
  title,
  onBack,
  right,
}: {
  title: string
  onBack: () => void
  right?: React.ReactNode
}) {
  return (
    <div
      className="sticky top-0 z-30 border-b bg-white"
      style={{
        borderColor: COLORS.border,
        background: COLORS.card,
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[12px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" color={COLORS.text} strokeWidth={1.75} />
        </button>
        <p className="text-[18px] font-bold" style={{ color: COLORS.text }}>
          {title}
        </p>
        <div className="min-w-[44px] text-right">{right}</div>
      </div>
    </div>
  )
}

function EmptyBlock({
  title,
  desc,
  actionText,
  onAction,
}: {
  title: string
  desc: string
  actionText: string
  onAction: () => void
}) {
  return (
    <Card>
      <div className="px-5 py-8 text-center">
        <User className="mx-auto size-12" color={COLORS.faint} strokeWidth={1.5} />
        <p className="mt-4 text-[16px] font-semibold" style={{ color: COLORS.sub }}>
          {title}
        </p>
        <p className="mt-2 text-[14px]" style={{ color: COLORS.faint }}>
          {desc}
        </p>
        <button
          type="button"
          onClick={onAction}
          className="mt-5 w-full rounded-[12px] px-5 py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
          style={{ background: COLORS.text }}
        >
          {actionText}
        </button>
      </div>
    </Card>
  )
}

function newIdentity(): PlayerIdentity {
  const now = Date.now()
  return {
    id: uid('pi'),
    createdAt: now,
    updatedAt: now,
    name: '',
    gender: 'female',
    age: null,
    birthdayMD: '',
    zodiac: '',
    identity: '',
    mbti: '',
    bio: '',
    motto: '',
    avatarUrl: '',
    worldBooks: [],
    interests: [],
    painPoints: [],
    schedule: undefined,
  }
}

function downloadTextFile(params: { filename: string; text: string; mime: string }) {
  const blob = new Blob([params.text], { type: params.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = params.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return JSON.stringify({ error: 'stringify_failed' })
  }
}

function normalizeImportedIdentity(input: unknown): PlayerIdentity | null {
  const r = (input ?? {}) as Partial<PlayerIdentity>
  const now = Date.now()
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : uid('pi')
  const gender = r.gender === 'male' || r.gender === 'female' ? r.gender : 'female'
  const age = typeof r.age === 'number' && Number.isFinite(r.age) ? r.age : null
  const interests = Array.isArray(r.interests) ? (r.interests as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : []
  const pains = Array.isArray(r.painPoints) ? (r.painPoints as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : []
  const worldBooks = Array.isArray(r.worldBooks) ? (r.worldBooks as any[]) : []
  return {
    id,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: now,
    name: typeof r.name === 'string' ? r.name : '',
    gender,
    age,
    birthdayMD: typeof r.birthdayMD === 'string' ? r.birthdayMD : '',
    zodiac: typeof r.zodiac === 'string' ? r.zodiac : '',
    identity: typeof r.identity === 'string' ? r.identity : '',
    mbti: typeof r.mbti === 'string' ? r.mbti : '',
    bio: typeof r.bio === 'string' ? r.bio : '',
    motto: typeof r.motto === 'string' ? r.motto : '',
    avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : '',
    worldBooks,
    interests,
    painPoints: pains,
    // 日程表：保留原样交给 IndexedDB normalize（兼容旧/新结构）
    schedule: (r as any).schedule,
  }
}

export function PlayerIdentityApp({
  onBack,
  onOpenCharacter: _onOpenCharacter,
}: {
  onBack: () => void
  /** 预留：从身份页跳转到角色资料卡 */
  onOpenCharacter: (characterId: string) => void
}) {
  void _onOpenCharacter
  const apiConfig = useCurrentApiConfig()
  const [page, setPage] = useState<
    | { name: 'list' }
    | { name: 'edit'; id: string; isNew: boolean; draft?: PlayerIdentity }
  >({ name: 'list' })
  const [list, setList] = useState<PlayerIdentity[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const ids = await personaDb.listPlayerIdentities()
    setList(ids)
    setLoading(false)
  }

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(t)
  }, [])

  if (page.name === 'edit') {
    return (
      <IdentityEditPage
        apiConfig={apiConfig}
        identityId={page.id}
        isNew={page.isNew}
        initialDraft={page.draft}
        onBack={() => setPage({ name: 'list' })}
        onSaved={async (id) => {
          await refresh()
          const cur = await personaDb.getCurrentIdentityId()
          if (!cur) await personaDb.setCurrentIdentityId(id)
          setPage({ name: 'list' })
        }}
      />
    )
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden" style={{ background: COLORS.bg }}>
      <TopBar
        title="我的身份"
        onBack={onBack}
        right={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-[12px] px-3 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-50"
              style={{ background: COLORS.text }}
              disabled={importing}
              onClick={() => {
                void (async () => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'application/json,.json'
                  input.onchange = () => {
                    const f = input.files?.[0]
                    if (!f) return
                    void (async () => {
                      setImporting(true)
                      try {
                        if (f.size > 2 * 1024 * 1024) {
                          window.alert('导入失败：文件过大（建议 ≤ 2MB）')
                          return
                        }
                        const text = await f.text()
                        const raw = JSON.parse(text) as any
                        const candidate = raw?.identity ?? raw
                        const normalized = normalizeImportedIdentity(candidate)
                        if (!normalized) {
                          window.alert('导入失败：文件内容不符合身份格式')
                          return
                        }
                        await personaDb.upsertPlayerIdentity(normalized)
                        await refresh()
                        const cur = await personaDb.getCurrentIdentityId()
                        if (!cur) await personaDb.setCurrentIdentityId(normalized.id)
                        window.alert('导入成功')
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : '未知错误'
                        window.alert(`导入失败：${msg.slice(0, 180)}`)
                      } finally {
                        setImporting(false)
                      }
                    })()
                  }
                  input.click()
                })()
              }}
            >
              {importing ? '导入中…' : '导入'}
            </button>
          </div>
        }
      />
      <div className="h-full min-h-0 overflow-y-auto px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-4">
          <p className="px-1 text-[16px] font-semibold" style={{ color: COLORS.text }}>
            身份列表
          </p>
          <p className="px-1 text-[13px] leading-relaxed" style={{ color: COLORS.sub }}>
            在新建角色人设时选择其一，作为 AI 参考的「你」；此处仅管理档案，不设「正在使用」状态。
          </p>

          {loading ? (
            <Card>
              <div className="px-5 py-5 text-[14px]" style={{ color: COLORS.sub }}>
                加载中…
              </div>
            </Card>
          ) : list.length === 0 ? (
            <EmptyBlock
              title="暂无身份"
              desc="创建身份后，可在新建角色时选择，供 AI 参考你的设定"
              actionText="创建新身份"
              onAction={() => setPage({ name: 'edit', id: newIdentity().id, isNew: true, draft: newIdentity() })}
            />
          ) : (
            <div className="space-y-3">
              {list.map((it) => (
                <Card key={it.id}>
                  <div className="flex w-full items-stretch">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 text-left transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                      onClick={() => setPage({ name: 'edit', id: it.id, isNew: false })}
                    >
                      <div
                        className="h-[50px] w-[50px] shrink-0 overflow-hidden rounded-full border"
                        style={{ borderColor: COLORS.border }}
                      >
                        {it.avatarUrl?.trim() ? (
                          <img
                            src={it.avatarUrl}
                            alt=""
                            className={`h-full w-full object-contain ${isLargeMbtiAvatar(it.mbti) ? 'scale-100' : 'scale-85'}`}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ background: '#ffffff' }}>
                            <User className="size-6" color={COLORS.faint} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold" style={{ color: COLORS.text }}>
                          {it.name?.trim() || '未命名'}
                        </p>
                        <p className="mt-1 truncate text-[14px]" style={{ color: COLORS.sub }}>
                          {it.identity?.trim() || '—'}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1 pr-2">
                      <button
                        type="button"
                        className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                        onClick={() => {
                          const fname = `【Lumi Phone】身份-${(it.name?.trim() || '未命名').slice(0, 12)}.json`
                          const payload = { schema: 'wechat-player-identity-v1', exportedAt: Date.now(), identity: it }
                          downloadTextFile({ filename: fname, text: safeJsonStringify(payload), mime: 'application/json' })
                        }}
                        aria-label="导出身份"
                        title="导出"
                      >
                        <Download className="size-[18px]" color={COLORS.sub} strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                        onClick={() => setPage({ name: 'edit', id: it.id, isNew: false })}
                        aria-label="编辑身份"
                      >
                        <Edit className="size-[18px]" color={COLORS.sub} strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                        onClick={() => setDeleteId(it.id)}
                        aria-label="删除身份"
                      >
                        <Trash2 className="size-[18px]" color={COLORS.sub} strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom,0px))' }}
      >
        <div className="pointer-events-auto px-4">
          <button
            type="button"
            onClick={() => setPage({ name: 'edit', id: newIdentity().id, isNew: true, draft: newIdentity() })}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] px-4 py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
            style={{ background: COLORS.text }}
          >
            <Plus className="size-4" color="#ffffff" strokeWidth={2} />
            创建新身份
          </button>
        </div>
      </div>

      {deleteId ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[400px] rounded-[16px] bg-white p-5" style={{ background: COLORS.card }}>
            <p className="text-center text-[16px] font-semibold" style={{ color: COLORS.text }}>
              确认删除
            </p>
            <p className="mt-2 text-center text-[14px]" style={{ color: COLORS.sub }}>
              将从 IndexedDB 中移除该身份。此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-[12px] border bg-white px-4 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const id = deleteId
                    setDeleteId(null)
                    await personaDb.deletePlayerIdentity(id)
                    await refresh()
                  })()
                }}
                className="flex-1 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: COLORS.text }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function IdentityEditPage({
  apiConfig,
  identityId,
  isNew,
  initialDraft,
  onBack,
  onSaved,
}: {
  apiConfig: ApiConfig | null
  identityId: string
  isNew: boolean
  initialDraft?: PlayerIdentity
  onBack: () => void
  onSaved: (id: string) => void
}) {
  const [data, setData] = useState<PlayerIdentity>(initialDraft ?? newIdentity())
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [rels, setRels] = useState<Relationship[]>([])
  const [mbtiOpen, setMbtiOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [interestsOpen, setInterestsOpen] = useState(false)
  const [painOpen, setPainOpen] = useState(false)
  const [customIdentityOpen, setCustomIdentityOpen] = useState(false)
  const [customInterestOpen, setCustomInterestOpen] = useState(false)
  const [customPainOpen, setCustomPainOpen] = useState(false)
  const [customIdentityDraft, setCustomIdentityDraft] = useState('')
  const [customInterestDraft, setCustomInterestDraft] = useState('')
  const [customPainDraft, setCustomPainDraft] = useState('')
  const [bindingDetails, setBindingDetails] = useState<
    Array<{
      relationId: string
      otherId: string
      otherName: string
      otherAvatarUrl: string
      isNpc: boolean
      mainCharacterId: string
      mainCharacterName: string
      mainCharacterAvatarUrl: string
      relationYouToThem: string
      youSeeThem: string
    }>
  >([])
  const [editingBinding, setEditingBinding] = useState<{
    relationId: string
    otherId: string
    rootCharacterId: string
    relationYouToThem: string
  } | null>(null)
  const [editTab, setEditTab] = useState<'basic' | 'worldbook' | 'bindings' | 'schedule'>('basic')
  const [identityWbPrompt, setIdentityWbPrompt] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      if (initialDraft) {
        setLoaded(true)
        return
      }
      const existing = await personaDb.getPlayerIdentity(identityId)
      if (existing) setData(existing)
      setLoaded(true)
    })()
  }, [identityId, initialDraft])

  useEffect(() => {
    void personaDb.getWorldBackground(data.worldBackgroundId ?? DEFAULT_WORLD_BACKGROUND_ID).then((w) => {
      setIdentityWbPrompt(formatWorldBackgroundForPrompt(w))
    })
  }, [data.worldBackgroundId])

  useEffect(() => {
    void (async () => {
      const r = await personaDb.listRelationshipsForIdentity(identityId)
      setRels(r)
    })()
  }, [identityId])

  useEffect(() => {
    void (async () => {
      const primaryRelByOther = new Map<string, Relationship>()
      for (const r of rels) {
        if (!r.isPlayerIdentity) continue
        let other = ''
        if (r.fromCharacterId === identityId) other = r.toCharacterId
        else if (r.toCharacterId === identityId) other = r.fromCharacterId
        if (!other || other === identityId) continue
        if (r.fromCharacterId === identityId) primaryRelByOther.set(other, r)
        else if (!primaryRelByOther.has(other)) primaryRelByOther.set(other, r)
      }

      const otherIds = new Set<string>(primaryRelByOther.keys())
      const allChars = await personaDb.listCharacters()
      for (const c of allChars) {
        if (c.playerIdentityId === identityId) otherIds.add(c.id)
      }

      let didCleanup = false

      const detailsRaw = await Promise.all(
        [...otherIds].map(async (otherId) => {
          const r = primaryRelByOther.get(otherId)
          const other = await personaDb.getCharacter(otherId)
          if (!other) {
            await personaDb.deletePlayerIdentityBinding(identityId, otherId)
            didCleanup = true
            return null
          }
          const isNpc = !!other.generatedForCharacterId
          const rootCharacterId = other.generatedForCharacterId || otherId
          const mainCharacter = isNpc ? await personaDb.getCharacter(rootCharacterId) : other
          if (isNpc && !mainCharacter) {
            await personaDb.deletePlayerIdentityBinding(identityId, otherId)
            didCleanup = true
            try {
              await personaDb.deleteCharacterNpcOnly(otherId)
            } catch {
              await personaDb.deleteRelationshipsInvolving(otherId)
            }
            return null
          }
          const links = await personaDb.getPlayerNetworkLinks(rootCharacterId)
          const playerLink = links.find((x) => x.characterId === otherId)
          const relationId = r?.id ?? `field-${otherId}`
          return {
            relationId,
            otherId,
            otherName: other.name?.trim() || '未命名角色',
            otherAvatarUrl: other.avatarUrl?.trim() || '',
            isNpc,
            mainCharacterId: mainCharacter?.id || '',
            mainCharacterName: mainCharacter?.name?.trim() || '',
            mainCharacterAvatarUrl: mainCharacter?.avatarUrl?.trim() || '',
            relationYouToThem: playerLink?.relationYouToThem?.trim() || r?.relation?.trim() || '',
            youSeeThem: playerLink?.youSeeThem?.trim() || r?.fromPerspective?.trim() || '',
          }
        }),
      )
      const details = detailsRaw.filter((x): x is NonNullable<typeof x> => x !== null)
      details.sort((a, b) => a.otherName.localeCompare(b.otherName, 'zh-CN'))
      setBindingDetails(details)
      if (didCleanup) {
        const nextRels = await personaDb.listRelationshipsForIdentity(identityId)
        setRels(nextRels)
      }
    })()
  }, [rels, identityId])

  const title = isNew ? '创建身份' : '编辑身份'
  const customInterestOptions = useMemo(
    () => (data.interests ?? []).filter((x) => !INTEREST_OPTIONS.includes(x as (typeof INTEREST_OPTIONS)[number])),
    [data.interests],
  )
  const customPainOptions = useMemo(
    () => (data.painPoints ?? []).filter((x) => !PAIN_OPTIONS.includes(x as (typeof PAIN_OPTIONS)[number])),
    [data.painPoints],
  )
  const birthdayParts = useMemo(() => {
    const raw = (data.birthdayMD || '').trim()
    const m = Number(raw.slice(0, 2))
    const d = Number(raw.slice(3, 5))
    if (Number.isFinite(m) && Number.isFinite(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { month: m, day: d }
    }
    return { month: 1, day: 1 }
  }, [data.birthdayMD])

  const setField = <K extends keyof PlayerIdentity>(k: K, v: PlayerIdentity[K]) => {
    setDirty(true)
    setData((prev) => ({ ...prev, [k]: v, updatedAt: Date.now() }))
  }

  const onSave = async () => {
    const mbtiAvatar = data.mbti?.trim() ? resolveMbtiImageUrl(data.mbti) : ''
    const next: PlayerIdentity = {
      ...data,
      id: identityId,
      updatedAt: Date.now(),
      zodiac: data.birthdayMD?.trim() ? zodiacFromMD(data.birthdayMD) : '',
      avatarUrl: mbtiAvatar || '',
      interests: (data.interests ?? []).filter(Boolean),
      painPoints: (data.painPoints ?? []).filter(Boolean),
    }
    await personaDb.upsertPlayerIdentity(next)
    setDirty(false)
    onSaved(identityId)
  }

  const saveBindingView = async () => {
    if (!editingBinding) return
    if (editingBinding.relationId.startsWith('field-')) {
      const iden = await personaDb.getPlayerIdentity(identityId)
      const other = await personaDb.getCharacter(editingBinding.otherId)
      await personaDb.upsertPlayerIdentityBindings({
        identityId,
        characterId: editingBinding.otherId,
        identityName: iden?.name || '你',
        characterName: other?.name || '角色',
      })
      const nextRels = await personaDb.listRelationshipsForIdentity(identityId)
      setRels(nextRels)
    }
    const rootLinks = await personaDb.getPlayerNetworkLinks(editingBinding.rootCharacterId)
    const idx = rootLinks.findIndex((x) => x.characterId === editingBinding.otherId)
    const next = [...rootLinks]
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        relationYouToThem: editingBinding.relationYouToThem.trim(),
      }
    } else {
      next.push({
        id: uid('pl'),
        characterId: editingBinding.otherId,
        relationYouToThem: editingBinding.relationYouToThem.trim(),
        relationThemToYou: '',
        youSeeThem: '',
        theySeeYou: '',
      })
    }
    await personaDb.putPlayerNetworkLinks(editingBinding.rootCharacterId, next)
    setBindingDetails((prev) =>
      prev.map((x) =>
        x.otherId === editingBinding.otherId
          ? {
              ...x,
              relationYouToThem: editingBinding.relationYouToThem.trim(),
            }
          : x,
      ),
    )
    setEditingBinding(null)
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden" style={{ background: COLORS.bg }}>
      <TopBar
        title={title}
        onBack={() => {
          if (dirty) {
            setConfirmLeave(true)
          } else onBack()
        }}
        right={
          <button
            type="button"
            onClick={() => void onSave()}
            className="rounded-[12px] px-2 py-1 text-[16px] font-semibold transition-all duration-200 ease-out"
            style={{ color: COLORS.text }}
          >
            保存
          </button>
        }
      />

      <div className="h-full min-h-0 overflow-y-auto pb-[calc(120px+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[520px] space-y-4 px-4 py-4">
          <Card>
            <div className="px-3 py-3">
              <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    { id: 'basic' as const, label: '基础信息' },
                    { id: 'worldbook' as const, label: '世界书' },
                    { id: 'bindings' as const, label: '人脉关系' },
                    { id: 'schedule' as const, label: '日程表' },
                  ] as const
                ).map((t) => {
                  const active = editTab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditTab(t.id)}
                      className="shrink-0 rounded-xl border px-3 py-2 text-[13px] transition-all duration-200 ease-out"
                      style={{
                        borderColor: COLORS.border,
                        background: active ? '#111827' : '#ffffff',
                        color: active ? '#ffffff' : COLORS.text,
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          <div className="mt-4" />

          {editTab === 'basic' ? (
          <Card>
            <div className="border-b px-5 py-4" style={{ borderColor: COLORS.border }}>
              <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
                基础信息
              </p>
            </div>
            <div className="space-y-3 px-5 py-5">
                <label className="block">
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    姓名
                  </span>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={data.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="请输入姓名"
                      className="w-full rounded-[12px] border bg-white px-4 py-3 text-[14px] outline-none transition-all duration-200 ease-out"
                      style={{ borderColor: COLORS.border, color: COLORS.text }}
                    />
                    <button
                      type="button"
                      onClick={() => setField('name', randomChineseName(data.gender))}
                      className="shrink-0 rounded-[12px] border bg-white px-3 py-3 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                      style={{ borderColor: COLORS.border, color: COLORS.text }}
                    >
                      随机
                    </button>
                  </div>
                </label>

                <div>
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    性别
                  </span>
                  <div className="mt-2 flex gap-2">
                    {(['male', 'female', 'other'] as const).map((g) => {
                      const on = data.gender === g
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setField('gender', g)}
                          className="rounded-[12px] border px-4 py-2 text-[13px] transition-all duration-200 ease-out"
                          style={{ borderColor: '#e5e5e5', background: on ? '#000000' : '#ffffff', color: on ? '#ffffff' : '#000000' }}
                        >
                          {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    年龄
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={data.age ?? ''}
                    onChange={(e) => setField('age', e.target.value ? Number(e.target.value) : null)}
                    placeholder="请输入年龄"
                    className="mt-2 w-full rounded-[12px] border bg-white px-4 py-3 text-[14px] outline-none transition-all duration-200 ease-out"
                    style={{ borderColor: COLORS.border, color: COLORS.text }}
                  />
                </label>

                <div>
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    生日（自动匹配星座）
                  </span>
                  <div className="mt-2 flex min-w-0 items-center gap-2">
                    <InlineDropdown
                      label="选择月份"
                      valueText={`${birthdayParts.month} 月`}
                      open={monthOpen}
                      onToggle={() => {
                        setMonthOpen((v) => !v)
                        setDayOpen(false)
                        setMbtiOpen(false)
                        setIdentityOpen(false)
                        setInterestsOpen(false)
                        setPainOpen(false)
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const active = birthdayParts.month === m
                        return (
                          <button
                            key={m}
                            type="button"
                            className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                            style={{
                              color: active ? '#ffffff' : '#000000',
                              background: active ? '#111827' : 'transparent',
                            }}
                            onClick={() => {
                              const maxD = daysInMonth(m)
                              const d = Math.min(birthdayParts.day, maxD)
                              const md = formatMD(m, d)
                              setField('birthdayMD', md)
                              setField('zodiac', zodiacFromMD(md))
                              setMonthOpen(false)
                            }}
                          >
                            {m} 月
                          </button>
                        )
                      })}
                    </InlineDropdown>

                    <InlineDropdown
                      label="选择日期"
                      valueText={`${birthdayParts.day} 日`}
                      open={dayOpen}
                      onToggle={() => {
                        setDayOpen((v) => !v)
                        setMonthOpen(false)
                        setMbtiOpen(false)
                        setIdentityOpen(false)
                        setInterestsOpen(false)
                        setPainOpen(false)
                      }}
                    >
                      {Array.from({ length: daysInMonth(birthdayParts.month) }, (_, i) => i + 1).map((d) => {
                        const active = birthdayParts.day === d
                        return (
                          <button
                            key={d}
                            type="button"
                            className="flex w-full items-center justify-center px-3 py-2 text-[13px]"
                            style={{
                              color: active ? '#ffffff' : '#000000',
                              background: active ? '#111827' : 'transparent',
                            }}
                            onClick={() => {
                              const md = formatMD(birthdayParts.month, d)
                              setField('birthdayMD', md)
                              setField('zodiac', zodiacFromMD(md))
                              setDayOpen(false)
                            }}
                          >
                            {d} 日
                          </button>
                        )
                      })}
                    </InlineDropdown>
                  </div>
                  <p className="mt-1 text-[12px]" style={{ color: COLORS.faint }}>
                    星座：{data.zodiac?.trim() || '—'}
                  </p>
                </div>

                <label className="block">
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    MBTI
                  </span>
                  <div className="mt-2">
                    <InlineDropdown
                      label="MBTI"
                      valueText={data.mbti?.trim() ? data.mbti : '未选择'}
                      open={mbtiOpen}
                      onToggle={() => {
                        setMbtiOpen((v) => !v)
                        setMonthOpen(false)
                        setDayOpen(false)
                        setIdentityOpen(false)
                        setInterestsOpen(false)
                        setPainOpen(false)
                      }}
                    >
                      <div className="grid grid-cols-2 gap-2 px-3 py-2">
                        {MBTI_LIST.map((m) => {
                          const active = data.mbti === m
                          const big = m === 'ENTJ' || m === 'ESFJ'
                          return (
                            <button
                              key={m}
                              type="button"
                              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out"
                              style={{
                                borderColor: '#e5e5e5',
                                background: active ? '#111827' : '#ffffff',
                                color: active ? '#ffffff' : '#000000',
                              }}
                              onClick={() => {
                                setField('mbti', m)
                                setMbtiOpen(false)
                              }}
                            >
                              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
                                <img
                                  src={resolveMbtiImageUrl(m)}
                                  alt=""
                                  className={`${big ? 'h-9 w-9' : 'h-[36px] w-[36px]'} border object-contain`}
                                  style={{ borderColor: active ? 'rgba(255,255,255,0.25)' : '#e5e5e5' }}
                                  onError={(e) => {
                                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold">{m}</p>
                                <p className="mt-0.5 text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.72)' : '#666666' }}>
                                  {MBTI_SUMMARY_4[m] ?? '人格概括'}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <div className="px-3 pb-2">
                        <button
                          type="button"
                          className="w-full rounded-xl border bg-white px-3 py-2 text-[12px] transition-all duration-200 ease-out hover:bg-[#fafafa]"
                          style={{ borderColor: '#e5e5e5', color: '#666666' }}
                          onClick={() => {
                            setField('mbti', '')
                            setMbtiOpen(false)
                          }}
                        >
                          清空选择
                        </button>
                      </div>
                    </InlineDropdown>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    职业/身份（单选）
                  </span>
                  <div className="mt-2">
                    <InlineDropdown
                      label="职业身份"
                      valueText={data.identity?.trim() || '请选择职业/身份'}
                      open={identityOpen}
                      onToggle={() => {
                        setIdentityOpen((v) => !v)
                        setMbtiOpen(false)
                        setMonthOpen(false)
                        setDayOpen(false)
                        setInterestsOpen(false)
                        setPainOpen(false)
                      }}
                    >
                      <div className="px-3 py-2">
                        <button
                          type="button"
                          className="w-full rounded-lg border px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                          style={{ borderColor: '#e5e5e5', color: '#000000' }}
                          onClick={() => setCustomIdentityOpen((v) => !v)}
                        >
                          自定义编辑
                        </button>
                        {customIdentityOpen ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              value={customIdentityDraft}
                              onChange={(e) => setCustomIdentityDraft(e.target.value)}
                              placeholder="输入自定义职业/身份"
                              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none"
                              style={{ borderColor: '#e5e5e5', color: '#000000' }}
                            />
                            <button
                              type="button"
                              className="rounded-lg bg-black px-3 py-2 text-[12px] text-white"
                              onClick={() => {
                                const v = customIdentityDraft.trim()
                                if (!v) return
                                setField('identity', v)
                                setCustomIdentityDraft('')
                                setIdentityOpen(false)
                              }}
                            >
                              选择
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {IDENTITY_OPTIONS.map((x) => {
                        const active = data.identity === x
                        return (
                          <button
                            key={x}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            style={{ color: active ? '#000000' : '#666666', background: active ? '#f5f5f5' : 'transparent' }}
                            onClick={() => {
                              setField('identity', x)
                              setIdentityOpen(false)
                            }}
                          >
                            <span>{x}</span>
                          </button>
                        )
                      })}
                    </InlineDropdown>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    兴趣爱好（多选）
                  </span>
                  <div className="mt-2">
                    <InlineDropdown
                      label="兴趣爱好"
                      valueText={(data.interests ?? []).length ? `${(data.interests ?? []).length} 项已选` : '请选择兴趣爱好'}
                      open={interestsOpen}
                      onToggle={() => {
                        setInterestsOpen((v) => !v)
                        setMbtiOpen(false)
                        setMonthOpen(false)
                        setDayOpen(false)
                        setIdentityOpen(false)
                        setPainOpen(false)
                      }}
                    >
                      <div className="px-3 py-2">
                        <button
                          type="button"
                          className="w-full rounded-lg border px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                          style={{ borderColor: '#e5e5e5', color: '#000000' }}
                          onClick={() => setCustomInterestOpen((v) => !v)}
                        >
                          自定义编辑
                        </button>
                        {customInterestOpen ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              value={customInterestDraft}
                              onChange={(e) => setCustomInterestDraft(e.target.value)}
                              placeholder="输入自定义兴趣"
                              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none"
                              style={{ borderColor: '#e5e5e5', color: '#000000' }}
                            />
                            <button
                              type="button"
                              className="rounded-lg bg-black px-3 py-2 text-[12px] text-white"
                              onClick={() => {
                                const v = customInterestDraft.trim()
                                if (!v) return
                                const set = new Set([...(data.interests ?? []), v])
                                setField('interests', Array.from(set))
                                setCustomInterestDraft('')
                              }}
                            >
                              添加
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {customInterestOptions.length ? (
                        <>
                          {customInterestOptions.map((x) => {
                            const selected = (data.interests ?? []).includes(x)
                            return (
                              <button
                                key={`custom-interest-${x}`}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                                style={{ color: selected ? '#000000' : '#666666', background: selected ? '#f5f5f5' : 'transparent' }}
                                onClick={() => {
                                  const base = data.interests ?? []
                                  const next = selected ? base.filter((i) => i !== x) : [...base, x]
                                  setField('interests', next)
                                }}
                              >
                                <span>{x}</span>
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded-full border"
                                  style={{ borderColor: selected ? '#000000' : '#e5e5e5', background: selected ? '#000000' : '#ffffff' }}
                                  aria-hidden
                                >
                                  {selected ? <Check className="size-3" color="#ffffff" strokeWidth={2.5} /> : null}
                                </span>
                              </button>
                            )
                          })}
                          <div className="my-1 h-px bg-black/5" />
                        </>
                      ) : null}
                      {INTEREST_OPTIONS.map((x) => {
                        const selected = (data.interests ?? []).includes(x)
                        return (
                          <button
                            key={x}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            style={{ color: selected ? '#000000' : '#666666', background: selected ? '#f5f5f5' : 'transparent' }}
                            onClick={() => {
                              const base = data.interests ?? []
                              const next = selected ? base.filter((i) => i !== x) : [...base, x]
                              setField('interests', next)
                            }}
                          >
                            <span>{x}</span>
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-full border"
                              style={{ borderColor: selected ? '#000000' : '#e5e5e5', background: selected ? '#000000' : '#ffffff' }}
                              aria-hidden
                            >
                              {selected ? <Check className="size-3" color="#ffffff" strokeWidth={2.5} /> : null}
                            </span>
                          </button>
                        )
                      })}
                    </InlineDropdown>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[12px]" style={{ color: COLORS.sub }}>
                    雷点（多选）
                  </span>
                  <div className="mt-2">
                    <InlineDropdown
                      label="雷点"
                      valueText={(data.painPoints ?? []).length ? `${(data.painPoints ?? []).length} 项已选` : '请选择雷点'}
                      open={painOpen}
                      onToggle={() => {
                        setPainOpen((v) => !v)
                        setMbtiOpen(false)
                        setMonthOpen(false)
                        setDayOpen(false)
                        setIdentityOpen(false)
                        setInterestsOpen(false)
                      }}
                    >
                      <div className="px-3 py-2">
                        <button
                          type="button"
                          className="w-full rounded-lg border px-3 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                          style={{ borderColor: '#e5e5e5', color: '#000000' }}
                          onClick={() => setCustomPainOpen((v) => !v)}
                        >
                          自定义编辑
                        </button>
                        {customPainOpen ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              value={customPainDraft}
                              onChange={(e) => setCustomPainDraft(e.target.value)}
                              placeholder="输入自定义雷点"
                              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none"
                              style={{ borderColor: '#e5e5e5', color: '#000000' }}
                            />
                            <button
                              type="button"
                              className="rounded-lg bg-black px-3 py-2 text-[12px] text-white"
                              onClick={() => {
                                const v = customPainDraft.trim()
                                if (!v) return
                                const set = new Set([...(data.painPoints ?? []), v])
                                setField('painPoints', Array.from(set))
                                setCustomPainDraft('')
                              }}
                            >
                              添加
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {customPainOptions.length ? (
                        <>
                          {customPainOptions.map((x) => {
                            const selected = (data.painPoints ?? []).includes(x)
                            return (
                              <button
                                key={`custom-pain-${x}`}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                                style={{ color: selected ? '#000000' : '#666666', background: selected ? '#f5f5f5' : 'transparent' }}
                                onClick={() => {
                                  const base = data.painPoints ?? []
                                  const next = selected ? base.filter((i) => i !== x) : [...base, x]
                                  setField('painPoints', next)
                                }}
                              >
                                <span>{x}</span>
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded-full border"
                                  style={{ borderColor: selected ? '#000000' : '#e5e5e5', background: selected ? '#000000' : '#ffffff' }}
                                  aria-hidden
                                >
                                  {selected ? <Check className="size-3" color="#ffffff" strokeWidth={2.5} /> : null}
                                </span>
                              </button>
                            )
                          })}
                          <div className="my-1 h-px bg-black/5" />
                        </>
                      ) : null}
                      {PAIN_OPTIONS.map((x) => {
                        const selected = (data.painPoints ?? []).includes(x)
                        return (
                          <button
                            key={x}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            style={{ color: selected ? '#000000' : '#666666', background: selected ? '#f5f5f5' : 'transparent' }}
                            onClick={() => {
                              const base = data.painPoints ?? []
                              const next = selected ? base.filter((i) => i !== x) : [...base, x]
                              setField('painPoints', next)
                            }}
                          >
                            <span>{x}</span>
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-full border"
                              style={{ borderColor: selected ? '#000000' : '#e5e5e5', background: selected ? '#000000' : '#ffffff' }}
                              aria-hidden
                            >
                              {selected ? <Check className="size-3" color="#ffffff" strokeWidth={2.5} /> : null}
                            </span>
                          </button>
                        )
                      })}
                    </InlineDropdown>
                  </div>
                </label>
            </div>
          </Card>
          ) : null}

          {editTab === 'schedule' ? (
          <Card>
            <div className="border-b px-5 py-4" style={{ borderColor: COLORS.border }}>
              <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
                日程表
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: COLORS.sub, fontWeight: 300 }}>
                保存后会自动加入 AI 回复参考（与长期记忆同优先级）。
              </p>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]" style={{ color: COLORS.text }}>
                    {data.schedule?.name?.trim() || '未设置'}
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: COLORS.faint }}>
                    {data.schedule
                      ? `表头 ${data.schedule.headers.length} 列 · ${data.schedule.rows.length} 行`
                      : '点击编辑，选择模板或自定义创建'}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-[12px] border bg-white px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
                  style={{ borderColor: COLORS.border, color: COLORS.text }}
                  onClick={() => setScheduleOpen(true)}
                >
                  编辑
                </button>
              </div>
            </div>
          </Card>
          ) : null}

          {editTab === 'worldbook' ? (
          <WorldBooksEditor
            apiConfig={apiConfig}
            character={data}
            forPlayerIdentity
            worldBackgroundPrompt={identityWbPrompt}
            onChange={(next) => {
              setDirty(true)
              setData(next)
            }}
          />
          ) : null}

          {editTab === 'bindings' ? (
          <Card>
            <div className="border-b px-5 py-4" style={{ borderColor: COLORS.border }}>
              <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
                绑定的人脉关系
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="text-[14px] leading-relaxed" style={{ color: COLORS.faint }}>
                包含关系表中的身份绑定、角色上已选身份，以及你在「跨角色关系与身份绑定」中建立的关联；删除角色后对应项会消失。
              </p>

              {bindingDetails.length === 0 ? (
                <p className="mt-4 text-center text-[14px]" style={{ color: COLORS.faint }}>
                  暂无绑定的人脉关系
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-[12px] border" style={{ borderColor: COLORS.border }}>
                  {bindingDetails.map((item, idx) => {
                    return (
                      <div key={item.otherId} className="px-3 py-3" style={{ borderTop: idx === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: COLORS.border }}>
                            {item.otherAvatarUrl ? (
                              <img src={item.otherAvatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-white">
                                <User className="size-5" color={COLORS.faint} strokeWidth={1.6} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-[16px]" style={{ color: COLORS.text }}>
                              {item.otherName}
                            </p>
                            <p className="mt-0.5 truncate text-[13px]" style={{ color: COLORS.sub }}>
                              {item.relationYouToThem || '点击编辑关系标签'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            onClick={() =>
                              setEditingBinding({
                                relationId: item.relationId,
                                otherId: item.otherId,
                                rootCharacterId: item.mainCharacterId || item.otherId,
                                relationYouToThem: item.relationYouToThem,
                              })
                            }
                            aria-label="编辑看法态度"
                          >
                            <Edit className="size-4" color={COLORS.sub} strokeWidth={1.75} />
                          </button>
                        </div>
                        {item.isNpc ? (
                          <div className="mt-2 flex items-center gap-2 pl-[52px]">
                            <span className="text-[12px]" style={{ color: COLORS.faint }}>
                              所属主角
                            </span>
                            <div className="flex min-w-0 items-center gap-2 rounded-[10px] border px-2 py-1" style={{ borderColor: COLORS.border }}>
                              <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: COLORS.border }}>
                                {item.mainCharacterAvatarUrl ? (
                                  <img src={item.mainCharacterAvatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-white">
                                    <User className="size-3.5" color={COLORS.faint} strokeWidth={1.7} />
                                  </div>
                                )}
                              </div>
                              <span className="truncate text-[12px]" style={{ color: COLORS.sub }}>
                                {item.mainCharacterName || '未找到主角色'}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
          ) : null}
        </div>
      </div>

      <ScheduleEditorScreen
        open={scheduleOpen}
        title="日程表"
        apiConfig={apiConfig}
        initial={(data.schedule as ScheduleTable | undefined) ?? null}
        onClose={() => setScheduleOpen(false)}
        onSave={async (next) => {
          const merged: PlayerIdentity = { ...data, schedule: next, updatedAt: Date.now() }
          setData(merged)
          setDirty(true)
          await personaDb.upsertPlayerIdentity(merged)
        }}
      />
      {!loaded ? null : null}
      {confirmLeave ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[400px] rounded-[16px] bg-white p-5">
            <p className="text-center text-[16px] font-semibold" style={{ color: COLORS.text }}>
              放弃未保存修改？
            </p>
            <p className="mt-2 text-center text-[14px]" style={{ color: COLORS.sub }}>
              当前修改尚未保存，返回后将丢失。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="flex-1 rounded-[12px] border bg-white px-4 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLeave(false)
                  onBack()
                }}
                className="flex-1 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: '#000000' }}
              >
                放弃返回
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editingBinding ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[420px] rounded-[16px] bg-white p-5">
            <p className="text-center text-[16px] font-semibold" style={{ color: COLORS.text }}>
              编辑关系标签
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <p className="text-[13px]" style={{ color: COLORS.sub }}>
                  关系标签
                </p>
                <input
                  value={editingBinding.relationYouToThem}
                  onChange={(e) => setEditingBinding((prev) => (prev ? { ...prev, relationYouToThem: e.target.value } : prev))}
                  placeholder="例如：朋友 / 合作对象 / 需保持距离"
                  className="mt-2 w-full rounded-[12px] border bg-white px-3 py-2 text-[14px] outline-none transition-all duration-200 ease-out"
                  style={{ borderColor: COLORS.border, color: COLORS.text }}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingBinding(null)}
                className="flex-1 rounded-[12px] border bg-white px-4 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveBindingView()}
                className="flex-1 rounded-[12px] bg-black px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PlayerIdentityApp

