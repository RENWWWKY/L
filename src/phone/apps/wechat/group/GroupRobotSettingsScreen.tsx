import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { Pressable } from '../../../components/Pressable'
import type { GroupChatRow, GroupRobotRule } from '../newFriendsPersona/types'
import { compressAvatarDataUrl, MAX_AVATAR_DATA_URL_LEN } from '../avatarCompress'
import { appendGroupChatEventNotice, groupNoticeMemberNickname } from '../groupChatEventNotice'
import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import { WECHAT_GROUP_USER_CHAR_ID } from '../wechatConversationKey'
import {
  parseGroupRobotTriggerWordInput,
  resolveGroupRobotAvatarDisplayUrl,
  userCanEditGroupRobotTriggerRulesInClient,
} from '../groupChatUtils'

function Cell({
  children,
  borderBottom,
  onClick,
}: {
  children: React.ReactNode
  borderBottom?: boolean
  onClick?: () => void
}) {
  const cls =
    'flex w-full items-center justify-between bg-white px-4 py-3 text-left text-[#111827]'
  const style = { borderBottom: borderBottom ? '1px solid #F3F4F6' : undefined }
  if (onClick) {
    return (
      <Pressable type="button" onClick={onClick} className={cls} style={style}>
        {children}
      </Pressable>
    )
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}

export function GroupRobotSettingsScreen({
  group,
  playerIdentityId,
  onBack,
}: {
  group: GroupChatRow
  playerIdentityId: string
  onBack: () => void
}) {
  const [rules, setRules] = useState<GroupRobotRule[]>(group.robotRules ?? [])
  const [draftWord, setDraftWord] = useState('')
  const [draftText, setDraftText] = useState('请注意文明发言。')
  const [action, setAction] = useState<'warn' | 'mute'>('warn')
  const [robotUrlDraft, setRobotUrlDraft] = useState('')
  const [robotCropSrc, setRobotCropSrc] = useState('')
  const robotFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRules(group.robotRules ?? [])
  }, [group.robotRules, group.id])

  useEffect(() => {
    const a = (group.robotAvatarUrl ?? '').trim()
    setRobotUrlDraft(a.startsWith('data:') ? '' : a)
  }, [group.robotAvatarUrl, group.id])

  const canEditRules = userCanEditGroupRobotTriggerRulesInClient(group)

  const persistRobotAvatar = useCallback(
    async (next: string) => {
      const row = await personaDb.getGroupChat(group.id)
      if (!row) return
      await personaDb.putGroupChat({
        ...row,
        robotAvatarUrl: next.trim() ? next.trim() : undefined,
        updatedAt: Date.now(),
        playerIdentityId: row.playerIdentityId || playerIdentityId,
      })
      emitWeChatStorageChanged()
    },
    [group.id, playerIdentityId],
  )

  const applyRobotImageUrl = async () => {
    const t = robotUrlDraft.trim()
    if (!t) {
      window.alert('请输入图片地址')
      return
    }
    await persistRobotAvatar(t)
  }

  const restoreDefaultRobotAvatar = async () => {
    if (!window.confirm('恢复为默认群管家头像？')) return
    await persistRobotAvatar('')
  }

  const onPickLocalRobotImage = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) setRobotCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const save = useCallback(
    async (next: GroupRobotRule[]) => {
      const row = await personaDb.getGroupChat(group.id)
      if (!row) return
      await personaDb.putGroupChat({ ...row, robotRules: next, playerIdentityId: row.playerIdentityId || playerIdentityId })
      emitWeChatStorageChanged()
      setRules(next)
    },
    [group.id, playerIdentityId],
  )

  const addRule = async () => {
    if (!canEditRules) return
    const words = parseGroupRobotTriggerWordInput(draftWord)
    if (!words.length) return
    const next: GroupRobotRule[] = [
      ...rules,
      { triggerWords: words, action, warningText: draftText.trim() || '请注意发言规范。' },
    ]
    await save(next)
    const pid = playerIdentityId.trim()
    if (pid) {
      const row = await personaDb.getGroupChat(group.id)
      const actorMem = row?.members.find((m) => m.charId === WECHAT_GROUP_USER_CHAR_ID)
      await appendGroupChatEventNotice({
        groupId: group.id,
        playerIdentityId: pid,
        displayText: `${groupNoticeMemberNickname(actorMem)}新增了敏感词至群机器人`,
      })
    }
    setDraftWord('')
  }

  const removeAt = async (i: number) => {
    if (!canEditRules) return
    const next = rules.filter((_, j) => j !== i)
    await save(next)
  }

  const robotPreviewSrc = resolveGroupRobotAvatarDisplayUrl(group)

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F3F4F6]">
      <ImageCropperModal
        open={!!robotCropSrc}
        imageSrc={robotCropSrc}
        title="裁剪群管家头像（1:1）"
        aspect={1}
        maxSide={1080}
        objectFit="contain"
        onCancel={() => setRobotCropSrc('')}
        onConfirm={async (dataUrl) => {
          try {
            const next = await compressAvatarDataUrl(dataUrl, MAX_AVATAR_DATA_URL_LEN)
            if (next.length > MAX_AVATAR_DATA_URL_LEN) {
              window.alert('图片过大，请选择较小的图片或使用网络地址。')
              return
            }
            await persistRobotAvatar(next)
            setRobotCropSrc('')
          } catch {
            window.alert('图片处理失败，请换一张图片重试。')
          }
        }}
      />
      <input
        ref={robotFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickLocalRobotImage(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <header
        className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2">
          <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
          </Pressable>
          <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群管家敏感词</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-8 pt-3">
        <p className="mx-4 mb-3 text-[12px] leading-relaxed text-[#6B7280]">
          与群公告相同性质：触发词与规则对群内全员公开可查看；群主或管理员可添加、修改或删除规则及群管家头像。
        </p>

        {canEditRules ? (
          <div className="mx-4 mb-4 overflow-hidden rounded-[12px] border border-[#F3F4F6] bg-white p-4">
            <p className="text-center text-[13px] font-medium text-[#111827]">群管家头像</p>
            <div className="mx-auto mt-3 flex w-full max-w-[140px] flex-col items-center">
              <div
                className="relative w-full overflow-hidden rounded-full bg-[#E5E7EB]"
                style={{ aspectRatio: '1 / 1' }}
              >
                <img src={robotPreviewSrc} alt="" className="size-full object-cover" />
              </div>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-[#9CA3AF]">展示为 1:1；未设置时使用默认图</p>
            </div>
            <label className="mt-4 block text-[12px] text-[#6B7280]">图片地址（http(s) 或站点内路径）</label>
            <input
              value={robotUrlDraft}
              onChange={(e) => setRobotUrlDraft(e.target.value)}
              placeholder="https://…"
              className="mt-1.5 w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[#111827]"
            />
            <Pressable
              type="button"
              onClick={() => void applyRobotImageUrl()}
              className="mt-2 flex w-full items-center justify-center rounded-[10px] bg-[#111827] py-2.5 text-[14px] font-medium text-white active:opacity-90"
            >
              应用地址
            </Pressable>
            <Pressable
              type="button"
              onClick={() => robotFileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white py-2.5 text-[14px] font-medium text-[#111827] active:bg-[#F9FAFB]"
            >
              从本地选择并裁剪（1:1）
            </Pressable>
            {(group.robotAvatarUrl ?? '').trim() ? (
              <Pressable
                type="button"
                onClick={() => void restoreDefaultRobotAvatar()}
                className="mt-2 flex w-full items-center justify-center rounded-[10px] py-2.5 text-[14px] font-medium text-[#DC2626] active:opacity-80"
              >
                恢复默认头像
              </Pressable>
            ) : null}
          </div>
        ) : (
          <div className="mx-4 mb-4 overflow-hidden rounded-[12px] border border-[#F3F4F6] bg-white p-4">
            <p className="text-center text-[13px] font-medium text-[#111827]">群管家头像</p>
            <div className="mx-auto mt-3 flex w-full max-w-[140px] flex-col items-center">
              <div
                className="relative w-full overflow-hidden rounded-full bg-[#E5E7EB]"
                style={{ aspectRatio: '1 / 1' }}
              >
                <img src={robotPreviewSrc} alt="" className="size-full object-cover" />
              </div>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-[#9CA3AF]">全员可见；群主或管理员可修改</p>
            </div>
          </div>
        )}

        {canEditRules ? (
          <div className="mx-0 overflow-hidden bg-white">
            <Cell borderBottom>
              <span className="text-[15px]">触发词</span>
              <input
                value={draftWord}
                onChange={(e) => setDraftWord(e.target.value)}
                placeholder="多条触发词请用 | 、中英文逗号、分号或空格分隔"
                className="ml-3 min-w-0 flex-1 rounded-lg border border-[#F3F4F6] px-2 py-1.5 text-right text-[14px] text-[#111827] outline-none"
              />
            </Cell>
            <Cell borderBottom>
              <span className="text-[15px]">动作</span>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as 'warn' | 'mute')}
                className="rounded-lg border border-[#F3F4F6] px-2 py-1 text-[14px] text-[#111827]"
              >
                <option value="warn">仅警告</option>
                <option value="mute">警告后禁言</option>
              </select>
            </Cell>
            <Cell borderBottom>
              <span className="text-[15px]">警告文案</span>
            </Cell>
            <div className="bg-white px-4 pb-3">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[#F3F4F6] px-3 py-2 text-[14px] text-[#111827] outline-none"
              />
            </div>
            <div className="bg-white px-4 pb-4">
              <Pressable
                type="button"
                onClick={() => void addRule()}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#111827] py-2.5 text-[14px] font-medium text-white"
              >
                <Plus className="size-4" strokeWidth={2} />
                添加规则
              </Pressable>
            </div>
          </div>
        ) : null}

        <p className="mt-4 px-4 text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">已启用规则</p>
        <div className="mt-2 divide-y divide-[#F3F4F6] overflow-hidden bg-white">
          {rules.length === 0 ? (
            <div className="px-4 py-8 text-center text-[14px] text-[#9CA3AF]">暂无规则</div>
          ) : (
            rules.map((r, i) => (
              <div key={`${i}-${r.triggerWords.join(',')}`} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-[#111827]">{r.triggerWords.join(' · ')}</p>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">{r.action === 'mute' ? '警告 / 禁言' : '警告'} · {r.warningText}</p>
                </div>
                {canEditRules ? (
                  <Pressable type="button" aria-label="删除" onClick={() => void removeAt(i)} className="shrink-0 p-2 text-[#111827]">
                    <Trash2 className="size-4" strokeWidth={2} />
                  </Pressable>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
