import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Flag, LockOpen, Megaphone, Menu, Moon, Sun, UserCircle2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDeviceFingerprint, getPublicIp } from '../../userSystem/deviceFingerprint'
import {
  logoutUser,
  fetchUserProfile,
  getAuthToken,
  getStoredUsername,
  loginUser,
  readBannedNotice,
  registerUser,
} from '../../userSystem/userSystemApi'
import { accountStatusLabel, formatAccountDate } from '../../userSystem/accountStatusLabel'
import { AccountNum, AccountNumericText } from '../../userSystem/AccountNum'
import {
  readUserAccountTheme,
  STATUS_BADGE_DARK,
  STATUS_BADGE_LIGHT,
  userAccountThemeTokens,
  writeUserAccountTheme,
  type UserAccountTheme,
} from '../../userSystem/userAccountTheme'
import { type UserAccountTab, type UserProfile } from '../../userSystem/types'
import { UserAccountAnnouncementPanel } from './UserAccountAnnouncementPanel'
import { UserAccountReportPanel } from './UserAccountReportPanel'
import { UserAccountUnbanPanel } from './UserAccountUnbanPanel'

type AuthTab = 'login' | 'register'
type LoggedInTab = 'announcement' | 'report' | 'unban' | 'overview'

type Props = {
  onBack: () => void
  initialTab?: UserAccountTab
  initialAuthTab?: AuthTab
  onAuthChange?: () => void
}

const LOGGED_IN_NAV: { id: LoggedInTab; label: string; icon: typeof UserCircle2 }[] = [
  { id: 'announcement', label: '公告', icon: Megaphone },
  { id: 'report', label: '举报', icon: Flag },
  { id: 'unban', label: '解封申请', icon: LockOpen },
  { id: 'overview', label: '账号概览', icon: UserCircle2 },
]

function resolveLoggedInTab(tab?: UserAccountTab): LoggedInTab {
  if (tab === 'announcement') return 'announcement'
  if (tab === 'report') return 'report'
  if (tab === 'unban') return 'unban'
  return 'overview'
}

export function UserAccountApp({ onBack, initialTab = 'overview', initialAuthTab = 'login', onAuthChange }: Props) {
  const [theme, setTheme] = useState<UserAccountTheme>(() => readUserAccountTheme())
  const t = userAccountThemeTokens(theme)
  const statusBadge = theme === 'dark' ? STATUS_BADGE_DARK : STATUS_BADGE_LIGHT

  const [tab, setTab] = useState<LoggedInTab>(() => resolveLoggedInTab(initialTab))
  const [authTab, setAuthTab] = useState<AuthTab>(initialAuthTab)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionLoggedIn, setSessionLoggedIn] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [qq, setQq] = useState('')
  const [dcId, setDcId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const currentNavLabel = useMemo(
    () => LOGGED_IN_NAV.find((item) => item.id === tab)?.label ?? 'Lumi账号中心',
    [tab],
  )

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: UserAccountTheme = prev === 'light' ? 'dark' : 'light'
      writeUserAccountTheme(next)
      return next
    })
  }, [])

  const loadProfile = useCallback(async () => {
    if (!getAuthToken()) {
      setProfile(null)
      setProfileLoading(false)
      setSessionLoggedIn(false)
      return
    }
    setSessionLoggedIn(true)
    setProfileLoading(true)
    const p = await fetchUserProfile()
    setProfile(p)
    setProfileLoading(false)
    setSessionLoggedIn(!!getAuthToken())
    if (p?.banStatus === 'banned') {
      setTab('unban')
    }
    if (!getAuthToken()) {
      const notice = readBannedNotice()
      if (notice) setError(notice.message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (getAuthToken()) {
        setSessionLoggedIn(true)
        await loadProfile()
      } else {
        setSessionLoggedIn(false)
        setProfileLoading(false)
      }
      if (!cancelled) setSessionReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [loadProfile])

  useEffect(() => {
    setAuthTab(initialAuthTab)
  }, [initialAuthTab])

  useEffect(() => {
    if (sessionLoggedIn && initialTab && initialTab !== 'auth') {
      setTab(resolveLoggedInTab(initialTab))
    }
  }, [sessionLoggedIn, initialTab])

  useEffect(() => {
    if (!sessionLoggedIn || getAuthToken()) return
    setSessionLoggedIn(false)
    setProfile(null)
    setError('登录已失效，请重新登录后再提交解封申请')
  }, [sessionLoggedIn, tab])

  const selectTab = useCallback((id: LoggedInTab) => {
    setTab(id)
    setDrawerOpen(false)
    setError('')
    setInfo('')
  }, [])

  const handleLogin = useCallback(async () => {
    setError('')
    setSubmitting(true)
    try {
      const fp = await getDeviceFingerprint()
      const ip = await getPublicIp()
      const r = await loginUser(username.trim(), password, {
        publicIp: ip,
        deviceId: fp.deviceId,
        deviceType: fp.deviceType,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setSessionLoggedIn(true)
      if (r.status.banStatus === 'banned') {
        setTab('unban')
        setInfo('账号已封禁，请在此提交解封申请。解封前无法进入 Lumi 主页验证。')
      } else {
        setInfo('登录成功')
        setTab(resolveLoggedInTab(initialTab))
      }
      await loadProfile()
      onAuthChange?.()
    } finally {
      setSubmitting(false)
    }
  }, [username, password, loadProfile, onAuthChange, initialTab])

  const handleRegister = useCallback(async () => {
    setError('')
    if (password !== password2) {
      setError('两次密码不一致')
      return
    }
    setSubmitting(true)
    try {
      const fp = await getDeviceFingerprint()
      const ip = await getPublicIp()
      const r = await registerUser({
        username: username.trim(),
        password,
        qq: qq.trim(),
        dcId: dcId.trim(),
        publicIp: ip,
        deviceId: fp.deviceId,
        deviceType: fp.deviceType,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setInfo('注册成功，请登录账号')
      setAuthTab('login')
      setPassword('')
      setPassword2('')
    } finally {
      setSubmitting(false)
    }
  }, [username, password, password2, qq, dcId])

  const handleLogout = useCallback(() => {
    void logoutUser().then(() => {
      setProfile(null)
      setSessionLoggedIn(false)
      setDrawerOpen(false)
      setTab('overview')
      setAuthTab('login')
      setInfo('已退出登录')
      onAuthChange?.()
    })
  }, [onAuthChange])

  const status = profile
    ? accountStatusLabel(profile)
    : sessionLoggedIn
      ? accountStatusLabel({ auditStatus: 'pending', banStatus: 'normal' })
      : null

  const inputCls = `h-10 w-full rounded-[10px] border px-3 text-[14px] outline-none focus:border-[#4F46E5] ${t.input}`
  const drawerBorder = theme === 'dark' ? 'border-[#2d3a4d]' : 'border-black/8'

  const authScreen = (
    <div className="mx-auto w-full max-w-md space-y-4 py-2">
      <div className={`rounded-[16px] border p-4 ${t.card}`}>
        <h2 className="text-[16px] font-semibold">Lumi账号中心</h2>
        <p className={`mt-2 text-[13px] leading-6 ${t.muted}`}>欢迎使用 Lumi 账号中心。请先注册或登录；审核通过后即可在 Lumi 主页使用。</p>
      </div>

      <div className={`flex rounded-[12px] p-1 ${t.authTabs}`}>
        {(['login', 'register'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium ${
              authTab === item ? t.authTabActive : t.authTabIdle
            }`}
            onClick={() => {
              setAuthTab(item)
              setError('')
            }}
          >
            {item === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      {authTab === 'login' ? (
        <div className={`space-y-3 rounded-[16px] border p-4 ${t.card}`}>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>账号</span>
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>密码</span>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button
            type="button"
            className={`h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
            disabled={submitting}
            onClick={() => void handleLogin()}
          >
            {submitting ? '登录中…' : '登录'}
          </button>
          <p className={`text-center text-[12px] ${t.subtitle}`}>
            还没有账号？
            <button type="button" className="ml-1 text-[#4F46E5] underline" onClick={() => setAuthTab('register')}>
              去注册
            </button>
          </p>
        </div>
      ) : (
        <div className={`space-y-3 rounded-[16px] border p-4 ${t.card}`}>
          <div className={`rounded-[12px] border px-3 py-3 text-[12px] leading-6 ${t.statusRejected}`}>
            <p className="font-medium">成员信息审核说明</p>
            <p className="mt-1">
              管理员将在 <strong>48 小时内</strong>审核您填写的 QQ 号与 Discord ID。审核期间请勿退出官方 QQ 群或 Discord 社区。
            </p>
            <p className="mt-1">
              若在 QQ 群与 Discord 社区<strong>两处均无法查询到</strong>您填写的信息，将按违规处理并<strong>封禁账号</strong>。
            </p>
          </div>
          <p className={`text-[12px] leading-5 ${t.muted}`}>注册成功后请登录；管理员将在 48 小时内审核 QQ 与 Discord ID，审核期间可正常使用。</p>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>账号</span>
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>密码</span>
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>确认密码</span>
            <input type="password" className={inputCls} value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>QQ</span>
            <input className={inputCls} value={qq} onChange={(e) => setQq(e.target.value)} />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>Discord ID</span>
            <input className={inputCls} value={dcId} onChange={(e) => setDcId(e.target.value)} />
          </label>
          <button
            type="button"
            className={`h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
            disabled={submitting}
            onClick={() => void handleRegister()}
          >
            {submitting ? '注册中…' : '注册'}
          </button>
        </div>
      )}
    </div>
  )

  const overviewContent = (
    <div className="space-y-4">
      <div className={`rounded-[16px] border p-4 ${t.card}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[12px] ${t.subtitle}`}>当前账号</p>
            <p className="mt-1 text-[18px] font-semibold">
              <AccountNumericText text={profile?.username || getStoredUsername()} />
            </p>
          </div>
          {status ? (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${statusBadge[status.tone]}`}>
              {status.label}
            </span>
          ) : null}
        </div>

        {profile && profile.auditStatus === 'pending' ? (
          <p className={`mt-3 text-[12px] leading-5 ${t.muted}`}>账号待后台核对成员信息，不影响正常使用。</p>
        ) : null}

        {profileLoading ? (
          <p className={`mt-4 text-[13px] ${t.subtitle}`}>加载中…</p>
        ) : profile ? (
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className={`flex justify-between gap-4 border-t pt-3 ${drawerBorder}`}>
              <dt className={t.subtitle}>注册时间</dt>
              <dd className="text-right">
                <AccountNumericText text={formatAccountDate(profile.createdAt)} className="text-[13px]" />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={t.subtitle}>QQ</dt>
              <dd className="text-right">
                <AccountNum className="text-[13px]">{profile.qq || '-'}</AccountNum>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={t.subtitle}>Discord ID</dt>
              <dd className="truncate text-right">
                <AccountNumericText text={profile.dcId || '-'} className="text-[13px]" />
              </dd>
            </div>
            {profile.auditStatus === 'rejected' && profile.auditRejectReason ? (
              <div className={`rounded-[10px] px-3 py-2 ${t.statusRejected}`}>拒绝原因：{profile.auditRejectReason}</div>
            ) : null}
            {profile.banStatus === 'banned' && profile.banReason ? (
              <div className={`rounded-[10px] px-3 py-2 ${t.statusRejected}`}>封禁原因：{profile.banReason}</div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${t.page}`}>
      <header
        className={`flex shrink-0 items-center gap-2 border-b px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-md ${t.header}`}
      >
        <button
          type="button"
          onClick={onBack}
          className={`flex size-10 items-center justify-center rounded-full border active:opacity-80 ${t.headerBtn}`}
          aria-label="返回"
        >
          <ChevronLeft className="size-5" />
        </button>

        {sessionLoggedIn ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex size-10 items-center justify-center rounded-full border active:opacity-80 ${t.headerBtn}`}
            aria-label="打开导航"
          >
            <Menu className="size-5" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold">{sessionLoggedIn ? currentNavLabel : 'Lumi账号中心'}</h1>
          <p className={`truncate text-[12px] ${t.subtitle}`}>
            {sessionLoggedIn ? (
              <AccountNumericText text={getStoredUsername() || '已登录'} />
            ) : (
              '欢迎使用Lumi账号中心'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className={`flex size-10 items-center justify-center rounded-full border active:opacity-80 ${t.headerBtn}`}
          title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
          aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
        >
          {theme === 'light' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className={`mb-3 rounded-[10px] border px-3 py-2 text-[13px] ${t.errorBox}`}>{error}</div>
        ) : null}
        {info ? (
          <div className={`mb-3 rounded-[10px] border px-3 py-2 text-[13px] ${t.infoBox}`}>{info}</div>
        ) : null}

        {!sessionReady ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className={`text-[13px] ${t.subtitle}`}>加载中…</p>
          </div>
        ) : !sessionLoggedIn ? (
          authScreen
        ) : tab === 'announcement' ? (
          <UserAccountAnnouncementPanel t={t} />
        ) : tab === 'report' ? (
          <UserAccountReportPanel
            t={t}
            inputCls={inputCls}
            onError={setError}
            onInfo={setInfo}
          />
        ) : tab === 'unban' ? (
          <UserAccountUnbanPanel
            t={t}
            inputCls={inputCls}
            profileBanned={profile?.banStatus === 'banned'}
            onError={setError}
            onInfo={setInfo}
            onSubmitted={() => void loadProfile()}
          />
        ) : (
          overviewContent
        )}
      </main>

      <AnimatePresence>
        {sessionLoggedIn && drawerOpen ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[60] bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="关闭导航"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className={`fixed left-0 top-0 z-[70] flex h-full w-[min(280px,86vw)] flex-col border-r shadow-2xl backdrop-blur-none ${t.sidebar} ${drawerBorder}`}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={`flex items-center justify-between border-b px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] ${drawerBorder}`}>
                <div>
                  <p className="text-[15px] font-semibold">Lumi账号中心</p>
                  <p className={`mt-0.5 text-[12px] ${t.subtitle}`}>
                    <AccountNumericText text={getStoredUsername() || profile?.username || ''} />
                  </p>
                </div>
                <button
                  type="button"
                  className={`flex size-9 items-center justify-center rounded-full border ${t.headerBtn}`}
                  onClick={() => setDrawerOpen(false)}
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-1 p-3">
                {LOGGED_IN_NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-[14px] font-medium transition ${
                      tab === id ? t.sidebarActive : t.sidebarIdle
                    }`}
                  >
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </nav>

              <div className={`border-t p-3 ${drawerBorder}`}>
                <button
                  type="button"
                  className={`h-11 w-full rounded-[12px] border text-[14px] ${t.secondaryBtn}`}
                  onClick={handleLogout}
                >
                  退出登录
                </button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
