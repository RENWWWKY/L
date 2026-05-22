/** 极简五角星评级（无 Emoji） */

function StarIcon({ filled, size = 11 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0"
      aria-hidden
    >
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={filled ? '#5c3d2e' : 'none'}
        stroke="#5c3d2e"
        strokeWidth="1.2"
        opacity={filled ? 1 : 0.35}
      />
    </svg>
  )
}

export function StarRating({
  label,
  value,
  max = 5,
}: {
  label: string
  value: number
  max?: number
}) {
  const n = Math.min(max, Math.max(0, Math.round(value)))
  return (
    <span className="inline-flex items-center gap-0.5 font-serif text-[10px] text-[#1a1a1a]/75">
      <span className="mr-0.5 tracking-wide">{label}</span>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} filled={i < n} />
      ))}
    </span>
  )
}
