export type UnixMs = number

export type AppId =
  | 'wechat'
  | 'notes'
  | 'shopping'
  | 'takeout'
  | 'browser'
  | 'calls'
  | 'music'
  | 'entertainment'
  | 'gaming'
  | 'checkin'
  | 'journey'
  | 'sleep'
  | 'battery'
  | 'maps'

export type RelationshipTag = 'work' | 'family' | 'friend' | 'dating' | 'unknown'

export interface PersonRef {
  id: string
  displayName: string
  remark?: string
  tag?: RelationshipTag
  avatarUrl?: string
}

export interface CharacterPhoneMeta {
  characterId: string
  characterName: string
  deviceModel?: string
  locale?: string
  lastSyncAt?: UnixMs
}

// -------------------- 1) WeChat --------------------
export type WeChatMessageDirection = 'in' | 'out'

export interface WeChatMessage {
  id: string
  peer: PersonRef
  direction: WeChatMessageDirection
  text?: string
  sentAt: UnixMs
  readAt?: UnixMs
  attachment?: { type: 'image' | 'voice' | 'file' | 'location'; summary: string }
}

export interface WeChatChatThread {
  id: string
  peer: PersonRef
  pinned?: boolean
  lastMessagePreview?: string
  updatedAt: UnixMs
  messages: WeChatMessage[]
}

export type BillingDirection = 'income' | 'expense'
export type BillingChannel = 'wechat_pay' | 'bankcard' | 'balance' | 'unknown'

export interface WeChatBillingRecord {
  id: string
  direction: BillingDirection
  channel: BillingChannel
  amountYuan: number
  title: string
  counterparty?: string
  createdAt: UnixMs
}

export interface WeChatAffectionCardRecord {
  id: string
  enabled: boolean
  receiver: PersonRef
  openedAt?: UnixMs
  monthlyLimitYuan?: number
  note?: string
}

export interface MomentsVisitRecord {
  id: string
  target: PersonRef
  visitedAt: UnixMs
  dwellMs: number
  interactions?: { like?: boolean; comment?: string; commentAt?: UnixMs }
}

export interface MomentsPrivacyRule {
  id: string
  momentId: string
  visibleToOnly?: PersonRef[]
  hiddenFrom?: PersonRef[]
  reasonHint?: string
}

export interface WeChatModuleData {
  chats: WeChatChatThread[]
  billing: WeChatBillingRecord[]
  affectionCards: WeChatAffectionCardRecord[]
  momentsHistory: MomentsVisitRecord[]
  momentsPrivacy: MomentsPrivacyRule[]
  pinnedContacts: PersonRef[]
  blockedContacts: PersonRef[]
}

// -------------------- 2) Notes --------------------
export interface NoteItem {
  id: string
  title: string
  content: string
  updatedAt: UnixMs
  locked: boolean
  lockHint?: string
}

export interface NotesModuleData {
  notes: NoteItem[]
}

// -------------------- 3) Shopping --------------------
export type ShoppingOrderStatus = 'shipping' | 'delivered' | 'awaiting_pickup' | 'cancelled' | 'refunded'

export interface ShoppingOrderItem {
  skuId: string
  title: string
  quantity: number
  priceYuan: number
}

export interface ShoppingOrder {
  id: string
  merchantName: string
  status: ShoppingOrderStatus
  createdAt: UnixMs
  deliveredAt?: UnixMs
  items: ShoppingOrderItem[]
  totalYuan: number
  logistics?: { carrier?: string; trackingNo?: string; lastUpdate?: string }
}

export interface ShoppingSupportMessage {
  id: string
  merchantName: string
  direction: WeChatMessageDirection
  text: string
  sentAt: UnixMs
}

export interface ShoppingReview {
  id: string
  orderId: string
  skuId: string
  rating: 1 | 2 | 3 | 4 | 5
  content: string
  createdAt: UnixMs
}

export interface ShoppingBrowseRecord {
  id: string
  title: string
  url?: string
  browsedAt: UnixMs
}

export interface ShoppingCartItem {
  skuId: string
  title: string
  quantity: number
  priceYuan: number
}

export interface ShoppingModuleData {
  orders: ShoppingOrder[]
  supportChats: ShoppingSupportMessage[]
  reviews: ShoppingReview[]
  browsingHistory: ShoppingBrowseRecord[]
  cart: ShoppingCartItem[]
}

// -------------------- 4) Takeout --------------------
export interface TakeoutAddress {
  id: string
  label: string
  detail: string
  contactName?: string
  contactPhone?: string
}

export interface TakeoutOrder {
  id: string
  storeName: string
  createdAt: UnixMs
  items: { title: string; quantity: number; priceYuan: number }[]
  totalYuan: number
  remark?: string
  address: TakeoutAddress
}

export interface TakeoutModuleData {
  orders: TakeoutOrder[]
  savedAddresses: TakeoutAddress[]
}

// -------------------- 5) Browser --------------------
export interface BrowserSearchRecord {
  id: string
  query: string
  searchedAt: UnixMs
}

export interface BrowserVisitRecord {
  id: string
  title?: string
  url: string
  visitedAt: UnixMs
  dwellMs?: number
}

export interface BrowserBookmark {
  id: string
  title: string
  url: string
  savedAt: UnixMs
}

export interface BrowserModuleData {
  searches: BrowserSearchRecord[]
  visits: BrowserVisitRecord[]
  bookmarks: BrowserBookmark[]
}

// -------------------- 6) Calls --------------------
export type CallType = 'incoming' | 'outgoing'
export type CallResult = 'answered' | 'missed' | 'rejected'

export interface CallTranscript {
  id: string
  text: string
  createdAt: UnixMs
  confidence?: number
}

export interface CallLogItem {
  id: string
  peer: PersonRef
  type: CallType
  result: CallResult
  startedAt: UnixMs
  durationSec: number
  transcript?: CallTranscript
}

export interface CallsModuleData {
  logs: CallLogItem[]
}

// -------------------- 7) Music --------------------
export interface MusicPlayRecord {
  id: string
  trackName: string
  artist?: string
  loopCount: number
  lastPlayedAt: UnixMs
}

export interface MusicModuleData {
  history: MusicPlayRecord[]
}

// -------------------- 8) Entertainment --------------------
export type EntertainmentKind = 'tv' | 'movie' | 'anime' | 'novel' | 'manga'

export interface EntertainmentProgress {
  id: string
  kind: EntertainmentKind
  title: string
  totalWatchedMs: number
  progressPct?: number
  lastAt: UnixMs
  lastPositionMs?: number
}

export interface EntertainmentModuleData {
  items: EntertainmentProgress[]
}

// -------------------- 9) Gaming --------------------
export interface GamingSession {
  id: string
  gameName: string
  loginAt: UnixMs
  logoutAt: UnixMs
}

export interface GamingModuleData {
  sessions: GamingSession[]
}

// -------------------- 10) Check-in --------------------
export interface CheckinRecord {
  id: string
  placeName: string
  lat?: number
  lng?: number
  checkedAt: UnixMs
  kind?: 'work' | 'class' | 'other'
}

export interface CheckinModuleData {
  records: CheckinRecord[]
}

// -------------------- 11) Journey / Location --------------------
export interface JourneyStop {
  id: string
  placeName: string
  lat?: number
  lng?: number
  arrivedAt: UnixMs
  leftAt?: UnixMs
  dwellMs: number
}

export interface JourneyModuleData {
  stops: JourneyStop[]
}

// -------------------- 12) Sleep --------------------
export interface SleepRecord {
  id: string
  sleepAt: UnixMs
  wakeAt: UnixMs
  deepSleepMs: number
}

export interface SleepModuleData {
  records: SleepRecord[]
}

// -------------------- 13) Battery --------------------
export interface BatteryChargeRecord {
  id: string
  startAt: UnixMs
  endAt: UnixMs
  beforePct: number
  afterPct: number
}

export interface BatteryModuleData {
  charges: BatteryChargeRecord[]
}

// -------------------- 14) Maps --------------------
export interface MapsSearchRecord {
  id: string
  query: string
  searchedAt: UnixMs
}

export interface MapsModuleData {
  searches: MapsSearchRecord[]
}

// -------------------- Root dictionary --------------------
export interface CharacterPhoneData {
  meta: CharacterPhoneMeta
  wechat: WeChatModuleData
  notes: NotesModuleData
  shopping: ShoppingModuleData
  takeout: TakeoutModuleData
  browser: BrowserModuleData
  calls: CallsModuleData
  music: MusicModuleData
  entertainment: EntertainmentModuleData
  gaming: GamingModuleData
  checkin: CheckinModuleData
  journey: JourneyModuleData
  sleep: SleepModuleData
  battery: BatteryModuleData
  maps: MapsModuleData
}

export const mockCharacterPhoneData: CharacterPhoneData = {
  meta: {
    characterId: 'peer-001',
    characterName: '他',
    deviceModel: 'Obsidian OS',
    locale: 'zh-CN',
    lastSyncAt: Date.now(),
  },
  wechat: {
    chats: [],
    billing: [],
    affectionCards: [],
    momentsHistory: [],
    momentsPrivacy: [],
    pinnedContacts: [],
    blockedContacts: [],
  },
  notes: { notes: [] },
  shopping: { orders: [], supportChats: [], reviews: [], browsingHistory: [], cart: [] },
  takeout: { orders: [], savedAddresses: [] },
  browser: { searches: [], visits: [], bookmarks: [] },
  calls: { logs: [] },
  music: { history: [] },
  entertainment: { items: [] },
  gaming: { sessions: [] },
  checkin: { records: [] },
  journey: { stops: [] },
  sleep: { records: [] },
  battery: { charges: [] },
  maps: { searches: [] },
}

