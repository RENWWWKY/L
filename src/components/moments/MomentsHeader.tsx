type MomentsHeaderProps = {
  coverUrl: string
  nickname: string
  avatarUrl: string
}

export function MomentsHeader({ coverUrl, nickname, avatarUrl }: MomentsHeaderProps) {
  return (
    <header className="relative h-[220px] overflow-hidden rounded-b-[22px]">
      <img src={coverUrl} alt="Moments cover" className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
      <div className="absolute bottom-4 right-4 flex items-end gap-3">
        <div className="pb-1 text-right text-[19px] font-semibold tracking-[0.01em] text-white">{nickname}</div>
        <img
          src={avatarUrl}
          alt={nickname}
          className="h-16 w-16 rounded-2xl border border-white/70 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
        />
      </div>
    </header>
  )
}
