import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import type { Character, PlayerIdentity } from '../types'
import { formatPlayerIdentityDisplayName } from '../../wechatCharacterPlayerIdentity'
import { formatIdentityBindingDisplay, formatPlayerIdentityRosterLabel, PERSONA_SERIF, playerIdentityProfessionTag } from './personaRosterDisplay'
import { PersonaRosterAvatar } from './PersonaRosterAvatar'
import { boundMainCharId } from './personaRosterTypes'

export type IdentityBindingChain = {
  identityId: string
  identityLabel: string
  mains: Array<{
    main: Character
    npcs: Character[]
  }>
}

export function buildIdentityBindingChains(
  mainCharacters: Character[],
  npcCharacters: Character[],
  identityList: PlayerIdentity[],
  identityNameById: Record<string, string>,
): IdentityBindingChain[] {
  const identityIds = new Set<string>()
  for (const c of [...mainCharacters, ...npcCharacters]) {
    const pid = c.playerIdentityId?.trim()
    if (pid) identityIds.add(pid)
  }
  for (const i of identityList) {
    if (i.id?.trim()) identityIds.add(i.id.trim())
  }

  const npcByMain = new Map<string, Character[]>()
  for (const n of npcCharacters) {
    const root = boundMainCharId(n)
    if (!root) continue
    const arr = npcByMain.get(root) ?? []
    arr.push(n)
    npcByMain.set(root, arr)
  }

  const chains: IdentityBindingChain[] = []
  for (const identityId of identityIds) {
    const mains = mainCharacters.filter((m) => m.playerIdentityId?.trim() === identityId)
    const sample =
      mains[0] ?? npcCharacters.find((n) => n.playerIdentityId?.trim() === identityId)
    const label = sample
      ? formatIdentityBindingDisplay(sample, identityId, identityList, identityNameById)
      : formatPlayerIdentityRosterLabel(identityId, identityList, identityNameById)
    chains.push({
      identityId,
      identityLabel: label,
      mains: mains.map((main) => ({
        main,
        npcs: npcByMain.get(main.id) ?? [],
      })),
    })
  }

  chains.sort((a, b) => a.identityLabel.localeCompare(b.identityLabel, 'zh'))
  return chains
}

function BindingChainRow({
  chain,
  identityRow,
}: {
  chain: IdentityBindingChain
  identityRow: PlayerIdentity | undefined
}) {
  const professionTag = playerIdentityProfessionTag(identityRow)
  const identityName = formatPlayerIdentityDisplayName(identityRow, chain.identityId)
  const wxNick = identityRow?.wechatNickname?.trim()

  return (
    <article className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3">
        <PersonaRosterAvatar character={identityRow ?? null} size={44} kind="identity" />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">
            USER IDENTITY | 用户身份
          </p>
          <p
            className="mt-1 truncate text-[17px] font-medium text-[#111827]"
            style={{ fontFamily: PERSONA_SERIF }}
          >
            <span>{identityName}</span>
            {professionTag ? (
              <span className="ml-2 text-[12px] font-normal tracking-wide text-[#9CA3AF]">
                [ {professionTag} ]
              </span>
            ) : null}
            {wxNick ? (
              <span className="ml-1 text-[14px] font-normal text-[#6B7280]">@{wxNick}</span>
            ) : null}
          </p>
        </div>
      </div>

      {chain.mains.length ? (
        <ul className="mt-4 space-y-3 list-none p-0 m-0">
          {chain.mains.map(({ main, npcs }) => (
            <li key={main.id} className="rounded-2xl bg-[#F9FAFB]/80 p-4">
              <div className="flex items-center gap-3">
                <PersonaRosterAvatar character={main} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium tracking-wide text-[#9CA3AF]">主要角色</p>
                  <p
                    className="mt-0.5 truncate text-[15px] font-medium text-[#111827]"
                    style={{ fontFamily: PERSONA_SERIF }}
                  >
                    {main.name?.trim() || '未命名'}
                  </p>
                  {main.identity?.trim() ? (
                    <p className="mt-0.5 truncate text-[12px] text-[#9CA3AF]">[ {main.identity.trim()} ]</p>
                  ) : null}
                </div>
              </div>

              {npcs.length ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center gap-1.5 pl-1">
                    <ChevronRight className="size-3.5 text-[#D1D5DB]" strokeWidth={1.5} aria-hidden />
                    <p className="text-[11px] font-medium tracking-wide text-[#9CA3AF]">关联 NPC</p>
                  </div>
                  <ul className="space-y-2 list-none p-0 m-0">
                    {npcs.map((n) => (
                      <li key={n.id} className="flex items-center gap-2.5 rounded-xl bg-white/70 px-2 py-1.5">
                        <PersonaRosterAvatar character={n} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[#374151]">
                            {n.name?.trim() || '未命名'}
                          </p>
                          {n.identity?.trim() ? (
                            <p className="truncate text-[11px] text-[#9CA3AF]">[ {n.identity.trim()} ]</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 pl-1 text-[11px] text-[#9CA3AF]">暂无关联 NPC</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-[#F9FAFB]/80 px-4 py-3 text-[12px] text-[#9CA3AF]">
          该身份下暂无已绑定的主要角色（NPC 可能仍通过副绑定关联）
        </p>
      )}
    </article>
  )
}

export function CrossBindings({
  chains,
  identityList,
  loading,
  onRebind,
}: {
  chains: IdentityBindingChain[]
  identityList: PlayerIdentity[]
  loading: boolean
  onRebind: () => void
}) {
  const totalMaps = useMemo(
    () => chains.reduce((n, c) => n + Math.max(1, c.mains.length), 0),
    [chains],
  )

  const identityById = useMemo(() => {
    const map = new Map<string, PlayerIdentity>()
    for (const i of identityList) {
      const id = i.id?.trim()
      if (id) map.set(id, i)
    }
    return map
  }, [identityList])

  if (loading && !chains.length) {
    return (
      <p className="py-12 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-[#9CA3AF]">
        MAPPING WORLD LINES…
      </p>
    )
  }

  if (!chains.length) {
    return (
      <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <p className="text-[16px] font-medium text-[#111827]" style={{ fontFamily: PERSONA_SERIF }}>
          尚无身份映射
        </p>
        <p className="mt-3 text-[13px] font-light leading-relaxed text-[#9CA3AF]">
          绑定「我的身份」与主角后，此处将展示完整入局链路。
        </p>
        <button
          type="button"
          onClick={onRebind}
          className="mt-6 rounded-full border border-[#1C1C1E]/20 bg-transparent px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1C1C1E] transition-opacity hover:opacity-70"
        >
          重新绑定 (Rebind)
        </button>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#9CA3AF]">
          ACTIVE MAPS · {totalMaps}
        </p>
        <button
          type="button"
          onClick={onRebind}
          className="rounded-full border border-[#1C1C1E]/20 bg-transparent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1C1C1E] transition-opacity hover:opacity-70"
        >
          重新绑定 (Rebind)
        </button>
      </div>

      {chains.map((chain) => (
        <BindingChainRow
          key={chain.identityId}
          chain={chain}
          identityRow={identityById.get(chain.identityId)}
        />
      ))}
    </motion.div>
  )
}
