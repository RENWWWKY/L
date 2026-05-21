import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { personaDb } from './idb'
import { loadAccountsBundle } from '../wechatAccountPersistence'
import { useWechatStore } from '../useWechatStore'
import { stampWechatAccountOwner } from '../wechatAccountScope'
import { mergeCharacterPlayerIdentityLink, preserveCharacterBoundPlayerIdentity } from '../wechatCharacterPlayerIdentity'
import type { Character, PlayerIdentity, Relationship } from './types'
import { uid } from './utils'

const bg = '#fafafa'
const card = '#ffffff'
const text = '#262626'
const sub = '#8e8e8e'
const border = '#dbdbdb'

function MiniDropdown({
  label,
  valueText,
  open,
  onToggle,
  children,
}: {
  label: string
  valueText: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        className="relative flex w-full items-center justify-center gap-1 rounded-xl border bg-white px-3 py-3 text-[14px] outline-none transition-all duration-200 ease-out"
        style={{ borderColor: border, color: text }}
        onClick={onToggle}
        aria-label={label}
      >
        <span className="pointer-events-none select-none truncate text-center">{valueText}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 transition-transform duration-200 ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          style={{ color: sub }}
        />
      </button>
      <div
        className={`absolute inset-x-0 top-full z-20 mt-1 origin-top rounded-2xl border bg-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-[opacity,transform,max-height] duration-200 ease-out ${
          open ? 'opacity-100 translate-y-0 max-h-64' : 'pointer-events-none opacity-0 -translate-y-1 max-h-0'
        }`}
        style={{ borderColor: border, overflow: 'hidden' }}
      >
        <div className="max-h-64 overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">{children}</div>
      </div>
    </div>
  )
}

type Tab = 'cross' | 'identity'

export function PersonaBindingsManager({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [tab, setTab] = useState<Tab>('cross')
  const [roots, setRoots] = useState<Character[]>([])
  const [identities, setIdentities] = useState<PlayerIdentity[]>([])
  const [allRels, setAllRels] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)

  const [ddCrossFrom, setDdCrossFrom] = useState(false)
  const [ddCrossTo, setDdCrossTo] = useState(false)
  const [ddId, setDdId] = useState(false)
  const [ddChar, setDdChar] = useState(false)

  const [crossFrom, setCrossFrom] = useState('')
  const [crossTo, setCrossTo] = useState('')
  const [crossRel, setCrossRel] = useState('')
  const [crossFromSee, setCrossFromSee] = useState('')
  const [crossToSee, setCrossToSee] = useState('')
  const [crossFromCallsTo, setCrossFromCallsTo] = useState('')

  const [bindIdentityId, setBindIdentityId] = useState('')
  const [bindCharId, setBindCharId] = useState('')
  const { currentAccountId } = useWechatStore()

  const load = useCallback(async () => {
    setLoading(true)
    const acc = currentAccountId?.trim()
    const bundle = await loadAccountsBundle()
    const linked =
      bundle?.accounts.find((a) => a.accountId === acc)?.personaContacts.map((c) => c.characterId) ?? []
    const [r, idents, rels] = await Promise.all([
      acc ? personaDb.listRootCharactersAccessibleToWechatAccount(acc, linked) : Promise.resolve([]),
      personaDb.listPlayerIdentities(acc ?? undefined),
      personaDb.listAllRelationships(),
    ])
    setRoots(r)
    setIdentities(idents)
    setAllRels(rels)
    const cur = await personaDb.getCurrentIdentityId()
    setBindIdentityId((prev) => {
      if (prev && idents.some((i) => i.id === prev)) return prev
      if (cur && idents.some((i) => i.id === cur)) return cur
      return idents[0]?.id ?? ''
    })
    setLoading(false)
  }, [currentAccountId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setBindCharId((prev) => {
      if (prev && roots.some((c) => c.id === prev)) return prev
      return roots[0]?.id ?? ''
    })
  }, [roots])

  const rootIdSet = useMemo(() => new Set(roots.map((c) => c.id)), [roots])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of roots) m.set(c.id, (c.name || '未命名').trim() || '未命名')
    for (const i of identities) m.set(i.id, (i.name || '未命名').trim() || '未命名')
    return m
  }, [roots, identities])

  const crossRootRels = useMemo(() => {
    return allRels.filter(
      (r) =>
        !r.isPlayerIdentity &&
        rootIdSet.has(r.fromCharacterId) &&
        rootIdSet.has(r.toCharacterId) &&
        r.fromCharacterId !== r.toCharacterId,
    )
  }, [allRels, rootIdSet])

  const identityBindings = useMemo(() => {
    if (!bindIdentityId) return [] as { characterId: string }[]
    const out: { characterId: string }[] = []
    const seen = new Set<string>()
    for (const r of allRels) {
      if (!r.isPlayerIdentity) continue
      if (r.fromCharacterId !== bindIdentityId && r.toCharacterId !== bindIdentityId) continue
      const other = r.fromCharacterId === bindIdentityId ? r.toCharacterId : r.fromCharacterId
      if (!rootIdSet.has(other) || seen.has(other)) continue
      seen.add(other)
      out.push({ characterId: other })
    }
    return out
  }, [allRels, bindIdentityId, rootIdSet])

  const persistRel = async (r: Relationship) => {
    await personaDb.putRelationship(r)
    await load()
    onSaved()
  }

  const removeRel = async (id: string) => {
    await personaDb.deleteRelationshipById(id)
    await load()
    onSaved()
  }

  const addCrossRel = async () => {
    if (!crossFrom || !crossTo || crossFrom === crossTo) return
    await persistRel({
      id: uid('rel'),
      fromCharacterId: crossFrom,
      toCharacterId: crossTo,
      relation: crossRel.trim(),
      fromPerspective: crossFromSee.trim(),
      toPerspective: crossToSee.trim(),
      fromCallsTo: crossFromCallsTo.trim(),
      isPlayerIdentity: false,
    })
    setCrossRel('')
    setCrossFromSee('')
    setCrossToSee('')
    setCrossFromCallsTo('')
  }

  const bindIdentityToCharacter = async () => {
    if (!bindIdentityId || !bindCharId) return
    const iden = identities.find((i) => i.id === bindIdentityId)
    const ch = roots.find((c) => c.id === bindCharId)
    if (!iden || !ch) return
    await personaDb.upsertPlayerIdentityBindings({
      identityId: bindIdentityId,
      characterId: bindCharId,
      identityName: iden.name || '你',
      characterName: ch.name || '角色',
    })
    const full = await personaDb.getCharacter(bindCharId)
    if (full) {
      const linkAcc =
        iden.wechatAccountId?.trim() || currentAccountId?.trim() || undefined
      const linkPatch = mergeCharacterPlayerIdentityLink(full, bindIdentityId, linkAcc)
      await personaDb.upsertCharacter(
        stampWechatAccountOwner(
          preserveCharacterBoundPlayerIdentity(full, {
            ...full,
            ...linkPatch,
            updatedAt: Date.now(),
          }),
          currentAccountId,
        ),
      )
    }
    await load()
    onSaved()
  }

  const unbindIdentity = async (characterId: string) => {
    if (!bindIdentityId) return
    await personaDb.deletePlayerIdentityBinding(bindIdentityId, characterId)
    const full = await personaDb.getCharacter(characterId)
    if (full?.playerIdentityId === bindIdentityId) {
      await personaDb.upsertCharacter({ ...full, playerIdentityId: undefined, updatedAt: Date.now() })
    }
    await load()
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col" style={{ background: bg }}>
      <div
        className="shrink-0 border-b bg-white px-4"
        style={{ borderColor: border, paddingTop: 'max(10px, env(safe-area-inset-top,0px))', paddingBottom: 10 }}
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-[#fafafa]" aria-label="返回">
            <ArrowLeft className="size-5" style={{ color: text }} />
          </button>
          <p className="flex-1 text-center text-[16px] font-semibold" style={{ color: text }}>
            关系与绑定
          </p>
          <div className="w-9" />
        </div>
      </div>

      <div className="shrink-0 border-b bg-white px-4 py-3" style={{ borderColor: border }}>
        <div className="flex gap-2">
          {(
            [
              { id: 'cross' as const, label: '角色间关系' },
              { id: 'identity' as const, label: '身份与角色' },
            ] as const
          ).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out"
                style={{
                  borderColor: border,
                  background: active ? '#111827' : card,
                  color: active ? '#ffffff' : text,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <p className="text-center text-[13px]" style={{ color: sub }}>
            加载中…
          </p>
        ) : roots.length < 2 && tab === 'cross' ? (
          <p className="rounded-2xl border bg-white px-4 py-4 text-[13px] leading-relaxed" style={{ borderColor: border, color: sub }}>
            至少需要两个已创建的角色，才能添加「角色间」关系。NPC 不在此管理（请在各自主角的人脉里编辑）。
          </p>
        ) : null}

        {!loading && tab === 'cross' && roots.length >= 2 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ borderColor: border }}>
              <p className="text-[14px] font-semibold" style={{ color: text }}>
                新增有向关系
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                仅在「人设列表里的角色」之间建立关系，不含 NPC。与单一人脉图内的关系并存。
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium" style={{ color: sub }}>
                    起点
                  </p>
                  <MiniDropdown
                    label="起点"
                    valueText={crossFrom ? (nameById.get(crossFrom) ?? crossFrom) : '请选择'}
                    open={ddCrossFrom}
                    onToggle={() => {
                      setDdCrossFrom((o) => !o)
                      setDdCrossTo(false)
                    }}
                  >
                    {roots.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                        style={{
                          color: c.id === crossFrom ? '#ffffff' : text,
                          background: c.id === crossFrom ? '#111827' : 'transparent',
                        }}
                        onClick={() => {
                          setCrossFrom(c.id)
                          setDdCrossFrom(false)
                        }}
                      >
                        {c.name || '未命名'}
                      </button>
                    ))}
                  </MiniDropdown>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium" style={{ color: sub }}>
                    终点
                  </p>
                  <MiniDropdown
                    label="终点"
                    valueText={crossTo ? (nameById.get(crossTo) ?? crossTo) : '请选择'}
                    open={ddCrossTo}
                    onToggle={() => {
                      setDdCrossTo((o) => !o)
                      setDdCrossFrom(false)
                    }}
                  >
                    {roots.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                        style={{
                          color: c.id === crossTo ? '#ffffff' : text,
                          background: c.id === crossTo ? '#111827' : 'transparent',
                        }}
                        onClick={() => {
                          setCrossTo(c.id)
                          setDdCrossTo(false)
                        }}
                      >
                        {c.name || '未命名'}
                      </button>
                    ))}
                  </MiniDropdown>
                </div>
              </div>
              <input
                value={crossRel}
                onChange={(e) => setCrossRel(e.target.value)}
                placeholder="关系词（连线中间）"
                className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-[13px] outline-none transition-all duration-200 ease-out"
                style={{ borderColor: border, color: text }}
              />
              <input
                value={crossFromCallsTo}
                onChange={(e) => setCrossFromCallsTo(e.target.value)}
                placeholder="起点如何称呼终点（可选，如：哥、师姐）"
                className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-[13px] outline-none transition-all duration-200 ease-out"
                style={{ borderColor: border, color: text }}
              />
              <textarea
                value={crossFromSee}
                onChange={(e) => setCrossFromSee(e.target.value)}
                placeholder="起点视角"
                rows={2}
                className="mt-2 w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                style={{ borderColor: border, color: text }}
              />
              <textarea
                value={crossToSee}
                onChange={(e) => setCrossToSee(e.target.value)}
                placeholder="终点视角"
                rows={2}
                className="mt-2 w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                style={{ borderColor: border, color: text }}
              />
              <button
                type="button"
                disabled={!crossFrom || !crossTo || crossFrom === crossTo}
                onClick={() => void addCrossRel()}
                className="mt-3 w-full rounded-xl py-3 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-40"
                style={{ background: '#111827' }}
              >
                添加关系
              </button>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ borderColor: border }}>
              <p className="text-[14px] font-semibold" style={{ color: text }}>
                已有关系
              </p>
              <div className="mt-3 space-y-3">
                {crossRootRels.length === 0 ? (
                  <p className="text-[13px]" style={{ color: sub }}>
                    暂无。可在上方添加 A→B 与 B→A 两条独立记录。
                  </p>
                ) : (
                  crossRootRels.map((r) => (
                    <div key={r.id} className="rounded-xl border p-3" style={{ borderColor: border, background: '#fafafa' }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold" style={{ color: text }}>
                          {nameById.get(r.fromCharacterId) ?? r.fromCharacterId}
                          <span style={{ color: sub }}> → </span>
                          {nameById.get(r.toCharacterId) ?? r.toCharacterId}
                        </p>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-2 py-1 text-[12px] transition-all duration-200 ease-out hover:bg-black/[0.04]"
                          style={{ color: sub }}
                          onClick={() => void removeRel(r.id)}
                        >
                          删除
                        </button>
                      </div>
                      <p className="mt-2 text-[12px]" style={{ color: sub }}>
                        「{r.relation || '—'}」
                        {r.fromCallsTo?.trim() ? (
                          <span>
                            {' '}
                            · 称呼：「{r.fromCallsTo.trim()}」
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && tab === 'identity' ? (
          <div className="space-y-4">
            {identities.length === 0 ? (
              <p className="rounded-2xl border bg-white px-4 py-4 text-[13px] leading-relaxed" style={{ borderColor: border, color: sub }}>
                请先在「我的身份」中创建玩家身份，再与角色绑定。
              </p>
            ) : (
              <>
                <div className="rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ borderColor: border }}>
                  <p className="text-[14px] font-semibold" style={{ color: text }}>
                    建立绑定
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: sub, fontWeight: 300 }}>
                    将「我的身份」与已创建角色关联（写入人脉绑定关系，并同步角色上的身份字段）。不含 NPC。
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium" style={{ color: sub }}>
                        玩家身份
                      </p>
                      <MiniDropdown
                        label="身份"
                        valueText={bindIdentityId ? (nameById.get(bindIdentityId) ?? bindIdentityId) : '请选择'}
                        open={ddId}
                        onToggle={() => {
                          setDdId((o) => !o)
                          setDdChar(false)
                        }}
                      >
                        {identities.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            className="flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            style={{
                              color: i.id === bindIdentityId ? '#ffffff' : text,
                              background: i.id === bindIdentityId ? '#111827' : 'transparent',
                            }}
                            onClick={() => {
                              setBindIdentityId(i.id)
                              setDdId(false)
                            }}
                          >
                            {i.name || '未命名'}
                          </button>
                        ))}
                      </MiniDropdown>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium" style={{ color: sub }}>
                        已创建角色
                      </p>
                      <MiniDropdown
                        label="角色"
                        valueText={bindCharId ? (nameById.get(bindCharId) ?? bindCharId) : '请选择'}
                        open={ddChar}
                        onToggle={() => {
                          setDdChar((o) => !o)
                          setDdId(false)
                        }}
                      >
                        {roots.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                            style={{
                              color: c.id === bindCharId ? '#ffffff' : text,
                              background: c.id === bindCharId ? '#111827' : 'transparent',
                            }}
                            onClick={() => {
                              setBindCharId(c.id)
                              setDdChar(false)
                            }}
                          >
                            {c.name || '未命名'}
                          </button>
                        ))}
                      </MiniDropdown>
                    </div>
                    <button
                      type="button"
                      disabled={!bindIdentityId || !bindCharId}
                      onClick={() => void bindIdentityToCharacter()}
                      className="w-full rounded-xl border py-3 text-[13px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa] disabled:opacity-40"
                      style={{ borderColor: '#111827', color: '#111827', background: card }}
                    >
                      建立绑定
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]" style={{ borderColor: border }}>
                  <p className="text-[14px] font-semibold" style={{ color: text }}>
                    当前身份下的绑定
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: sub }}>
                    切换上方「玩家身份」可查看各身份已绑定的角色。
                  </p>
                  <div className="mt-3 space-y-2">
                    {identityBindings.length === 0 ? (
                      <p className="text-[13px]" style={{ color: sub }}>
                        该身份下暂无与根角色的绑定。
                      </p>
                    ) : (
                      identityBindings.map(({ characterId }) => (
                        <div
                          key={characterId}
                          className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
                          style={{ borderColor: border, background: '#fafafa' }}
                        >
                          <p className="min-w-0 truncate text-[13px]" style={{ color: text }}>
                            {nameById.get(bindIdentityId)} ↔ {nameById.get(characterId)}
                          </p>
                          <button
                            type="button"
                            className="shrink-0 text-[12px] transition-all duration-200 ease-out hover:opacity-70"
                            style={{ color: sub }}
                            onClick={() => void unbindIdentity(characterId)}
                          >
                            解除
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
