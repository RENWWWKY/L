import { MomentImageViewer } from '../../../components/moments/MomentImageViewer'

type Props = {
  open: boolean
  src: string
  onClose: () => void
}

/** 聊天图片全屏预览（复用朋友圈查看器：缩放、双击放大） */
export function ChatImageLightbox({ open, src, onClose }: Props) {
  if (!src.trim()) return null
  return <MomentImageViewer open={open} images={[src.trim()]} onClose={onClose} />
}
