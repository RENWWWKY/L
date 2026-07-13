import { Pressable } from '../../../components/Pressable'
import { getWeiboFaceUrl, PULSE_WEIBO_FACE_PICKER } from '../pulseWeiboFace'

const QUICK_FACE_NAMES = PULSE_WEIBO_FACE_PICKER.slice(0, 10)

/** 发布栏常用微博表情快捷条 */
export function PulseWeiboQuickFaces({ onPick }: { onPick: (token: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {QUICK_FACE_NAMES.map((name) => {
        const url = getWeiboFaceUrl(name)
        if (!url) return null
        return (
          <Pressable
            key={name}
            type="button"
            title={`[${name}]`}
            onClick={() => onPick(`[${name}]`)}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F4]/80 hover:bg-[#F5F5F4]"
          >
            <img src={url} alt={name} className="size-[24px] object-contain" draggable={false} />
          </Pressable>
        )
      })}
    </div>
  )
}
