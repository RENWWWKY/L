type Area = { x: number; y: number; width: number; height: number }

function createImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (e) => reject(e))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

/**
 * 将裁剪区域输出为压缩 dataURL（JPEG）。
 * 默认最长边压到 256，显著降低同步存储体积与渲染压力，避免白屏。
 */
export async function getCroppedDataUrl(
  imageSrc: string,
  croppedAreaPixels: Area,
  maxSide = 256,
) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const imageW = Math.max(1, Math.floor(image.naturalWidth || image.width))
  const imageH = Math.max(1, Math.floor(image.naturalHeight || image.height))
  // 兜底钳制：确保裁剪区域始终在图片有效边界内，杜绝导出图片外透明区域
  const x = Math.max(0, Math.min(imageW - 1, Math.floor(croppedAreaPixels.x)))
  const y = Math.max(0, Math.min(imageH - 1, Math.floor(croppedAreaPixels.y)))
  const maxW = Math.max(1, imageW - x)
  const maxH = Math.max(1, imageH - y)
  const srcW = Math.max(1, Math.min(maxW, Math.floor(croppedAreaPixels.width)))
  const srcH = Math.max(1, Math.min(maxH, Math.floor(croppedAreaPixels.height)))
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH))
  canvas.width = Math.max(1, Math.floor(srcW * scale))
  canvas.height = Math.max(1, Math.floor(srcH * scale))

  ctx.drawImage(
    image,
    x,
    y,
    srcW,
    srcH,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return canvas.toDataURL('image/jpeg', 0.86)
}

