/** 遇见 vol10 结业初印象：加微信成功后写入过程与完成提示（全局 CustomEvent） */

export const MEET_VOL10_EPILOGUE_WRITE_START_EVENT = 'meet-vol10-epilogue-write-start'
export const MEET_VOL10_EPILOGUE_WRITE_END_EVENT = 'meet-vol10-epilogue-write-end'
export const MEET_VOL10_EPILOGUE_WRITTEN_EVENT = 'meet-vol10-epilogue-written'

export type MeetVol10EpilogueNoticeDetail = {
  characterId: string
  characterNickname: string
}

export function emitMeetVol10EpilogueWriteStart(detail: MeetVol10EpilogueNoticeDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<MeetVol10EpilogueNoticeDetail>(MEET_VOL10_EPILOGUE_WRITE_START_EVENT, { detail }),
  )
}

export function emitMeetVol10EpilogueWriteEnd(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MEET_VOL10_EPILOGUE_WRITE_END_EVENT))
}

export function emitMeetVol10EpilogueWritten(detail: MeetVol10EpilogueNoticeDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<MeetVol10EpilogueNoticeDetail>(MEET_VOL10_EPILOGUE_WRITTEN_EVENT, { detail }),
  )
}
