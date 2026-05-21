/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { WeChatPersonaContact } from '../../types'
import { useCustomization } from '../../CustomizationContext'
import { purgeAllMeetEntriesFromLoreArchive } from '../lumiMeet/meetClearEncounterData'
import { resetWorldbookLoreArchiveAfterWeChatErase } from '../../worldbook/worldbookLoreStore'
import { personaDb } from './newFriendsPersona/idb'
import {
  allocateWechatAccountIdentitySlot,
  attachOrphanPlayerIdentitiesToWechatAccount,
  cloneAccount,
  findAccountById,
  loadAccountsBundle,
  loadLegacyProfileOnly,
  migrateLegacyProfileToBundle,
  resolveAccountSessionIdentityId,
  saveAccountsBundle,
  upsertAccountInBundle,
} from './wechatAccountPersistence'
import {
  collectCanonicalIdsPreservedAcrossAccounts,
  expandCanonicalIdSet,
  runLegacyGlobalCharacterCompatibilityMigration,
} from './wechatGlobalCharacterRegistry'
import { migrateAllLegacyWeChatConversationsToAccountScope } from './wechatAccountPrivateChatStorage'
import { alignAllStoredWorldBookUserPlaceholders } from './worldBookUserPlaceholderBindings'
import { alignAllStoredMemoryUserPlaceholders } from './memoryUserPlaceholderBindings'
import {
  bundleWithAccountPersonaContacts,
  filterPersonaContactsToWechatAccount,
  applyIncomingPersonaContactRemarkOverrides,
  mergeWeChatPersonaContacts,
  personaContactsEqual,
  reconcileAccountPersonaContacts,
  repairMultiAccountPersonaContactsBundle,
} from './wechatPersonaContactsSync'
import {
  accountToProfile,
  profileToAccountDraft,
  WECHAT_ACCOUNTS_BUNDLE_KV_KEY,
  type UserAccount,
  type WechatAccountsBundle,
} from './wechatAccountTypes'
import {
  isWechatProfileComplete,
  isWechatPasswordValid,
  normalizeWechatPasswordInput,
  normalizeWechatProfile,
  wechatPasswordsMatch,
  WECHAT_USER_PROFILE_KV_KEY,
  WECHAT_USER_PROFILE_KV_KEY_LEGACY,
  type WechatProfile,
} from './wechatProfileTypes'

export type UpdateWechatPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'no-profile' | 'wrong-current' | 'invalid-new' | 'mismatch' }

export type DeleteWechatAccountResult =
  | { ok: true; remainingAccounts: number }
  | { ok: false; reason: 'no-profile' }

type WechatStoreContextValue = {
  profile: WechatProfile | null
  hydrated: boolean
  accounts: UserAccount[]
  currentAccountId: string | null
  /** 切换账号后递增，供微信主界面强制重挂载 */
  accountSwitchRevision: number
  completeRegistration: (profile: WechatProfile) => Promise<void>
  addAccountFromRegistration: (profile: WechatProfile) => Promise<void>
  switchAccount: (accountId: string) => Promise<void>
  /** 更新当前微信账号选用的「我的身份」，并切换会话隔离指针 */
  setActivePlayerIdentityForCurrentAccount: (playerIdentityId: string) => Promise<void>
  /** 好友通过后等：原子写入当前马甲通讯录（避免多账号空 bundle 竞态把新联系人冲掉） */
  appendPersonaContactsForCurrentAccount: (add: WeChatPersonaContact[]) => Promise<void>
  updatePassword: (params: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => Promise<UpdateWechatPasswordResult>
  deleteAccount: () => Promise<DeleteWechatAccountResult>
}

const WechatStoreContext = createContext<WechatStoreContextValue | null>(null)

const WECHAT_FORCE_REREGISTER_LS_KEY = 'wechat-force-reregister-onboarding-v1'

async function runOneTimeWechatProfileReset(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(WECHAT_FORCE_REREGISTER_LS_KEY) === '1') return
    await personaDb.deletePhoneKv(WECHAT_USER_PROFILE_KV_KEY)
    await personaDb.deletePhoneKv(WECHAT_USER_PROFILE_KV_KEY_LEGACY)
    window.localStorage.setItem(WECHAT_FORCE_REREGISTER_LS_KEY, '1')
  } catch {
    // ignore
  }
}

export function WechatStoreProvider({ children }: { children: ReactNode }) {
  const {
    setProfile: setPhoneProfile,
    clearWeChatPersonaContacts,
    setWeChatPersonaContacts,
    state,
  } = useCustomization()
  const [profile, setProfile] = useState<WechatProfile | null>(null)
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [accountSwitchRevision, setAccountSwitchRevision] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const bundleRef = useRef<{ accounts: UserAccount[]; currentAccountId: string } | null>(null)
  /** 切换马甲时跳过「内存通讯录 → bundle」同步，避免把上一号联系人写入新号。 */
  const suppressContactsBundleSyncRef = useRef(false)
  /** 切换进行中：避免 persistBundle 与 applyActiveAccount 之间的 effect 用旧内存覆盖新号 bundle。 */
  const accountSwitchInFlightRef = useRef(false)

  const persistBundle = useCallback(async (nextAccounts: UserAccount[], nextCurrentId: string) => {
    const bundle = { accounts: nextAccounts, currentAccountId: nextCurrentId }
    bundleRef.current = bundle
    await saveAccountsBundle(bundle)
    setAccounts(nextAccounts.map(cloneAccount))
    setCurrentAccountId(nextCurrentId)
    const active = nextAccounts.find((a) => a.accountId === nextCurrentId)
    if (active) setProfile(accountToProfile(active))
  }, [])

  const syncPhoneCustomization = useCallback(
    (p: WechatProfile) => {
      setPhoneProfile({
        displayName: p.nickname.trim(),
        signature: p.signature?.trim() ?? '',
        avatarImageUrl: p.avatarUrl.trim(),
        avatarEmoji: p.nickname.trim().slice(0, 1) || state.profile.avatarEmoji,
      })
    },
    [setPhoneProfile, state.profile.avatarEmoji],
  )

  const applyActiveAccount = useCallback(
    async (account: UserAccount, opts?: { bumpRevision?: boolean; contactsOverride?: WeChatPersonaContact[] }) => {
      const primaryId = bundleRef.current?.accounts[0]?.accountId
      const raw = opts?.contactsOverride ?? account.personaContacts
      const contacts = await filterPersonaContactsToWechatAccount(raw, account.accountId, primaryId)
      if (
        bundleRef.current &&
        !personaContactsEqual(raw, contacts)
      ) {
        const repaired = bundleWithAccountPersonaContacts(
          bundleRef.current,
          account.accountId,
          contacts,
        )
        bundleRef.current = repaired
        await saveAccountsBundle(repaired)
      }
      suppressContactsBundleSyncRef.current = true
      setWeChatPersonaContacts(contacts)
      syncPhoneCustomization(accountToProfile(account))
      setProfile(accountToProfile(account))
      const sessionId = resolveAccountSessionIdentityId(account)
      if (sessionId) {
        await personaDb.setCurrentIdentityId(sessionId)
        await migrateAllLegacyWeChatConversationsToAccountScope({
          wechatAccountId: account.accountId,
          appSessionPlayerIdentityId: sessionId,
        })
      }
      if (opts?.bumpRevision) setAccountSwitchRevision((n) => n + 1)
    },
    [setWeChatPersonaContacts, syncPhoneCustomization],
  )

  const snapshotContactsForAccount = useCallback(
    (list: WeChatPersonaContact[], accountId: string): UserAccount[] => {
      const bundle = bundleRef.current
      const outgoingId = accountId.trim()
      if (!bundle || !outgoingId) return bundle?.accounts.map(cloneAccount) ?? accounts
      const snap = list.map((c) => ({ ...c }))
      return bundle.accounts.map((a) =>
        a.accountId === outgoingId
          ? { ...cloneAccount(a), personaContacts: snap, lastActive: Date.now() }
          : cloneAccount(a),
      )
    },
    [accounts],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await runOneTimeWechatProfileReset()
        let bundle = await loadAccountsBundle()
        if (!bundle) {
          const legacy = await loadLegacyProfileOnly()
          if (legacy) {
            bundle = await migrateLegacyProfileToBundle(legacy, state.wechatPersonaContacts)
          }
        }
        if (cancelled) return
        if (bundle) {
          const bundleBeforeRepair = bundle
          bundle = await repairMultiAccountPersonaContactsBundle(bundle)
          if (bundle !== bundleBeforeRepair) await saveAccountsBundle(bundle)
          bundleRef.current = bundle
          setAccounts(bundle.accounts.map(cloneAccount))
          setCurrentAccountId(bundle.currentAccountId)
          let active = findAccountById(bundle, bundle.currentAccountId)
          if (active) {
            setProfile(accountToProfile(active))
            const primaryAccountId = bundle.accounts[0]?.accountId
            if (primaryAccountId) {
              await attachOrphanPlayerIdentitiesToWechatAccount(primaryAccountId)
            }
            const sessionId = resolveAccountSessionIdentityId(active)
            const reconciled = await reconcileAccountPersonaContacts({
              bundle,
              account: active,
              sessionPlayerIdentityId: sessionId,
              fromInMemory: state.wechatPersonaContacts,
              recoverFromChats: true,
            })
            bundle = reconciled.bundle
            bundleRef.current = bundle
            setAccounts(bundle.accounts.map(cloneAccount))
            await saveAccountsBundle(bundle)
            active = findAccountById(bundle, bundle.currentAccountId)!
            const migratedBundle = await runLegacyGlobalCharacterCompatibilityMigration(bundle)
            bundleRef.current = migratedBundle
              ? { accounts: migratedBundle.accounts, currentAccountId: migratedBundle.currentAccountId }
              : bundleRef.current
            if (migratedBundle) {
              bundle = migratedBundle
              setAccounts(migratedBundle.accounts.map(cloneAccount))
              active = findAccountById(migratedBundle, migratedBundle.currentAccountId) ?? active
            }
            await applyActiveAccount(active, { contactsOverride: active.personaContacts })
          }
        }
        if (!cancelled) {
          try {
              await alignAllStoredWorldBookUserPlaceholders()
              await alignAllStoredMemoryUserPlaceholders().then((r) => r.written)
            } catch {
              // 对齐失败不阻塞进入微信
            }
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅启动时迁移一次
  }, [])

  /** 通讯录变更后写回当前微信账号 bundle，避免刷新后仅存在 customization KV 而 bundle 为空被覆盖。 */
  useEffect(() => {
    if (!hydrated || !currentAccountId) return
    if (accountSwitchInFlightRef.current) return
    if (suppressContactsBundleSyncRef.current) {
      suppressContactsBundleSyncRef.current = false
      return
    }
    const bundle = bundleRef.current
    if (!bundle) return
    const activeAccountId = bundle.currentAccountId.trim() || currentAccountId.trim()
    const active = findAccountById(bundle, activeAccountId)
    if (!active) return
    const snap = state.wechatPersonaContacts
    if (personaContactsEqual(active.personaContacts, snap)) return
    const primaryId = bundle.accounts[0]?.accountId
    // 多账号：bundle 为空但内存有联系人 → 仅当过滤后对本号仍为空时才视为「大号通讯录泄漏」
    if (bundle.accounts.length > 1 && !active.personaContacts.length && snap.length > 0) {
      void (async () => {
        const filtered = await filterPersonaContactsToWechatAccount(snap, activeAccountId, primaryId)
        suppressContactsBundleSyncRef.current = true
        if (!filtered.length) {
          setWeChatPersonaContacts(active.personaContacts.map((c) => ({ ...c })))
          return
        }
        setWeChatPersonaContacts(filtered.map((c) => ({ ...c })))
        const nextAccounts = bundle.accounts.map((a) =>
          a.accountId === activeAccountId
            ? { ...cloneAccount(a), personaContacts: filtered, lastActive: Date.now() }
            : cloneAccount(a),
        )
        await persistBundle(nextAccounts, bundle.currentAccountId)
      })()
      return
    }
    const nextAccounts = snapshotContactsForAccount(snap, activeAccountId)
    void persistBundle(nextAccounts, bundle.currentAccountId)
  }, [
    currentAccountId,
    hydrated,
    persistBundle,
    setWeChatPersonaContacts,
    snapshotContactsForAccount,
    state.wechatPersonaContacts,
  ])

  const bindFirstIdentityIfNeeded = useCallback(async (baseIdentityId: string) => {
    const currentId = (await personaDb.getCurrentIdentityId()).trim()
    if (currentId && currentId !== '__none__') return baseIdentityId
    await personaDb.setCurrentIdentityId(baseIdentityId)
    await personaDb.migrateWeChatDataFromNonePlayerIdentity(baseIdentityId)
    return baseIdentityId
  }, [])

  const addAccountFromRegistration = useCallback(
    async (next: WechatProfile) => {
      const normalized = normalizeWechatProfile(next)
      if (!normalized || !isWechatProfileComplete(normalized)) return

      const baseIdentityId = allocateWechatAccountIdentitySlot()
      const account = profileToAccountDraft(normalized, baseIdentityId, [])
      const bundle = bundleRef.current ?? { accounts: [], currentAccountId: account.accountId }
      const merged = upsertAccountInBundle(
        { accounts: bundle.accounts, currentAccountId: account.accountId },
        account,
      )
      await persistBundle(merged.accounts, account.accountId)
      await applyActiveAccount(account, { contactsOverride: [], bumpRevision: true })
    },
    [applyActiveAccount, persistBundle],
  )

  const setActivePlayerIdentityForCurrentAccount = useCallback(
    async (playerIdentityId: string) => {
      const id = playerIdentityId.trim()
      const bundle = bundleRef.current
      if (!id || !bundle || !currentAccountId) return
      const nextAccounts = bundle.accounts.map((a) =>
        a.accountId === currentAccountId ? { ...cloneAccount(a), sessionPlayerIdentityId: id } : cloneAccount(a),
      )
      await persistBundle(nextAccounts, bundle.currentAccountId)
      await personaDb.setCurrentIdentityId(id)
    },
    [currentAccountId, persistBundle],
  )

  const appendPersonaContactsForCurrentAccount = useCallback(
    async (add: WeChatPersonaContact[]) => {
      const bundle = bundleRef.current
      if (!bundle || !currentAccountId || !add.length) return
      const active = findAccountById(bundle, currentAccountId)
      if (!active) return
      const primaryId = bundle.accounts[0]?.accountId
      const merged = applyIncomingPersonaContactRemarkOverrides(
        mergeWeChatPersonaContacts(active.personaContacts, add),
        add,
      )
      const filtered = await filterPersonaContactsToWechatAccount(merged, currentAccountId, primaryId)
      suppressContactsBundleSyncRef.current = true
      setWeChatPersonaContacts(filtered.map((c) => ({ ...c })))
      const nextAccounts = bundle.accounts.map((a) =>
        a.accountId === currentAccountId
          ? { ...cloneAccount(a), personaContacts: filtered, lastActive: Date.now() }
          : cloneAccount(a),
      )
      await persistBundle(nextAccounts, bundle.currentAccountId)
    },
    [currentAccountId, persistBundle, setWeChatPersonaContacts],
  )

  const switchAccount = useCallback(
    async (accountId: string) => {
      const bundle = bundleRef.current
      if (!bundle) return
      const target = findAccountById(bundle, accountId)
      const outgoingId = bundle.currentAccountId.trim()
      if (!target || target.accountId === outgoingId) return

      accountSwitchInFlightRef.current = true
      suppressContactsBundleSyncRef.current = true
      try {
        const withSnap = snapshotContactsForAccount(state.wechatPersonaContacts, outgoingId)
        const nextAccounts = withSnap.map((a) =>
          a.accountId === accountId ? { ...cloneAccount(a), lastActive: Date.now() } : a,
        )
        await persistBundle(nextAccounts, accountId)
        const fresh = findAccountById({ accounts: nextAccounts, currentAccountId: accountId }, accountId)!
        const targetContacts = fresh.personaContacts.map((c) => ({ ...c }))
        await applyActiveAccount(fresh, { contactsOverride: targetContacts, bumpRevision: true })
      } finally {
        accountSwitchInFlightRef.current = false
      }
    },
    [applyActiveAccount, persistBundle, snapshotContactsForAccount, state.wechatPersonaContacts],
  )

  const updatePassword = useCallback(
    async (params: {
      currentPassword: string
      newPassword: string
      confirmPassword: string
    }): Promise<UpdateWechatPasswordResult> => {
      const cur = profile
      if (!cur || !isWechatProfileComplete(cur) || !currentAccountId) return { ok: false, reason: 'no-profile' }

      const current = normalizeWechatPasswordInput(params.currentPassword)
      const next = normalizeWechatPasswordInput(params.newPassword)
      const confirm = normalizeWechatPasswordInput(params.confirmPassword)

      if (current !== cur.password) return { ok: false, reason: 'wrong-current' }
      if (!isWechatPasswordValid(next)) return { ok: false, reason: 'invalid-new' }
      if (!wechatPasswordsMatch(next, confirm)) return { ok: false, reason: 'mismatch' }

      const updated: WechatProfile = { ...cur, password: next }
      const bundle = bundleRef.current
      if (bundle) {
        const acc = findAccountById(bundle, currentAccountId)
        if (acc) {
          const nextAcc = { ...cloneAccount(acc), password: next }
          const merged = upsertAccountInBundle(bundle, nextAcc)
          await persistBundle(merged.accounts, merged.currentAccountId)
        }
      } else {
        await personaDb.setPhoneKv(WECHAT_USER_PROFILE_KV_KEY, updated)
      }
      setProfile(updated)
      return { ok: true }
    },
    [currentAccountId, profile],
  )

  const deleteAccount = useCallback(async (): Promise<DeleteWechatAccountResult> => {
    if (!profile || !isWechatProfileComplete(profile) || !currentAccountId) {
      return { ok: false, reason: 'no-profile' }
    }

    const bundle = bundleRef.current
    if (!bundle) return { ok: false, reason: 'no-profile' }

    const deleting = findAccountById(bundle, currentAccountId)
    if (!deleting) return { ok: false, reason: 'no-profile' }

    const remainingAccounts = bundle.accounts.filter((a) => a.accountId !== currentAccountId)

    if (remainingAccounts.length > 0) {
      const sessionIds = [
        deleting.baseIdentityId,
        deleting.sessionPlayerIdentityId,
        resolveAccountSessionIdentityId(deleting),
      ].filter((id): id is string => !!id?.trim())

      const preserveRaw = collectCanonicalIdsPreservedAcrossAccounts(
        { accounts: remainingAccounts, currentAccountId: bundle.currentAccountId },
        deleting.accountId,
      )
      const preserveCanonicalCharacterIds = await expandCanonicalIdSet(preserveRaw)

      await personaDb.eraseWeChatBundleAccount({
        wechatAccountId: deleting.accountId,
        sessionIdentityIds: sessionIds,
        preserveCanonicalCharacterIds,
      })

      const nextAccountId = [...remainingAccounts].sort((a, b) => b.lastActive - a.lastActive)[0]!.accountId
      await persistBundle(remainingAccounts, nextAccountId)
      const nextAccount = findAccountById(
        { accounts: remainingAccounts, currentAccountId: nextAccountId },
        nextAccountId,
      )
      if (nextAccount) await applyActiveAccount(nextAccount, { bumpRevision: true })
      setAccountSwitchRevision((n) => n + 1)
      return { ok: true, remainingAccounts: remainingAccounts.length }
    }

    await personaDb.eraseWeChatAccountCompletely()
    await personaDb.deletePhoneKv(WECHAT_ACCOUNTS_BUNDLE_KV_KEY)
    purgeAllMeetEntriesFromLoreArchive()
    resetWorldbookLoreArchiveAfterWeChatErase()
    clearWeChatPersonaContacts()
    bundleRef.current = null
    setAccounts([])
    setCurrentAccountId(null)
    setProfile(null)
    setPhoneProfile({
      displayName: '未命名',
      signature: '',
      avatarImageUrl: '',
      avatarEmoji: '未',
    })
    setAccountSwitchRevision((n) => n + 1)
    return { ok: true, remainingAccounts: 0 }
  }, [
    applyActiveAccount,
    clearWeChatPersonaContacts,
    currentAccountId,
    persistBundle,
    profile,
    setPhoneProfile,
  ])

  const completeRegistrationWrapped = useCallback(
    async (next: WechatProfile) => {
      const normalized = normalizeWechatProfile(next)
      if (!normalized || !isWechatProfileComplete(normalized)) return

      if (bundleRef.current && bundleRef.current.accounts.length > 0) {
        await addAccountFromRegistration(normalized)
        return
      }

      const baseIdentityId = allocateWechatAccountIdentitySlot()
      await bindFirstIdentityIfNeeded(baseIdentityId)
      const draftContacts = state.wechatPersonaContacts.map((c) => ({ ...c }))
      const account = profileToAccountDraft(normalized, baseIdentityId, draftContacts)
      const sessionId = resolveAccountSessionIdentityId(account)
      let bundle: WechatAccountsBundle = {
        accounts: [account],
        currentAccountId: account.accountId,
      }
      await attachOrphanPlayerIdentitiesToWechatAccount(account.accountId)
      const reconciled = await reconcileAccountPersonaContacts({
        bundle,
        account,
        sessionPlayerIdentityId: sessionId,
        fromInMemory: draftContacts,
        recoverFromChats: true,
      })
      bundle = reconciled.bundle
      bundleRef.current = bundle
      const migratedBundle = await runLegacyGlobalCharacterCompatibilityMigration(bundle)
      if (migratedBundle) bundle = migratedBundle
      await persistBundle(bundle.accounts, account.accountId)
      const active = findAccountById(bundle, account.accountId)!
      await applyActiveAccount(active, { contactsOverride: active.personaContacts })
    },
    [
      addAccountFromRegistration,
      applyActiveAccount,
      bindFirstIdentityIfNeeded,
      persistBundle,
      state.wechatPersonaContacts,
    ],
  )

  const value = useMemo(
    () => ({
      profile,
      hydrated,
      accounts,
      currentAccountId,
      accountSwitchRevision,
      completeRegistration: completeRegistrationWrapped,
      addAccountFromRegistration,
      switchAccount,
      setActivePlayerIdentityForCurrentAccount,
      appendPersonaContactsForCurrentAccount,
      updatePassword,
      deleteAccount,
    }),
    [
      profile,
      hydrated,
      accounts,
      currentAccountId,
      accountSwitchRevision,
      completeRegistrationWrapped,
      addAccountFromRegistration,
      switchAccount,
      setActivePlayerIdentityForCurrentAccount,
      appendPersonaContactsForCurrentAccount,
      updatePassword,
      deleteAccount,
    ],
  )

  return <WechatStoreContext.Provider value={value}>{children}</WechatStoreContext.Provider>
}

export function useWechatStore(): WechatStoreContextValue {
  const ctx = useContext(WechatStoreContext)
  if (!ctx) throw new Error('useWechatStore must be used within WechatStoreProvider')
  return ctx
}

export type { WechatProfile }
