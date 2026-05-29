# 听一听 · api-enhanced 接口对接说明

API 文档：[在线文档](https://neteasecloudmusicapienhanced.js.org/) · 你的部署示例：`https://api-enhanced-smoky-five.vercel.app/docs/`

所有需登录接口均在 Query 带 `cookie`（项目里由 `ncmApiGet` 自动附加）。

---

## 听一听页面 ↔ 接口对照

| 页面功能 | 接口 | 项目实现 |
|----------|------|----------|
| 扫码登录 | `GET /login/qr/key` → `/login/qr/create` → `/login/qr/check` | `NeteaseQrLoginModal` · 扫码 Tab |
| 手机号登录 | `GET /captcha/sent` + `GET /login/cellphone` | 同上 · 手机号 Tab（密码或验证码） |
| 登录态校验 | `GET /login/status` | `checkNeteaseLogin()` |
| 我的 · 头像昵称 | `GET /user/account` | `fetchNeteaseProfile()` |
| 我的 · 关注/粉丝 | `GET /user/detail?uid=` | `fetchNeteaseProfile()` |
| 我的 · 累计听歌（小时） | `GET /listen/data/total`（主）+ `listen/data/year/report` | 同上；解析时兼容秒/毫秒，取多源最大值 |
| 我的 · 听歌等级 | `GET /user/level`（回退 `user/detail` 的 `level`） | 我的页统计行 |
| 我的 · VIP | `GET /user/account` + `user/detail` | 头像右下角角标 |
| 我的 · 创建歌单 | `GET /user/playlist?uid=` | 同上 |
| 我的 · 收藏歌单 | `GET /user/playlist`（`creator.userId !== 自己`） | 同上（**无** `/playlist/sublist`） |
| 首页/我的 · 歌单详情 | 歌单 `id` + `playlist/track/all` | `ListenTogetherPlaylistDetailPage` |
| 首页 · 最近播放 | `GET /user/record?uid=&type=1` | `fetchUserRecentSongs()` |
| 搜索 · 单曲 | `GET /search?keywords=&type=1` | `searchNeteaseSongs()` |
| 播放 | `GET /song/url/v1?id=` | `resolveSongPlayback()` + `useListenTogetherPlayer` |
| 全屏歌词 | `GET /lyric?id=` | 同上，与播放地址一并缓存 |
| 歌单详情 · 曲目列表 | `GET /playlist/track/all?id=` | `fetchPlaylistTracks()` |
| 歌单详情 · 歌曲评论 | `GET /comment/music?id=` | `fetchSongComments()` |
| 歌单/评论/资料离线缓存 | IndexedDB `personaDb.phoneKv` | `listenTogetherPersistence.ts` |
| 我的 · 同步刷新 | 清缓存 + 强制拉取 | 右上角刷新按钮 → `clearListenTogetherSyncCaches()` |

**本地缓存（IndexedDB，库名与微信人设相同）**：

| 键 | 内容 |
|----|------|
| `listen-together-netease-login-cookie-v1` | 登录 Cookie |
| `listen-together-netease-profile-v1` | 我的页资料与歌单列表 |
| `listen-together-recent-songs-v1` | 首页最近播放 |
| `listen-together-playlist-tracks-v1` | 歌单详情曲目 |
| `listen-together-song-comments-v1` | 歌曲评论 |
| `listen-together-song-playback-v1` | 已加载曲目：播放地址 + LRC 歌词（最多约 80 首，播放链约 6 小时过期后自动重拉） |

旧版 `localStorage`（Cookie、歌单缓存）会在首次读取时自动迁入 IndexedDB。除用户点击「同步」外，二次进入优先读缓存、不重复请求。

---

## 仍为占位 / 未接网易 API

| 功能 | 说明 |
|------|------|
| 笔记 Tab | 本地 `NOTES_FEED_MOCK`，非云音乐动态 |
| 共听羁绊卡 | 登录后仍用剧情 mock（`PROFILE_MOCK.bondData`） |
| 搜索页「情绪频率」封面 | UI 灵感卡片，点击会用分类名发起搜索 |
| 下一首 / 播放列表按钮 | 未实现队列 |

---

## 调用示例（与文档一致）

浏览器或 curl（需替换 `BASE` 与登录后的 `cookie`）：

```text
# 搜索
GET {BASE}/search?keywords=周杰伦&type=1&limit=10&cookie=...

# 播放地址
GET {BASE}/song/url/v1?id=347230&level=standard&cookie=...

# 歌单曲目
GET {BASE}/playlist/detail?id=3778678&cookie=...
```

---

## 环境变量

```env
VITE_NETEASE_API_BASE=https://api-enhanced-smoky-five.vercel.app
VITE_NETEASE_API_MODE=ncm
```

**上线给国内用户**：建议改为国内机房 API，Vercel 仅适合开发或配合梯子。
