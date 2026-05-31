import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, Sparkles, Play, Pause, Waves, Search } from 'lucide-react'

import { useCustomization } from '../../CustomizationContext'
import type { AppSlot } from '../../types'
import { AppIconTile } from '../../components/AppIconTile'
import { Pressable } from '../../components/Pressable'

import { VoiceStoreProvider, useVoiceStore } from './useVoiceStore'
import {
  createMiniMaxT2ASyncAudioBlob,
  createMiniMaxT2AAsyncTask,
  fetchMiniMaxVoices,
  mergePinnedMiniMaxVoicesIntoList,
  pinMiniMaxVoiceIdForLocalList,
  queryMiniMaxT2AAsyncTask,
  retrieveMiniMaxAudioFileUrl,
  type MiniMaxApiRegion,
  type MiniMaxVoiceInfo,
} from './services/minimaxApi'
import { PlatinumToast } from './components/PlatinumToast'
import { BottomSheet } from './components/BottomSheet'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import { loadCanonicalCastingCharacterIds } from '../wechat/wechatCastingRoster'
import { resolveCanonicalCharacterId } from '../wechat/wechatGlobalCharacterRegistry'

type TabId = 'settings' | 'archive' | 'casting'

const TAB_LABEL: Record<TabId, string> = {
  settings: 'Settings',
  archive: 'Voice Archive',
  casting: 'Casting',
}

const SPEECH_MODEL_OPTIONS = [
  {
    id: 'speech-2.8-hd',
    label: 'Speech-2.8-HD',
    advantage: '情绪渲染与语气词表现最自然，音质通透',
    recommended: '角色配音、情感对白、追求自然听感的高质量场景',
  },
  {
    id: 'speech-2.8-turbo',
    label: 'Speech-2.8-Turbo',
    advantage: '生成速度快，效果接近 HD',
    recommended: '实时预览、频繁调参、追求响应速度的交互场景',
  },
  {
    id: 'speech-2.6-hd',
    label: 'Speech-2.6-HD',
    advantage: '韵律稳定、自然度高，整体质量均衡',
    recommended: '通用配音、长文本朗读、成本与质量平衡场景',
  },
  {
    id: 'speech-2.6-turbo',
    label: 'Speech-2.6-Turbo',
    advantage: '低延时、速度优先',
    recommended: '低时延语音聊天、快速生成草稿音频',
  },
  {
    id: 'speech-02-hd',
    label: 'Speech-02-HD',
    advantage: '音质与复刻稳定性较强（历史经典）',
    recommended: '老项目兼容、对历史音色效果一致性有要求的场景',
  },
  {
    id: 'speech-02-turbo',
    label: 'Speech-02-Turbo',
    advantage: '速度快，小语种表现较稳',
    recommended: '历史链路延续、小语种快速合成',
  },
] as const

function TabBar({ value, onChange }: { value: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="relative mx-auto mt-2 flex w-full max-w-[420px] items-center justify-between px-4">
      <div className="relative flex w-full items-center gap-1 rounded-full border border-black/8 bg-white/70 p-1 backdrop-blur">
        {(['settings', 'archive', 'casting'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`relative flex-1 rounded-full px-3 py-2 text-[12px] font-medium transition-colors ${
              value === t ? 'text-[#111]' : 'text-[#6b7280]'
            }`}
          >
            {value === t ? (
              <motion.span
                layoutId="voiceprint-tab-underline"
                className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.22), rgba(0,0,0,0.02))' }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            ) : null}
            <span className="relative">{TAB_LABEL[t]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UnderlineInput({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] font-medium text-[#4b5563]">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent py-2 text-[14px] text-[#111] outline-none placeholder:text-[#9ca3af]"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.10)' }}
      />
    </label>
  )
}

function InvitationCard() {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-black/8 bg-white shadow-[0_14px_40px_rgba(0,0,0,0.06)]">
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          background:
            'radial-gradient(900px 260px at 18% 30%, rgba(212,175,55,0.20), transparent 60%), radial-gradient(700px 240px at 78% 70%, rgba(212,175,55,0.12), transparent 65%)',
        }}
      />
      <div className="relative px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-[14px] border border-black/8 bg-white/70 p-2 backdrop-blur">
            <Sparkles size={18} color="#D4AF37" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-[#111]">前往 MiniMax 声纹实验室，缔造属于他的专属声线。</div>
            <div className="mt-1 text-[12px] leading-relaxed text-[#6b7280]">
              这是一个“邀请函”入口。你将在官方页面完成音色设计，再回到这里管理与试听。
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Pressable
            className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[12px] font-medium text-[#111] backdrop-blur active:bg-black/5"
            onClick={() => window.open('https://www.minimaxi.com/audio/voice-design', '_blank')}
          >
            Design Voice
          </Pressable>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_ACTIVATE_TTS_TEXT = '你好。'

function SettingsTab() {
  const {
    apiKey,
    groupId,
    speechModel,
    apiRegion,
    setApiKey,
    setGroupId,
    setSpeechModel,
    setApiRegion,
    setVoices,
  } = useVoiceStore()
  const [apiKeyDraft, setApiKeyDraft] = useState(apiKey)
  const [groupIdDraft, setGroupIdDraft] = useState(groupId)
  const [speechModelDraft, setSpeechModelDraft] = useState(speechModel)
  const [apiRegionDraft, setApiRegionDraft] = useState<MiniMaxApiRegion>(apiRegion)
  const [modelGuideOpen, setModelGuideOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tone, setTone] = useState<'error' | 'info'>('info')
  const [testing, setTesting] = useState(false)
  const [activateVoiceIdDraft, setActivateVoiceIdDraft] = useState('')
  const [activateTextDraft, setActivateTextDraft] = useState(DEFAULT_ACTIVATE_TTS_TEXT)
  const [activatingVoice, setActivatingVoice] = useState(false)
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false)
  const [activateRemarkDraft, setActivateRemarkDraft] = useState('')
  const currentModelMeta = useMemo(
    () => SPEECH_MODEL_OPTIONS.find((m) => m.id === speechModelDraft) ?? SPEECH_MODEL_OPTIONS[0],
    [speechModelDraft],
  )

  useEffect(() => {
    setApiKeyDraft(apiKey)
  }, [apiKey])
  useEffect(() => {
    setGroupIdDraft(groupId)
  }, [groupId])
  useEffect(() => {
    setSpeechModelDraft(speechModel)
  }, [speechModel])
  useEffect(() => {
    setApiRegionDraft(apiRegion)
  }, [apiRegion])

  const saveSettings = () => {
    setApiKey(apiKeyDraft.trim())
    setGroupId(groupIdDraft.trim())
    setSpeechModel(speechModelDraft.trim())
    setApiRegion(apiRegionDraft)
    setTone('info')
    setToast('声纹配置已保存')
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      await fetchMiniMaxVoices({
        apiKey: apiKeyDraft.trim(),
        groupId: groupIdDraft.trim(),
        apiRegion: apiRegionDraft,
      })
      setTone('info')
      setToast('连接测试成功，API Key 可用')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接测试失败'
      setTone('error')
      setToast(msg)
    } finally {
      setTesting(false)
    }
  }

  const openActivateRemarkSheet = () => {
    const vid = activateVoiceIdDraft.trim()
    if (!vid) {
      setTone('error')
      setToast('请先把编号粘贴到输入框里')
      return
    }
    const key = apiKeyDraft.trim()
    if (!key) {
      setTone('error')
      setToast('请先填写上面的 API Key')
      return
    }
    setActivateRemarkDraft('')
    setActivateConfirmOpen(true)
  }

  const activateVoiceForApiListing = async (remarkForList: string) => {
    const vid = activateVoiceIdDraft.trim()
    if (!vid) {
      setTone('error')
      setToast('请先把编号粘贴到输入框里')
      return
    }
    const key = apiKeyDraft.trim()
    if (!key) {
      setTone('error')
      setToast('请先填写上面的 API Key')
      return
    }
    const label = String(remarkForList || '').trim().slice(0, 40)
    if (!label) {
      setTone('error')
      setToast('请填写备注')
      return
    }
    const txt = (activateTextDraft.trim() || DEFAULT_ACTIVATE_TTS_TEXT).slice(0, 500)
    setActivatingVoice(true)
    try {
      await createMiniMaxT2ASyncAudioBlob(
        { apiKey: key, groupId: groupIdDraft.trim(), apiRegion: apiRegionDraft },
        {
          voice_id: vid,
          text: txt,
          model: speechModelDraft.trim() || 'speech-2.8-hd',
        },
      )
      pinMiniMaxVoiceIdForLocalList(vid, label)
      const creds = {
        apiKey: key,
        groupId: groupIdDraft.trim(),
        apiRegion: apiRegionDraft,
      }
      /** 与激活使用同一套凭据写入 store，避免切到「Voice Archive」时挂载即用旧 Key 把列表刷掉 */
      setApiKey(key)
      setGroupId(groupIdDraft.trim())
      setSpeechModel(speechModelDraft.trim() || 'speech-2.8-hd')
      setApiRegion(apiRegionDraft)
      try {
        const list = await fetchMiniMaxVoices(creds)
        setVoices(list)
        setTone('info')
        setToast('已激活，列表已更新')
      } catch (refreshErr) {
        setVoices(mergePinnedMiniMaxVoicesIntoList([]))
        setTone('info')
        setToast(
          `已激活；更新列表时出错：${refreshErr instanceof Error ? refreshErr.message : '请稍后再试'}`,
        )
      }
    } catch (e) {
      setTone('error')
      setToast(e instanceof Error ? e.message : '激活失败')
    } finally {
      setActivatingVoice(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-4 px-4 pb-6 pt-4">
      <div className="rounded-[18px] border border-black/8 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="text-[13px] font-semibold text-[#111]">核心密钥</div>
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[#4b5563]">API 区域</div>
            <div className="flex w-full gap-1 rounded-[12px] border border-black/10 bg-[#fafafa] p-1">
              {(
                [
                  { id: 'domestic' as const, label: '国内版' },
                  { id: 'international' as const, label: '海外版' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApiRegionDraft(opt.id)}
                  className={`flex-1 rounded-[10px] px-2 py-2 text-[12px] font-medium transition-colors ${
                    apiRegionDraft === opt.id
                      ? 'bg-white text-[#111] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                      : 'text-[#6b7280] active:bg-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-[#9ca3af]">
              需与 API Key
              所属控制台一致。海外站含
              <span className="mx-0.5 font-mono text-[10px]">moss_</span>
              等系统音色时选「海外版」。
              {' '}
              <a
                href="https://platform.minimax.io/docs/faq/about-apis"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#D4AF37] underline underline-offset-2"
              >
                国际站说明
              </a>
            </div>
          </div>
          <UnderlineInput label="MiniMax API Key" value={apiKeyDraft} placeholder="sk-..." onChange={setApiKeyDraft} />
          <UnderlineInput
            label="Group ID（可选）"
            value={groupIdDraft}
            placeholder="optional group id"
            onChange={setGroupIdDraft}
          />
          <div className="text-[11px] leading-relaxed text-[#9ca3af]">
            提示：点击“保存设置”后会写入 localStorage。不要把完整 Key 粘贴到聊天里。
          </div>
          <div className="pt-1 text-[12px] text-[#6b7280]">
            可前往
            {' '}
            <a
              href={
                apiRegionDraft === 'international'
                  ? 'https://platform.minimax.io/user-center/basic-information/interface-key'
                  : 'https://platform.minimaxi.com/user-center/basic-information'
              }
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#D4AF37] underline underline-offset-2"
            >
              {apiRegionDraft === 'international' ? 'MiniMax 国际站 · API Keys' : 'MiniMax 账户中心'}
            </a>
            {' '}
            获取 API Key 与 Group ID。
          </div>
          <div className="pt-1">
            <div className="mb-1 text-[12px] font-medium text-[#4b5563]">语音模型</div>
            <select
              value={speechModelDraft}
              onChange={(e) => setSpeechModelDraft(e.target.value)}
              className="w-full rounded-[12px] border border-black/10 bg-white px-3 py-2 text-[13px] text-[#111] outline-none"
            >
              {SPEECH_MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[11px] text-[#9ca3af]">
              模型来源于 MiniMax 模型概览。你可以按“质量优先 / 速度优先 / 兼容历史”选择。
            </div>
          </div>
          <div className="rounded-[12px] border border-black/8 bg-[#fafafa] p-3">
            <div className="flex items-start justify-between gap-2 rounded-[10px] border border-black/10 bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[#111]">模型选择指南</div>
                <div className="mt-0.5 truncate text-[11px] text-[#6b7280]">
                  当前：{currentModelMeta.label} · {currentModelMeta.advantage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelGuideOpen((v) => !v)}
                className="ml-2 shrink-0 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-[#6b7280]"
              >
                {modelGuideOpen ? '收起' : '展开'}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {modelGuideOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="mt-2 overflow-hidden"
                >
                  <div className="space-y-2">
                    {SPEECH_MODEL_OPTIONS.map((m) => (
                      <div key={m.id} className="rounded-[10px] border border-black/8 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-semibold text-[#111]">{m.label}</div>
                          {speechModelDraft === m.id ? (
                            <div className="rounded-full bg-[#111] px-2 py-0.5 text-[10px] text-white">当前</div>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] text-[#4b5563]">优势：{m.advantage}</div>
                        <div className="mt-0.5 text-[11px] text-[#6b7280]">推荐：{m.recommended}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Pressable
              className="rounded-full bg-[#111] px-3 py-1.5 text-[12px] font-medium text-white active:opacity-90"
              onClick={saveSettings}
            >
              保存设置
            </Pressable>
            <Pressable
              className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-[#111] active:bg-black/5"
              onClick={() => void testConnection()}
            >
              {testing ? '测试中...' : '测试连接'}
            </Pressable>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-black/8 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="text-[13px] font-semibold text-[#111]">激活音色</div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#6b7280]">
          列表里若一直找不到某个音色，请把从网页里复制下来的<strong>整段编号</strong>粘贴到下面，再点激活。会先让你填一句<strong>备注</strong>，方便以后在列表里分辨是谁的声音。
        </p>
        <div className="mt-3 space-y-3">
          <UnderlineInput
            label="音色编号"
            value={activateVoiceIdDraft}
            placeholder="从网页复制整段编号粘贴到这里"
            onChange={setActivateVoiceIdDraft}
          />
          <UnderlineInput
            label="试听用的一句话（很短即可）"
            value={activateTextDraft}
            placeholder={DEFAULT_ACTIVATE_TTS_TEXT}
            onChange={setActivateTextDraft}
          />
          <Pressable
            className="w-full rounded-full bg-[#111] py-2.5 text-center text-[12px] font-medium text-white active:opacity-90 disabled:opacity-50"
            onClick={openActivateRemarkSheet}
            disabled={activatingVoice}
          >
            激活
          </Pressable>
        </div>
      </div>

      <BottomSheet
        open={activateConfirmOpen}
        title="填写备注"
        onClose={() => !activatingVoice && setActivateConfirmOpen(false)}
      >
        <p className="text-[12px] leading-relaxed text-[#6b7280]">
          给这个音色起个好认的名字（最多 40 个字），会显示在音色列表里。
        </p>
        <p className="mt-2 truncate rounded-lg bg-black/[0.04] px-2 py-1.5 text-[11px] text-[#374151]">
          编号：{activateVoiceIdDraft.trim() || '（未填写）'}
        </p>
        <label className="mt-3 block">
          <div className="mb-1 text-[12px] font-medium text-[#4b5563]">备注</div>
          <input
            value={activateRemarkDraft}
            onChange={(e) => setActivateRemarkDraft(e.target.value.slice(0, 40))}
            placeholder="例如：男主旁白、客服女声"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[14px] text-[#111] outline-none placeholder:text-[#9ca3af]"
          />
        </label>
        <div className="mt-4 flex gap-2">
          <Pressable
            type="button"
            className="flex-1 rounded-full border border-black/10 py-2.5 text-[13px] font-medium text-[#374151] active:bg-black/5"
            onClick={() => setActivateConfirmOpen(false)}
            disabled={activatingVoice}
          >
            取消
          </Pressable>
          <Pressable
            type="button"
            className="flex-1 rounded-full bg-[#111] py-2.5 text-[13px] font-medium text-white active:opacity-90 disabled:opacity-50"
            onClick={() => {
              const r = activateRemarkDraft.trim()
              if (!r) {
                setTone('error')
                setToast('请填写备注')
                return
              }
              setActivateConfirmOpen(false)
              void activateVoiceForApiListing(r)
            }}
            disabled={activatingVoice}
          >
            {activatingVoice ? '处理中…' : '确认激活'}
          </Pressable>
        </div>
      </BottomSheet>

      <InvitationCard />
      <PlatinumToast open={!!toast} message={toast || ''} tone={tone} onClose={() => setToast(null)} />
    </div>
  )
}

function VoiceCard({
  v,
  selected,
  onSelect,
  rightAction,
}: {
  v: MiniMaxVoiceInfo
  selected: boolean
  onSelect: () => void
  rightAction?: ReactNode
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className="w-full rounded-[16px] border px-3 py-3 text-left transition-colors active:bg-black/5"
      style={{
        borderColor: selected ? 'rgba(212,175,55,0.55)' : 'rgba(0,0,0,0.08)',
        background: selected ? 'rgba(212,175,55,0.06)' : 'white',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#111]">{v.voice_name || v.voice_id}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-[#6b7280]">{v.voice_id}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rightAction}
          <div className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[10px] text-[#6b7280]">
            {v.voice_type || 'voice'}
          </div>
        </div>
      </div>
      {v.description?.length ? (
        <div className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[#6b7280]">{v.description.join(' ')}</div>
      ) : null}
    </div>
  )
}

type VoiceSection = { key: 'mine' | 'system'; label: string; hint: string; items: MiniMaxVoiceInfo[] }

function buildVoiceSections(list: MiniMaxVoiceInfo[]) {
  const mine: MiniMaxVoiceInfo[] = []
  const system: MiniMaxVoiceInfo[] = []
  for (const v of list) {
    if (v.voice_type === 'system') {
      system.push(v)
    } else {
      mine.push(v)
    }
  }
  const sections: VoiceSection[] = []
  if (mine.length) {
    sections.push({ key: 'mine', label: '我的音色', hint: `${mine.length} 个`, items: mine })
  }
  if (system.length) {
    sections.push({ key: 'system', label: '系统音色', hint: `${system.length} 个`, items: system })
  }
  return sections
}

function VoiceSectionBlock({
  section,
  selectedVoiceId,
  onSelect,
  renderRightAction,
}: {
  section: VoiceSection
  selectedVoiceId?: string
  onSelect: (v: MiniMaxVoiceInfo) => void
  renderRightAction?: (v: MiniMaxVoiceInfo) => ReactNode
}) {
  return (
    <div className="rounded-[16px] border border-black/8 bg-white/60 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[12px] font-semibold text-[#374151]">{section.label}</div>
        <div className="text-[10px] text-[#9ca3af]">{section.hint}</div>
      </div>
      <div className="space-y-2">
        {section.items.map((v) => (
          <VoiceCard
            key={v.voice_id}
            v={v}
            selected={selectedVoiceId === v.voice_id}
            onSelect={() => onSelect(v)}
            rightAction={renderRightAction ? renderRightAction(v) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function ArchiveTab() {
  const { apiKey, groupId, speechModel, apiRegion, voices, setVoices } = useVoiceStore()
  const [query, setQuery] = useState('')
  const [selectedVoice, setSelectedVoice] = useState<MiniMaxVoiceInfo | null>(null)
  const [testText, setTestText] = useState('你好，我是你的专属声音。')
  const [toast, setToast] = useState<string | null>(null)
  const [tone, setTone] = useState<'error' | 'info'>('error')

  const [synthState, setSynthState] = useState<
    | { status: 'idle' }
    | { status: 'loading'; label: string }
    | { status: 'ready'; audioUrl: string }
  >({ status: 'idle' })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewVoice, setPreviewVoice] = useState<MiniMaxVoiceInfo | null>(null)
  const [previewTextDraft, setPreviewTextDraft] = useState('你好，<#0.5#>我是你的专属声音。(clear-throat)')
  const previewTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const previewAudioMapRef = useRef<Record<string, string>>({})
  const [previewAudioByVoiceId, setPreviewAudioByVoiceId] = useState<Record<string, string>>({})
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const tonePresets = useMemo(
    () => [
      { label: '轻笑', token: '(laughs)' },
      { label: '笑出声', token: '(chuckle)' },
      { label: '清嗓', token: '(clear-throat)' },
      { label: '咳嗽', token: '(coughs)' },
      { label: '低吟', token: '(groans)' },
      { label: '呼吸', token: '(breath)' },
      { label: '喘息', token: '(pant)' },
      { label: '吸气', token: '(inhale)' },
      { label: '呼气', token: '(exhale)' },
      { label: '惊喘', token: '(gasps)' },
      { label: '抽鼻', token: '(sniffs)' },
      { label: '叹息', token: '(sighs)' },
      { label: '哼鼻', token: '(snorts)' },
      { label: '打嗝', token: '(burps)' },
      { label: '咂嘴', token: '(lip-smacking)' },
      { label: '哼唱', token: '(humming)' },
      { label: '嘶声', token: '(hissing)' },
      { label: '迟疑', token: '(emm)' },
      { label: '喷嚏', token: '(sneezes)' },
    ],
    [],
  )
  const emotionPresets = useMemo(
    () => [
      { label: '开心', token: '{happy}是吗？{/happy}' },
      { label: '伤感', token: '{sad}是吗？{/sad}' },
      { label: '生气', token: '{angry}是吗？{/angry}' },
      { label: '害怕', token: '{fearful}是吗？{/fearful}' },
      { label: '厌恶', token: '{disgusted}是吗？{/disgusted}' },
      { label: '惊讶', token: '{surprised}是吗？{/surprised}' },
      { label: '中性', token: '{neutral}是吗？{/neutral}' },
      { label: '流畅', token: '{fluent}是吗？{/fluent}' },
    ],
    [],
  )

  const creds = useMemo(() => ({ apiKey, groupId, apiRegion }), [apiKey, groupId, apiRegion])

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase()
    if (!kw) return voices
    return voices.filter((v) => (v.voice_name || v.voice_id).toLowerCase().includes(kw) || v.voice_id.toLowerCase().includes(kw))
  }, [query, voices])
  const voiceSections = useMemo(() => buildVoiceSections(filtered), [filtered])

  const refreshVoices = useCallback(async () => {
    try {
      const list = await fetchMiniMaxVoices(creds)
      setVoices(list)
      setTone('info')
      setToast(`已获取音色 ${list.length} 个`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '获取音色失败'
      setTone('error')
      setToast(msg)
    }
  }, [creds, setVoices])

  useEffect(() => {
    // 进入音色页时自动拉取（Group ID 可选）
    if (!apiKey.trim()) return
    void refreshVoices()
  }, [apiKey, apiRegion, refreshVoices])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      if (!a.duration || !Number.isFinite(a.duration)) return
      setProgress(Math.max(0, Math.min(1, a.currentTime / a.duration)))
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
      setPlayingVoiceId(null)
    }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [synthState.status])

  const stopAudio = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.pause()
    a.currentTime = 0
    setPlaying(false)
    setProgress(0)
    setPlayingVoiceId(null)
  }, [])

  useEffect(() => {
    previewAudioMapRef.current = previewAudioByVoiceId
  }, [previewAudioByVoiceId])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current && objectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      Object.values(previewAudioMapRef.current).forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u)
      })
    }
  }, [])

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
      return
    }
    void a.play()
    setPlaying(true)
  }, [playing])

  const synthesize = useCallback(async (voiceIdArg?: string, textArg?: string) => {
    try {
      const voiceId = (voiceIdArg ?? selectedVoice?.voice_id ?? '').trim()
      const content = (textArg ?? testText).trim()
      if (!voiceId) throw new Error('请先选择 voice_id')
      stopAudio()
      setLoadingVoiceId(voiceId)
      setSynthState({ status: 'loading', label: 'Synthesizing vocal cords...' })

      // 先走同步链路（与 Lumi 机一致），iOS PWA 兼容性更好；失败再回退异步链路。
      try {
        const syncBlob = await createMiniMaxT2ASyncAudioBlob(creds, {
          voice_id: voiceId,
          text: content,
          model: speechModel,
        })
        const syncUrl = URL.createObjectURL(syncBlob)
        objectUrlRef.current = syncUrl
        audioRef.current = new Audio(syncUrl)
        setPreviewAudioByVoiceId((prev) => {
          const old = prev[voiceId]
          if (old && old !== syncUrl && old.startsWith('blob:')) URL.revokeObjectURL(old)
          return { ...prev, [voiceId]: syncUrl }
        })
        setSynthState({ status: 'ready', audioUrl: syncUrl })
        setPlaying(false)
        setProgress(0)
        return
      } catch {
        // ignore and fallback async
      }

      const created = await createMiniMaxT2AAsyncTask(creds, { voice_id: voiceId, text: content, model: speechModel })
      const task_id = String((created as any).task_id ?? '')
      if (!task_id) throw new Error('任务创建失败：缺少 task_id')
      const started = Date.now()
      let waitMs = 600
      for (;;) {
        await new Promise((r) => window.setTimeout(r, waitMs))
        waitMs = Math.min(1400, Math.round(waitMs * 1.15))
        const q = await queryMiniMaxT2AAsyncTask(creds, { task_id })
        const payload = ((q as any)?.data && typeof (q as any).data === 'object' ? (q as any).data : q) as any
        const url = String(payload?.audio_url ?? payload?.url ?? '').trim()
        const fileId = String(payload?.file_id ?? '').trim()
        const statusRaw = payload?.status ?? payload?.task_status ?? payload?.state ?? ''
        const statusText = String(statusRaw).trim().toLowerCase()
        const statusNum = Number(statusRaw)
        const isFailed =
          statusText.includes('fail') || statusText.includes('error') || (Number.isFinite(statusNum) && statusNum < 0)
        const isDone =
          statusText.includes('success') ||
          statusText.includes('succeed') ||
          statusText.includes('done') ||
          statusText.includes('finish') ||
          statusText.includes('complete') ||
          (Number.isFinite(statusNum) && statusNum >= 2)

        if (url || (fileId && isDone)) {
          let finalUrl = url
          if (!finalUrl && fileId) {
            try {
              finalUrl = await retrieveMiniMaxAudioFileUrl(creds, { file_id: fileId })
            } catch (e) {
              const msg = e instanceof Error ? e.message : ''
              const transientFileNotReady = msg.includes('code=2013') || msg.includes('暂不可用') || msg.includes('file not found')
              if (transientFileNotReady) {
                continue
              }
              throw e
            }
          }
          objectUrlRef.current = finalUrl
          audioRef.current = new Audio(finalUrl)
          setPreviewAudioByVoiceId((prev) => {
            const old = prev[voiceId]
            if (old && old !== finalUrl && old.startsWith('blob:')) URL.revokeObjectURL(old)
            return { ...prev, [voiceId]: finalUrl }
          })
          setSynthState({ status: 'ready', audioUrl: finalUrl })
          setPlaying(false)
          setProgress(0)
          return
        }
        if (isFailed) {
          throw new Error('语音合成失败，请检查 Key/余额/模型参数')
        }
        if (Date.now() - started > 45_000) {
          throw new Error('合成超时，请稍后重试')
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '合成失败'
      setSynthState({ status: 'idle' })
      setTone('error')
      setToast(msg)
    } finally {
      setLoadingVoiceId(null)
    }
  }, [creds, selectedVoice?.voice_id, speechModel, stopAudio, testText])

  const playVoicePreview = useCallback(
    (voiceId: string) => {
      const url = previewAudioByVoiceId[voiceId]
      if (!url) return
      if (!audioRef.current || audioRef.current.src !== url) {
        audioRef.current = new Audio(url)
      }
      const a = audioRef.current
      if (!a) return
      if (playing && playingVoiceId === voiceId) {
        a.pause()
        setPlaying(false)
        setPlayingVoiceId(null)
        return
      }
      const tryPlayWithFallback = async () => {
        try {
          await a.play()
          setPlaying(true)
          setPlayingVoiceId(voiceId)
          return
        } catch (firstErr) {
          // 某些浏览器会因 blob mime 判断失败抛 NotSupportedError，这里做格式兜底重试。
          if (!url.startsWith('blob:')) throw firstErr
          const rawBlob = await fetch(url).then((r) => r.blob())
          for (const mime of ['audio/mpeg', 'audio/wav']) {
            try {
              const retryUrl = URL.createObjectURL(new Blob([rawBlob], { type: mime }))
              audioRef.current = new Audio(retryUrl)
              await audioRef.current.play()
              setPreviewAudioByVoiceId((prev) => {
                const old = prev[voiceId]
                if (old && old !== retryUrl && old.startsWith('blob:')) URL.revokeObjectURL(old)
                return { ...prev, [voiceId]: retryUrl }
              })
              setPlaying(true)
              setPlayingVoiceId(voiceId)
              return
            } catch {
              // try next mime
            }
          }
          throw firstErr
        }
      }
      void tryPlayWithFallback()
        .then(() => {
          // handled in tryPlayWithFallback
        })
        .catch((err) => {
          setTone('error')
          const msg = err instanceof Error ? err.message : '浏览器拦截或音频无效'
          setToast(`播放失败：${msg}`)
          setPlaying(false)
          setPlayingVoiceId(null)
        })
    },
    [playing, playingVoiceId, previewAudioByVoiceId],
  )

  const quickInsert = useCallback((token: string) => {
    const textarea = previewTextareaRef.current
    if (!textarea) {
      setPreviewTextDraft((prev) => `${prev}${token}`)
      return
    }
    const start = textarea.selectionStart ?? previewTextDraft.length
    const end = textarea.selectionEnd ?? previewTextDraft.length
    const next = `${previewTextDraft.slice(0, start)}${token}${previewTextDraft.slice(end)}`
    setPreviewTextDraft(next.slice(0, 500))
    window.requestAnimationFrame(() => {
      textarea.focus()
      const caret = Math.min(start + token.length, 500)
      textarea.setSelectionRange(caret, caret)
    })
  }, [previewTextDraft])

  const openPreviewDialog = useCallback((voice: MiniMaxVoiceInfo) => {
    setPreviewVoice(voice)
    setPreviewDialogOpen(true)
  }, [])

  const confirmPreview = useCallback(async () => {
    if (!previewVoice) return
    const content = previewTextDraft.trim()
    setSelectedVoice(previewVoice)
    setTestText(content || testText)
    setPreviewDialogOpen(false)
    await synthesize(previewVoice.voice_id, content || testText)
  }, [previewTextDraft, previewVoice, synthesize, testText])

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 pb-8 pt-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 py-2 backdrop-blur">
          <Search size={14} className="text-[#6b7280]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voice_id / name"
            className="w-full bg-transparent text-[13px] text-[#111] outline-none placeholder:text-[#9ca3af]"
          />
        </div>
        <Pressable
          className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[12px] text-[#111] backdrop-blur active:bg-black/5"
          onClick={() => void refreshVoices()}
        >
          刷新
        </Pressable>
      </div>

      <div className="mt-3 space-y-2">
        {voiceSections.map((section) => (
          <VoiceSectionBlock
            key={section.key}
            section={section}
            selectedVoiceId={selectedVoice?.voice_id}
            onSelect={openPreviewDialog}
            renderRightAction={(v) =>
              previewAudioByVoiceId[v.voice_id] ? (
                <Pressable
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/85 active:bg-black/5"
                  onClick={(e: any) => {
                    e?.stopPropagation?.()
                    playVoicePreview(v.voice_id)
                  }}
                  aria-label={playing && playingVoiceId === v.voice_id ? '暂停预览' : '播放预览'}
                >
                  {playing && playingVoiceId === v.voice_id ? <Pause size={13} /> : <Play size={13} className="ml-[1px]" />}
                </Pressable>
              ) : null
            }
          />
        ))}
        {!voiceSections.length ? <div className="py-10 text-center text-[12px] text-[#9ca3af]">暂无音色</div> : null}
      </div>

      <AnimatePresence initial={false}>
        {selectedVoice ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="mt-3 overflow-hidden rounded-[18px] border border-black/8 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-[#111]">T2A Generation</div>
              <div className="font-mono text-[11px] text-[#6b7280]">{selectedVoice.voice_id}</div>
            </div>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value.slice(0, 500))}
              className="mt-3 h-[88px] w-full resize-none rounded-[14px] border border-black/10 bg-[#fff] px-3 py-2 text-[13px] leading-relaxed text-[#111] outline-none placeholder:text-[#9ca3af]"
              placeholder="输入要合成的台词..."
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <Pressable
                className="flex items-center gap-2 rounded-full bg-[#111] px-4 py-2 text-[12px] font-medium text-white active:opacity-90"
                onClick={() => void synthesize()}
              >
                {synthState.status === 'loading' ? (
                  <motion.span
                    className="flex items-center gap-2"
                    initial={false}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.1 }}
                  >
                    <Waves size={14} color="#D4AF37" />
                    <span className="tracking-wide">{synthState.label}</span>
                  </motion.span>
                ) : (
                  <>
                    <Waves size={14} color="#D4AF37" />
                    <span>提取声纹</span>
                  </>
                )}
              </Pressable>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {synthState.status === 'ready' ? (
                  <>
                    <Pressable
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 backdrop-blur active:bg-black/5"
                      onClick={togglePlay}
                      aria-label={playing ? '暂停' : '播放'}
                    >
                      {playing ? <Pause size={16} /> : <Play size={16} className="ml-[1px]" />}
                    </Pressable>
                    <div className="relative h-[2px] w-[140px] overflow-hidden rounded-full bg-black/10">
                      <motion.div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ background: '#D4AF37' }}
                        animate={{ width: `${Math.round(progress * 100)}%` }}
                        transition={{ duration: 0.08, ease: 'linear' }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-[#9ca3af]">生成后可播放试听</div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PlatinumToast open={!!toast} message={toast || ''} tone={tone} onClose={() => setToast(null)} />
      <AnimatePresence>
        {loadingVoiceId ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-[320px] rounded-[18px] border border-black/10 bg-white px-4 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.20)]"
              initial={{ y: 16, opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
            >
              <motion.div
                className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#fff8e7]"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Waves size={16} color="#D4AF37" />
              </motion.div>
              <div className="text-[14px] font-semibold text-[#111]">正在生成语音预览...</div>
              <div className="mt-1 text-[12px] text-[#6b7280]">音色 ID：{loadingVoiceId}</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {previewDialogOpen && previewVoice ? (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewDialogOpen(false)}
          >
            <motion.div
              className="w-full max-w-[420px] rounded-[20px] border border-black/10 bg-white p-4 shadow-[0_18px_60px_rgba(0,0,0,0.20)]"
              initial={{ y: 28, opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[14px] font-semibold text-[#111]">是否生成语音预览？</div>
              <div className="mt-1 text-[12px] text-[#6b7280]">
                当前音色：<span className="font-medium text-[#111]">{previewVoice.voice_name || previewVoice.voice_id}</span>
              </div>

              <textarea
                ref={previewTextareaRef}
                value={previewTextDraft}
                onChange={(e) => setPreviewTextDraft(e.target.value.slice(0, 500))}
                className="mt-3 h-[96px] w-full resize-none rounded-[14px] border border-black/10 bg-[#fff] px-3 py-2 text-[13px] leading-relaxed text-[#111] outline-none placeholder:text-[#9ca3af]"
                placeholder="输入要用这个音色合成的语音内容..."
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pressable
                  className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-[#374151] active:bg-black/5"
                  onClick={() => quickInsert('<#0.5#>')}
                >
                  + 插入停顿（后台：&lt;#0.5#&gt;）
                </Pressable>
                <Pressable
                  className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-[#374151] active:bg-black/5"
                  onClick={() => quickInsert('(clear-throat)')}
                >
                  + 清嗓（后台：(clear-throat)）
                </Pressable>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {tonePresets.map((preset) => (
                  <Pressable
                    key={preset.token}
                    className="rounded-full border border-black/10 bg-[#fafafa] px-2.5 py-1 text-[11px] text-[#4b5563] active:bg-black/5"
                    onClick={() => quickInsert(preset.token)}
                  >
                    {preset.label}
                  </Pressable>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {emotionPresets.map((preset) => (
                  <Pressable
                    key={preset.label}
                    className="rounded-full border border-black/10 bg-[#f7f7ff] px-2.5 py-1 text-[11px] text-[#4b5563] active:bg-black/5"
                    onClick={() => quickInsert(preset.token)}
                  >
                    {preset.label}
                  </Pressable>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-[#9ca3af]">
                说明：前端显示中文标签，插入内容使用官方控制词格式（语气词/情绪标签）以保证合成效果。
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Pressable
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#374151] active:bg-black/5"
                  onClick={() => setPreviewDialogOpen(false)}
                >
                  取消
                </Pressable>
                <Pressable
                  className="rounded-full bg-[#111] px-3 py-1.5 text-[12px] font-medium text-white active:opacity-90"
                  onClick={() => void confirmPreview()}
                >
                  生成预览
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function CastingTab() {
  const { state } = useCustomization()
  const { voices, characterVoiceMap, setCharacterVoice, clearCharacterVoice, pruneCharacterVoiceMappingsToAllowed } =
    useVoiceStore()
  const [characters, setCharacters] = useState<Character[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null)
  const [query, setQuery] = useState('')

  const refreshCastingCharacters = useCallback(async () => {
    const ids = await loadCanonicalCastingCharacterIds(state.wechatPersonaContacts)
    pruneCharacterVoiceMappingsToAllowed(ids)

    const list = (await personaDb.listCharacters()) ?? []
    const byCanon = new Map<string, Character>()
    for (const ch of list) {
      const raw = ch.id.trim()
      if (!raw) continue
      const canon = (await resolveCanonicalCharacterId(raw)) || raw
      if (!ids.has(canon)) continue
      if (!byCanon.has(canon)) byCanon.set(canon, ch)
    }
    setCharacters([...byCanon.values()])
  }, [pruneCharacterVoiceMappingsToAllowed, state.wechatPersonaContacts])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refreshCastingCharacters()
      if (cancelled) return
    })()
    const onStorage = () => {
      void refreshCastingCharacters()
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [refreshCastingCharacters])

  const openPicker = (ch: Character) => {
    setActiveCharacter(ch)
    setQuery('')
    setSheetOpen(true)
  }

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase()
    if (!kw) return voices
    return voices.filter((v) => (v.voice_name || v.voice_id).toLowerCase().includes(kw) || v.voice_id.toLowerCase().includes(kw))
  }, [query, voices])
  const voiceSections = useMemo(() => buildVoiceSections(filtered), [filtered])

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 pb-8 pt-4">
      <div className="rounded-[18px] border border-black/8 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
        <div className="text-[13px] font-semibold text-[#111]">角色声带映射</div>
        <div className="mt-1 text-[12px] leading-relaxed text-[#6b7280]">
          这里会保存 <span className="font-mono">CharacterId → voice_id</span>，后续微信/语音通话可直接读取发声。
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {characters.map((ch) => {
          const voiceId = characterVoiceMap[ch.id] || ''
          const voiceName = voices.find((v) => v.voice_id === voiceId)?.voice_name
          return (
            <button
              key={ch.id}
              type="button"
              className="w-full rounded-[16px] border border-black/8 bg-white px-3 py-3 text-left active:bg-black/5"
              onClick={() => openPicker(ch)}
            >
              <div className="flex items-center gap-3">
                <img
                  src={ch.avatarUrl || ''}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-black/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#111]">{ch.name || '未命名角色'}</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[#9ca3af]">{ch.id}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="truncate text-[12px] text-[#111]">{voiceName || (voiceId ? '已绑定' : '未绑定')}</div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[#6b7280]">{voiceId || '—'}</div>
                </div>
              </div>
            </button>
          )
        })}
        {!characters.length ? <div className="py-10 text-center text-[12px] text-[#9ca3af]">暂无角色数据</div> : null}
      </div>

      <BottomSheet
        open={sheetOpen}
        title={activeCharacter ? `为「${activeCharacter.name || '角色'}」选择声纹` : '选择声纹'}
        onClose={() => setSheetOpen(false)}
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 py-2 backdrop-blur">
            <Search size={14} className="text-[#6b7280]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 voice_id / name"
              className="w-full bg-transparent text-[13px] text-[#111] outline-none placeholder:text-[#9ca3af]"
            />
          </div>
          {activeCharacter ? (
            <Pressable
              className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[12px] text-[#111] backdrop-blur active:bg-black/5"
              onClick={() => {
                clearCharacterVoice(activeCharacter.id)
                setSheetOpen(false)
              }}
            >
              清除
            </Pressable>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          {voiceSections.map((section) => (
            <VoiceSectionBlock
              key={section.key}
              section={section}
              selectedVoiceId={activeCharacter ? characterVoiceMap[activeCharacter.id] : undefined}
              onSelect={(v) => {
                if (!activeCharacter) return
                setCharacterVoice(activeCharacter.id, v.voice_id)
                setSheetOpen(false)
              }}
            />
          ))}
          {!voiceSections.length ? <div className="py-8 text-center text-[12px] text-[#9ca3af]">暂无可选音色</div> : null}
        </div>
      </BottomSheet>
    </div>
  )
}

function InnerApp({ onBack }: { onBack: () => void }) {
  const { state } = useCustomization()
  const { theme, appPageStyles } = state
  const appId: AppSlot['id'] = 'voiceprint'
  const pageStyle = appPageStyles[appId]
  const [tab, setTab] = useState<TabId>('settings')

  return (
    <div
      className="flex h-full flex-col"
      data-phone-page="app"
      data-app-id={appId}
      style={{
        backgroundColor: pageStyle?.pageBg || '#ffffff',
        backgroundImage: pageStyle?.pageBgImageUrl ? `url(${pageStyle.pageBgImageUrl})` : 'none',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        fontFamily: pageStyle?.fontFamily || 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          borderBottom: `1px solid ${theme.border}`,
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          backgroundColor: pageStyle?.headerBg || theme.surface,
          backgroundImage: pageStyle?.headerBgImageUrl ? `url(${pageStyle.headerBgImageUrl})` : 'none',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: pageStyle?.headerText || theme.text }}
          aria-label="返回桌面"
        >
          <ChevronLeft size={20} />
        </Pressable>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AppIconTile appId={appId} bgSize={50} glyphSize={32} radius={13} />
          <h1 className="truncate text-[15px] font-semibold" style={{ color: pageStyle?.headerText || theme.text }}>
            声纹档案
          </h1>
        </div>
      </header>

      <TabBar value={tab} onChange={setTab} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'settings' ? <SettingsTab /> : tab === 'archive' ? <ArchiveTab /> : <CastingTab />}
      </div>
    </div>
  )
}

export function VoiceprintHubApp({ onBack }: { onBack: () => void }) {
  return (
    <VoiceStoreProvider>
      <InnerApp onBack={onBack} />
    </VoiceStoreProvider>
  )
}

