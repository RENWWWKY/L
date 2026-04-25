type MomentsCoverProps = {
  coverUrl: string
  nickname: string
  avatarUrl: string
}

export function MomentsCover({ coverUrl, nickname, avatarUrl }: MomentsCoverProps) {
  return (
    <header className="relative z-10 h-[30vh] min-h-[220px] max-h-[320px] overflow-visible">
      <img src={coverUrl} alt="Moments cover" className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/46 via-black/12 to-transparent" />
      <div
        className="absolute bottom-2 right-[88px] text-right text-[20px] font-semibold tracking-[0.01em] text-white"
        style={{ textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
      >
        {nickname}
      </div>
      <img
        src={avatarUrl}
        alt={nickname}
        className="absolute -bottom-5 right-4 z-20 h-16 w-16 rounded-2xl border border-white/80 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
      />
    </header>
  )
}
