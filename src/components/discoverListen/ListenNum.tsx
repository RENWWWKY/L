import type { ReactNode } from 'react'

import { listenNumMetaClass } from './listenTogetherTypography'

type ListenNumProps = {
  children: ReactNode
  className?: string
}

/** 包裹任意数字或含数字的短文案（如 2天前、12w） */
export function ListenNum({ children, className = '' }: ListenNumProps) {
  return <span className={listenNumMetaClass(className)}>{children}</span>
}
