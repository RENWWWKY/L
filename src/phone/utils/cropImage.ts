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

  const srcW = Math.max(1, Math.floor(croppedAreaPixels.width))
  const srcH = Math.max(1, Math.floor(croppedAreaPixels.height))
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH))
  canvas.width = Math.max(1, Math.floor(srcW * scale))
  canvas.height = Math.max(1, Math.floor(srcH * scale))

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return canvas.toDataURL('image/jpeg', 0.86)
}

