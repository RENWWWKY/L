import { AppearanceRefSettingsPanel } from '../appearanceRef/AppearanceRefSettingsPanel'

type Props = {
  characterId: string
  playerIdentityId?: string
}

/** 聊天信息页：角色形象参考（本页独立配置，与线下约会页可分叉） */
export function CharacterAppearanceRefSettingsBlock({ characterId, playerIdentityId }: Props) {
  return (
    <AppearanceRefSettingsPanel
      subject="character"
      context="chat"
      characterId={characterId}
      playerIdentityId={playerIdentityId}
      title="AI 生图形象参考（角色）"
      description="角色发自拍/对镜时锁定五官与画风。此处修改仅影响本聊天会话绑定的形象参考；与线下约会页独立，除非恢复跟随全局。"
    />
  )
}

export default CharacterAppearanceRefSettingsBlock
