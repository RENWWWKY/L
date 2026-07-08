import { useMemo } from 'react'
import { PlotImageTile } from './PlotImageTile'
import { buildPlotMagazineSegments } from './plotMagazineLayout'
import { PlotRichParagraph } from './plotRichText'
import type { PlotImageItem } from './types'

type Props = {
  content: string
  plotImages?: PlotImageItem[]
  characterId: string
  plotId: string
}

export function PlotMagazineBody({ content, plotImages, characterId, plotId }: Props) {
  const segments = useMemo(
    () => buildPlotMagazineSegments(content, plotImages ?? []),
    [content, plotImages],
  )

  return (
    <div className="overflow-hidden text-[16px] font-normal leading-[1.85] text-[#262626]">
      {segments.map((seg, index) => {
        if (seg.type === 'image') {
          return (
            <PlotImageTile
              key={seg.image.id}
              image={seg.image}
              characterId={characterId}
              plotId={plotId}
              variant="magazine"
              floatSide={seg.float}
            />
          )
        }
        return (
          <p
            key={`text-${index}`}
            className="mb-[0.65em] whitespace-pre-wrap break-words last:mb-0"
          >
            <PlotRichParagraph content={seg.content} className="inline" />
          </p>
        )
      })}
    </div>
  )
}
