import { compressChatImageToJpeg, loadImageFromFile } from '../wechat/wechatChatImageCompress'

const MAX_PULSE_POST_IMAGES = 9

export { MAX_PULSE_POST_IMAGES }

/** 相册选图 → 压缩 JPEG → data URL（供微博动态持久化） */
export async function fileToPulseImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  const img = await loadImageFromFile(file)
  const b64 = await compressChatImageToJpeg({
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
  })
  return `data:image/jpeg;base64,${b64}`
}

export async function filesToPulseImageDataUrls(files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    urls.push(await fileToPulseImageDataUrl(file))
  }
  return urls
}
