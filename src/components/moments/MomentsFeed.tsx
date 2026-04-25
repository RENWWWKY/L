import { motion } from 'framer-motion'

import { MomentItem } from './MomentItem'
import type { MomentItemModel } from './mockMoments'

type MomentsFeedProps = {
  moments: MomentItemModel[]
  currentUserName: string
}

export function MomentsFeed({ moments, currentUserName }: MomentsFeedProps) {
  return (
    <section className="mt-22 pt-4 divide-y divide-black/5">
      {moments.map((item, idx) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: Math.min(0.05 * idx, 0.2) }}
        >
          <MomentItem item={item} currentUserName={currentUserName} />
        </motion.div>
      ))}
    </section>
  )
}
