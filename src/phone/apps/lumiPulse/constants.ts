import type { PulsePersistedRoot } from './pulseTypes'

export const LUMI_PULSE_KV_KEY = 'lumi-pulse-persist-v1'

/** Soft Pastel Light Luxury palette */
export const PULSE_COLORS = {
  bg: '#FCFCFC',
  surface: '#FFFFFF',
  subtle: '#F5F5F4',
  ink: '#1C1C1E',
  muted: '#9CA3AF',
  dustyRose: '#E5989B',
  mistBlue: '#A2B2C6',
  sage: '#A3C4BC',
  lightGold: '#D4AF37',
  hairline: 'rgba(0,0,0,0.04)',
} as const

export const PULSE_CARD_SHADOW = 'shadow-[0_2px_15px_rgba(0,0,0,0.03)]'

export const PULSE_SHEET_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 38,
  mass: 0.9,
}

export const PULSE_MODAL_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 36,
  mass: 0.95,
}

export const PULSE_LIKE_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 22,
  mass: 0.6,
}

export const PULSE_STAGGER = {
  staggerChildren: 0.05,
  delayChildren: 0.04,
}

export const DEFAULT_PULSE_ROOT: PulsePersistedRoot = {
  version: 1,
  byAccount: {},
}
