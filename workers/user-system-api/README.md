# 账号系统 · Discord OAuth 扩展

本目录提供 **Discord 授权登录 / 注册填 ID** 的后端参考实现，需合并到你已部署的 `user-system-api` Worker 中。

前端（本仓库）已对接以下接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/discord/login` | 用 OAuth code 登录（按 `dcId` 匹配已有账号） |
| POST | `/api/auth/discord/identify` | 用 OAuth code 换取 Discord ID（注册页自动填入） |

账密登录 `/api/auth/login` 保持不变，两种方式并存。

## 1. Discord Developer Portal

1. 打开 [Discord Developer Portal](https://discord.com/developers/applications) → 新建 Application
2. **OAuth2 → Redirects** 添加与前端一致的 URI（须完全一致）：
   - 本地 dev：`http://localhost:5173/` 或 `https://localhost:5173/`（取决于是否启用 HTTPS）
   - GitHub Pages：`https://<用户名>.github.io/Lumi-Phone/`
3. 记下 **Client ID**、**Client Secret**

## 2. Worker 密钥

```bash
cd workers/user-system-api
wrangler secret put DISCORD_CLIENT_SECRET
# 在 wrangler.toml 或 Cloudflare Dashboard 设置 DISCORD_CLIENT_ID
```

## 3. 合并到你的 user-system-api

在现有 Worker 路由中挂载（示例）：

```typescript
import {
  handleDiscordIdentifyRequest,
  handleDiscordLoginRequest,
  type DiscordAuthDeps,
} from './discordAuth'

// 在 fetch handler 内：
if (path === '/api/auth/discord/login' && request.method === 'POST') {
  return handleDiscordLoginRequest(request, env, deps)
}
if (path === '/api/auth/discord/identify' && request.method === 'POST') {
  return handleDiscordIdentifyRequest(request, env)
}
```

`deps` 需对接你现有的用户表与 JWT 签发逻辑：

```typescript
const deps: DiscordAuthDeps = {
  async findUserByDcId(dcId) {
    // SELECT * FROM users WHERE dc_id = ?
    return row ?? null
  },
  async createLoginSession(user, trace) {
    // 复用 /api/auth/login 成功后的 token + status 生成逻辑
    return { token, status }
  },
}
```

## 4. 前端环境变量

在项目根目录 `.env.local` 或 GitHub Actions secrets 中设置：

```env
VITE_DISCORD_CLIENT_ID=你的Discord应用ClientID
```

未配置时前端自动隐藏 Discord 按钮，不影响账密登录。

## 5. 业务规则

- **Discord 登录**：OAuth 拿到的 Discord 用户 ID 必须与注册时填写的 `dcId` 一致
- **Discord 填 ID**：仅用于注册表单，不创建账号
- 封禁账号走与账密登录相同的 403 错误格式（含「封禁」字样，前端可识别）

## 文件说明

- `src/discordOAuth.ts` — 与 Discord API 交换 token、拉取用户信息
- `src/discordAuth.ts` — HTTP 路由处理，可 import 进现有 Worker
