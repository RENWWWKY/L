import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import { isMeetSyncedCharacter, readMeetVol11ContentFromCharacterWorldBooks } from './meetUserProfileSnapshot'
import { findMeetNpcInPersist, loadMeetPersisted } from './meetPersistLoad'
import { MEET_DEFAULT_PUBLIC_DISPLAY_NAME } from './meetPublicProfileDisplay'
import type { EncounterNPC, MeetChatMessage, MeetPublicProfile } from './meetTypes'
import { loadMeetUserProfileSnapshotFromKv } from './meetUserProfileSnapshot'

const EMPTY_MEET_PROFILE: MeetPublicProfile = {
  displayName: MEET_DEFAULT_PUBLIC_DISPLAY_NAME,
  intent: '',
  bio: '',
  orientation: '',
  meetAvatarUrl: '',
  contactWechatId: '',
  baseWeChatIdentityId: '',
  meetIntentionsPublic: [],
  chatBackground: '',
  secretAdmirers: 0,
  lastCheckTime: 0,
}

/** 从遇见存档或人设库还原 NPC，供结业 vol10 写入（避免 meet 存档缺失时整段跳过） */
export async function resolveMeetNpcForEpilogue(characterId: string): Promise<{
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  thread: MeetChatMessage[]
} | null> {
  const cid = characterId.trim()
  if (!cid) return null

  const meet = await loadMeetPersisted()
  const ch = await personaDb.getCharacter(cid)
  if (!ch && !meet) return null

  const fromPersist = meet ? findMeetNpcInPersist(meet, cid) : null
  const thread = meet?.chatThreads[cid] ?? []

  let userProfile = meet?.meetProfile ?? EMPTY_MEET_PROFILE
  if (fromPersist?.meetUserProfileAtMatch) {
    const snap = fromPersist.meetUserProfileAtMatch
    userProfile = {
      ...userProfile,
      displayName: snap.displayName || userProfile.displayName,
      intent: snap.intent || userProfile.intent,
      bio: snap.bio || userProfile.bio,
      orientation: snap.orientation || userProfile.orientation,
      meetIntentionsPublic: snap.meetIntentionsPublic?.length
        ? [...snap.meetIntentionsPublic]
        : userProfile.meetIntentionsPublic,
    }
  } else {
    const snap = await loadMeetUserProfileSnapshotFromKv(cid)
    if (snap) {
      userProfile = {
        ...userProfile,
        displayName: snap.displayName || userProfile.displayName,
        intent: snap.intent || userProfile.intent,
        bio: snap.bio || userProfile.bio,
        orientation: snap.orientation || userProfile.orientation,
        meetIntentionsPublic: snap.meetIntentionsPublic?.length
          ? [...snap.meetIntentionsPublic]
          : userProfile.meetIntentionsPublic,
      }
    }
  }

  const pid =
    userProfile.baseWeChatIdentityId?.trim() || (await personaDb.getCurrentIdentityId()).trim()
  if (pid && pid !== '__none__') {
    userProfile = { ...userProfile, baseWeChatIdentityId: pid }
  }

  if (fromPersist) {
    return { npc: fromPersist, userProfile, thread }
  }

  if (!ch || !isMeetSyncedCharacter(cid, ch.worldBooks)) return null

  const npc = meetNpcFromCharacter(ch, cid)
  return { npc, userProfile, thread }
}

function meetNpcFromCharacter(ch: Character, cid: string): EncounterNPC {
  const nick = ch.wechatNickname?.trim() || ch.remark?.trim() || ch.name?.trim() || '对方'
  return {
    id: cid,
    avatarUrl: ch.avatarUrl?.trim() || '',
    nickname: nick,
    realName: ch.name?.trim() || nick,
    ageYears: typeof ch.age === 'number' && Number.isFinite(ch.age) ? ch.age : 24,
    birthdayMD: ch.birthdayMD?.trim() || '06-15',
    weightKg: '',
    heightCm: '',
    occupation: ch.identity?.trim() || '',
    motto: ch.motto?.trim(),
    mbti: ch.mbti?.trim(),
    zodiac: ch.zodiac?.trim() || '',
    gender: ch.gender === 'female' ? '女' : ch.gender === 'male' ? '男' : '其他',
    orientation: '',
    persona: ch.bio?.trim() || readMeetVol11ContentFromCharacterWorldBooks(ch.worldBooks, cid).slice(0, 480),
    wechatId: ch.wechatId?.trim(),
    status: 'wechat_added',
    lastEncounterTime: ch.updatedAt ?? Date.now(),
  }
}
