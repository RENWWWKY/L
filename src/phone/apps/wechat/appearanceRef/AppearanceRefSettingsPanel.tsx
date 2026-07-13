import { ImagePlus, Link2, Unlink, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compressAvatarDataUrl, MAX_AVATAR_DATA_URL_LEN } from '../avatarCompress'
import {
  APPEARANCE_REF_IMAGES_MAX,
  APPEARANCE_REF_KIND_LABELS,
  APPEARANCE_REF_KIND_ORDER,
  APPEARANCE_REF_NOTE_MAX,
  getCharacterAppearanceRefImages,
  withAppearanceRefImagesSaved,
  withAppearanceRefNoteSaved,
} from '../characterAppearanceRefImages'
import {
  bundleFromCharacterFields,
  clearAppearanceRefContextOverride,
  getAppearanceRefContextOverride,
  upsertAppearanceRefContextOverride,
  type AppearanceRefContext,
} from '../appearanceRefContextStore'
import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import { useImageGenSettings } from '../../api/useImageGenSettings'
import { describeReferenceImageSupportForModel } from '../../../../components/moments/imageGenModelCapabilities'
import { parseMomentsImageModelId } from '../../../../components/moments/momentsImageModelCatalog'
import type {
  Character,
  CharacterAppearanceRefImage,
  CharacterAppearanceRefKind,
  PlayerIdentity,
} from '../newFriendsPersona/types'

export type AppearanceRefPanelContext = 'global' | AppearanceRefContext

export type AppearanceRefPanelSubject = 'character' | 'user'

type Props = {
  subject: AppearanceRefPanelSubject
  context: AppearanceRefPanelContext
  characterId?: string
  playerIdentityId?: string
  title?: string
  description?: string
  className?: string
  /** 约会配图面板：紧凑杂志风排版 */
  variant?: 'default' | 'dating'
  /** 由外层 Tab 提供标题时隐藏面板头 */
  hideHeader?: boolean
}

function newAppearanceRefId(): string {
  return `aref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function cropAspectForKind(kind: CharacterAppearanceRefKind): number {
  if (kind === 'face') return 1
  if (kind === 'full') return 9 / 16
  return 3 / 4
}

const DEFAULT_CHARACTER_DESC =
  '角色发自拍/对镜时，客户端会按参考图锁定五官、体型与画风；与微信头像独立。可上传多张（面部、半身、侧面、全身），最多 8 张。'

const DEFAULT_USER_DESC =
  '用户（你）的形象参考图；剧情配图、聊天发图时可锁定你的外貌。与身份头像独立，最多 8 张。'

export function AppearanceRefSettingsPanel({
  subject,
  context,
  characterId,
  playerIdentityId,
  title,
  description,
  className,
  variant = 'default',
  hideHeader = false,
}: Props) {
  const cid = characterId?.trim() ?? ''
  const pid = playerIdentityId?.trim() ?? ''
  const scoped = context !== 'global' && !!pid && !!cid

  const [character, setCharacter] = useState<Character | null>(null)
  const [playerIdentity, setPlayerIdentity] = useState<PlayerIdentity | null>(null)
  const [forked, setForked] = useState(false)
  const [refImages, setRefImages] = useState<CharacterAppearanceRefImage[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const noteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [pendingKind, setPendingKind] = useState<CharacterAppearanceRefKind>('face')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const loadData = useCallback(async () => {
    if (subject === 'character') {
      if (!cid) {
        setCharacter(null)
        setRefImages([])
        setNoteDraft('')
        setForked(false)
        return
      }
      const ch = (await personaDb.getCharacter(cid)) ?? null
      setCharacter(ch)
      if (scoped) {
        const override = await getAppearanceRefContextOverride(pid, cid, context)
        if (override?.forked) {
          const hasLocal =
            (override.characterRefImages?.length ?? 0) > 0 || !!override.characterRefNote?.trim()
          if (hasLocal) {
            const bundle = bundleFromCharacterFields(
              override.characterRefImages,
              undefined,
              override.characterRefNote,
            )
            setRefImages(bundle.images)
            setNoteDraft(bundle.note ?? '')
            setForked(true)
            return
          }
        }
      }
      const globalImages = getCharacterAppearanceRefImages(ch)
      setRefImages(globalImages)
      setNoteDraft(ch?.appearanceRefNote?.trim() ?? '')
      setForked(false)
      return
    }

    if (!pid) {
      setPlayerIdentity(null)
      setRefImages([])
      setNoteDraft('')
      setForked(false)
      return
    }
    const identity = (await personaDb.getPlayerIdentity(pid)) ?? null
    setPlayerIdentity(identity)
    if (scoped) {
      const override = await getAppearanceRefContextOverride(pid, cid, context)
      if (override?.forked) {
        const hasLocal = (override.userRefImages?.length ?? 0) > 0 || !!override.userRefNote?.trim()
        if (hasLocal) {
          const bundle = bundleFromCharacterFields(
            override.userRefImages,
            undefined,
            override.userRefNote,
          )
          setRefImages(bundle.images)
          setNoteDraft(bundle.note ?? '')
          setForked(true)
          return
        }
      }
    }
    setRefImages(getCharacterAppearanceRefImages(identity))
    setNoteDraft(identity?.appearanceRefNote?.trim() ?? '')
    setForked(false)
  }, [subject, cid, pid, scoped, context])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const onChange = () => void loadData()
    window.addEventListener('wechat-storage-changed', onChange)
    return () => window.removeEventListener('wechat-storage-changed', onChange)
  }, [loadData])

  useEffect(() => {
    return () => {
      if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current)
    }
  }, [])

  const panelTitle = title ?? (subject === 'character' ? '角色形象参考' : '用户形象参考')
  const panelDesc = description ?? (subject === 'character' ? DEFAULT_CHARACTER_DESC : DEFAULT_USER_DESC)
  const { imageGen } = useImageGenSettings()
  const refSupportNote = useMemo(() => {
    const { modelName } = parseMomentsImageModelId(imageGen.modelId)
    return modelName ? describeReferenceImageSupportForModel(imageGen.provider, modelName) : ''
  }, [imageGen])

  const persistGlobal = async (images: CharacterAppearanceRefImage[], note: string) => {
    if (subject === 'character') {
      if (!character) return
      let next = withAppearanceRefImagesSaved(character, images)
      next = withAppearanceRefNoteSaved(next, note)
      await personaDb.upsertCharacter(next)
      setCharacter(next)
    } else {
      if (!playerIdentity) return
      let next = withAppearanceRefImagesSaved(playerIdentity, images)
      next = withAppearanceRefNoteSaved(next, note)
      await personaDb.upsertPlayerIdentity(next)
      setPlayerIdentity(next)
    }
    emitWeChatStorageChanged()
  }

  const persistScoped = async (images: CharacterAppearanceRefImage[], note: string) => {
    if (!scoped) return
    const existing = (await getAppearanceRefContextOverride(pid, cid, context)) ?? {
      playerIdentityId: pid,
      characterId: cid,
      context,
      forked: true,
    }
    const patch =
      subject === 'character'
        ? {
            ...existing,
            playerIdentityId: pid,
            characterId: cid,
            context,
            forked: true as const,
            characterRefImages: images,
            characterRefNote: note.trim() || undefined,
          }
        : {
            ...existing,
            playerIdentityId: pid,
            characterId: cid,
            context,
            forked: true as const,
            userRefImages: images,
            userRefNote: note.trim() || undefined,
          }
    await upsertAppearanceRefContextOverride(patch)
    setForked(true)
    emitWeChatStorageChanged()
  }

  const persist = async (images: CharacterAppearanceRefImage[], note: string) => {
    if (scoped) await persistScoped(images, note)
    else await persistGlobal(images, note)
    setRefImages(images)
    setNoteDraft(note)
  }

  const persistNote = async (nextNote: string) => {
    setNoteSaving(true)
    try {
      await persist(refImages, nextNote)
    } catch (err) {
      console.error('[appearanceRefNote] save failed', err)
      window.alert('形象特征补充保存失败，请稍后重试')
    } finally {
      setNoteSaving(false)
    }
  }

  const scheduleNoteSave = (nextNote: string) => {
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current)
    noteSaveTimerRef.current = setTimeout(() => {
      noteSaveTimerRef.current = null
      void persistNote(nextNote)
    }, 600)
  }

  const persistImages = async (images: CharacterAppearanceRefImage[]) => {
    try {
      await persist(images, noteDraft)
    } catch (err) {
      console.error('[appearanceRef] save failed', err)
      window.alert('形象参考图保存失败，请换一张较小的图片重试')
    }
  }

  const addAppearanceRef = async (dataUrl: string, kind: CharacterAppearanceRefKind) => {
    if (refImages.length >= APPEARANCE_REF_IMAGES_MAX) {
      window.alert(`最多添加 ${APPEARANCE_REF_IMAGES_MAX} 张参考图`)
      return
    }
    const stored = await compressAvatarDataUrl(dataUrl.trim(), MAX_AVATAR_DATA_URL_LEN)
    const entry: CharacterAppearanceRefImage = {
      id: newAppearanceRefId(),
      url: stored,
      kind,
      addedAt: Date.now(),
    }
    await persistImages([...refImages, entry])
  }

  const removeAppearanceRef = async (id: string) => {
    await persistImages(refImages.filter((item) => item.id !== id))
  }

  const changeAppearanceRefKind = async (id: string, kind: CharacterAppearanceRefKind) => {
    await persistImages(refImages.map((item) => (item.id === id ? { ...item, kind } : item)))
  }

  const clearAllAppearanceRefs = async () => {
    await persistImages([])
  }

  const restoreGlobalSync = async () => {
    if (!scoped) return
    const existing = await getAppearanceRefContextOverride(pid, cid, context)
    if (!existing) return
    const patch =
      subject === 'character'
        ? { ...existing, characterRefImages: undefined, characterRefNote: undefined }
        : { ...existing, userRefImages: undefined, userRefNote: undefined }
    const stillForked =
      subject === 'character'
        ? !!(patch.userRefImages?.length || patch.userRefNote?.trim())
        : !!(patch.characterRefImages?.length || patch.characterRefNote?.trim())
    if (stillForked) {
      await upsertAppearanceRefContextOverride({ ...patch, forked: true })
    } else {
      await clearAppearanceRefContextOverride(pid, cid, context)
    }
    await loadData()
  }

  const onPickFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) setCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const syncBadge = useMemo(() => {
    if (!scoped) return '全局同步'
    return forked ? '本页独立配置' : '跟随全局'
  }, [scoped, forked])

  if (subject === 'character' && !cid) return null
  if (subject === 'user' && !pid) return null

  const canAdd = refImages.length < APPEARANCE_REF_IMAGES_MAX
  const isDating = variant === 'dating'

  const kindPills = (
    <div className={`flex flex-wrap gap-1.5 ${isDating ? '' : 'mt-1.5'}`}>
      {APPEARANCE_REF_KIND_ORDER.map((kind) => {
        const active = pendingKind === kind
        return (
          <button
            key={kind}
            type="button"
            onClick={() => setPendingKind(kind)}
            className={
              isDating
                ? `shrink-0 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                    active ? 'bg-[#262626] text-white' : 'bg-stone-100 text-[#666]'
                  }`
                : `rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    active ? 'bg-[#576b95] text-white' : 'bg-[#f5f5f5] text-[#666]'
                  }`
            }
          >
            {APPEARANCE_REF_KIND_LABELS[kind]}
          </button>
        )
      })}
    </div>
  )

  const imageStrip = (
    <div
      className={
        isDating
          ? 'flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'mt-3 flex flex-wrap gap-2'
      }
    >
      {refImages.map((item) => {
        const preview = resolveCharacterAvatarUrl({ avatarUrl: item.url }) || item.url
        const thumbCls = isDating
          ? 'relative size-[68px] shrink-0 overflow-hidden rounded-xl border border-stone-200/90 bg-stone-50'
          : 'relative size-[72px] overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white'
        return (
          <div key={item.id} className={isDating ? 'relative shrink-0' : 'relative w-[72px]'}>
            <div className={thumbCls}>
              <img src={preview} alt="" className="size-full object-cover" />
              {isDating ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1 pb-0.5 pt-3 text-center text-[9px] text-white">
                  {APPEARANCE_REF_KIND_LABELS[item.kind]}
                </span>
              ) : null}
              <button
                type="button"
                aria-label="删除参考图"
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/55 text-white"
                onClick={() => void removeAppearanceRef(item.id)}
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </div>
            <select
              value={item.kind}
              onChange={(e) =>
                void changeAppearanceRefKind(item.id, e.target.value as CharacterAppearanceRefKind)
              }
              className={
                isDating
                  ? 'mt-1 w-[68px] rounded-md border-0 bg-transparent px-0 py-0 text-center text-[9px] text-[#8e8e8e] outline-none'
                  : 'mt-1 w-full rounded-[6px] border border-[#e5e5e5] bg-white px-1 py-0.5 text-[10px] text-[#333]'
              }
            >
              {APPEARANCE_REF_KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {APPEARANCE_REF_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
        )
      })}

      {canAdd ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={
            isDating
              ? 'flex size-[68px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-stone-300/90 bg-stone-50/80 text-[#8e8e8e] transition-colors active:bg-stone-100'
              : 'flex size-[72px] shrink-0 items-center justify-center rounded-[10px] border border-dashed border-[#d9d9d9] bg-[#fafafa]'
          }
        >
          <ImagePlus className={isDating ? 'size-5' : 'size-6'} strokeWidth={1.5} />
          {isDating ? <span className="text-[9px]">添加</span> : null}
        </button>
      ) : null}
    </div>
  )

  const noteField = (
    <textarea
      value={noteDraft}
      maxLength={APPEARANCE_REF_NOTE_MAX}
      rows={isDating ? 2 : 3}
      placeholder={
        subject === 'character'
          ? '例：银白色长发、琥珀色眼瞳…'
          : '例：黑色短发、戴眼镜…'
      }
      className={
        isDating
          ? 'mt-2 w-full resize-none rounded-xl border border-stone-200/90 bg-[#fafafa] px-3 py-2 text-[12px] leading-relaxed text-[#262626] outline-none placeholder:text-[#c7c7cc] focus:border-stone-400 focus:bg-white'
          : 'mt-1.5 w-full resize-none rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#333] outline-none placeholder:text-[#c7c7cc] focus:border-[#576b95]'
      }
      onChange={(e) => {
        const next = e.target.value
        setNoteDraft(next)
        scheduleNoteSave(next)
      }}
      onBlur={() => {
        if (noteSaveTimerRef.current) {
          clearTimeout(noteSaveTimerRef.current)
          noteSaveTimerRef.current = null
        }
        void persistNote(noteDraft)
      }}
    />
  )

  if (isDating) {
    return (
      <>
        <div className={className ?? ''}>
          {!hideHeader ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#262626]">{panelTitle}</p>
                <p className="mt-0.5 text-[11px] text-[#8e8e8e]">
                  {refImages.length ? `已上传 ${refImages.length} 张` : '尚未上传参考图'}
                  {' · '}
                  {syncBadge}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                  forked && scoped ? 'bg-stone-200/80 text-[#262626]' : 'bg-stone-100 text-[#8e8e8e]'
                }`}
              >
                {forked && scoped ? <Unlink className="size-3" /> : <Link2 className="size-3" />}
                {forked && scoped ? '独立' : '同步'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-[#8e8e8e]">
                {refImages.length ? `${refImages.length} 张参考图` : '暂无参考图'}
                {' · '}
                {syncBadge}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {scoped && forked ? (
                  <button
                    type="button"
                    className="text-[11px] text-[#666] underline-offset-2 hover:underline active:opacity-70"
                    onClick={() => void restoreGlobalSync()}
                  >
                    恢复全局
                  </button>
                ) : null}
                {refImages.length ? (
                  <button
                    type="button"
                    className="text-[11px] text-[#666] underline-offset-2 hover:underline active:opacity-70"
                    onClick={() => void clearAllAppearanceRefs()}
                  >
                    清空
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-[#8e8e8e]">下一张类型</p>
            {kindPills}
          </div>

          <div className="mt-2.5">{imageStrip}</div>

          <details className="mt-3 rounded-xl border border-stone-200/80 bg-[#fafafa] px-3 py-2">
            <summary className="cursor-pointer select-none list-none text-[12px] text-[#666] [&::-webkit-details-marker]:hidden">
              特征补充（可选）
              {noteDraft.trim() ? (
                <span className="ml-1.5 text-[10px] text-stone-400">已填写</span>
              ) : null}
            </summary>
            <div className="flex items-center justify-end gap-1 pb-0.5 pt-1">
              <span className="text-[10px] text-[#bbb]">
                {noteDraft.length}/{APPEARANCE_REF_NOTE_MAX}
                {noteSaving ? ' · 保存中' : ''}
              </span>
            </div>
            {noteField}
          </details>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPickFile(e.target.files?.[0] ?? null)
            e.currentTarget.value = ''
          }}
        />

        <ImageCropperModal
          open={!!cropSrc}
          imageSrc={cropSrc ?? ''}
          title={`裁剪形象参考（${APPEARANCE_REF_KIND_LABELS[pendingKind]}）`}
          aspect={cropAspectForKind(pendingKind)}
          maxSide={768}
          objectFit="contain"
          onCancel={() => setCropSrc(null)}
          onConfirm={(dataUrl) => {
            const kind = pendingKind
            setCropSrc(null)
            void addAppearanceRef(dataUrl, kind)
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className={className ?? 'mt-4 border-t border-[#f0f0f0] pt-4'}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[16px] text-black">{panelTitle}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
              forked && scoped ? 'bg-amber-50 text-amber-700' : 'bg-[#f0f4ff] text-[#576b95]'
            }`}
          >
            {forked && scoped ? <Unlink className="size-3" /> : <Link2 className="size-3" />}
            {syncBadge}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">{panelDesc}</p>
        {refSupportNote ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#9CA3AF]">{refSupportNote}</p>
        ) : null}
        {scoped && forked ? (
          <button
            type="button"
            className="mt-2 text-[12px] text-[#576b95] active:opacity-70"
            onClick={() => void restoreGlobalSync()}
          >
            恢复跟随全局
          </button>
        ) : null}

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-[#666]">形象特征补充（可选）</p>
            <span className="text-[11px] text-[#bbb]">
              {noteDraft.length}/{APPEARANCE_REF_NOTE_MAX}
              {noteSaving ? ' · 保存中…' : ''}
            </span>
          </div>
          <textarea
            value={noteDraft}
            maxLength={APPEARANCE_REF_NOTE_MAX}
            rows={3}
            placeholder={
              subject === 'character'
                ? '例：银白色长发、琥珀色眼瞳、黑色皮质项圈…'
                : '例：黑色短发、戴眼镜、常穿米色卫衣…'
            }
            className="mt-1.5 w-full resize-none rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#333] outline-none placeholder:text-[#c7c7cc] focus:border-[#576b95]"
            onChange={(e) => {
              const next = e.target.value
              setNoteDraft(next)
              scheduleNoteSave(next)
            }}
            onBlur={() => {
              if (noteSaveTimerRef.current) {
                clearTimeout(noteSaveTimerRef.current)
                noteSaveTimerRef.current = null
              }
              void persistNote(noteDraft)
            }}
          />
        </div>

        <div className="mt-3">
          <p className="text-[12px] text-[#666]">下一张类型</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {APPEARANCE_REF_KIND_ORDER.map((kind) => {
              const active = pendingKind === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setPendingKind(kind)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    active ? 'bg-[#576b95] text-white' : 'bg-[#f5f5f5] text-[#666]'
                  }`}
                >
                  {APPEARANCE_REF_KIND_LABELS[kind]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {refImages.map((item) => {
            const preview = resolveCharacterAvatarUrl({ avatarUrl: item.url }) || item.url
            return (
              <div key={item.id} className="relative w-[72px]">
                <div className="relative size-[72px] overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white">
                  <img src={preview} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="删除参考图"
                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/55 text-white"
                    onClick={() => void removeAppearanceRef(item.id)}
                  >
                    <X className="size-3" strokeWidth={2.5} />
                  </button>
                </div>
                <select
                  value={item.kind}
                  onChange={(e) =>
                    void changeAppearanceRefKind(item.id, e.target.value as CharacterAppearanceRefKind)
                  }
                  className="mt-1 w-full rounded-[6px] border border-[#e5e5e5] bg-white px-1 py-0.5 text-[10px] text-[#333]"
                >
                  {APPEARANCE_REF_KIND_ORDER.map((kind) => (
                    <option key={kind} value={kind}>
                      {APPEARANCE_REF_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}

          {canAdd ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-[72px] shrink-0 items-center justify-center rounded-[10px] border border-dashed border-[#d9d9d9] bg-[#fafafa]"
            >
              <ImagePlus className="size-6 text-[#c7c7cc]" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-[13px] text-[#333]">
            {refImages.length ? `已设置 ${refImages.length} 张参考图` : '尚未设置参考图'}
          </p>
          {refImages.length ? (
            <button
              type="button"
              className="text-[12px] text-[#576b95] active:opacity-70"
              onClick={() => void clearAllAppearanceRefs()}
            >
              全部清除
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null)
          e.currentTarget.value = ''
        }}
      />

      <ImageCropperModal
        open={!!cropSrc}
        imageSrc={cropSrc ?? ''}
        title={`裁剪形象参考（${APPEARANCE_REF_KIND_LABELS[pendingKind]}）`}
        aspect={cropAspectForKind(pendingKind)}
        maxSide={768}
        objectFit="contain"
        onCancel={() => setCropSrc(null)}
        onConfirm={(dataUrl) => {
          const kind = pendingKind
          setCropSrc(null)
          void addAppearanceRef(dataUrl, kind)
        }}
      />
    </>
  )
}
