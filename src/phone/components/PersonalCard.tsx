import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'

import { useCustomization } from '../CustomizationContext'
import { resolveProfileAvatarPreviewUrl } from '../utils/characterAvatarUrl'
import { resolvePersonalCardBackgroundUrl } from '../utils/personalCardAssets'
import { PersonalCardEditModal } from './PersonalCardEditModal'

function formatDate(d: Date) {
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${w}`
}

function splitDateForNumberStyle(dateText: string) {
  const parts: Array<{ kind: 'num' | 'text'; value: string }> = []
  const re = /(\d+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(dateText))) {
    const idx = m.index
    if (idx > last) parts.push({ kind: 'text', value: dateText.slice(last, idx) })
    parts.push({ kind: 'num', value: m[1] ?? '' })
    last = idx + (m[1]?.length ?? 0)
  }
  if (last < dateText.length) parts.push({ kind: 'text', value: dateText.slice(last) })
  return parts
}

export type PersonalCardProps = {
  /** 为 false 时不可点击（桌面组件编辑模式） */
  interactive?: boolean
}

export function PersonalCard({ interactive = true }: PersonalCardProps) {
  const { state, setPersonalCardProfile, setPersonalCardBackgroundUrl } = useCustomization()
  const { personalCardProfile: profile, personalCardBackgroundUrl, theme } = state
  const [editOpen, setEditOpen] = useState(false)

  const dateText = formatDate(new Date())
  const dateParts = splitDateForNumberStyle(dateText)
  const bgStyle = useMemo(
    () => resolvePersonalCardBackgroundUrl(personalCardBackgroundUrl),
    [personalCardBackgroundUrl],
  )

  const openEdit = interactive
    ? () => {
        setEditOpen(true)
      }
    : undefined

  return (
    <>
      <section
        data-desktop-static="true"
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={openEdit}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setEditOpen(true)
                }
              }
            : undefined
        }
        className={`relative h-full overflow-hidden shadow-[var(--phone-shadow)]${interactive ? ' cursor-pointer transition-opacity active:opacity-[0.97]' : ''}`}
        style={{
          background: theme.surface,
          borderRadius: 'var(--phone-radius-lg)',
          border: `1px solid ${theme.border}`,
        }}
        aria-label={interactive ? '编辑桌面个人名片' : undefined}
      >
        {interactive ? (
          <span
            className="absolute right-2.5 top-2.5 z-[2] flex size-7 items-center justify-center rounded-full border bg-white/88 shadow-sm backdrop-blur-sm"
            style={{ borderColor: theme.border, color: theme.textMuted }}
            aria-hidden
          >
            <Pencil className="size-3.5" strokeWidth={1.75} />
          </span>
        ) : null}
        <div
          className="h-1/2 w-full"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.2) 100%), url(${JSON.stringify(bgStyle)})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            backgroundColor: theme.surfaceMuted,
          }}
        />
        <div className="relative px-5 pb-5 pt-0">
          <div
            className="mx-auto flex w-full max-w-[280px] flex-col items-center"
            style={{ marginTop: '-36px' }}
          >
            <div
              className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden text-2xl shadow-[var(--phone-shadow)]"
              style={{
                borderRadius: '999px',
                background: theme.surfaceMuted,
                border: `2px solid ${theme.surface}`,
                color: theme.text,
              }}
            >
              {profile.avatarImageUrl ? (
                <img
                  src={resolveProfileAvatarPreviewUrl(profile.avatarImageUrl)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden>{profile.avatarEmoji}</span>
              )}
            </div>
            <h2
              className="mt-3 text-center text-[1.35rem] font-semibold tracking-tight"
              style={{ color: theme.text }}
            >
              {profile.displayName}
            </h2>
            <p
              className="mt-1 text-center text-[13px] leading-relaxed"
              style={{ color: theme.textMuted }}
            >
              {profile.signature}
            </p>
            <p
              className="mt-3 text-[11px] uppercase tracking-[0.2em]"
              style={{ color: theme.textMuted }}
            >
              {dateParts.map((p, idx) =>
                p.kind === 'num' ? (
                  <span
                    key={`${idx}-${p.value}`}
                    style={{
                      fontFamily: 'var(--wx-num-font, var(--phone-font))',
                      fontVariantNumeric: 'tabular-nums lining-nums',
                      fontFeatureSettings: '"tnum" 1, "lnum" 1',
                      display: 'inline-block',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {p.value}
                  </span>
                ) : (
                  <span key={`${idx}-${p.value}`}>{p.value}</span>
                ),
              )}
            </p>
          </div>
        </div>
      </section>

      <PersonalCardEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        backgroundUrl={personalCardBackgroundUrl}
        onSave={({ profile: profilePatch, backgroundUrl }) => {
          setPersonalCardProfile(profilePatch)
          setPersonalCardBackgroundUrl(backgroundUrl)
        }}
      />
    </>
  )
}
