import type { JBSFlowMedia } from './chatRoom/JBSFlowEngine'
import { useRoomAmbientOptional } from './RoomAmbientContext'

export type HallRoomBackdropProps = {
  media: JBSFlowMedia
}

/** 视频仅画面；氛围声走独立 Audio 轨（与 VN BGM + 语音双轨一致） */
export function HallRoomBackdrop({ media }: HallRoomBackdropProps) {
  const ambient = useRoomAmbientOptional()

  return (
    <>
      {media.videoUrl ? (
        <video
          ref={(el) => ambient?.registerAmbientVideo(el)}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          src={media.videoUrl}
        />
      ) : (
        <div className="jbs-gf-chat-fallback-bg absolute inset-0 -z-10" aria-hidden />
      )}
    </>
  )
}
