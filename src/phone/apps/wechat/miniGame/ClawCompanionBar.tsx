import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'

function AvatarCircle({ url, label }: { url?: string; label: string }) {
  const resolved = resolveCharacterAvatarUrl({ avatarUrl: url }) || undefined
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-white shadow-sm">
      {resolved ? (
        <img src={resolved} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-[11px] text-[#9CA3AF]">
          {label}
        </div>
      )}
    </div>
  )
}

function BubbleBelow({ text, visible }: { text: string | null; visible: boolean }) {
  const show = visible && !!text
  return (
    <div className="mt-2 flex min-h-[40px] w-[min(42vw,148px)] justify-center">
      <div
        className={`w-full transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden={!show}
      >
        {text ? (
          <p
            className="rounded-2xl border border-white/70 bg-white/85 px-3 py-2 text-center text-[13px] leading-snug text-[#0A0A0C] shadow-sm backdrop-blur-md"
            style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
          >
            {text}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function ClawCompanionBar({
  playerAvatarUrl,
  charAvatarUrl,
  charName,
  reactionText,
  reactionVisible,
  playerScore = 0,
  charScore = 0,
  playerGoesFirst: _playerGoesFirst = true,
  aiThinking = false,
  gameOver = false,
  activePlayer = 1,
}: {
  playerAvatarUrl?: string
  charAvatarUrl?: string
  charName?: string
  reactionText: string | null
  reactionVisible: boolean
  playerScore?: number
  charScore?: number
  playerGoesFirst?: boolean
  aiThinking?: boolean
  gameOver?: boolean
  activePlayer?: 1 | 2
}) {
  const showBubble = reactionVisible && !!reactionText
  const peer = charName?.trim() || '对方'
  const isPlayerTurn = activePlayer === 1
  const playerTurnHint = gameOver ? '' : aiThinking ? '等待下爪' : isPlayerTurn ? '轮到你' : '等待对方'
  const charTurnHint = gameOver ? '' : aiThinking ? '瞄准中…' : isPlayerTurn ? '等待对方' : '轮到 TA'

  return (
    <div className="pointer-events-none flex w-full max-w-[min(92vw,420px)] flex-col items-center">
      <div className="flex items-start justify-center gap-10 sm:gap-14">
        <div className="flex flex-col items-center">
          <AvatarCircle url={playerAvatarUrl} label="我" />
          <div className="mt-1 text-[10px] tracking-wide text-[#9CA3AF]">你</div>
          <div
            className={`mt-0.5 text-[11px] font-medium tabular-nums ${
              !gameOver && isPlayerTurn && !aiThinking ? 'text-emerald-600' : 'text-[#374151]'
            }`}
          >
            {playerTurnHint || `${playerScore} 分`}
          </div>
          <div className="mt-2 min-h-[40px] w-[min(42vw,148px)]" aria-hidden />
        </div>
        <div className="flex flex-col items-center">
          <AvatarCircle url={charAvatarUrl} label={charName?.trim().slice(0, 1) || 'TA'} />
          <div className="mt-1 max-w-[88px] truncate text-[10px] tracking-wide text-[#9CA3AF]">
            {peer}
          </div>
          <div
            className={`mt-0.5 text-[11px] font-medium tabular-nums ${
              !gameOver && !isPlayerTurn && !aiThinking ? 'text-emerald-600' : 'text-[#374151]'
            }`}
          >
            {charTurnHint || `${charScore} 分`}
          </div>
          <BubbleBelow text={reactionText} visible={showBubble} />
        </div>
      </div>
    </div>
  )
}
