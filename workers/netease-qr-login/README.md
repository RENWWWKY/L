# 网易云扫码登录 Worker

单 Worker 代理网易云二维码登录三件套，前端无需直连 `music.163.com`，也无需另部署 Render。

## 部署

```bash
cd workers/netease-qr-login
npm install
npx wrangler login   # 首次
npm run deploy
```

部署后地址形如：`https://netease-qr-login.lyx815934990.workers.dev`

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/login/qr/key` | 获取 `unikey` |
| GET | `/api/login/qr/create?key=xxx&qrimg=true` | 二维码 base64 + 链接 |
| GET | `/api/login/qr/check?key=xxx` | 轮询；`code=803` 时返回 `cookie` |
| POST | `/api/login/qr/start` | 一步生成 key + 二维码 |

扫码状态码：`801` 等待 / `802` 已扫待确认 / `803` 成功 / `800` 过期。

## 要不要梯子？

| 环节 | 是否需要梯子 |
|------|----------------|
| 浏览器打开 `workers.dev` / 本地 Vite | 国内**有时**要梯子（`workers.dev` 偶发慢或被墙） |
| **Cloudflare Worker 请求网易云** | **和你电脑开不开梯子无关**（Worker 在海外机房跑） |

所以：**开梯子也不能保证二维码成功**。常见原因是 Worker 在海外访问 `music.163.com` 被网易返回空数据。

### 解决办法（仍只用 Cloudflare）

1. 浏览器打开诊断页（部署后）  
   `https://netease-qr-login.lyx815934990.workers.dev/api/debug/netease`  
   看 `direct_unikey` 是否 `ok: true`。

2. 若 `direct` 失败：在国内任意能跑 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 的机器上部署一份（腾讯云轻量、家里 NAS 等，**不必 Render**），得到地址如 `https://你的域名.com`。

3. Cloudflare 控制台 → **netease-qr-login** → **设置** → **变量** → 添加：  
   - 名称：`NETEASE_UPSTREAM`  
   - 值：`https://你的域名.com`（无末尾 `/`）  
   保存后 **重新部署** Worker。

4. 建议打开 **Workers 日志**（可观察性 → 启用日志），便于看真实报错。

### Cloudflare 设置页是空的，有问题吗？

**没有问题。** 本 Worker 默认不需要填变量；只有直连网易失败时才需要填 `NETEASE_UPSTREAM`。

## 国内一直转圈？用本机 API（最快）

你在国内的电脑网络 **不能** 让海外 Worker 直连网易。开发阶段请：

1. 启动网易云 API（**不要用已清空的 Binaryify 仓库**，任选其一）：
   - `npx NeteaseCloudMusicApi@4.28.0`（在项目根目录执行即可）
   - 或克隆 [api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 后 `npm install && node app.js`
2. 项目根目录 `.env.local` 改为：
   ```env
   VITE_NETEASE_API_BASE=http://127.0.0.1:3000
   VITE_NETEASE_API_MODE=ncm
   ```
3. 重启 `npm run dev`，听一听里点二维码

浏览器会 **直连本机**，不经过 `workers.dev`，一般几秒内出码。

## 前端配置

项目根目录 `.env` 或 `.env.local`：

```env
VITE_NETEASE_API_BASE=https://netease-qr-login.lyx815934990.workers.dev
```

本地开发：

```bash
# 终端 1
cd workers/netease-qr-login && npm run dev

# 终端 2（Vite）
VITE_NETEASE_API_BASE=http://127.0.0.1:8787 npm run dev
```
