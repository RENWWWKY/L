import type { Character, PlayerIdentity } from '../types'
import type { WechatAccountsBundle } from '../../wechatAccountTypes'
import {
  formatIdentityBindingDisplay,
  metaGender,
  metaMbti,
  metaZodiac,
  PERSONA_SERIF,
} from './personaRosterDisplay'
import { PersonaRosterAvatar } from './PersonaRosterAvatar'
import { boundMainCharId } from './personaRosterTypes'

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-medium text-[#374151]">{value}</p>
    </div>
  )
}

function PersonaNpcCompactCard({
  character,
  identityList,
  identityNameById,
  mainById,
  mainNameById,
}: {
  character: Character
  identityList: PlayerIdentity[]
  identityNameById: Record<string, string>
  mainById: Record<string, Character>
  mainNameById: Record<string, string>
}) {
  const name = character.name?.trim() || '未命名'
  const identityTag = character.identity?.trim()
  const metaLine = [metaGender(character), metaMbti(character), metaZodiac(character)].join(' · ')
  const subtitle = identityTag ? `[ ${identityTag} ] · ${metaLine}` : metaLine
  const identityLine = formatIdentityBindingDisplay(
    character,
    character.playerIdentityId,
    identityList,
    identityNameById,
  )
  const rootId = boundMainCharId(character)
  const main = rootId ? mainById[rootId] : undefined
  const mainName = main?.name?.trim() || mainNameById[rootId]?.trim() || '未命名主角'

  return (
    <article className="rounded-2xl bg-white px-3.5 py-3 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5">
        <PersonaRosterAvatar character={character} size={40} />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-[15px] font-medium leading-snug text-[#111827]"
            style={{ fontFamily: PERSONA_SERIF }}
          >
            {name}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-[#9CA3AF]">{subtitle}</p>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5 text-[11px] leading-snug">
        <p className="truncate text-[#6B7280]">
          <span className="text-[#9CA3AF]">绑定身份</span>
          <span className="mx-1 text-[#D1D5DB]">·</span>
          <span style={{ fontFamily: PERSONA_SERIF }}>{identityLine}</span>
        </p>
        {rootId ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-[#F9FAFB]/90 px-2 py-1.5">
            <span className="shrink-0 text-[10px] text-[#9CA3AF]">围绕主角</span>
            <PersonaRosterAvatar character={main} size={22} />
            <span
              className="min-w-0 truncate text-[12px] font-medium text-[#374151]"
              style={{ fontFamily: PERSONA_SERIF }}
            >
              {mainName}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function PersonaCard({
  character,
  variant,
  identityList,
  identityNameById,
  mainNameById,
  mainById = {},
}: {
  character: Character
  variant: 'main' | 'npc'
  identityList: PlayerIdentity[]
  identityNameById: Record<string, string>
  mainNameById: Record<string, string>
  mainById?: Record<string, Character>
  accountsBundle?: WechatAccountsBundle | null
}) {
  if (variant === 'npc') {
    return (
      <PersonaNpcCompactCard
        character={character}
        identityList={identityList}
        identityNameById={identityNameById}
        mainById={mainById}
        mainNameById={mainNameById}
      />
    )
  }

  const identityLine = formatIdentityBindingDisplay(
    character,
    character.playerIdentityId,
    identityList,
    identityNameById,
  )
  const identityTag = character.identity?.trim()

  return (
    <article className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
      <header className="flex items-start gap-4">
        <PersonaRosterAvatar character={character} size={48} />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-[20px] font-medium leading-tight text-[#111827]"
            style={{ fontFamily: PERSONA_SERIF }}
          >
            {character.name?.trim() || '未命名'}
          </h3>
          {identityTag ? (
            <p className="mt-1 text-[12px] font-light tracking-wide text-[#9CA3AF]">[ {identityTag} ]</p>
          ) : null}
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        <MetaCell label="GENDER | 性别" value={metaGender(character)} />
        <MetaCell label="MBTI | 人格" value={metaMbti(character)} />
        <MetaCell label="ZODIAC | 星座" value={metaZodiac(character)} />
        <MetaCell label="ARCHIVE | 档案" value="主角" />
      </div>

      <div className="mt-4 rounded-xl bg-[#F9FAFB]/80 p-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">
          USER IDENTITY BOUND | 绑定的用户身份
        </p>
        <p
          className="mt-2 truncate text-[14px] text-[#374151]"
          style={{ fontFamily: PERSONA_SERIF }}
        >
          {identityLine}
        </p>
      </div>
    </article>
  )
}
