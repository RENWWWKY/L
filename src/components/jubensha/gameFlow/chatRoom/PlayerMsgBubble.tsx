import { RolePortraitMsgBubble } from './RolePortraitMsgBubble'

export type PlayerMsgBubbleProps = {
  body: string
  roleName: string
  isSelf: boolean
  portraitUrl?: string
  isTyping?: boolean
}

export function PlayerMsgBubble(props: PlayerMsgBubbleProps) {
  return <RolePortraitMsgBubble {...props} />
}
