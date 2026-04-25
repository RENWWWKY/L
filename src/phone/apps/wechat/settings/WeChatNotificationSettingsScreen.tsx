import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterNotificationSettingsRow, WeChatGlobalSettingsRow } from '../newFriendsPersona/types'
import { getWeChatBuiltInNotifySoundMeta, type WeChatBuiltInNotifySoundKey } from '../wechatNotifySound'

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full min-w-0 rounded-[12px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  )
}

function RadioRow({
  checked,
  label,
  description,
  onClick,
  disabled,
}: {
  checked: boolean
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors disabled:opacity-50"
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: checked ? '#000000' : '#c7c7cc', background: checked ? '#000000' : '#ffffff' }}
        aria-hidden
      >
        {checked ? <span className="text-[12px] text-white">✓</span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-black">{label}</span>
        {description ? <span className="mt-0.5 block text-[13px] text-[#8e8e8e]">{description}</span> : null}
      </span>
    </button>
  )
}

type PersonaContact = { characterId: string; remarkName: string; avatarUrl?: string }

function base64FromDataUrl(dataUrl: string): { base64: string; mime: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl)
  if (!m) return null
  return { mime: m[1]!, base64: m[2] ?? '' }
}

export function WeChatNotificationSettingsScreen({
  onBack,
  personaContacts,
}: {
  onBack: () => void
  personaContacts: PersonaContact[]
}) {
  const [gs, setGs] = useState<WeChatGlobalSettingsRow | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  const [characterRow, setCharacterRow] = useState<CharacterNotificationSettingsRow | null>(null)
  const [uploading, setUploading] = useState(false)
  const [charPickerOpen, setCharPickerOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const load = useCallback(async () => {
    const next = await personaDb.getGlobalSettings()
    setGs(next)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedCharacterId.trim()) return
    if (personaContacts.length) {
      setSelectedCharacterId(personaContacts[0]!.characterId)
    }
  }, [personaContacts, selectedCharacterId])

  const loadCharacterRow = useCallback(async () => {
    if (!gs || gs.notificationMode !== 'character') return
    const cid = selectedCharacterId.trim()
    if (!cid) return
    const row = await personaDb.getCharacterNotificationSettings(cid)
    setCharacterRow(row)
  }, [gs, selectedCharacterId])

  useEffect(() => {
    void loadCharacterRow()
  }, [loadCharacterRow])

  useEffect(() => {
    const onChange = () => void load()
    window.addEventListener('wechat-storage-changed', onChange)
    return () => window.removeEventListener('wechat-storage-changed', onChange)
  }, [load])

  const disabledAll = !gs?.notificationEnabled

  const mode = gs?.notificationMode ?? 'global'

  const currentAudio = useMemo(() => {
    if (!gs) {
      const meta = getWeChatBuiltInNotifySoundMeta('notify2')
      return { kind: 'url' as const, url: meta.url, name: meta.name }
    }
    const global = gs.globalAudio
    if (mode === 'character') {
      if (characterRow?.audio?.type === 'custom') {
        return {
          kind: 'base64' as const,
          base64: characterRow.audio.customAudioBase64,
          mime: characterRow.audio.customAudioMime,
          name: characterRow.audio.customAudioName,
        }
      }
    }
    if (global?.type === 'custom') {
      return {
        kind: 'base64' as const,
        base64: global.customAudioBase64,
        mime: global.customAudioMime,
        name: global.customAudioName,
      }
    }
    const meta = getWeChatBuiltInNotifySoundMeta(global.defaultKey)
    return { kind: 'url' as const, url: meta.url, name: meta.name }
  }, [characterRow?.audio, gs, mode])

  const stopPreview = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    try {
      a.pause()
      a.currentTime = 0
    } catch {
      // ignore
    }
    setPlaying(false)
  }, [])

  const togglePreview = useCallback(async () => {
    const a = audioRef.current ?? new Audio()
    audioRef.current = a
    if (playing) {
      stopPreview()
      return
    }
    const src = currentAudio.kind === 'url' ? currentAudio.url : `data:${currentAudio.mime};base64,${currentAudio.base64}`
    a.src = src
    a.onended = () => setPlaying(false)
    a.onpause = () => setPlaying(false)
    try {
      setPlaying(true)
      await a.play()
    } catch {
      setPlaying(false)
      window.alert('播放失败：浏览器可能拦截了自动播放，请先进行一次点击操作后重试')
    }
  }, [currentAudio, playing, stopPreview])

  const setNotificationEnabled = useCallback(
    async (next: boolean) => {
      await personaDb.putGlobalSettings({ notificationEnabled: next })
      await load()
      if (!next) stopPreview()
    },
    [load, stopPreview],
  )

  const setMode = useCallback(
    async (m: 'global' | 'character') => {
      await personaDb.putGlobalSettings({ notificationMode: m })
      await load()
      if (m === 'character') {
        await loadCharacterRow()
      } else {
        setCharacterRow(null)
      }
    },
    [load, loadCharacterRow],
  )

  const onPickAudioFile = useCallback(
    async (file: File, scope: 'global' | 'character') => {
      if (!gs) return
      if (file.size > 5 * 1024 * 1024) {
        window.alert('文件过大：请上传 ≤5MB 的音频')
        return
      }
      const okExt = /\.(mp3|wav|m4a)$/i.test(file.name)
      if (!okExt) {
        window.alert('格式不支持：仅支持 MP3 / WAV / M4A')
        return
      }
      setUploading(true)
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(r.error ?? new Error('read file failed'))
          r.readAsDataURL(file)
        })
        const parsed = base64FromDataUrl(dataUrl)
        if (!parsed?.base64?.trim() || !parsed.mime?.trim()) {
          window.alert('读取失败：无法解析音频数据')
          return
        }
        if (scope === 'global') {
          await personaDb.putGlobalSettings({
            globalAudio: { type: 'custom', customAudioBase64: parsed.base64, customAudioName: file.name, customAudioMime: parsed.mime },
          })
          await load()
        } else {
          const cid = selectedCharacterId.trim()
          if (!cid) return
          await personaDb.putCharacterNotificationSettings({
            characterId: cid,
            audio: { type: 'custom', customAudioBase64: parsed.base64, customAudioName: file.name, customAudioMime: parsed.mime },
          })
          await loadCharacterRow()
        }
      } finally {
        setUploading(false)
      }
    },
    [gs, load, loadCharacterRow, selectedCharacterId],
  )

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputCharacterRef = useRef<HTMLInputElement | null>(null)

  const globalAudioType = gs?.globalAudio?.type ?? 'default'
  const builtInKey: WeChatBuiltInNotifySoundKey =
    gs?.globalAudio?.type === 'default' && gs.globalAudio.defaultKey === 'lai' ? 'lai' : 'notify2'
  const [builtInPickerOpen, setBuiltInPickerOpen] = useState(false)
  const characterAudioType = characterRow?.audio?.type ?? 'global'

  const characterEnabled = characterRow?.notificationEnabled ?? true

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <header
        className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          aria-label="返回"
          onClick={() => {
            stopPreview()
            onBack()
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">通知设置</h1>
        <div className="w-10 shrink-0" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
          {/* 1. 通知总开关 */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-medium text-black">新消息通知提醒</p>
                <p className="mt-1 text-[13px] text-[#8e8e8e]">关闭后，所有角色新消息都不播放提醒音</p>
              </div>
              <WxSwitch on={!!gs?.notificationEnabled} onToggle={() => void setNotificationEnabled(!gs?.notificationEnabled)} />
            </div>
          </Card>

          {/* 2. 配置模式选择 */}
          <Card>
            <p className="text-[14px] font-medium text-black">配置模式</p>
            <div className={`mt-2 ${disabledAll ? 'pointer-events-none opacity-50' : ''}`}>
              <RadioRow
                checked={mode === 'global'}
                label="全局统一配置"
                description="一套音频配置作用于所有角色"
                onClick={() => void setMode('global')}
                disabled={disabledAll}
              />
              <RadioRow
                checked={mode === 'character'}
                label="按角色单独配置"
                description="不同角色可拥有不同的提醒音，未配置的默认使用全局"
                onClick={() => void setMode('character')}
                disabled={disabledAll}
              />
            </div>
          </Card>

          {/* 3. 音频配置区 */}
          <Card>
            <div className={`${disabledAll ? 'pointer-events-none opacity-50' : ''}`}>
              {mode === 'global' ? (
                <>
                  <p className="text-[14px] font-medium text-black">全局音频配置</p>
                  <div className="mt-2">
                    <RadioRow
                      checked={globalAudioType === 'default'}
                      label="默认音频"
                      description="内置：voice\\通知音2.mp3、voice\\消息提示音（来）.mp3（可在下方选择）"
                      onClick={() =>
                        void personaDb
                          .putGlobalSettings({ globalAudio: { type: 'default', defaultKey: builtInKey } })
                          .then(load)
                      }
                      disabled={disabledAll}
                    />
                    {globalAudioType === 'default' ? (
                      <div className="mt-2 px-2">
                        <InlineDropdown
                          label="默认音频"
                          valueText={getWeChatBuiltInNotifySoundMeta(builtInKey).name}
                          open={builtInPickerOpen}
                          onToggle={() => setBuiltInPickerOpen((v) => !v)}
                          disabled={disabledAll}
                        >
                          <div className="grid grid-cols-2 gap-2 px-3 py-2">
                            {(['notify2', 'lai'] as WeChatBuiltInNotifySoundKey[]).map((k) => {
                              const meta = getWeChatBuiltInNotifySoundMeta(k)
                              const active = k === builtInKey
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out"
                                  style={{
                                    borderColor: '#e5e5e5',
                                    background: active ? '#111827' : '#ffffff',
                                    color: active ? '#ffffff' : '#000000',
                                  }}
                                  onClick={() => {
                                    void personaDb
                                      .putGlobalSettings({ globalAudio: { type: 'default', defaultKey: k } })
                                      .then(load)
                                    setBuiltInPickerOpen(false)
                                  }}
                                >
                                  <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                                    style={{ background: active ? 'rgba(255,255,255,0.14)' : '#f5f5f5' }}
                                    aria-hidden
                                  >
                                    <span className="text-[14px]" style={{ color: active ? '#ffffff' : '#000000' }}>
                                      {meta.name.slice(0, 1)}
                                    </span>
                                  </div>
                                  <span className="min-w-0 flex-1 truncate text-[14px]">{meta.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </InlineDropdown>
                      </div>
                    ) : null}
                    <RadioRow
                      checked={globalAudioType === 'custom'}
                      label="自定义音频"
                      description={gs?.globalAudio?.type === 'custom' ? `已上传：${gs.globalAudio.customAudioName}` : '上传后全局生效'}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disabledAll}
                    />
                    <div className="mt-2 px-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          e.target.value = ''
                          void onPickAudioFile(f, 'global')
                        }}
                      />
                      <button
                        type="button"
                        disabled={disabledAll || uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-[10px] bg-black px-3 py-2 text-[14px] font-medium text-white disabled:opacity-50"
                      >
                        {uploading ? '上传中…' : '上传音频'}
                      </button>
                      {gs?.globalAudio?.type === 'custom' ? (
                        <p className="mt-2 text-[13px] text-[#666666]">当前：{gs.globalAudio.customAudioName}</p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-medium text-black">按角色配置</p>
                  <div className="mt-2 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] text-black">选择角色</span>
                      <InlineDropdown
                        label="选择角色"
                        valueText={
                          selectedCharacterId.trim()
                            ? personaContacts.find((c) => c.characterId === selectedCharacterId)?.remarkName ?? '未选择'
                            : '未选择'
                        }
                        open={charPickerOpen}
                        onToggle={() => setCharPickerOpen((v) => !v)}
                        disabled={disabledAll}
                      >
                        <div className="grid grid-cols-2 gap-2 px-3 py-2">
                          {personaContacts.map((c) => {
                            const active = c.characterId === selectedCharacterId
                            return (
                              <button
                                key={c.characterId}
                                type="button"
                                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out"
                                style={{
                                  borderColor: '#e5e5e5',
                                  background: active ? '#111827' : '#ffffff',
                                  color: active ? '#ffffff' : '#000000',
                                }}
                                onClick={() => {
                                  setSelectedCharacterId(c.characterId)
                                  setCharPickerOpen(false)
                                }}
                              >
                                <div
                                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                                  style={{ background: active ? 'rgba(255,255,255,0.14)' : '#f5f5f5' }}
                                  aria-hidden
                                >
                                  <span className="text-[14px]" style={{ color: active ? '#ffffff' : '#000000' }}>
                                    {(c.remarkName || '?').slice(0, 1)}
                                  </span>
                                </div>
                                <span className="min-w-0 flex-1 truncate text-[14px]">{c.remarkName}</span>
                              </button>
                            )
                          })}
                        </div>
                      </InlineDropdown>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] text-black">该角色通知提醒</p>
                        <p className="mt-1 text-[13px] text-[#8e8e8e]">与聊天信息页开关同步</p>
                      </div>
                      <WxSwitch
                        on={characterEnabled}
                        onToggle={() =>
                          void personaDb
                            .putCharacterNotificationSettings({ characterId: selectedCharacterId, notificationEnabled: !characterEnabled })
                            .then(loadCharacterRow)
                        }
                      />
                    </div>

                    <div>
                      <RadioRow
                        checked={characterAudioType === 'global'}
                        label="使用全局音频"
                        onClick={() =>
                          void personaDb
                            .putCharacterNotificationSettings({ characterId: selectedCharacterId, audio: { type: 'global' } })
                            .then(loadCharacterRow)
                        }
                        disabled={disabledAll}
                      />
                      <RadioRow
                        checked={characterAudioType === 'custom'}
                        label="自定义角色音频"
                        description={
                          characterRow?.audio?.type === 'custom' ? `已上传：${characterRow.audio.customAudioName}` : '上传后仅对该角色生效'
                        }
                        onClick={() => fileInputCharacterRef.current?.click()}
                        disabled={disabledAll}
                      />
                      {characterAudioType === 'custom' ? (
                        <div className="mt-2 px-2">
                          <input
                            ref={fileInputCharacterRef}
                            type="file"
                            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (!f) return
                              e.target.value = ''
                              void onPickAudioFile(f, 'character')
                            }}
                          />
                          <button
                            type="button"
                            disabled={disabledAll || uploading}
                            onClick={() => fileInputCharacterRef.current?.click()}
                            className="rounded-[10px] bg-black px-3 py-2 text-[14px] font-medium text-white disabled:opacity-50"
                          >
                            {uploading ? '上传中…' : '上传音频'}
                          </button>
                          {characterRow?.audio?.type === 'custom' ? (
                            <p className="mt-2 text-[13px] text-[#666666]">当前：{characterRow.audio.customAudioName}</p>
                          ) : null}
                        </div>
                      ) : (
                        <input
                          ref={fileInputCharacterRef}
                          type="file"
                          accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            e.target.value = ''
                            void onPickAudioFile(f, 'character')
                          }}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* 4. 音频预览区 */}
          <div className={`${disabledAll ? 'pointer-events-none opacity-50' : ''}`}>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-[14px] text-black">当前音频</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-[#666666]">{currentAudio.name}</span>
                <button
                  type="button"
                  onClick={() => void togglePreview()}
                  className="shrink-0 rounded-[8px] bg-black px-3 py-1.5 text-[14px] font-medium text-white"
                >
                  {playing ? '暂停' : '播放'}
                </button>
              </div>
            </Card>
          </div>
        </div>

        <div className="h-6 shrink-0" style={{ minHeight: 'max(24px, env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  )
}

