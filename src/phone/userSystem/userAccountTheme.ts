export const USER_ACCOUNT_THEME_KEY = 'us_account_ui_theme'

export type UserAccountTheme = 'light' | 'dark'

export function readUserAccountTheme(): UserAccountTheme {
  try {
    return localStorage.getItem(USER_ACCOUNT_THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function writeUserAccountTheme(theme: UserAccountTheme): void {
  try {
    localStorage.setItem(USER_ACCOUNT_THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

export type UserAccountThemeTokens = {
  page: string
  header: string
  headerBtn: string
  subtitle: string
  sidebar: string
  sidebarActive: string
  sidebarIdle: string
  card: string
  muted: string
  input: string
  label: string
  primaryBtn: string
  secondaryBtn: string
  authTabs: string
  authTabActive: string
  authTabIdle: string
  errorBox: string
  infoBox: string
  claimBox: string
  claimCode: string
  claimHint: string
  accentBtn: string
  accentOutline: string
  statusRejected: string
}

const LIGHT: UserAccountThemeTokens = {
  page: 'bg-[#F5F6F8] text-[#1C1C1E]',
  header: 'border-black/8 bg-white/90',
  headerBtn: 'border-black/10',
  subtitle: 'text-[#1C1C1E]/50',
  sidebar: 'border-black/8 bg-white',
  sidebarActive: 'bg-[#1C1C1E] text-white',
  sidebarIdle: 'text-[#1C1C1E]/55 active:bg-black/5',
  card: 'border-black/8 bg-white',
  muted: 'text-[#1C1C1E]/55',
  input: 'border-black/10 bg-[#FAFAFA] text-[#1C1C1E]',
  label: 'text-[#1C1C1E]/55',
  primaryBtn: 'bg-[#1C1C1E] text-white',
  secondaryBtn: 'border-black/10 text-[#1C1C1E]/70',
  authTabs: 'bg-[#E5E7EB]',
  authTabActive: 'bg-white text-[#1C1C1E] shadow-sm',
  authTabIdle: 'text-[#1C1C1E]/50',
  errorBox: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  infoBox: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]',
  claimBox: 'border-[#4F46E5] bg-[#EEF2FF]',
  claimCode: 'text-[#4F46E5]',
  claimHint: 'text-[#3730A3]',
  accentBtn: 'bg-[#4F46E5] text-white',
  accentOutline: 'border-[#4F46E5] text-[#4F46E5]',
  statusRejected: 'bg-[#FFF1F2] text-[#BE123C]',
}

const DARK: UserAccountThemeTokens = {
  page: 'bg-[#0f1419] text-[#e7ecf3]',
  header: 'border-[#2d3a4d] bg-[#1a2332]/95',
  headerBtn: 'border-[#2d3a4d]',
  subtitle: 'text-[#8b9cb3]',
  sidebar: 'border-[#2d3a4d] bg-[#1a2332]',
  sidebarActive: 'bg-[#3b82f6] text-white',
  sidebarIdle: 'text-[#8b9cb3] active:bg-white/5',
  card: 'border-[#2d3a4d] bg-[#1a2332]',
  muted: 'text-[#8b9cb3]',
  input: 'border-[#2d3a4d] bg-[#0f1419] text-[#e7ecf3]',
  label: 'text-[#8b9cb3]',
  primaryBtn: 'bg-[#3b82f6] text-white',
  secondaryBtn: 'border-[#2d3a4d] text-[#8b9cb3]',
  authTabs: 'bg-[#0f1419]',
  authTabActive: 'bg-[#1a2332] text-[#e7ecf3] shadow-sm',
  authTabIdle: 'text-[#8b9cb3]',
  errorBox: 'border-[#ef4444]/40 bg-[#ef4444]/15 text-[#fca5a5]',
  infoBox: 'border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#93c5fd]',
  claimBox: 'border-[#3b82f6] bg-[#3b82f6]/10',
  claimCode: 'text-[#93c5fd]',
  claimHint: 'text-[#8b9cb3]',
  accentBtn: 'bg-[#3b82f6] text-white',
  accentOutline: 'border-[#3b82f6] text-[#93c5fd]',
  statusRejected: 'bg-[#ef4444]/15 text-[#fca5a5]',
}

export function userAccountThemeTokens(theme: UserAccountTheme): UserAccountThemeTokens {
  return theme === 'dark' ? DARK : LIGHT
}

export const STATUS_BADGE_LIGHT: Record<string, string> = {
  normal: 'bg-[#DCFCE7] text-[#166534]',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
  banned: 'bg-[#FEE2E2] text-[#991B1B]',
  rejected: 'bg-[#FFE4E6] text-[#BE123C]',
}

export const STATUS_BADGE_DARK: Record<string, string> = {
  normal: 'bg-[#22c55e]/20 text-[#86efac]',
  pending: 'bg-[#f59e0b]/20 text-[#fcd34d]',
  banned: 'bg-[#ef4444]/20 text-[#fca5a5]',
  rejected: 'bg-[#ef4444]/20 text-[#fca5a5]',
}
