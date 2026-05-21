import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Character } from '../types'
import { PlaceholderAwareTextarea } from '../characterFieldPlaceholderPreview'

export function WeChatProfileTab({
  data,
  editorId,
  momentsCoverFileRef,
  onPickMomentsCoverFile,
  setField,
}: {
  data: Character
  editorId: string
  momentsCoverFileRef: React.RefObject<HTMLInputElement | null>
  onPickMomentsCoverFile: (file: File | null) => void
  setField: <K extends keyof Character>(k: K, v: Character[K]) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [coverScroll, setCoverScroll] = useState(0)

  const displayName =
    String(data.wechatNickname ?? '').trim() || String(data.name ?? '').trim() || '未命名'
  const subId = String(data.wechatId ?? '').trim() || '微信号未设置'

  return (
    <section className="rounded-[14px] border border-neutral-200/90 bg-white px-3 pb-8 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-5 border-b border-neutral-100 pb-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">04 WX · 名片仿真</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">微信资料</h2>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => setCoverScroll((e.target as HTMLDivElement).scrollTop)}
        className="mx-auto max-w-md overflow-y-auto rounded-[16px] border border-neutral-200/80 bg-[#F7F7F7]"
        style={{ maxHeight: 'min(72vh, 560px)' }}
      >
        <div className="relative h-40 w-full overflow-hidden bg-neutral-300">
          {data.momentsCoverUrl?.trim() ? (
            <img
              src={data.momentsCoverUrl}
              alt=""
              className="h-[calc(100%+24px)] w-full object-cover will-change-transform"
              style={{ transform: `translateY(${-coverScroll * 0.35}px)` }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] text-neutral-500">朋友圈封面 · 未设置</div>
          )}
        </div>

        <div className="relative -mt-10 px-5 pb-6 pt-0">
          <div className="flex items-end gap-4">
            <div className="size-[72px] shrink-0 overflow-hidden rounded-[12px] border-[3px] border-white bg-white shadow-sm">
              {data.avatarUrl?.trim() ? (
                <img src={data.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-neutral-200 text-[11px] text-neutral-500">头像</div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-[19px] font-semibold text-[#1C1C1E]">{displayName}</p>
              <p className="mt-0.5 truncate text-[12px] text-neutral-500">{subId}</p>
            </div>
          </div>

          <div className="mt-6 space-y-1 border-t border-neutral-200/80 pt-4 text-[14px]">
            <button
              type="button"
              className="flex w-full items-center justify-between py-2 text-left text-[#1C1C1E]"
              onClick={() => {}}
            >
              <span className="text-neutral-500">地区</span>
              <span className="truncate pl-4 text-right text-[13px]">
                {String(data.wechatRegion ?? '').trim() || '未填写'}
              </span>
            </button>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-500">拍一拍</span>
              <span className="truncate pl-4 text-right text-[12px] text-neutral-400">后缀展示 · 即将接入数据字段</span>
            </div>
          </div>

          <div className="mt-4 rounded-[12px] border border-neutral-200/60 bg-white/90 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Signature · 个性签名</p>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
              {String(data.wechatSignature ?? '').trim() || '暂无签名'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-5 border-t border-neutral-100 pt-6">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Nickname · 微信昵称</span>
          <input
            value={data.wechatNickname ?? ''}
            onChange={(e) => setField('wechatNickname', e.target.value)}
            maxLength={32}
            className="mt-2 w-full border-0 border-b border-neutral-200 bg-transparent py-2 text-[15px] text-[#1C1C1E] outline-none ring-0 transition-colors focus:border-[#D4AF37]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">WX ID · 微信号</span>
          <input
            value={data.wechatId ?? ''}
            onChange={(e) => setField('wechatId', e.target.value)}
            maxLength={32}
            className="mt-2 w-full border-0 border-b border-neutral-200 bg-transparent py-2 text-[15px] outline-none ring-0 transition-colors focus:border-[#D4AF37]"
            style={{ color: '#1C1C1E' }}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Region · 地区</span>
          <input
            value={data.wechatRegion ?? ''}
            onChange={(e) => setField('wechatRegion', e.target.value)}
            maxLength={32}
            className="mt-2 w-full border-0 border-b border-neutral-200 bg-transparent py-2 text-[15px] outline-none ring-0 transition-colors focus:border-[#D4AF37]"
            style={{ color: '#1C1C1E' }}
          />
        </label>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Signature · 编辑签名</span>
          <PlaceholderAwareTextarea
            value={data.wechatSignature ?? ''}
            onChange={(v) => setField('wechatSignature', v)}
            characterId={editorId}
            className="mt-2 w-full border-0 border-b border-neutral-200 bg-transparent py-2 text-[14px] leading-relaxed outline-none ring-0 transition-colors focus:border-[#D4AF37]"
            rows={3}
            maxLength={120}
            placeholder="展示在名片下方的一行简介"
          />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Moments · 朋友圈封面</span>
          <p className="mt-1 text-[11px] font-light text-neutral-500">URL 与本地裁剪二选一；列表内预览带轻视差滚动。</p>
          <input
            value={data.momentsCoverUrl?.startsWith('data:') ? '' : (data.momentsCoverUrl ?? '')}
            onChange={(e) => setField('momentsCoverUrl', e.target.value)}
            placeholder="https://…"
            className="mt-3 w-full border-0 border-b border-neutral-200 bg-transparent py-2 text-[13px] outline-none ring-0 transition-colors focus:border-[#D4AF37]"
            style={{ color: '#1C1C1E' }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-4 py-2 text-[12px] text-[#1C1C1E] transition-colors hover:bg-neutral-50"
              onClick={() => momentsCoverFileRef.current?.click()}
            >
              上传 · 1:1 裁剪
              <ChevronRight className="size-3.5 opacity-40" />
            </button>
            {data.momentsCoverUrl?.trim() ? (
              <button
                type="button"
                className="text-[12px] text-neutral-400 underline-offset-2 hover:text-neutral-600"
                onClick={() => setField('momentsCoverUrl', '')}
              >
                清除封面
              </button>
            ) : null}
            <input
              ref={momentsCoverFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickMomentsCoverFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
