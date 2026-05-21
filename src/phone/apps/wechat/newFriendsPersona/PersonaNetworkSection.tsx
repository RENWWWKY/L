import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Maximize2,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, PointerEvent } from 'react'
import type { Character, PlayerNetworkLink, Relationship } from './types'
import { useCustomization } from '../../../CustomizationContext'
import { personaDb } from './idb'
import { stampWechatAccountOwner } from '../wechatAccountScope'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import { formatWorldBackgroundForPrompt } from './worldBackgroundFormat'
import { generateNpcNetworkWithAi } from './npcNetworkGenerate'
import { genderLabelZh, uid } from './utils'
import type { ApiConfig } from '../../api/types'

/** 关系偏向：语义去重（职场含同事向、家族含亲属向、宿敌含对立向），避免胶囊列表冗长 */
const REL_BIAS_OPTIONS = ['职场', '家族', '暗恋', '宿敌', '朋友', '同学', '恋人', '陌生人', '合作伙伴'] as const
const REL_BIAS_ALLOWED = new Set<string>(REL_BIAS_OPTIONS as unknown as string[])

const GRAPH_W = 880
const GRAPH_H = Math.round(520 * (2 / 3))

/** 关系图中操作者节点虚拟 id（不对应 Character 表） */
const PLAYER_GRAPH_NODE_ID = '__graph_you__'

/** 手动编辑关系图弹窗：黑白灰排版 */
const GE = {
  overlay: 'rgba(0,0,0,0.5)',
  canvas: '#f5f5f5',
  card: '#ffffff',
  border: '#e5e5e5',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  shadowLg: '0 8px 30px rgba(0,0,0,0.12)',
} as const

/** 与身份页「兴趣爱好」等下拉一致：圆角、阴影、展开/收起动画 */
function GraphEditorInlineDropdown({
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
        className="relative flex w-full min-h-[44px] items-center justify-center gap-1 rounded-[10px] border bg-white px-3 py-2.5 text-[13px] outline-none transition-all duration-200 ease-out"
        style={{ borderColor: GE.border, color: GE.text }}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={label}
      >
        <span className="pointer-events-none max-w-[calc(100%-28px)] select-none truncate text-center">{valueText}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 size-4 shrink-0 -translate-y-1/2 transition-transform duration-200 ease-out ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          style={{ color: GE.sub }}
          strokeWidth={1.75}
        />
      </button>
      <div
        className={`absolute inset-x-0 top-full z-[1220] mt-1 origin-top rounded-2xl border bg-white transition-[opacity,transform,max-height] duration-200 ease-out ${
          open ? 'max-h-72 translate-y-0 opacity-100' : 'pointer-events-none max-h-0 -translate-y-1 opacity-0'
        }`}
        style={{ borderColor: GE.border, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
      >
        <div className="max-h-72 overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </div>
  )
}

function pairFromPlayerLink(link: PlayerNetworkLink): {
  aId: string
  bId: string
  ab: Relationship
  ba: Relationship
} {
  const YOU = PLAYER_GRAPH_NODE_ID
  const c = link.characterId
  const aId = YOU < c ? YOU : c
  const bId = YOU < c ? c : YOU
  const ab: Relationship =
    YOU < c
      ? {
          id: `${link.id}-ab`,
          fromCharacterId: YOU,
          toCharacterId: c,
          relation: link.relationYouToThem,
          fromPerspective: link.youSeeThem,
          toPerspective: link.theySeeYou,
          fromCallsTo: link.youCallThem,
        }
      : {
          id: `${link.id}-ab`,
          fromCharacterId: c,
          toCharacterId: YOU,
          relation: link.relationThemToYou,
          fromPerspective: link.theySeeYou,
          toPerspective: link.youSeeThem,
          fromCallsTo: link.theyCallYou,
        }
  const ba: Relationship =
    YOU < c
      ? {
          id: `${link.id}-ba`,
          fromCharacterId: c,
          toCharacterId: YOU,
          relation: link.relationThemToYou,
          fromPerspective: link.theySeeYou,
          toPerspective: link.youSeeThem,
          fromCallsTo: link.theyCallYou,
        }
      : {
          id: `${link.id}-ba`,
          fromCharacterId: YOU,
          toCharacterId: c,
          relation: link.relationYouToThem,
          fromPerspective: link.youSeeThem,
          toPerspective: link.theySeeYou,
          fromCallsTo: link.youCallThem,
        }
  return { aId, bId, ab, ba }
}

function ringRForGraphHeight(graphH: number) {
  return Math.min(230, Math.max(100, Math.floor(graphH / 2 - 44)))
}

/** 轻量力导向：在径向初值上推开节点，减轻拥挤（不引入 d3 依赖） */
function refineLayoutWithForces(
  layout: Record<string, { x: number; y: number }>,
  allIds: string[],
  focalId: string,
  graphW: number,
  graphH: number,
  ringR: number,
  steps: number,
): Record<string, { x: number; y: number }> {
  const cx = graphW / 2
  const cy = graphH / 2
  const pos: Record<string, { x: number; y: number }> = { ...layout }
  const minNodeDist = 82
  for (let s = 0; s < steps; s++) {
    const f: Record<string, { dx: number; dy: number }> = {}
    for (const id of allIds) f[id] = { dx: 0, dy: 0 }
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        const ia = allIds[i]
        const ib = allIds[j]
        const pa = pos[ia]
        const pb = pos[ib]
        if (!pa || !pb) continue
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const dist = Math.hypot(dx, dy) || 0.001
        if (dist < minNodeDist) {
          const push = ((minNodeDist - dist) / dist) * 0.45
          f[ia].dx -= dx * push
          f[ia].dy -= dy * push
          f[ib].dx += dx * push
          f[ib].dy += dy * push
        }
      }
    }
    for (const id of allIds) {
      const p = pos[id]
      if (!p) continue
      if (id === focalId) {
        f[id].dx += (cx - p.x) * 0.14
        f[id].dy += (cy - p.y) * 0.14
      } else if (id !== PLAYER_GRAPH_NODE_ID) {
        const dx = p.x - cx
        const dy = p.y - cy
        const dist = Math.hypot(dx, dy) || 0.001
        const target = ringR * (0.9 + (s / Math.max(steps, 1)) * 0.1)
        const pull = (dist - target) * 0.065
        f[id].dx -= (dx / dist) * pull
        f[id].dy -= (dy / dist) * pull
      }
    }
    for (const id of allIds) {
      const p = pos[id]
      if (!p) continue
      pos[id] = { x: p.x + f[id].dx, y: p.y + f[id].dy }
    }
  }
  return pos
}

/** 与主角编辑页「新建角色」一致的空白卡，并标记为当前主角下的 NPC */
function newBlankNpcForMain(main: Character): Character {
  const now = Date.now()
  return {
    id: uid('ch'),
    createdAt: now,
    updatedAt: now,
    name: '',
    gender: 'female',
    age: null,
    birthdayMD: '',
    zodiac: '',
    identity: '学生',
    mbti: '',
    bio: '',
    avatarUrl: '',
    worldBooks: [],
    generatedForCharacterId: main.id,
    playerIdentityId: main.playerIdentityId,
    wechatAccountId: main.wechatAccountId,
    worldBackgroundId: main.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID,
  }
}

function computeRadialLayout(
  focalId: string,
  allIds: string[],
  graphW: number,
  graphH: number,
  ringR: number,
): Record<string, { x: number; y: number }> {
  const cx = graphW / 2
  const cy = graphH / 2
  const others = allIds.filter((id) => id !== focalId).sort()
  const next: Record<string, { x: number; y: number }> = {}
  next[focalId] = { x: cx, y: cy }
  others.forEach((id, i) => {
    const ang = (i / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2
    next[id] = { x: cx + ringR * Math.cos(ang), y: cy + ringR * Math.sin(ang) }
  })
  return next
}

function positionsMatchNetwork(
  positions: Record<string, { x: number; y: number }>,
  allIds: string[],
): boolean {
  if (allIds.length === 0) return false
  for (const id of allIds) {
    const p = positions[id]
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return false
  }
  return true
}

function centerPanForFocal(focalX: number, focalY: number, viewW: number, viewH: number, s: number) {
  return { x: viewW / 2 - focalX * s, y: viewH / 2 - focalY * s }
}

type Props = {
  main: Character
  apiConfig: ApiConfig | null
  onApiMissing: () => void
  /** 第二个参数为草稿时：仅打开编辑页，不写入 IndexedDB，直至用户点击保存 */
  onOpenNpcEdit: (npcId: string, draft?: Character) => void
}

export function PersonaNetworkSection({ main, apiConfig, onApiMissing, onOpenNpcEdit }: Props) {
  const { state } = useCustomization()
  const linkedCharacterIds = useMemo(
    () => state.wechatPersonaContacts.map((c) => c.characterId.trim()).filter(Boolean),
    [state.wechatPersonaContacts],
  )
  const playerAvatarUrl = state.profile.avatarImageUrl || ''
  /** 用字符串承载输入，避免 number 受控时删空/删个位被强制成 0 */
  const [countInput, setCountInput] = useState('3')
  const [biases, setBiases] = useState<string[]>([])
  const [customNote, setCustomNote] = useState('')
  const [expandedAccordion, setExpandedAccordion] = useState<null | 'ai' | 'manual'>(null)
  const [graphFullscreenOpen, setGraphFullscreenOpen] = useState(false)
  const [graphResetSignal, setGraphResetSignal] = useState(0)
  const [manualSheetOpen, setManualSheetOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualRelation, setManualRelation] = useState('')
  const [rosterExpandedId, setRosterExpandedId] = useState<string | null>(null)
  const [npcs, setNpcs] = useState<Character[]>([])
  /** 与当前主角存在跨人设连线的其他根角色（非 NPC） */
  const [linkedRoots, setLinkedRoots] = useState<Character[]>([])
  const [rels, setRels] = useState<Relationship[]>([])
  const [playerLinks, setPlayerLinks] = useState<PlayerNetworkLink[]>([])
  const [generating, setGenerating] = useState(false)
  const [graphEditorOpen, setGraphEditorOpen] = useState(false)
  const [draftRels, setDraftRels] = useState<Relationship[]>([])
  const [draftPlayerLinks, setDraftPlayerLinks] = useState<PlayerNetworkLink[]>([])
  const [relIdsOnOpen, setRelIdsOnOpen] = useState<Set<string>>(new Set())
  const [graphEditorSaving, setGraphEditorSaving] = useState(false)
  /** 手动关系图：默认只读展示，点「编辑」后展开该条的表单 */
  const [editingGraphPlayerLinkId, setEditingGraphPlayerLinkId] = useState<string | null>(null)
  const [editingGraphRelId, setEditingGraphRelId] = useState<string | null>(null)
  /** 画布点击边线弹窗：先只读再编辑 */
  const [edgePlayerFormUnlocked, setEdgePlayerFormUnlocked] = useState(false)
  const [edgeCharFormUnlocked, setEdgeCharFormUnlocked] = useState(false)
  const [newRelFrom, setNewRelFrom] = useState('')
  const [newRelTo, setNewRelTo] = useState('')
  const [newRelRelation, setNewRelRelation] = useState('')
  const [newRelFromSee, setNewRelFromSee] = useState('')
  const [newRelToSee, setNewRelToSee] = useState('')
  const [newRelFromCallsTo, setNewRelFromCallsTo] = useState('')
  const [newPlCharId, setNewPlCharId] = useState('')
  const [graphDdOpen, setGraphDdOpen] = useState<null | 'plChar' | 'relFrom' | 'relTo'>(null)
  /** 手动编辑关系图：你与角色 | 角色与 NPC（有向关系） */
  const [graphEditorTab, setGraphEditorTab] = useState<'you' | 'between'>('you')
  type EdgeDetail = {
    aId: string
    bId: string
    ab?: Relationship
    ba?: Relationship
  }
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null)
  const [draftYouRel, setDraftYouRel] = useState('')
  const [draftYouSee, setDraftYouSee] = useState('')
  const [draftTheyCallYou, setDraftTheyCallYou] = useState('')
  const [draftYouCallThem, setDraftYouCallThem] = useState('')
  const [draftTheySeeYou, setDraftTheySeeYou] = useState('')
  const [draftThemRel, setDraftThemRel] = useState('')
  const [savingPlayerView, setSavingPlayerView] = useState(false)
  /** 画布点击「角色↔角色」边后在弹窗内编辑，与手动关系图一致、无额外限制 */
  type CharRelDraft = {
    id: string
    relation: string
    fromCallsTo: string
    fromPerspective: string
    toPerspective: string
  }
  const [draftCharAb, setDraftCharAb] = useState<CharRelDraft | null>(null)
  const [draftCharBa, setDraftCharBa] = useState<CharRelDraft | null>(null)
  const [savingCharEdge, setSavingCharEdge] = useState(false)

  const playerLinkCharIdForModal = useMemo(() => {
    if (!edgeDetail) return null
    const { aId, bId } = edgeDetail
    if (aId !== PLAYER_GRAPH_NODE_ID && bId !== PLAYER_GRAPH_NODE_ID) return null
    return aId === PLAYER_GRAPH_NODE_ID ? bId : aId
  }, [edgeDetail])

  useEffect(() => {
    setEdgePlayerFormUnlocked(false)
    setEdgeCharFormUnlocked(false)
  }, [edgeDetail])

  useEffect(() => {
    if (!playerLinkCharIdForModal) return
    const link = playerLinks.find((l) => l.characterId === playerLinkCharIdForModal)
    if (link) {
      setDraftYouRel(link.relationYouToThem)
      setDraftYouSee(link.youSeeThem)
      setDraftTheyCallYou(link.theyCallYou)
      setDraftYouCallThem(link.youCallThem)
      setDraftTheySeeYou(link.theySeeYou)
      setDraftThemRel(link.relationThemToYou)
    }
  }, [playerLinkCharIdForModal, playerLinks])

  useEffect(() => {
    if (!edgeDetail) {
      setDraftCharAb(null)
      setDraftCharBa(null)
      return
    }
    if (playerLinkCharIdForModal) {
      setDraftCharAb(null)
      setDraftCharBa(null)
      return
    }
    const pack = (r?: Relationship): CharRelDraft | null =>
      r && r.id
        ? {
            id: r.id,
            relation: r.relation,
            fromCallsTo: r.fromCallsTo ?? '',
            fromPerspective: r.fromPerspective,
            toPerspective: r.toPerspective,
          }
        : null
    setDraftCharAb(pack(edgeDetail.ab))
    setDraftCharBa(pack(edgeDetail.ba))
  }, [edgeDetail, playerLinkCharIdForModal])

  const reload = useCallback(async () => {
    const acc = main.wechatAccountId?.trim()
    const list = acc
      ? await personaDb.listNpcsForAccessibleRoot(main.id, acc, linkedCharacterIds)
      : await personaDb.listNpcsFor(main.id)
    const allRoots = acc ? await personaDb.listRootCharactersAccessibleToWechatAccount(acc, linkedCharacterIds) : []
    const rootIdSet = new Set(allRoots.map((c) => c.id))
    const allRelsFull = await personaDb.listAllRelationships()
    const linkedRootIds = new Set<string>()
    for (const rel of allRelsFull) {
      if (rel.isPlayerIdentity) continue
      const a = rel.fromCharacterId
      const b = rel.toCharacterId
      if (!a || !b || a === b) continue
      if (a === main.id && rootIdSet.has(b) && b !== main.id) linkedRootIds.add(b)
      else if (b === main.id && rootIdSet.has(a) && a !== main.id) linkedRootIds.add(a)
    }
    const linked = allRoots.filter((c) => linkedRootIds.has(c.id))
    const ids = [main.id, ...list.map((n) => n.id), ...linked.map((x) => x.id)]
    const r = await personaDb.listRelationshipsInNetwork(ids)
    const pl = await personaDb.getPlayerNetworkLinks(main.id)
    setNpcs(list)
    setLinkedRoots(linked)
    setRels(r)
    setPlayerLinks(pl.filter((l) => ids.includes(l.characterId)))
  }, [linkedCharacterIds, main.id, main.wechatAccountId])

  useEffect(() => {
    void reload()
  }, [reload])

  /** 去掉已从选项表移除的旧标签，避免状态里残留无效偏向 */
  useEffect(() => {
    setBiases((prev) => prev.filter((b) => REL_BIAS_ALLOWED.has(b)))
  }, [main.id])

  const characterIdToName = useMemo(() => {
    const m = new Map<string, string>()
    m.set(PLAYER_GRAPH_NODE_ID, '你')
    m.set(main.id, (main.name || '未命名').trim() || '未命名')
    for (const n of npcs) m.set(n.id, (n.name || '未命名').trim() || '未命名')
    for (const lr of linkedRoots) m.set(lr.id, (lr.name || '未命名').trim() || '未命名')
    return m
  }, [main.id, main.name, npcs, linkedRoots])

  const networkCharIds = useMemo(
    () => [main.id, ...npcs.map((n) => n.id), ...linkedRoots.map((x) => x.id)],
    [main.id, npcs, linkedRoots],
  )

  const availPlCharIds = useMemo(
    () => networkCharIds.filter((id) => !draftPlayerLinks.some((l) => l.characterId === id)),
    [networkCharIds, draftPlayerLinks],
  )

  /** 删除「你」的连线后，原 select 的 value 可能仍指向已有连线的角色，导致无匹配 option、无法添加；此处始终同步到可选列表 */
  useEffect(() => {
    if (!graphEditorOpen) {
      setGraphDdOpen(null)
      return
    }
    setNewPlCharId((prev) => {
      const avail = networkCharIds.filter((id) => !draftPlayerLinks.some((l) => l.characterId === id))
      if (avail.length === 0) return ''
      if (prev && avail.includes(prev)) return prev
      return avail[0]
    })
  }, [graphEditorOpen, draftPlayerLinks, networkCharIds])

  const relMap = useMemo(() => {
    const m = new Map<string, Relationship>()
    for (const r of rels) m.set(`${r.fromCharacterId}::${r.toCharacterId}`, r)
    return m
  }, [rels])

  const [graphFocalId, setGraphFocalId] = useState(main.id)

  useEffect(() => {
    setGraphFocalId(main.id)
  }, [main.id])

  useEffect(() => {
    const ids = [main.id, ...npcs.map((n) => n.id)]
    if (!ids.includes(graphFocalId)) setGraphFocalId(main.id)
  }, [main.id, npcs, graphFocalId])

  const toggleBias = (b: string) => {
    setBiases((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
  }

  const clearOldNpcs = async () => {
    const old = await personaDb.listNpcsFor(main.id)
    for (const n of old) {
      await personaDb.deleteCharacterNpcOnly(n.id)
    }
    await personaDb.putPlayerNetworkLinks(main.id, [])
  }

  const onGenerate = async () => {
    if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
      onApiMissing()
      return
    }
    const parsed = parseInt(countInput.replace(/\D/g, ''), 10)
    const n = Math.max(1, Math.min(10, Number.isFinite(parsed) ? parsed : 3))
    setGenerating(true)
    try {
      const playerIdentity =
        main.playerIdentityId && main.playerIdentityId.trim()
          ? await personaDb.getPlayerIdentity(main.playerIdentityId)
          : await personaDb.getCurrentIdentity()
      const wbgRow = await personaDb.getWorldBackground(main.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID)
      const worldBackgroundSummary = formatWorldBackgroundForPrompt(wbgRow)
      await clearOldNpcs()
      const { characters, relationships, playerLinks: nextPl } = await generateNpcNetworkWithAi(apiConfig, {
        main,
        playerIdentity,
        count: n,
        relationBiases: biases.filter((b) => REL_BIAS_ALLOWED.has(b)),
        customNote,
        worldBackgroundSummary,
      })
      const acc = main.wechatAccountId?.trim()
      for (const c of characters) {
        await personaDb.upsertCharacter(acc ? stampWechatAccountOwner(c, acc) : c)
      }
      await personaDb.bulkPutRelationships(relationships)
      await personaDb.putPlayerNetworkLinks(main.id, nextPl)
      if (main.playerIdentityId?.trim()) {
        const identity = await personaDb.getPlayerIdentity(main.playerIdentityId)
        for (const npc of characters) {
          await personaDb.upsertPlayerIdentityBindings({
            identityId: main.playerIdentityId,
            characterId: npc.id,
            identityName: identity?.name || '你',
            characterName: npc.name || '角色',
          })
        }
      }
      await reload()
    } finally {
      setGenerating(false)
    }
  }

  const onDeleteNpc = async (npcId: string) => {
    await personaDb.deleteCharacterNpcOnly(npcId)
    await reload()
  }

  const openGraphEditor = () => {
    setDraftRels(rels.map((r) => ({ ...r })))
    setDraftPlayerLinks(playerLinks.map((l) => ({ ...l })))
    setRelIdsOnOpen(new Set(rels.map((r) => r.id)))
    setNewRelFrom(main.id)
    setNewRelTo(npcs[0]?.id ?? linkedRoots[0]?.id ?? main.id)
    setNewRelRelation('')
    setNewRelFromSee('')
    setNewRelToSee('')
    setNewRelFromCallsTo('')
    setGraphEditorTab('you')
    setEditingGraphPlayerLinkId(null)
    setEditingGraphRelId(null)
    setGraphEditorOpen(true)
  }

  const saveGraphEditor = async () => {
    setGraphEditorSaving(true)
    try {
      for (const id of relIdsOnOpen) {
        if (!draftRels.some((r) => r.id === id)) {
          await personaDb.deleteRelationshipById(id)
        }
      }
      await personaDb.bulkPutRelationships(draftRels.map((r) => ({ ...r, isPlayerIdentity: r.isPlayerIdentity ?? false })))
      await personaDb.putPlayerNetworkLinks(main.id, draftPlayerLinks)
      await reload()
      setEditingGraphPlayerLinkId(null)
      setEditingGraphRelId(null)
      setGraphEditorOpen(false)
    } finally {
      setGraphEditorSaving(false)
    }
  }

  const onManualAddNpc = () => {
    const npc = newBlankNpcForMain(main)
    onOpenNpcEdit(npc.id, npc)
  }

  const countSliderValue = Math.max(1, Math.min(10, parseInt(countInput.replace(/\D/g, ''), 10) || 3))

  const submitManualSheet = async () => {
    const name = manualName.trim()
    if (!name) {
      window.alert('请填写姓名')
      return
    }
    const npc = newBlankNpcForMain(main)
    npc.name = name
    await personaDb.upsertCharacter(npc)
    const rel = manualRelation.trim()
    if (rel) {
      const nextLink: PlayerNetworkLink = {
        id: uid('pnl'),
        characterId: npc.id,
        relationYouToThem: rel,
        relationThemToYou: '',
        youSeeThem: '',
        theySeeYou: '',
        youCallThem: '',
        theyCallYou: '',
      }
      await personaDb.putPlayerNetworkLinks(main.id, [...playerLinks, nextLink])
    }
    await reload()
    setManualSheetOpen(false)
    setManualName('')
    setManualRelation('')
    onOpenNpcEdit(npc.id)
  }

  const focalDisplayName =
    [main, ...npcs, ...linkedRoots].find((n) => n.id === graphFocalId)?.name?.trim() || '—'

  return (
    <>
    <div className="space-y-8">
      <section className="relative">
        <div className="relative overflow-hidden rounded-2xl border border-neutral-100/90 bg-gray-50/50">
          {!graphFullscreenOpen ? (
            <RelationshipGraph
              rootMainId={main.id}
              focalId={graphFocalId}
              onFocalChange={setGraphFocalId}
              main={main}
              npcs={npcs}
              linkedRoots={linkedRoots}
              rels={rels}
              playerLinks={playerLinks}
              playerAvatarUrl={playerAvatarUrl}
              resetSignal={graphResetSignal}
              visualPreset="platinum"
              dashboardChrome={false}
              onNodeDblClick={(id) => {
                if (id === PLAYER_GRAPH_NODE_ID) return
                if (id !== main.id) onOpenNpcEdit(id)
              }}
              onEdgeClick={(aId, bId) => {
                let ab = relMap.get(`${aId}::${bId}`)
                let ba = relMap.get(`${bId}::${aId}`)
                if (aId === PLAYER_GRAPH_NODE_ID || bId === PLAYER_GRAPH_NODE_ID) {
                  const charId = aId === PLAYER_GRAPH_NODE_ID ? bId : aId
                  const link = playerLinks.find((l) => l.characterId === charId)
                  if (link) {
                    const p = pairFromPlayerLink(link)
                    if (p.aId === aId && p.bId === bId) {
                      ab = p.ab
                      ba = p.ba
                    }
                  }
                }
                setEdgeDetail({ aId, bId, ab, ba })
              }}
            />
          ) : (
            <div className="flex min-h-[280px] items-center justify-center py-16">
              <p className="text-center text-[12px] text-neutral-400">图谱已在全屏模式中打开</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/80 to-transparent" aria-hidden />
          <div className="pointer-events-auto absolute bottom-3 right-3 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => setGraphFullscreenOpen(true)}
              className="flex size-10 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-[#1C1C1E] shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors hover:bg-white"
              aria-label="全屏编辑关系图"
            >
              <Maximize2 className="size-[18px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setGraphResetSignal((n) => n + 1)}
              className="flex size-10 items-center justify-center rounded-full border border-neutral-200/90 bg-white/95 text-[#1C1C1E] shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors hover:bg-white"
              aria-label="恢复默认排版"
            >
              <RotateCcw className="size-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
          视角中心 · {focalDisplayName}
        </p>
      </section>

      <section className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
          <button
            type="button"
            onClick={() => setExpandedAccordion((v) => (v === 'ai' ? null : 'ai'))}
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-neutral-50/80"
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-[#1C1C1E]">
              <Sparkles className="size-4 text-[#D4AF37]" strokeWidth={1.5} />
              AI 智能拓扑
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-neutral-400 transition-transform duration-300 ${
                expandedAccordion === 'ai' ? 'rotate-180' : ''
              }`}
              strokeWidth={1.5}
            />
          </button>
          <AnimatePresence initial={false}>
            {expandedAccordion === 'ai' ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-neutral-100"
              >
                <div className="space-y-5 px-4 py-5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                        拓展人数
                      </span>
                      <span className="font-mono text-[13px] tabular-nums text-[#1C1C1E]">{countSliderValue}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={countSliderValue}
                      onChange={(e) => setCountInput(e.target.value)}
                      className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#1C1C1E]"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">关系偏向</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {REL_BIAS_OPTIONS.map((b) => {
                        const on = biases.includes(b)
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => toggleBias(b)}
                            className={`rounded-full border px-3 py-1.5 text-[11px] transition-all duration-200 ${
                              on
                                ? 'border-[#1C1C1E] bg-[#1C1C1E] text-white'
                                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                            }`}
                          >
                            {b}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      补充指令
                    </span>
                    <textarea
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="输入额外的设定要求…"
                      rows={3}
                      className="mt-2 w-full resize-none border-0 border-b border-neutral-200 bg-transparent py-2 text-[13px] leading-relaxed text-[#1C1C1E] outline-none ring-0 transition-colors placeholder:text-neutral-300 focus:border-[#D4AF37]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => void onGenerate()}
                    className="w-full rounded-xl bg-[#1C1C1E] py-3.5 text-[13px] font-semibold tracking-wide text-white transition-opacity disabled:opacity-50"
                  >
                    {generating ? '生成中…' : '开始生成 · Generate'}
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
          <button
            type="button"
            onClick={() => setExpandedAccordion((v) => (v === 'manual' ? null : 'manual'))}
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-neutral-50/80"
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-[#1C1C1E]">
              <Plus className="size-4 text-[#D4AF37]" strokeWidth={1.5} />
              手动录入档案
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-neutral-400 transition-transform duration-300 ${
                expandedAccordion === 'manual' ? 'rotate-180' : ''
              }`}
              strokeWidth={1.5}
            />
          </button>
          <AnimatePresence initial={false}>
            {expandedAccordion === 'manual' ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-neutral-100"
              >
                <div className="px-4 py-5">
                  <p className="text-[12px] leading-relaxed text-neutral-500">
                    添加单个 NPC 档案；可填写与「你」之间的连线关系词，随后在完整人设页补全细节。
                  </p>
                  <button
                    type="button"
                    onClick={() => setManualSheetOpen(true)}
                    className="mt-4 w-full rounded-xl border border-neutral-200 py-3 text-[13px] font-medium text-[#1C1C1E] transition-colors hover:bg-neutral-50"
                  >
                    打开录入抽屉
                  </button>
                  <button
                    type="button"
                    onClick={onManualAddNpc}
                    className="mt-2 w-full py-2 text-[11px] text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    或直接创建空白人设
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-2 border-b border-neutral-100 pb-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Roster · 已收录档案</p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight text-[#1C1C1E]">NPC 列表</p>
          </div>
          <button
            type="button"
            onClick={openGraphEditor}
            className="shrink-0 text-[11px] font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-[#1C1C1E] hover:underline"
          >
            深度编辑关系图
          </button>
        </div>
        <div className="space-y-0 divide-y divide-neutral-100 rounded-2xl border border-neutral-200/80 bg-white">
          {npcs.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-neutral-400">暂无收录。使用 AI 拓扑或手动录入添加。</p>
          ) : (
            npcs.map((npc) => (
              <RosterNpcRow
                key={npc.id}
                npc={npc}
                relationHint={playerLinks.find((l) => l.characterId === npc.id)?.relationYouToThem?.trim() || ''}
                expanded={rosterExpandedId === npc.id}
                onToggle={() => setRosterExpandedId((id) => (id === npc.id ? null : npc.id))}
                onEdit={() => onOpenNpcEdit(npc.id)}
                onDelete={() => void onDeleteNpc(npc.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>

    {graphFullscreenOpen
      ? createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2600] flex flex-col bg-white"
            style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3">
              <p className="text-[14px] font-semibold text-[#1C1C1E]">关系图谱 · 全屏</p>
              <button
                type="button"
                onClick={() => setGraphFullscreenOpen(false)}
                className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-[#1C1C1E]"
                aria-label="关闭"
              >
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <RelationshipGraph
                rootMainId={main.id}
                focalId={graphFocalId}
                onFocalChange={setGraphFocalId}
                main={main}
                npcs={npcs}
                linkedRoots={linkedRoots}
                rels={rels}
                playerLinks={playerLinks}
                playerAvatarUrl={playerAvatarUrl}
                resetSignal={graphResetSignal}
                visualPreset="platinum"
                dashboardChrome
                onNodeDblClick={(id) => {
                  if (id === PLAYER_GRAPH_NODE_ID) return
                  if (id !== main.id) onOpenNpcEdit(id)
                }}
                onEdgeClick={(aId, bId) => {
                  let ab = relMap.get(`${aId}::${bId}`)
                  let ba = relMap.get(`${bId}::${aId}`)
                  if (aId === PLAYER_GRAPH_NODE_ID || bId === PLAYER_GRAPH_NODE_ID) {
                    const charId = aId === PLAYER_GRAPH_NODE_ID ? bId : aId
                    const link = playerLinks.find((l) => l.characterId === charId)
                    if (link) {
                      const p = pairFromPlayerLink(link)
                      if (p.aId === aId && p.bId === bId) {
                        ab = p.ab
                        ba = p.ba
                      }
                    }
                  }
                  setEdgeDetail({ aId, bId, ab, ba })
                }}
              />
            </div>
            <div
              className="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-4 py-3"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={() => setGraphResetSignal((n) => n + 1)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-[12px] font-medium text-[#1C1C1E]"
              >
                恢复默认排版
              </button>
              <button
                type="button"
                onClick={openGraphEditor}
                className="rounded-full bg-[#1C1C1E] px-4 py-2 text-[12px] font-medium text-white"
              >
                深度编辑连线
              </button>
            </div>
          </motion.div>,
          document.body,
        )
      : null}

    {manualSheetOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[2550] flex flex-col justify-end bg-black/45"
            role="presentation"
            onClick={() => setManualSheetOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="rounded-t-[20px] bg-white px-4 pt-4 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
              style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" />
              <p className="text-[15px] font-semibold text-[#1C1C1E]">手动录入档案</p>
              <p className="mt-1 text-[11px] text-neutral-500">姓名必填；关系词将显示在「你」与该 NPC 的连线标签上。</p>
              <label className="mt-4 block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400">姓名</span>
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="mt-1 w-full border-0 border-b border-neutral-200 py-2 text-[15px] text-[#1C1C1E] outline-none ring-0 focus:border-[#D4AF37]"
                  placeholder="角色姓名"
                />
              </label>
              <label className="mt-4 block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
                  关系词（你→对方，可选）
                </span>
                <input
                  value={manualRelation}
                  onChange={(e) => setManualRelation(e.target.value)}
                  className="mt-1 w-full border-0 border-b border-neutral-200 py-2 text-[15px] text-[#1C1C1E] outline-none ring-0 focus:border-[#D4AF37]"
                  placeholder="如：损友、暗恋对象"
                />
              </label>
              <button
                type="button"
                onClick={() => void submitManualSheet()}
                className="mt-6 w-full rounded-xl bg-[#1C1C1E] py-3.5 text-[13px] font-semibold text-white"
              >
                保存并打开人设
              </button>
              <button
                type="button"
                onClick={() => setManualSheetOpen(false)}
                className="mt-2 w-full py-2 text-[12px] text-neutral-400"
              >
                取消
              </button>
            </motion.div>
          </div>,
          document.body,
        )
      : null}

      {edgeDetail ? (
        (() => {
          const fromName = characterIdToName.get(edgeDetail.aId) ?? '未知角色'
          const toName = characterIdToName.get(edgeDetail.bId) ?? '未知角色'
          const plink =
            playerLinkCharIdForModal != null
              ? playerLinks.find((l) => l.characterId === playerLinkCharIdForModal)
              : null
          const charNameForYou = playerLinkCharIdForModal
            ? (characterIdToName.get(playerLinkCharIdForModal) ?? '未知角色')
            : ''

          if (playerLinkCharIdForModal && plink) {
            return (
              <div
                className="fixed inset-0 z-[2800] flex items-center justify-center px-4"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                onClick={() => setEdgeDetail(null)}
              >
                <div
                  className="w-full max-w-md rounded-2xl border bg-white p-5"
                  style={{ borderColor: '#dbdbdb' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-center text-[15px] font-semibold" style={{ color: '#262626' }}>
                    「你」与「{charNameForYou}」
                  </p>
                  <p className="mt-2 text-center text-[11px]" style={{ color: '#8e8e8e' }}>
                    默认仅浏览；点「编辑」后可改文案，保存后写回人脉。
                  </p>
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      className="rounded-full border px-4 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa]"
                      style={{ borderColor: '#dbdbdb', color: '#262626' }}
                      onClick={() => setEdgePlayerFormUnlocked((v) => !v)}
                    >
                      {edgePlayerFormUnlocked ? '完成' : '编辑'}
                    </button>
                  </div>
                  {edgePlayerFormUnlocked ? (
                    <>
                      <div className="mt-4 rounded-xl border bg-[#fafafa] p-3" style={{ borderColor: '#e5e5e5' }}>
                        <p className="text-[12px] font-medium" style={{ color: '#525252' }}>
                          【{charNameForYou}看「你」】
                        </p>
                        <textarea
                          value={draftTheySeeYou}
                          onChange={(e) => setDraftTheySeeYou(e.target.value)}
                          rows={3}
                          placeholder="对方视角下对你的看法…"
                          className="mt-2 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                          style={{ borderColor: '#dbdbdb', color: '#262626' }}
                        />
                        <label className="mt-3 block text-[11px] font-medium" style={{ color: '#737373' }}>
                          关系词（对方→你，连线中间）
                          <input
                            type="text"
                            value={draftThemRel}
                            onChange={(e) => setDraftThemRel(e.target.value)}
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                            style={{ borderColor: '#dbdbdb', color: '#262626' }}
                          />
                        </label>
                        <label className="mt-3 block text-[11px] font-medium" style={{ color: '#737373' }}>
                          Ta 如何称呼你（与关系词不同，侧重当面怎么叫你）
                          <input
                            type="text"
                            value={draftTheyCallYou}
                            onChange={(e) => setDraftTheyCallYou(e.target.value)}
                            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                            style={{ borderColor: '#dbdbdb', color: '#262626' }}
                          />
                        </label>
                      </div>
                      <div className="mt-4">
                        <p className="text-[12px] font-medium" style={{ color: '#262626' }}>
                          【你看{charNameForYou}】
                        </p>
                        <textarea
                          value={draftYouSee}
                          onChange={(e) => setDraftYouSee(e.target.value)}
                          rows={3}
                          placeholder="填写你对该角色的看法…"
                          className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-[13px] outline-none"
                          style={{ borderColor: '#dbdbdb', color: '#262626' }}
                        />
                        <p className="mt-3 text-[12px] font-medium" style={{ color: '#262626' }}>
                          关系词（你→对方，连线中间显示）
                        </p>
                        <input
                          type="text"
                          value={draftYouRel}
                          onChange={(e) => setDraftYouRel(e.target.value)}
                          placeholder="如：朋友、熟人…"
                          className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-[13px] outline-none"
                          style={{ borderColor: '#dbdbdb', color: '#262626' }}
                        />
                        <p className="mt-3 text-[12px] font-medium" style={{ color: '#262626' }}>
                          你如何称呼对方（可自由填写；人脉 AI 不会预填此项）
                        </p>
                        <input
                          type="text"
                          value={draftYouCallThem}
                          onChange={(e) => setDraftYouCallThem(e.target.value)}
                          placeholder="如：师兄、全名、外号…"
                          className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-[13px] outline-none"
                          style={{ borderColor: '#dbdbdb', color: '#262626' }}
                        />
                      </div>
                    </>
                  ) : (
                    (() => {
                      const d = (s: string) => (String(s || '').trim() ? String(s).trim() : '—')
                      return (
                        <div
                          className="mt-4 space-y-2 rounded-xl border px-3 py-3 text-[13px] leading-relaxed"
                          style={{ borderColor: '#e5e5e5', background: '#fafafa', color: '#262626' }}
                        >
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">对方→你</span> {d(draftThemRel)}
                          </p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">对方称你</span> {d(draftTheyCallYou)}
                          </p>
                          <p className="text-[12px]">
                            <span className="text-[11px] font-medium text-[#737373]">【{charNameForYou}看你】</span>
                            <span className="mt-0.5 block whitespace-pre-wrap">{d(draftTheySeeYou)}</span>
                          </p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">你→对方</span> {d(draftYouRel)}
                          </p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">你称对方</span> {d(draftYouCallThem)}
                          </p>
                          <p className="text-[12px]">
                            <span className="text-[11px] font-medium text-[#737373]">【你看{charNameForYou}】</span>
                            <span className="mt-0.5 block whitespace-pre-wrap">{d(draftYouSee)}</span>
                          </p>
                        </div>
                      )
                    })()
                  )}
                  <button
                    type="button"
                    disabled={savingPlayerView}
                    className="mt-4 w-full rounded-xl py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
                    style={{ background: '#000000' }}
                    onClick={() => {
                      void (async () => {
                        setSavingPlayerView(true)
                        try {
                          const next = playerLinks.map((l) =>
                            l.characterId === playerLinkCharIdForModal
                              ? {
                                  ...l,
                                  relationYouToThem: draftYouRel.trim(),
                                  youSeeThem: draftYouSee.trim(),
                                  youCallThem: draftYouCallThem.trim(),
                                  theyCallYou: draftTheyCallYou.trim(),
                                  theySeeYou: draftTheySeeYou.trim(),
                                  relationThemToYou: draftThemRel.trim(),
                                }
                              : l,
                          )
                          await personaDb.putPlayerNetworkLinks(main.id, next)
                          setPlayerLinks(next)
                        } finally {
                          setSavingPlayerView(false)
                        }
                      })()
                    }}
                  >
                    {savingPlayerView ? '保存中…' : '保存本条连线'}
                  </button>
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border py-2 text-[13px]"
                    style={{ borderColor: '#dbdbdb', color: '#262626' }}
                    onClick={() => setEdgeDetail(null)}
                  >
                    关闭
                  </button>
                </div>
              </div>
            )
          }

          if (playerLinkCharIdForModal && !plink) {
            return (
              <div
                className="fixed inset-0 z-[2800] flex items-center justify-center px-4"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                onClick={() => setEdgeDetail(null)}
              >
                <div
                  className="w-full max-w-md rounded-2xl border bg-white p-5 text-center text-[13px]"
                  style={{ borderColor: '#dbdbdb', color: '#8e8e8e' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  未找到该连线的存档数据。
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl border py-2 text-[13px]"
                    style={{ borderColor: '#dbdbdb', color: '#262626' }}
                    onClick={() => setEdgeDetail(null)}
                  >
                    关闭
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              className="fixed inset-0 z-[2800] flex items-center justify-center px-4"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={() => !savingCharEdge && setEdgeDetail(null)}
            >
              <div
                className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-white p-5"
                style={{ borderColor: '#dbdbdb' }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-center text-[15px] font-semibold" style={{ color: '#262626' }}>
                  编辑关系与看法
                </p>
                <p className="mt-2 text-center text-[11px] leading-relaxed" style={{ color: '#8e8e8e' }}>
                  默认仅浏览；点「编辑」后可改文案。若某方向无记录，请在「手动编辑关系图」→「角色与 NPC」补充有向边。
                </p>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    className="rounded-full border px-4 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa]"
                    style={{ borderColor: '#dbdbdb', color: '#262626' }}
                    onClick={() => setEdgeCharFormUnlocked((v) => !v)}
                  >
                    {edgeCharFormUnlocked ? '完成' : '编辑'}
                  </button>
                </div>
                {!draftCharAb && !draftCharBa ? (
                  <p className="mt-4 text-center text-[13px]" style={{ color: '#8e8e8e' }}>
                    当前连线在数据库中尚无对应关系记录。
                  </p>
                ) : null}
                {(() => {
                  const d = (s: string) => (String(s || '').trim() ? String(s).trim() : '—')
                  return edgeCharFormUnlocked ? (
                    <>
                      {draftCharAb && edgeDetail.ab ? (
                        <div className="mt-4 rounded-xl border bg-[#fafafa] p-3" style={{ borderColor: '#e5e5e5' }}>
                          <p className="text-[12px] font-semibold" style={{ color: '#262626' }}>
                            {fromName} → {toName}
                          </p>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            关系词（连线中间）
                            <input
                              value={draftCharAb.relation}
                              onChange={(e) => setDraftCharAb((x) => (x ? { ...x, relation: e.target.value } : x))}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            {fromName} 如何称呼 {toName}
                            <input
                              value={draftCharAb.fromCallsTo}
                              onChange={(e) => setDraftCharAb((x) => (x ? { ...x, fromCallsTo: e.target.value } : x))}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            【{fromName}看{toName}】
                            <textarea
                              value={draftCharAb.fromPerspective}
                              onChange={(e) => setDraftCharAb((x) => (x ? { ...x, fromPerspective: e.target.value } : x))}
                              rows={3}
                              className="mt-1 w-full resize-y rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            【{toName}看{fromName}】
                            <textarea
                              value={draftCharAb.toPerspective}
                              onChange={(e) => setDraftCharAb((x) => (x ? { ...x, toPerspective: e.target.value } : x))}
                              rows={3}
                              className="mt-1 w-full resize-y rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                        </div>
                      ) : null}
                      {draftCharBa && edgeDetail.ba ? (
                        <div className="mt-4 rounded-xl border bg-[#fafafa] p-3" style={{ borderColor: '#e5e5e5' }}>
                          <p className="text-[12px] font-semibold" style={{ color: '#262626' }}>
                            {toName} → {fromName}
                          </p>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            关系词（连线中间）
                            <input
                              value={draftCharBa.relation}
                              onChange={(e) => setDraftCharBa((x) => (x ? { ...x, relation: e.target.value } : x))}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            {toName} 如何称呼 {fromName}
                            <input
                              value={draftCharBa.fromCallsTo}
                              onChange={(e) => setDraftCharBa((x) => (x ? { ...x, fromCallsTo: e.target.value } : x))}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            【{toName}看{fromName}】
                            <textarea
                              value={draftCharBa.fromPerspective}
                              onChange={(e) => setDraftCharBa((x) => (x ? { ...x, fromPerspective: e.target.value } : x))}
                              rows={3}
                              className="mt-1 w-full resize-y rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                          <label className="mt-2 block text-[11px] font-medium" style={{ color: '#737373' }}>
                            【{fromName}看{toName}】
                            <textarea
                              value={draftCharBa.toPerspective}
                              onChange={(e) => setDraftCharBa((x) => (x ? { ...x, toPerspective: e.target.value } : x))}
                              rows={3}
                              className="mt-1 w-full resize-y rounded-lg border bg-white px-2 py-1.5 text-[13px] outline-none"
                              style={{ borderColor: '#dbdbdb', color: '#262626' }}
                            />
                          </label>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {draftCharAb && edgeDetail.ab ? (
                        <div
                          className="mt-4 space-y-2 rounded-xl border px-3 py-3 text-[13px] leading-relaxed"
                          style={{ borderColor: '#e5e5e5', background: '#fafafa', color: '#262626' }}
                        >
                          <p className="text-[12px] font-semibold">{fromName} → {toName}</p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">关系词</span> {d(draftCharAb.relation)}
                          </p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">
                              {fromName} 称呼 {toName}
                            </span>{' '}
                            {d(draftCharAb.fromCallsTo)}
                          </p>
                          <p className="text-[12px]">
                            <span className="text-[11px] font-medium text-[#737373]">【{fromName}看{toName}】</span>
                            <span className="mt-0.5 block whitespace-pre-wrap">{d(draftCharAb.fromPerspective)}</span>
                          </p>
                          <p className="text-[12px]">
                            <span className="text-[11px] font-medium text-[#737373]">【{toName}看{fromName}】</span>
                            <span className="mt-0.5 block whitespace-pre-wrap">{d(draftCharAb.toPerspective)}</span>
                          </p>
                        </div>
                      ) : null}
                      {draftCharBa && edgeDetail.ba ? (
                        <div
                          className="mt-4 space-y-2 rounded-xl border px-3 py-3 text-[13px] leading-relaxed"
                          style={{ borderColor: '#e5e5e5', background: '#fafafa', color: '#262626' }}
                        >
                          <p className="text-[12px] font-semibold">{toName} → {fromName}</p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">关系词</span> {d(draftCharBa.relation)}
                          </p>
                          <p>
                            <span className="text-[11px] font-medium text-[#737373]">
                              {toName} 称呼 {fromName}
                            </span>{' '}
                            {d(draftCharBa.fromCallsTo)}
                          </p>
                          <p className="text-[12px]">
                            <span className="text-[11px] font-medium text-[#737373]">【{toName}看{fromName}】</span>
                            <span className="mt-0.5 block whitespace-pre-wrap">{d(draftCharBa.fromPerspective)}</span>
                          </p>
                          <p className="text-[12px]">
                            <span className="text-[11px] font-medium text-[#737373]">【{fromName}看{toName}】</span>
                            <span className="mt-0.5 block whitespace-pre-wrap">{d(draftCharBa.toPerspective)}</span>
                          </p>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
                <button
                  type="button"
                  disabled={savingCharEdge || (!draftCharAb && !draftCharBa)}
                  className="mt-4 w-full rounded-xl py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
                  style={{ background: '#000000' }}
                  onClick={() => {
                    void (async () => {
                      if (!edgeDetail) return
                      setSavingCharEdge(true)
                      try {
                        if (draftCharAb && edgeDetail.ab) {
                          await personaDb.putRelationship({
                            ...edgeDetail.ab,
                            relation: draftCharAb.relation.trim(),
                            fromCallsTo: draftCharAb.fromCallsTo.trim(),
                            fromPerspective: draftCharAb.fromPerspective.trim(),
                            toPerspective: draftCharAb.toPerspective.trim(),
                          })
                        }
                        if (draftCharBa && edgeDetail.ba) {
                          await personaDb.putRelationship({
                            ...edgeDetail.ba,
                            relation: draftCharBa.relation.trim(),
                            fromCallsTo: draftCharBa.fromCallsTo.trim(),
                            fromPerspective: draftCharBa.fromPerspective.trim(),
                            toPerspective: draftCharBa.toPerspective.trim(),
                          })
                        }
                        await reload()
                        setEdgeDetail(null)
                      } finally {
                        setSavingCharEdge(false)
                      }
                    })()
                  }}
                >
                  {savingCharEdge ? '保存中…' : '保存修改'}
                </button>
                <button
                  type="button"
                  disabled={savingCharEdge}
                  className="mt-2 w-full rounded-xl border py-2 text-[13px]"
                  style={{ borderColor: '#dbdbdb', color: '#262626' }}
                  onClick={() => setEdgeDetail(null)}
                >
                  关闭
                </button>
              </div>
            </div>
          )
        })()
      ) : null}

      {graphEditorOpen ? (
        <div
          className="fixed inset-0 z-[2810] flex items-end justify-center px-0 sm:items-center sm:px-4"
          style={{ background: GE.overlay }}
          onClick={() => {
            if (!graphEditorSaving) {
              setEditingGraphPlayerLinkId(null)
              setEditingGraphRelId(null)
              setGraphEditorOpen(false)
            }
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[16px] border sm:max-h-[88vh] sm:rounded-[16px]"
            style={{
              borderColor: GE.border,
              background: GE.card,
              boxShadow: GE.shadowLg,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="shrink-0 border-b px-5 py-4"
              style={{ borderColor: GE.border, background: GE.card }}
            >
              <p className="text-center text-[17px] font-bold tracking-tight" style={{ color: GE.text }}>
                手动编辑关系图
              </p>
              <p className="mx-auto mt-2 max-w-md text-center text-[12px] leading-relaxed" style={{ color: GE.sub }}>
                编辑「你」与各角色的关系词、互相如何称呼与叙述，以及角色之间的有向关系与称呼。保存后画布与连线标签会同步。你对他人怎么称呼仅在此手动填写，人脉 AI 不会代写。
              </p>
            </header>

            <div className="shrink-0 px-4 pt-3 sm:px-5" style={{ background: GE.canvas }}>
              <div
                className="flex gap-2 rounded-[12px] border p-2"
                style={{ borderColor: GE.border, background: GE.card, boxShadow: GE.shadow }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setGraphEditorTab('you')
                    setEditingGraphPlayerLinkId(null)
                    setEditingGraphRelId(null)
                    setGraphDdOpen(null)
                  }}
                  className="min-w-0 flex-1 rounded-[10px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out"
                  style={{
                    border: '1px solid ' + GE.border,
                    background: graphEditorTab === 'you' ? GE.text : GE.card,
                    color: graphEditorTab === 'you' ? '#ffffff' : GE.text,
                  }}
                >
                  你与角色
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGraphEditorTab('between')
                    setEditingGraphPlayerLinkId(null)
                    setEditingGraphRelId(null)
                    setGraphDdOpen(null)
                  }}
                  className="min-w-0 flex-1 rounded-[10px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ease-out"
                  style={{
                    border: '1px solid ' + GE.border,
                    background: graphEditorTab === 'between' ? GE.text : GE.card,
                    color: graphEditorTab === 'between' ? '#ffffff' : GE.text,
                  }}
                >
                  角色与 NPC
                </button>
              </div>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ background: GE.canvas }}
            >
              {graphEditorTab === 'you' ? (
                <section
                  className="rounded-[12px] border p-4"
                  style={{ borderColor: GE.border, background: GE.card, boxShadow: GE.shadow }}
                >
                  <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end" style={{ borderColor: GE.border }}>
                    {availPlCharIds.length > 0 ? (
                      <div className="min-w-0 flex-1">
                        <p className="mb-1.5 text-[11px] font-medium" style={{ color: GE.sub }}>
                          为角色添加「你」的连线
                        </p>
                        <GraphEditorInlineDropdown
                          label="选择要添加连线的角色"
                          valueText={
                            newPlCharId && availPlCharIds.includes(newPlCharId)
                              ? (characterIdToName.get(newPlCharId) ?? newPlCharId)
                              : '请选择角色'
                          }
                          open={graphDdOpen === 'plChar'}
                          onToggle={() => setGraphDdOpen((o) => (o === 'plChar' ? null : 'plChar'))}
                        >
                          {availPlCharIds.map((id) => {
                            const active = id === newPlCharId
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out ${
                                  active ? '' : 'hover:bg-[#f5f5f5]'
                                }`}
                                style={{
                                  color: active ? '#ffffff' : GE.text,
                                  background: active ? GE.text : 'transparent',
                                }}
                                onClick={() => {
                                  setNewPlCharId(id)
                                  setGraphDdOpen(null)
                                }}
                              >
                                {characterIdToName.get(id) ?? id}
                              </button>
                            )
                          })}
                        </GraphEditorInlineDropdown>
                      </div>
                    ) : (
                      <p className="flex-1 text-[12px]" style={{ color: GE.faint }}>
                        当前人脉中的角色均已配置「你」的连线。
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!newPlCharId || availPlCharIds.length === 0 || !availPlCharIds.includes(newPlCharId)}
                      className="shrink-0 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-40"
                      style={{ background: GE.text }}
                      onClick={() => {
                        if (!newPlCharId || !availPlCharIds.includes(newPlCharId)) return
                        const newLinkId = uid('pl')
                        const nextLinks: PlayerNetworkLink[] = [
                          ...draftPlayerLinks,
                          {
                            id: newLinkId,
                            characterId: newPlCharId,
                            relationYouToThem: '',
                            relationThemToYou: '',
                            youSeeThem: '',
                            theySeeYou: '',
                            youCallThem: '',
                            theyCallYou: '',
                          },
                        ]
                        setDraftPlayerLinks(nextLinks)
                        setEditingGraphPlayerLinkId(newLinkId)
                        setGraphDdOpen(null)
                      }}
                    >
                      添加连线
                    </button>
                  </div>
                  <div className="mt-4 mb-3 flex items-center gap-2">
                    <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: GE.text }} aria-hidden />
                    <h3 className="text-[14px] font-semibold" style={{ color: GE.text }}>
                      已有「你」的连线
                    </h3>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed" style={{ color: GE.faint }}>
                    每条对应关系图中「你」与该角色之间的连线；可移除或新增尚未配置连线的角色。
                  </p>
                  <div className="space-y-3">
                    {draftPlayerLinks.map((link) => {
                      const nm = characterIdToName.get(link.characterId) ?? link.characterId
                      const rowEdit = editingGraphPlayerLinkId === link.id
                      const dash = (s: string) => (String(s || '').trim() ? String(s).trim() : '—')
                      return (
                        <div
                          key={link.id}
                          className="rounded-[10px] border p-3"
                          style={{
                            borderColor: GE.border,
                            background: rowEdit ? '#fafafa' : GE.card,
                            boxShadow: rowEdit ? undefined : '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold" style={{ color: GE.text }}>
                              你 ↔ {nm}
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                className="rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa]"
                                style={{ borderColor: GE.border, color: GE.text }}
                                onClick={() => setEditingGraphPlayerLinkId(rowEdit ? null : link.id)}
                              >
                                {rowEdit ? '完成' : '编辑'}
                              </button>
                              <button
                                type="button"
                                className="rounded-lg px-2 py-1 text-[12px] transition-all duration-200 ease-out hover:bg-black/[0.04]"
                                style={{ color: GE.sub }}
                                onClick={() => {
                                  setDraftPlayerLinks((prev) => prev.filter((l) => l.id !== link.id))
                                  if (editingGraphPlayerLinkId === link.id) setEditingGraphPlayerLinkId(null)
                                }}
                              >
                                移除
                              </button>
                            </div>
                          </div>
                          {rowEdit ? (
                            <>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  关系词（你→对方）
                                  <input
                                    value={link.relationYouToThem}
                                    onChange={(e) =>
                                      setDraftPlayerLinks((prev) =>
                                        prev.map((l) => (l.id === link.id ? { ...l, relationYouToThem: e.target.value } : l)),
                                      )
                                    }
                                    className="mt-1.5 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                                <label className="block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  关系词（对方→你）
                                  <input
                                    value={link.relationThemToYou}
                                    onChange={(e) =>
                                      setDraftPlayerLinks((prev) =>
                                        prev.map((l) => (l.id === link.id ? { ...l, relationThemToYou: e.target.value } : l)),
                                      )
                                    }
                                    className="mt-1.5 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                              </div>
                              <label className="mt-3 block text-[11px] font-medium" style={{ color: GE.sub }}>
                                你看对方
                                <textarea
                                  value={link.youSeeThem}
                                  onChange={(e) =>
                                    setDraftPlayerLinks((prev) =>
                                      prev.map((l) => (l.id === link.id ? { ...l, youSeeThem: e.target.value } : l)),
                                    )
                                  }
                                  rows={2}
                                  className="mt-1.5 w-full resize-y rounded-[10px] border bg-white px-3 py-2 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                                  style={{ borderColor: GE.border, color: GE.text }}
                                />
                              </label>
                              <label className="mt-3 block text-[11px] font-medium" style={{ color: GE.sub }}>
                                对方看你
                                <textarea
                                  value={link.theySeeYou}
                                  onChange={(e) =>
                                    setDraftPlayerLinks((prev) =>
                                      prev.map((l) => (l.id === link.id ? { ...l, theySeeYou: e.target.value } : l)),
                                    )
                                  }
                                  rows={2}
                                  className="mt-1.5 w-full resize-y rounded-[10px] border bg-white px-3 py-2 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                                  style={{ borderColor: GE.border, color: GE.text }}
                                />
                              </label>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  你如何称呼对方（仅手动）
                                  <input
                                    value={link.youCallThem}
                                    onChange={(e) =>
                                      setDraftPlayerLinks((prev) =>
                                        prev.map((l) => (l.id === link.id ? { ...l, youCallThem: e.target.value } : l)),
                                      )
                                    }
                                    placeholder="人脉 AI 不会填写此项"
                                    className="mt-1.5 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                                <label className="block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  对方如何称呼你
                                  <input
                                    value={link.theyCallYou}
                                    onChange={(e) =>
                                      setDraftPlayerLinks((prev) =>
                                        prev.map((l) => (l.id === link.id ? { ...l, theyCallYou: e.target.value } : l)),
                                      )
                                    }
                                    placeholder="可手动改；生成人脉时可预填"
                                    className="mt-1.5 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                              </div>
                            </>
                          ) : (
                            <div
                              className="mt-3 space-y-2 rounded-[10px] border px-3 py-2.5 text-[13px] leading-relaxed"
                              style={{ borderColor: GE.border, background: '#fafafa', color: GE.text }}
                            >
                              <p>
                                <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                  你→对方
                                </span>{' '}
                                {dash(link.relationYouToThem)}
                              </p>
                              <p>
                                <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                  对方→你
                                </span>{' '}
                                {dash(link.relationThemToYou)}
                              </p>
                              <p>
                                <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                  你称对方
                                </span>{' '}
                                {dash(link.youCallThem)}
                              </p>
                              <p>
                                <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                  对方称你
                                </span>{' '}
                                {dash(link.theyCallYou)}
                              </p>
                              <p className="text-[12px]">
                                <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                  你看对方
                                </span>
                                <span className="mt-0.5 block whitespace-pre-wrap">{dash(link.youSeeThem)}</span>
                              </p>
                              <p className="text-[12px]">
                                <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                  对方看你
                                </span>
                                <span className="mt-0.5 block whitespace-pre-wrap">{dash(link.theySeeYou)}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : (
                <>
                  <section
                    className="rounded-[12px] border p-4"
                    style={{ borderColor: GE.border, background: GE.card, boxShadow: GE.shadow }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: GE.text }} aria-hidden />
                      <h3 className="text-[14px] font-semibold" style={{ color: GE.text }}>
                        新增有向关系
                      </h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium" style={{ color: GE.sub }}>
                          起点
                        </p>
                        <GraphEditorInlineDropdown
                          label="选择关系起点角色"
                          valueText={(characterIdToName.get(newRelFrom) ?? newRelFrom) || '请选择'}
                          open={graphDdOpen === 'relFrom'}
                          onToggle={() => setGraphDdOpen((o) => (o === 'relFrom' ? null : 'relFrom'))}
                        >
                          {networkCharIds.map((id) => {
                            const active = id === newRelFrom
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out ${
                                  active ? '' : 'hover:bg-[#f5f5f5]'
                                }`}
                                style={{
                                  color: active ? '#ffffff' : GE.text,
                                  background: active ? GE.text : 'transparent',
                                }}
                                onClick={() => {
                                  setNewRelFrom(id)
                                  setGraphDdOpen(null)
                                }}
                              >
                                {characterIdToName.get(id) ?? id}
                              </button>
                            )
                          })}
                        </GraphEditorInlineDropdown>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium" style={{ color: GE.sub }}>
                          终点
                        </p>
                        <GraphEditorInlineDropdown
                          label="选择关系终点角色"
                          valueText={(characterIdToName.get(newRelTo) ?? newRelTo) || '请选择'}
                          open={graphDdOpen === 'relTo'}
                          onToggle={() => setGraphDdOpen((o) => (o === 'relTo' ? null : 'relTo'))}
                        >
                          {networkCharIds.map((id) => {
                            const active = id === newRelTo
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`flex w-full items-center justify-center px-3 py-2.5 text-[13px] transition-all duration-200 ease-out ${
                                  active ? '' : 'hover:bg-[#f5f5f5]'
                                }`}
                                style={{
                                  color: active ? '#ffffff' : GE.text,
                                  background: active ? GE.text : 'transparent',
                                }}
                                onClick={() => {
                                  setNewRelTo(id)
                                  setGraphDdOpen(null)
                                }}
                              >
                                {characterIdToName.get(id) ?? id}
                              </button>
                            )
                          })}
                        </GraphEditorInlineDropdown>
                      </div>
                    </div>
                    <input
                      value={newRelRelation}
                      onChange={(e) => setNewRelRelation(e.target.value)}
                      placeholder="关系词"
                      className="mt-3 w-full rounded-[10px] border bg-white px-3 py-2.5 text-[13px] outline-none transition-all duration-200 ease-out"
                      style={{ borderColor: GE.border, color: GE.text }}
                    />
                    <input
                      value={newRelFromCallsTo}
                      onChange={(e) => setNewRelFromCallsTo(e.target.value)}
                      placeholder="起点如何称呼终点（可选）"
                      className="mt-2 w-full rounded-[10px] border bg-white px-3 py-2.5 text-[13px] outline-none transition-all duration-200 ease-out"
                      style={{ borderColor: GE.border, color: GE.text }}
                    />
                    <textarea
                      value={newRelFromSee}
                      onChange={(e) => setNewRelFromSee(e.target.value)}
                      placeholder="起点视角叙述"
                      rows={2}
                      className="mt-2 w-full resize-y rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                      style={{ borderColor: GE.border, color: GE.text }}
                    />
                    <textarea
                      value={newRelToSee}
                      onChange={(e) => setNewRelToSee(e.target.value)}
                      placeholder="终点视角叙述"
                      rows={2}
                      className="mt-2 w-full resize-y rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                      style={{ borderColor: GE.border, color: GE.text }}
                    />
                    <button
                      type="button"
                      className="mt-3 w-full rounded-[10px] border py-2.5 text-[13px] font-semibold transition-all duration-200 ease-out hover:bg-[#fafafa]"
                      style={{ borderColor: GE.text, color: GE.text, background: GE.card }}
                      onClick={() => {
                        if (!newRelFrom || !newRelTo || newRelFrom === newRelTo) return
                        const newRelId = uid('rel')
                        setDraftRels((prev) => [
                          ...prev,
                          {
                            id: newRelId,
                            fromCharacterId: newRelFrom,
                            toCharacterId: newRelTo,
                            relation: newRelRelation.trim(),
                            fromPerspective: newRelFromSee.trim(),
                            toPerspective: newRelToSee.trim(),
                            fromCallsTo: newRelFromCallsTo.trim(),
                          },
                        ])
                        setEditingGraphRelId(newRelId)
                        setNewRelRelation('')
                        setNewRelFromSee('')
                        setNewRelToSee('')
                        setNewRelFromCallsTo('')
                      }}
                    >
                      加入列表
                    </button>
                  </section>

                  <section
                    className="mt-4 rounded-[12px] border p-4"
                    style={{ borderColor: GE.border, background: GE.card, boxShadow: GE.shadow }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: GE.text }} aria-hidden />
                      <h3 className="text-[14px] font-semibold" style={{ color: GE.text }}>
                        角色间有向关系
                      </h3>
                    </div>
                    <p className="mb-3 text-[11px] leading-relaxed" style={{ color: GE.faint }}>
                      A→B 与 B→A 为两条独立记录，可分别编辑关系词与两侧叙述。
                    </p>
                    <div className="space-y-3">
                      {draftRels.map((r) => {
                        const rowEdit = editingGraphRelId === r.id
                        const dash = (s: string) => (String(s || '').trim() ? String(s).trim() : '—')
                        const fromNm = characterIdToName.get(r.fromCharacterId) ?? r.fromCharacterId
                        const toNm = characterIdToName.get(r.toCharacterId) ?? r.toCharacterId
                        return (
                          <div
                            key={r.id}
                            className="rounded-[10px] border p-3"
                            style={{
                              borderColor: GE.border,
                              background: rowEdit ? '#fafafa' : GE.card,
                              boxShadow: rowEdit ? undefined : '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold" style={{ color: GE.text }}>
                                {fromNm}
                                <span style={{ color: GE.faint }}> → </span>
                                {toNm}
                              </p>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  className="rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa]"
                                  style={{ borderColor: GE.border, color: GE.text }}
                                  onClick={() => setEditingGraphRelId(rowEdit ? null : r.id)}
                                >
                                  {rowEdit ? '完成' : '编辑'}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg px-2 py-1 text-[12px] transition-all duration-200 ease-out hover:bg-black/[0.04]"
                                  style={{ color: GE.sub }}
                                  onClick={() => {
                                    setDraftRels((prev) => prev.filter((x) => x.id !== r.id))
                                    if (editingGraphRelId === r.id) setEditingGraphRelId(null)
                                  }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                            {rowEdit ? (
                              <>
                                <label className="mt-3 block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  关系词（连线中间）
                                  <input
                                    value={r.relation}
                                    onChange={(e) =>
                                      setDraftRels((prev) => prev.map((x) => (x.id === r.id ? { ...x, relation: e.target.value } : x)))
                                    }
                                    className="mt-1.5 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                                <label className="mt-3 block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  起点如何称呼终点
                                  <input
                                    value={r.fromCallsTo ?? ''}
                                    onChange={(e) =>
                                      setDraftRels((prev) =>
                                        prev.map((x) => (x.id === r.id ? { ...x, fromCallsTo: e.target.value } : x)),
                                      )
                                    }
                                    placeholder="如：哥、李老师"
                                    className="mt-1.5 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                                <label className="mt-3 block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  起点视角
                                  <textarea
                                    value={r.fromPerspective}
                                    onChange={(e) =>
                                      setDraftRels((prev) =>
                                        prev.map((x) => (x.id === r.id ? { ...x, fromPerspective: e.target.value } : x)),
                                      )
                                    }
                                    rows={2}
                                    className="mt-1.5 w-full resize-y rounded-[10px] border bg-white px-3 py-2 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                                <label className="mt-3 block text-[11px] font-medium" style={{ color: GE.sub }}>
                                  终点视角
                                  <textarea
                                    value={r.toPerspective}
                                    onChange={(e) =>
                                      setDraftRels((prev) =>
                                        prev.map((x) => (x.id === r.id ? { ...x, toPerspective: e.target.value } : x)),
                                      )
                                    }
                                    rows={2}
                                    className="mt-1.5 w-full resize-y rounded-[10px] border bg-white px-3 py-2 text-[13px] leading-relaxed outline-none transition-all duration-200 ease-out"
                                    style={{ borderColor: GE.border, color: GE.text }}
                                  />
                                </label>
                              </>
                            ) : (
                              <div
                                className="mt-3 space-y-2 rounded-[10px] border px-3 py-2.5 text-[13px] leading-relaxed"
                                style={{ borderColor: GE.border, background: '#fafafa', color: GE.text }}
                              >
                                <p>
                                  <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                    关系词
                                  </span>{' '}
                                  {dash(r.relation)}
                                </p>
                                <p>
                                  <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                    {fromNm} 称呼 {toNm}
                                  </span>{' '}
                                  {dash(r.fromCallsTo ?? '')}
                                </p>
                                <p className="text-[12px]">
                                  <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                    【{fromNm}看{toNm}】
                                  </span>
                                  <span className="mt-0.5 block whitespace-pre-wrap">{dash(r.fromPerspective)}</span>
                                </p>
                                <p className="text-[12px]">
                                  <span className="text-[11px] font-medium" style={{ color: GE.sub }}>
                                    【{toNm}看{fromNm}】
                                  </span>
                                  <span className="mt-0.5 block whitespace-pre-wrap">{dash(r.toPerspective)}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>

            <footer
              className="shrink-0 border-t px-4 py-3 sm:px-5"
              style={{ borderColor: GE.border, background: GE.card, paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={graphEditorSaving}
                  className="flex-1 rounded-[12px] border py-3 text-[13px] font-medium transition-all duration-200 ease-out hover:bg-[#fafafa] disabled:opacity-50"
                  style={{ borderColor: GE.border, color: GE.text, background: GE.card }}
                  onClick={() => {
                    setEditingGraphPlayerLinkId(null)
                    setEditingGraphRelId(null)
                    setGraphEditorOpen(false)
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={graphEditorSaving}
                  className="flex-1 rounded-[12px] py-3 text-[13px] font-semibold text-white transition-all duration-200 ease-out disabled:opacity-50"
                  style={{ background: GE.text }}
                  onClick={() => void saveGraphEditor()}
                >
                  {graphEditorSaving ? '保存中…' : '保存到本地'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    {generating
      ? createPortal(
          <div
            className="fixed inset-0 z-[5000] flex items-center justify-center px-6"
            role="alertdialog"
            aria-modal="true"
            aria-busy="true"
            aria-labelledby="npc-gen-loading-title"
          >
            <div className="absolute inset-0 bg-black/50" aria-hidden />
            <div
              className="relative w-full max-w-[320px] rounded-2xl border bg-white px-6 py-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
              style={{ borderColor: '#e5e5e5' }}
            >
              <Loader2 className="mx-auto size-10 animate-spin" strokeWidth={1.75} style={{ color: '#111827' }} aria-hidden />
              <p id="npc-gen-loading-title" className="mt-4 text-[16px] font-semibold" style={{ color: '#111827' }}>
                正在生成 NPC
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: '#6b7280' }}>
                正在清空旧人脉并由 AI 生成新角色与关系，请稍候…
              </p>
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  )
}

function RosterNpcRow({
  npc,
  relationHint,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  npc: Character
  relationHint: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const interests = npc.interests ?? []
  const painPoints = npc.painPoints ?? []
  const profileSubtitle = `${genderLabelZh(npc.gender)} · ${npc.identity?.trim() || '—'} · ${npc.mbti?.trim() || '—'}`

  const [bioDisplay, setBioDisplay] = useState(() => npc.bio?.trim() || '')
  useEffect(() => {
    const raw = npc.bio?.trim() || ''
    if (!raw) {
      setBioDisplay('')
      return
    }
    if (!raw.includes('{{') || !npc.id?.trim()) {
      setBioDisplay(raw)
      return
    }
    let cancelled = false
    void personaDb.expandCharacterFieldPlaceholderPreview(raw, npc.id).then((out) => {
      if (!cancelled) setBioDisplay((out ?? raw).trim() || raw)
    })
    return () => {
      cancelled = true
    }
  }, [npc.id, npc.bio])

  return (
    <div className="bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50/90"
      >
        {npc.avatarUrl?.trim() ? (
          <img
            src={npc.avatarUrl}
            alt=""
            className="size-11 shrink-0 rounded-full border border-white object-cover shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          />
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-neutral-100 text-[10px] text-neutral-400">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[#1C1C1E]">{npc.name || '未命名'}</p>
          <p className="mt-0.5 truncate text-[10px] leading-snug text-neutral-500">{profileSubtitle}</p>
        </div>
        <ChevronRight
          className={`size-4 shrink-0 text-neutral-300 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-neutral-50 bg-neutral-50/40"
          >
            <div className="space-y-3 px-4 py-4 text-[12px] text-neutral-600">
              <p>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400">Link · 人脉连线</span>
                <span className="mt-1 block text-[#1C1C1E]">
                  {relationHint.trim() ? (
                    <span className="text-neutral-600">[ {relationHint.trim()} ]</span>
                  ) : (
                    <span className="text-neutral-400">未在「你」的连线中填写关系词</span>
                  )}
                </span>
              </p>
              {interests.length > 0 ? (
                <p>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">Tags · 兴趣</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {interests.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-white px-2 py-0.5 text-[11px] text-neutral-600 ring-1 ring-neutral-200/80"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </p>
              ) : null}
              {painPoints.length > 0 ? (
                <p>
                  <span className="text-[10px] uppercase tracking-wider text-amber-800/70">Minefield · 雷点</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {painPoints.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-dashed border-amber-200/90 bg-amber-50/80 px-2 py-0.5 text-[11px] text-amber-950/80"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </p>
              ) : null}
              <p>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400">Bio · 简介</span>
                <span className="mt-1 block line-clamp-5 whitespace-pre-wrap leading-relaxed text-neutral-500">
                  {bioDisplay || '暂无简介'}
                </span>
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  className="flex-1 rounded-lg border border-neutral-200 py-2 text-[12px] font-medium text-[#1C1C1E] transition-colors hover:bg-white"
                >
                  完整人设
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="rounded-lg border border-transparent px-3 py-2 text-[12px] text-neutral-400 transition-colors hover:text-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function RelationshipGraph({
  rootMainId,
  focalId,
  onFocalChange,
  main,
  npcs,
  linkedRoots,
  rels,
  playerLinks,
  playerAvatarUrl,
  onNodeDblClick,
  onEdgeClick,
  visualPreset = 'classic',
  dashboardChrome = true,
  resetSignal = 0,
}: {
  rootMainId: string
  focalId: string
  onFocalChange: (characterId: string) => void
  main: Character
  npcs: Character[]
  /** 与当前主角有跨人设连线的其他根角色 */
  linkedRoots: Character[]
  rels: Relationship[]
  playerLinks: PlayerNetworkLink[]
  playerAvatarUrl: string
  onNodeDblClick: (id: string) => void
  onEdgeClick: (aId: string, bId: string) => void
  visualPreset?: 'classic' | 'platinum'
  /** 是否显示视角条、恢复按钮与底部说明（仪表盘嵌入时可关闭） */
  dashboardChrome?: boolean
  /** 递增时触发恢复默认排版 */
  resetSignal?: number
}) {
  const svgUid = useId().replace(/:/g, '')
  const platinum = visualPreset === 'platinum'
  const relDirMap = useMemo(() => {
    const m = new Map<string, Relationship>()
    for (const r of rels) m.set(`${r.fromCharacterId}::${r.toCharacterId}`, r)
    return m
  }, [rels])

  const pairEdges = useMemo(() => {
    const seen = new Set<string>()
    const out: { aId: string; bId: string; ab?: Relationship; ba?: Relationship }[] = []
    for (const r of rels) {
      const aId = r.fromCharacterId
      const bId = r.toCharacterId
      if (!aId || !bId || aId === bId) continue
      const key = aId < bId ? `${aId}::${bId}` : `${bId}::${aId}`
      if (seen.has(key)) continue
      seen.add(key)
      const a = aId < bId ? aId : bId
      const b = aId < bId ? bId : aId
      out.push({
        aId: a,
        bId: b,
        ab: relDirMap.get(`${a}::${b}`),
        ba: relDirMap.get(`${b}::${a}`),
      })
    }
    for (const link of playerLinks) {
      const p = pairFromPlayerLink(link)
      const key = `${p.aId}::${p.bId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ aId: p.aId, bId: p.bId, ab: p.ab, ba: p.ba })
    }
    return out
  }, [rels, relDirMap, playerLinks])
  const linkedIdSet = useMemo(() => new Set(linkedRoots.map((c) => c.id)), [linkedRoots])
  const nodes = useMemo(() => [main, ...npcs, ...linkedRoots], [main, npcs, linkedRoots])
  const charIdsSorted = useMemo(
    () => [main.id, ...npcs.map((n) => n.id), ...linkedRoots.map((x) => x.id)].sort(),
    [main.id, npcs, linkedRoots],
  )
  const layoutNetworkKey = useMemo(
    () => `${charIdsSorted.join(',')}|${playerLinks.map((l) => l.characterId).sort().join(',')}`,
    [charIdsSorted, playerLinks],
  )
  const allNodeIds = useMemo(() => {
    if (!playerLinks.length) return charIdsSorted
    return [...charIdsSorted, PLAYER_GRAPH_NODE_ID].sort()
  }, [charIdsSorted, playerLinks])
  const focalName = useMemo(() => nodes.find((n) => n.id === focalId)?.name ?? '—', [nodes, focalId])

  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({})
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef(pan)
  panRef.current = pan
  const graphWrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const loadSeqRef = useRef(0)

  const dragRef = useRef<
    | { kind: 'node'; id: string; sx: number; sy: number; ox: number; oy: number }
    | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
    | null
  >(null)

  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<null | { dist: number; scale: number; pan: { x: number; y: number } }>(null)
  const nodeDragMovedRef = useRef(false)

  const lastTapRef = useRef<{ id: string; t: number } | null>(null)
  const singleTapTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current)
    }
  }, [])

  const handleNodeTap = useCallback(
    (id: string) => {
      if (id === PLAYER_GRAPH_NODE_ID) return
      const now = Date.now()
      const prev = lastTapRef.current
      if (prev && prev.id === id && now - prev.t < 320) {
        if (singleTapTimerRef.current) {
          window.clearTimeout(singleTapTimerRef.current)
          singleTapTimerRef.current = null
        }
        lastTapRef.current = null
        onNodeDblClick(id)
        return
      }
      lastTapRef.current = { id, t: now }
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current)
      singleTapTimerRef.current = window.setTimeout(() => {
        singleTapTimerRef.current = null
        lastTapRef.current = null
        onFocalChange(id)
      }, 280)
    },
    [onFocalChange, onNodeDblClick],
  )

  useEffect(() => {
    const seq = ++loadSeqRef.current
    const ringR = ringRForGraphHeight(GRAPH_H)
    void (async () => {
      const stored = await personaDb.getNetworkGraphView(rootMainId, focalId)
      if (seq !== loadSeqRef.current) return
      if (stored && positionsMatchNetwork(stored.positions, allNodeIds)) {
        setPos(stored.positions)
        setScale(stored.scale)
        setPan(stored.pan)
        return
      }
      let layout = computeRadialLayout(focalId, charIdsSorted, GRAPH_W, GRAPH_H, ringR)
      if (playerLinks.length > 0) {
        layout[PLAYER_GRAPH_NODE_ID] = { x: GRAPH_W / 2, y: GRAPH_H / 2 + ringR + 82 }
      }
      layout = refineLayoutWithForces(layout, allNodeIds, focalId, GRAPH_W, GRAPH_H, ringR, platinum ? 56 : 28)
      setPos(layout)
      setScale(1)
      requestAnimationFrame(() => {
        if (seq !== loadSeqRef.current) return
        const el = graphWrapRef.current
        if (!el) return
        const box = el.getBoundingClientRect()
        const fp = layout[focalId]
        if (!fp) return
        setPan(centerPanForFocal(fp.x, fp.y, box.width, box.height, 1))
      })
    })()
  }, [rootMainId, focalId, layoutNetworkKey, charIdsSorted, allNodeIds, playerLinks.length, platinum])

  useEffect(() => {
    if (!positionsMatchNetwork(pos, allNodeIds)) return
    const t = window.setTimeout(() => {
      void personaDb.putNetworkGraphView({
        id: `${rootMainId}::${focalId}`,
        rootCharacterId: rootMainId,
        perspectiveCharacterId: focalId,
        scale,
        pan,
        positions: Object.fromEntries(allNodeIds.map((id) => [id, pos[id]!])),
        updatedAt: Date.now(),
      })
    }, 450)
    return () => window.clearTimeout(t)
  }, [pos, pan, scale, focalId, rootMainId, allNodeIds])

  const resetToDefaultLayout = useCallback(() => {
    const ringR = ringRForGraphHeight(GRAPH_H)
    let layout = computeRadialLayout(focalId, charIdsSorted, GRAPH_W, GRAPH_H, ringR)
    if (playerLinks.length > 0) {
      layout[PLAYER_GRAPH_NODE_ID] = { x: GRAPH_W / 2, y: GRAPH_H / 2 + ringR + 82 }
    }
    layout = refineLayoutWithForces(layout, allNodeIds, focalId, GRAPH_W, GRAPH_H, ringR, platinum ? 56 : 28)
    setPos(layout)
    setScale(1)
    requestAnimationFrame(() => {
      const el = graphWrapRef.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const fp = layout[focalId]
      if (!fp) return
      const panNext = centerPanForFocal(fp.x, fp.y, box.width, box.height, 1)
      setPan(panNext)
      void personaDb.putNetworkGraphView({
        id: `${rootMainId}::${focalId}`,
        rootCharacterId: rootMainId,
        perspectiveCharacterId: focalId,
        scale: 1,
        pan: panNext,
        positions: layout,
        updatedAt: Date.now(),
      })
    })
  }, [focalId, rootMainId, allNodeIds, charIdsSorted, playerLinks.length, platinum])

  const resetLayoutRef = useRef(resetToDefaultLayout)
  resetLayoutRef.current = resetToDefaultLayout
  useEffect(() => {
    if (!resetSignal) return
    resetLayoutRef.current()
  }, [resetSignal])

  useEffect(() => {
    const el = graphWrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const d = e.deltaY > 0 ? -0.08 : 0.08
      setScale((s) => Math.min(2.2, Math.max(0.45, s + d)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /** 平移/缩放/拖节点时不要出现系统文字选取框或图片拖拽幽灵 */
  useEffect(() => {
    const el = graphWrapRef.current
    if (!el) return
    const block = (e: Event) => e.preventDefault()
    el.addEventListener('selectstart', block)
    el.addEventListener('dragstart', block)
    return () => {
      el.removeEventListener('selectstart', block)
      el.removeEventListener('dragstart', block)
    }
  }, [])

  const onPointerDownBg = (e: PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    window.getSelection?.()?.removeAllRanges?.()
    ;(e.currentTarget as unknown as SVGElement).setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null
    const p = panRef.current
    dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
  }

  const onPointerDownNode = (id: string, ox: number, oy: number) => (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    window.getSelection?.()?.removeAllRanges?.()
    nodeDragMovedRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null
    dragRef.current = { kind: 'node', id, sx: e.clientX, sy: e.clientY, ox, oy }
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return
    e.preventDefault()
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values())
      const a = pts[0]
      const b = pts[1]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.hypot(dx, dy) || 1
      if (!pinchRef.current) {
        pinchRef.current = { dist, scale, pan: panRef.current }
        dragRef.current = null
        return
      }
      const base = pinchRef.current
      const nextScale = Math.min(2.2, Math.max(0.45, (base.scale * dist) / base.dist))
      setScale(nextScale)
      return
    }

    const d = dragRef.current
    if (!d) return
    if (d.kind === 'node') {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 12) nodeDragMovedRef.current = true
      const dx = (e.clientX - d.sx) / scale
      const dy = (e.clientY - d.sy) / scale
      setPos((p) => ({ ...p, [d.id]: { x: d.ox + dx, y: d.oy + dy } }))
    } else {
      setPan({
        x: d.ox + (e.clientX - d.sx),
        y: d.oy + (e.clientY - d.sy),
      })
    }
  }

  const endPointer = (e: PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) dragRef.current = null
  }

  const finishNodePointer = (id: string, e: PointerEvent<SVGGElement>, treatAsTap: boolean) => {
    if (e.type === 'pointerup' && e.button !== 0) return
    e.stopPropagation()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const wasNode = dragRef.current?.kind === 'node' && dragRef.current.id === id
    const moved = nodeDragMovedRef.current
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) dragRef.current = null
    nodeDragMovedRef.current = false
    if (treatAsTap && wasNode && !moved) handleNodeTap(id)
  }

  const onNodePointerUp = (id: string) => (e: PointerEvent<SVGGElement>) => {
    finishNodePointer(id, e, true)
  }

  const onNodePointerCancel = (id: string) => (e: PointerEvent<SVGGElement>) => {
    finishNodePointer(id, e, false)
  }

  const clipYou = `cp-${svgUid}-${PLAYER_GRAPH_NODE_ID}`

  return (
    <div
      className={`overflow-hidden ${platinum ? 'rounded-[14px] bg-transparent p-3 sm:p-4' : 'rounded-xl bg-white p-5'}`}
      style={{ background: platinum ? 'transparent' : '#fff' }}
    >
      {dashboardChrome ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px]" style={{ color: platinum ? '#a3a3a3' : '#8e8e8e' }}>
            视角中心：<span style={{ color: platinum ? '#1C1C1E' : '#262626' }}>{focalName}</span>
          </p>
          <button
            type="button"
            onClick={resetToDefaultLayout}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              platinum ? 'border-neutral-200/90 text-[#1C1C1E] hover:bg-white' : ''
            }`}
            style={platinum ? undefined : { borderColor: '#dbdbdb', color: '#262626' }}
          >
            恢复默认排版
          </button>
        </div>
      ) : null}
      <div
        ref={graphWrapRef}
        className="mx-auto max-w-full"
        style={{
          touchAction: 'none',
          width: GRAPH_W,
          maxWidth: '100%',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      >
      <svg
        ref={svgRef}
        width={GRAPH_W}
        height={GRAPH_H}
        className="touch-none select-none [&_text]:select-none"
        style={{ WebkitUserSelect: 'none', userSelect: 'none' } as CSSProperties}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <defs>
          {playerLinks.length > 0 ? (
            <clipPath id={clipYou}>
              <circle cx={0} cy={0} r={20} />
            </clipPath>
          ) : null}
          {nodes.map((n) => (
            <clipPath key={`cp-${svgUid}-${n.id}`} id={`cp-${svgUid}-${n.id}`}>
              <circle cx={0} cy={0} r={20} />
            </clipPath>
          ))}
          {!platinum ? (
            <>
              <marker id={`arrEnd-${svgUid}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,4 L0,8 Z" fill="#111827" />
              </marker>
              <marker id={`arrStart-${svgUid}`} markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M8,0 L0,4 L8,8 Z" fill="#111827" />
              </marker>
            </>
          ) : null}
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          <rect
            x={0}
            y={0}
            width={GRAPH_W}
            height={GRAPH_H}
            fill="transparent"
            style={{ cursor: 'grab' }}
            onPointerDown={onPointerDownBg}
          />
          {pairEdges.map((pair) => {
            const a = pos[pair.aId]
            const b = pos[pair.bId]
            if (!a || !b) return null
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            const label =
              focalId === pair.aId
                ? pair.ab?.relation ?? pair.ba?.relation ?? ''
                : focalId === pair.bId
                  ? pair.ba?.relation ?? pair.ab?.relation ?? ''
                  : pair.ab?.relation ?? pair.ba?.relation ?? ''
            const labelTrim = String(label).trim()
            const labelW = platinum
              ? Math.max(36, Math.min(118, labelTrim.length * 6.5 + 18))
              : 112
            const labelH = platinum ? 16 : 20
            return (
              <g key={`${pair.aId}::${pair.bId}`}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onEdgeClick(pair.aId, pair.bId)}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={platinum ? '#d4d4d4' : '#111827'}
                  strokeWidth={platinum ? 0.85 : 1}
                  markerEnd={platinum ? 'none' : `url(#arrEnd-${svgUid})`}
                  markerStart={platinum ? 'none' : `url(#arrStart-${svgUid})`}
                  pointerEvents="none"
                />
                {labelTrim ? (
                  <>
                    <rect
                      x={mx - labelW / 2}
                      y={my - labelH / 2}
                      width={labelW}
                      height={labelH}
                      rx={platinum ? 4 : 6}
                      fill="#ffffff"
                      stroke={platinum ? 'none' : '#dbdbdb'}
                      strokeWidth={platinum ? 0 : 1}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdgeClick(pair.aId, pair.bId)
                      }}
                    />
                    <text
                      x={mx}
                      y={my + (platinum ? 3.5 : 4)}
                      textAnchor="middle"
                      fontSize={platinum ? 10 : 12}
                      fill={platinum ? '#525252' : '#262626'}
                      style={{ cursor: 'pointer', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                    >
                      {labelTrim}
                    </text>
                  </>
                ) : null}
              </g>
            )
          })}
          {playerLinks.length > 0 && pos[PLAYER_GRAPH_NODE_ID] ? (
            <g
              key={PLAYER_GRAPH_NODE_ID}
              transform={`translate(${pos[PLAYER_GRAPH_NODE_ID].x},${pos[PLAYER_GRAPH_NODE_ID].y})`}
              onPointerDown={onPointerDownNode(
                PLAYER_GRAPH_NODE_ID,
                pos[PLAYER_GRAPH_NODE_ID].x,
                pos[PLAYER_GRAPH_NODE_ID].y,
              )}
              onPointerUp={onNodePointerUp(PLAYER_GRAPH_NODE_ID)}
              onPointerCancel={onNodePointerCancel(PLAYER_GRAPH_NODE_ID)}
              style={{ cursor: 'grab' }}
            >
              {playerAvatarUrl.trim() ? (
                <>
                  <image
                    href={playerAvatarUrl}
                    x={-20}
                    y={-20}
                    width={40}
                    height={40}
                    clipPath={`url(#${clipYou})`}
                    preserveAspectRatio="xMidYMid slice"
                    style={{ WebkitUserDrag: 'none', userSelect: 'none' } as CSSProperties}
                  />
                  <circle r={20} fill="none" stroke={platinum ? '#ffffff' : '#000000'} strokeWidth={platinum ? 1.5 : 2} />
                </>
              ) : (
                <circle r={20} fill="#ffffff" stroke={platinum ? '#e5e5e5' : '#000000'} strokeWidth={platinum ? 1.5 : 2} />
              )}
              <text
                y={36}
                textAnchor="middle"
                fontSize={12}
                fill="#262626"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}
              >
                你
              </text>
            </g>
          ) : null}
          {nodes.map((n) => {
            const p = pos[n.id]
            if (!p) return null
            const isFocal = n.id === focalId
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                onPointerDown={onPointerDownNode(n.id, p.x, p.y)}
                onPointerUp={onNodePointerUp(n.id)}
                onPointerCancel={onNodePointerCancel(n.id)}
                style={{ cursor: 'grab' }}
              >
                {n.avatarUrl?.trim() ? (
                  <>
                    {isFocal && platinum ? (
                      <circle r={27} fill="none" stroke="#D4AF37" strokeOpacity={0.28} strokeWidth={1} />
                    ) : null}
                    <image
                      href={n.avatarUrl}
                      x={-20}
                      y={-20}
                      width={40}
                      height={40}
                      clipPath={`url(#cp-${svgUid}-${n.id})`}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ WebkitUserDrag: 'none', userSelect: 'none' } as CSSProperties}
                    />
                    <circle r={20} fill="none" stroke={platinum ? '#ffffff' : '#dbdbdb'} strokeWidth={platinum ? 1.25 : 1} />
                    {isFocal && !platinum ? <circle r={23} fill="none" stroke="#111827" strokeWidth={1.5} /> : null}
                  </>
                ) : (
                  <>
                    {isFocal && platinum ? (
                      <circle r={27} fill="none" stroke="#D4AF37" strokeOpacity={0.28} strokeWidth={1} />
                    ) : null}
                    <circle r={20} fill="#fafafa" stroke={platinum ? '#e5e5e5' : '#dbdbdb'} strokeWidth={1} />
                    {isFocal && !platinum ? <circle r={23} fill="none" stroke="#111827" strokeWidth={1.5} /> : null}
                  </>
                )}
                <text
                  y={36}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#262626"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}
                >
                  {n.name}
                </text>
                {linkedIdSet.has(n.id) ? (
                  <text
                    y={52}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#8e8e8e"
                    style={{ userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}
                  >
                    跨主角
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>
      </div>
      {dashboardChrome ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed" style={{ color: platinum ? '#a3a3a3' : '#8e8e8e' }}>
          单击头像切换视角中心（「你」不可切视角）· 连点打开人设 · 拖节点 / 空白平移 · 捏合或滚轮缩放 · 点击连线或标签查看；含「你」的连线可编辑。完整编辑请用「深度编辑关系图」。
        </p>
      ) : null}
    </div>
  )
}
