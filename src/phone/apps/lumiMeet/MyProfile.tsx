import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { MeetChatBackgroundCropperModal } from './MeetChatBackgroundCropperModal'
import { MyProfileAestheticTab } from './myProfile/MyProfileAestheticTab'
import { MyProfileContactTab } from './myProfile/MyProfileContactTab'
import { MyProfileMaskTab } from './myProfile/MyProfileMaskTab'
import { useMeetStore } from './LumiMeetStore'
import { MEET_OPEN_PROFILE_CONTACT_TAB_KEY } from './meetBindingReadiness'

type TabId = 'mask' | 'aesthetic' | 'contact'

const TABS: { id: TabId; label: string }[] = [
  { id: 'mask', label: '01 MASK | 社交假面' },
  { id: 'aesthetic', label: '02 AESTHETIC | 沉浸氛围' },
  { id: 'contact', label: '03 CONTACT | 联络绑定' },
]

const tabSpring = { type: 'spring' as const, stiffness: 520, damping: 38 }

type ProfileTabId = 'mask' | 'aesthetic' | 'contact'

export function MyProfile({ coachProfileTab = null }: { coachProfileTab?: ProfileTabId | null }) {
  const { state, setMeetProfile } = useMeetStore()
  const p = state.meetProfile

  const [tab, setTab] = useState<TabId>('mask')
  /** 引导进行时同步切子页，避免高亮量测时联络绑定尚未挂载 */
  const activeTab = coachProfileTab ?? tab
  const [cropOpen, setCropOpen] = useState(false)
  const [cropSrc, setCropSrc] = useState('')
  const [bgUrlDraft, setBgUrlDraft] = useState('')
  const bgObjectUrlRef = useRef<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(MEET_OPEN_PROFILE_CONTACT_TAB_KEY) === '1') {
        sessionStorage.removeItem(MEET_OPEN_PROFILE_CONTACT_TAB_KEY)
        setTab('contact')
      }
    } catch {
      /* ignore */
    }
  }, [])

  const revokeBgObjectUrl = useCallback(() => {
    if (bgObjectUrlRef.current) {
      URL.revokeObjectURL(bgObjectUrlRef.current)
      bgObjectUrlRef.current = null
    }
  }, [])

  const openCropWithSrc = useCallback(
    (src: string) => {
      revokeBgObjectUrl()
      setCropSrc(src)
      setCropOpen(true)
    },
    [revokeBgObjectUrl],
  )

  const onPickAvatar = useCallback(() => {
    avatarInputRef.current?.click()
  }, [])

  const onAvatarFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f || !f.type.startsWith('image/')) return
      const r = new FileReader()
      r.onload = () => {
        const url = typeof r.result === 'string' ? r.result : ''
        if (url) setMeetProfile({ meetAvatarUrl: url })
      }
      r.readAsDataURL(f)
    },
    [setMeetProfile],
  )

  const onPickBgFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f || !f.type.startsWith('image/')) return
      revokeBgObjectUrl()
      const url = URL.createObjectURL(f)
      bgObjectUrlRef.current = url
      openCropWithSrc(url)
    },
    [openCropWithSrc, revokeBgObjectUrl],
  )

  const onApplyBgUrl = useCallback(() => {
    const u = bgUrlDraft.trim()
    if (!u) return
    openCropWithSrc(u)
  }, [bgUrlDraft, openCropWithSrc])

  return (
    <div className="meet-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-white pb-28">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onAvatarFile}
      />

      <MeetChatBackgroundCropperModal
        open={cropOpen}
        imageSrc={cropSrc}
        onClose={() => {
          setCropOpen(false)
          revokeBgObjectUrl()
          setCropSrc('')
        }}
        onComplete={(dataUrl) => {
          setMeetProfile({ chatBackground: dataUrl })
        }}
      />

      <nav className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/95 px-3 pt-3 backdrop-blur-[6px]">
        <div className="flex justify-between gap-1 sm:justify-center sm:gap-4">
          {TABS.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative min-w-0 flex-1 pb-2.5 pt-1 text-center text-[9px] font-light uppercase tracking-[0.12em] outline-none ring-0 transition-colors duration-300 focus:outline-none focus:ring-0 sm:text-[10px] sm:tracking-[0.16em] ${
                  active ? 'text-[#1C1C1E]' : 'text-gray-400'
                }`}
              >
                <span className="block leading-snug">{t.label}</span>
                {active ? (
                  <motion.div
                    layoutId="meetProfileTabGoldLine"
                    className="absolute bottom-0 left-[10%] right-[10%] h-[2px] rounded-full bg-[#D4AF37]"
                    transition={tabSpring}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="min-h-0 flex-1 px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={{ opacity: 0, y: coachProfileTab ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: coachProfileTab ? 0 : -6 }}
            transition={{ duration: coachProfileTab ? 0 : 0.4, ease: 'easeOut' }}
          >
            {activeTab === 'mask' ? (
              <div data-meet-app-coach="profile-shell">
                <MyProfileMaskTab
                  profile={p}
                  setMeetProfile={setMeetProfile}
                  avatarInputRef={avatarInputRef}
                  onPickAvatar={onPickAvatar}
                  onAvatarFile={onAvatarFile}
                />
              </div>
            ) : null}
            {activeTab === 'aesthetic' ? (
              <MyProfileAestheticTab
                profile={p}
                setMeetProfile={setMeetProfile}
                bgUrlDraft={bgUrlDraft}
                setBgUrlDraft={setBgUrlDraft}
                onPickBgFileClick={() => bgFileInputRef.current?.click()}
                onApplyBgUrl={onApplyBgUrl}
              />
            ) : null}
            {activeTab === 'contact' ? (
              <MyProfileContactTab profile={p} setMeetProfile={setMeetProfile} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickBgFile} />
    </div>
  )
}
