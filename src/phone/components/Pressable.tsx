import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'

type Props = HTMLMotionProps<'button'> & {
  children: ReactNode
  className?: string
}

/** 统一点击缩放反馈 */
export const Pressable = forwardRef<HTMLButtonElement, Props>(function Pressable({ children, className, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 520, damping: 35 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  )
})
