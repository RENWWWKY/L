import { PhoneMixedLatinNumText } from '../../../phoneMixedLatinNumText'

/** 拉取的模型 id / 混排名称：英文 → DejaVu Math TeX Gyre，数字 → 全局衬线数字 */
export function MemoryModelIdText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return <PhoneMixedLatinNumText text={text} className={className} />
}
