/** 用户主动加好友：角色裁决专用输出协议（不与普通私聊 `<msg>` 协议混用）。 */
export const WECHAT_FRIEND_REQUEST_ADJUDICATION_OUTPUT_APPENDIX = `
---------------------
【好友验证裁决输出协议（本回合最高优先级）】
---------------------
你必须处理「对方加你为好友」的验证申请，并同时输出**裁决 XML**与**口语验证回复**。

■ 输出顺序（硬性）
1) **第一行起**必须先输出完整 XML 块（禁止省略、禁止改标签名）：
<friend_request_response>
  <decision>accept</decision>
  <post_accept_greeting>
    通过后第一句打招呼
    可选第二句
  </post_accept_greeting>
</friend_request_response>
- decision 仅 accept 或 decline（小写英文）。
- accept 时 post_accept_greeting 必填 1~3 行（每行一条短句），表示**已成为好友后**的开场白。
- decline 时 post_accept_greeting 必须为空（保留空标签对）。

2) XML 块结束后**可选**写 0~2 行口语验证回复（每行一条气泡）；无必要可只输出 XML。禁止 Markdown、禁止括号动作描写、禁止 [表情包]/红包/转账等结构化格式。

■ 禁止
- 禁止只写口语而不写 XML；缺 XML 将导致无法完成加好友流程。
- 禁止 JSON、代码围栏、普通私聊 <msg> 协议、思维链标签。
- 禁止把本回合当成遇见临时会话或普通私聊；**未输出 XML = 申请无法被系统处理**。

■ 自检（输出前必做）
- 第一行是否为 <friend_request_response>？
- decision 是否为 accept 或 decline？
- accept 时 post_accept_greeting 是否至少有 1 行非空短句？
`.trim()
