import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable } from '../../../components/Pressable'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterBusySettingsRow, WeChatGlobalSettingsRow } from '../newFriendsPersona/types'

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
      <span className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out" style={{ left: on ? 26 : 4 }} />
    </button>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="w-full rounded-[12px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">{children}</div>
}

type PersonaContact = { characterId: string; remarkName: string; avatarUrl?: string }

export function WeChatBusySettingsScreen({ onBack, personaContacts }: { onBack: () => void; personaContacts: PersonaContact[] }) {
  const [gs, setGs] = useState<WeChatGlobalSettingsRow | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [characterRow, setCharacterRow] = useState<CharacterBusySettingsRow | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scenariosInput, setScenariosInput] = useState('')

  const load = useCallback(async () => {
    const g = await personaDb.getGlobalSettings()
    setGs(g)
  }, [])

  const loadCharacter = useCallback(async () => {
    const cid = selectedCharacterId.trim()
    if (!cid) return
    const row = await personaDb.getCharacterBusySettings(cid)
    setCharacterRow(row)
  }, [selectedCharacterId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedCharacterId.trim()) return
    if (personaContacts.length) setSelectedCharacterId(personaContacts[0]!.characterId)
  }, [personaContacts, selectedCharacterId])

  useEffect(() => {
    if ((gs?.busyMode ?? 'global') !== 'character') return
    void loadCharacter()
  }, [gs?.busyMode, loadCharacter])

  useEffect(() => {
    const onChange = () => {
      void load()
      if ((gs?.busyMode ?? 'global') === 'character') void loadCharacter()
    }
    window.addEventListener('wechat-storage-changed', onChange)
    return () => window.removeEventListener('wechat-storage-changed', onChange)
  }, [load, loadCharacter, gs?.busyMode])

  const mode = gs?.busyMode ?? 'global'
  const globalCfg: WeChatGlobalSettingsRow['globalBusyConfig'] = gs?.globalBusyConfig ?? {
    maxDuration: 30,
    triggerProbability: 20,
    customScenarios: [],
  }
  const effective = mode === 'character' ? characterRow : null

  const enabledForPanel = mode === 'character' ? (effective?.enabled ?? true) : !!gs?.busyEnabled

  const scenarioList = useMemo(() => {
    if (mode === 'character') return effective?.customScenarios ?? []
    return globalCfg.customScenarios
  }, [mode, effective?.customScenarios, globalCfg.customScenarios])

  useEffect(() => {
    setScenariosInput(scenarioList.join('\n'))
  }, [scenarioList])

  const saveScenarios = useCallback(async () => {
    const list = scenariosInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)
    if (mode === 'character') {
      const cid = selectedCharacterId.trim()
      if (!cid) return
      await personaDb.putCharacterBusySettings({ characterId: cid, customScenarios: list })
      await loadCharacter()
      return
    }
    await personaDb.putGlobalSettings({ globalBusyConfig: { ...globalCfg, customScenarios: list } })
    await load()
  }, [mode, scenariosInput, selectedCharacterId, globalCfg, load, loadCharacter])

  const maxDuration = mode === 'character' ? (effective?.maxDuration ?? globalCfg.maxDuration) : globalCfg.maxDuration

  const patchBusyNumbers = useCallback(
    async (partial: { maxDuration?: number }) => {
      if (mode === 'character') {
        const cid = selectedCharacterId.trim()
        if (!cid) return
        await personaDb.putCharacterBusySettings({ characterId: cid, ...partial })
        await loadCharacter()
      } else {
        await personaDb.putGlobalSettings({ globalBusyConfig: { ...globalCfg, ...partial } })
        await load()
      }
    },
    [mode, selectedCharacterId, loadCharacter, globalCfg, load],
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <header className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Pressable>
        <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">忙碌设置</h1>
        <div className="w-10 shrink-0" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[16px] font-medium text-black">忙碌总开关</p>
                <p className="mt-1 text-[13px] text-[#8e8e8e]">关闭后所有角色不会进入忙碌</p>
              </div>
              <WxSwitch on={!!gs?.busyEnabled} onToggle={() => void personaDb.putGlobalSettings({ busyEnabled: !gs?.busyEnabled }).then(load)} />
            </div>
          </Card>
          <Card>
            <p className="text-[14px] font-medium text-black">配置模式</p>
            <div className={`mt-2 ${!gs?.busyEnabled ? 'pointer-events-none opacity-50' : ''}`}>
              <button type="button" className="flex w-full items-center justify-between rounded-[10px] px-2 py-2 text-left" onClick={() => void personaDb.putGlobalSettings({ busyMode: 'global' }).then(load)}>
                <span className="text-[15px] text-black">全局统一配置</span>
                <span className="text-[13px] text-[#666]">{mode === 'global' ? '已选中' : ''}</span>
              </button>
              <button type="button" className="flex w-full items-center justify-between rounded-[10px] px-2 py-2 text-left" onClick={() => void personaDb.putGlobalSettings({ busyMode: 'character' }).then(load)}>
                <span className="text-[15px] text-black">按角色单独配置</span>
                <span className="text-[13px] text-[#666]">{mode === 'character' ? '已选中' : ''}</span>
              </button>
            </div>
          </Card>
          {mode === 'character' ? (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] text-black">角色</span>
                <InlineDropdown
                  label="选择角色"
                  valueText={personaContacts.find((x) => x.characterId === selectedCharacterId)?.remarkName ?? '未选择'}
                  open={pickerOpen}
                  onToggle={() => setPickerOpen((v) => !v)}
                >
                  <div className="grid grid-cols-2 gap-2 px-3 py-2">
                    {personaContacts.map((c) => (
                      <button key={c.characterId} type="button" className="rounded-xl border px-3 py-2 text-left text-[14px]" onClick={() => { setSelectedCharacterId(c.characterId); setPickerOpen(false) }}>
                        {c.remarkName}
                      </button>
                    ))}
                  </div>
                </InlineDropdown>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[15px] text-black">该角色开启忙碌</span>
                <WxSwitch on={effective?.enabled ?? true} onToggle={() => void personaDb.putCharacterBusySettings({ characterId: selectedCharacterId, enabled: !(effective?.enabled ?? true), isBusy: false, busyEndTime: 0 }).then(loadCharacter)} />
              </div>
            </Card>
          ) : null}

          <Card>
            <div className={`${!gs?.busyEnabled || !enabledForPanel ? 'pointer-events-none opacity-50' : ''}`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-black">最大忙碌时长</span>
                  <span className="text-[14px] text-[#666]">{maxDuration} 分钟</span>
                </div>
                <input type="range" min={1} max={120} value={maxDuration} onChange={(e) => void patchBusyNumbers({ maxDuration: Number(e.target.value) })} className="mt-2 w-full accent-black" />
              </div>
              <div className="mt-4">
                <p className="text-[14px] text-black">自定义忙碌场景</p>
                <textarea
                  className="mt-2 min-h-[120px] w-full rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none"
                  value={scenariosInput}
                  onChange={(e) => setScenariosInput(e.target.value)}
                  onBlur={() => void saveScenarios()}
                  placeholder="每行一个场景，如：上课、工作、吃饭"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

