import { Smile } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS } from '../constants'
import { getWeiboFaceUrl, PULSE_WEIBO_FACE_PICKER } from '../pulseWeiboFace'

/** 微博专属表情选择器（插入 [名称] 占位符） */
export function PulseWeiboFacePicker({
  onPick,
  panelPlacement = 'above',
  variant = 'default',
}: {
  onPick: (token: string) => void
  /** above：面板在按钮上方（底栏）；below：面板在按钮下方（顶栏） */
  panelPlacement?: 'above' | 'below'
  variant?: 'default' | 'luxury'
}) {
  const [open, setOpen] = useState(false)

  const faces = useMemo(
    () =>
      PULSE_WEIBO_FACE_PICKER.map((name) => ({
        name,
        url: getWeiboFaceUrl(name),
      })).filter((f) => f.url),
    [],
  )

  return (
    <div className="relative shrink-0">
      <Pressable
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-full text-neutral-500 ${
          variant === 'luxury' ? 'size-9' : 'size-8'
        }`}
        aria-label="微博表情"
      >
        <Smile
          className={variant === 'luxury' ? 'size-[18px]' : 'size-[18px]'}
          strokeWidth={1.35}
          style={{ color: PULSE_COLORS.mistBlue }}
        />
      </Pressable>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[10]"
            aria-label="关闭表情面板"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute z-[20] w-[min(280px,72vw)] rounded-2xl bg-white/95 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl ${
              variant === 'luxury' ? 'left-1/2 -translate-x-1/2' : 'right-0'
            } ${panelPlacement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
          >
            <p className="px-1 pb-1.5 text-[10px] tracking-wide text-neutral-400">微博表情</p>
            <div className="grid max-h-[168px] grid-cols-8 gap-1 overflow-y-auto">
              {faces.map((face) => (
                <Pressable
                  key={face.name}
                  type="button"
                  title={`[${face.name}]`}
                  onClick={() => {
                    onPick(`[${face.name}]`)
                    setOpen(false)
                  }}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-[#F5F5F4]"
                >
                  <img src={face.url} alt={face.name} className="size-[22px] object-contain" draggable={false} />
                </Pressable>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
