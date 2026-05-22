import { motion } from 'framer-motion'

import type { DeckRoleCard } from './gameFlowTypes'
import { roleDeckCardLayoutId } from './roleDeckLayout'
import { RoleScriptBook } from './RoleScriptBook'

export type RoleFlipBookProps = {
  scriptId: string
  card: DeckRoleCard
  coverOpen: boolean
  sharedLayout?: boolean
  scale?: number
}

export function RoleFlipBook({
  scriptId,
  card,
  coverOpen,
  sharedLayout = true,
  scale = 1,
}: RoleFlipBookProps) {
  const layoutId = sharedLayout ? roleDeckCardLayoutId(scriptId, card.id) : undefined

  return (
    <div className="jbs-gf-role-flip-scene">
      <motion.div
        className="jbs-gf-role-flip-book"
        initial={{ scale: 0.9 }}
        animate={{ scale }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div className="jbs-gf-role-flip-inner" aria-hidden={!coverOpen} />

        <motion.div
          className="jbs-gf-role-flip-cover-wrap"
          style={{ transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: coverOpen ? -165 : 0 }}
          transition={{ duration: 0.95, ease: [0.33, 1, 0.68, 1] }}
        >
          <div className="jbs-gf-role-flip-cover-slot">
            <RoleScriptBook
              coverImageUrl={card.coverImageUrl}
              layoutId={layoutId}
              size="hero"
              alt=""
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
