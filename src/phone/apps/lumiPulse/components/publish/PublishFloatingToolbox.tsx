import { AtSign, Hash, Image, MapPin, Smile } from 'lucide-react'
import { motion } from 'framer-motion'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_COLORS } from '../../constants'

/** 内联工具栏：固定在编辑器与媒体区之间 */
export function PublishFloatingToolbox({
  onOpenEmoji,
  onImage,
  onHashtag,
  onMention,
  onLocation,
  imageDisabled,
}: {
  onOpenEmoji: () => void
  onImage: () => void
  onHashtag: () => void
  onMention: () => void
  onLocation: () => void
  imageDisabled?: boolean
}) {
  return (
    <motion.div
      className="flex shrink-0 justify-center px-6 py-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      <div className="flex items-center gap-1 rounded-full bg-white/90 px-5 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <ToolboxIcon
          icon={Smile}
          label="表情"
          onClick={onOpenEmoji}
          color={PULSE_COLORS.mistBlue}
        />
        <ToolboxIcon
          icon={Image}
          label="图片"
          onClick={onImage}
          disabled={imageDisabled}
          color={PULSE_COLORS.sage}
        />
        <ToolboxIcon icon={Hash} label="话题" onClick={onHashtag} color={PUBLISH_HASH_COLOR} />
        <ToolboxIcon icon={AtSign} label="艾特" onClick={onMention} color={PULSE_COLORS.lightGold} />
        <ToolboxIcon icon={MapPin} label="位置" onClick={onLocation} color={PULSE_COLORS.muted} />
      </div>
    </motion.div>
  )
}

const PUBLISH_HASH_COLOR = '#7C90A0'

function ToolboxIcon({
  icon: Icon,
  label,
  onClick,
  color,
  disabled,
}: {
  icon: typeof Smile
  label: string
  onClick: () => void
  color: string
  disabled?: boolean
}) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center rounded-full disabled:opacity-35"
      aria-label={label}
    >
      <Icon className="size-[18px]" strokeWidth={1.35} style={{ color }} />
    </Pressable>
  )
}
