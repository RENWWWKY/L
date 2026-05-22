import { motion } from 'framer-motion'

export type RoleScriptBookProps = {
  coverImageUrl?: string
  layoutId?: string
  /** compact = 牌阵小册；hero = 翻书仪式大图 */
  size?: 'compact' | 'hero'
  /** 牌阵选角：无投影，贴平面陈列 */
  flat?: boolean
  alt?: string
}

export function RoleScriptBook({
  coverImageUrl,
  layoutId,
  size = 'compact',
  flat = false,
  alt = '',
}: RoleScriptBookProps) {
  const coverInner = coverImageUrl ? (
    <img src={coverImageUrl} alt={alt} className="h-full w-full object-cover" />
  ) : (
    <div
      className="h-full w-full"
      style={{ background: 'linear-gradient(160deg, #ebe6dc 0%, #d9d4c8 100%)' }}
      aria-hidden
    />
  )

  const coverNode = layoutId ? (
    <motion.div
      layoutId={layoutId}
      className="absolute inset-0"
      transition={{ type: 'spring', stiffness: 280, damping: 32 }}
    >
      {coverInner}
    </motion.div>
  ) : (
    <div className="absolute inset-0">{coverInner}</div>
  )

  return (
    <div
      className={`jbs-gf-role-script-book ${size === 'hero' ? 'jbs-gf-role-script-book--hero' : ''} ${flat ? 'jbs-gf-role-script-book--flat' : ''}`}
    >
      <div className="jbs-gf-role-script-book-volume">
        <div className="jbs-gf-role-script-book-face">{coverNode}</div>
      </div>
    </div>
  )
}
