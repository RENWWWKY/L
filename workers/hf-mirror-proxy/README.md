# HF 镜像代理（本地向量模型 · GitHub Pages）

浏览器从 GitHub Pages 下载 Transformers.js 模型时，需要 **带 CORS 的镜像根地址**。  
本 Worker 把请求转发到 `hf-mirror.com`（国内一般不用梯子）。

## 一、部署 Worker（只需做一次）

### 1. 安装依赖

在项目根目录打开终端（PowerShell / CMD 均可）：

```bash
cd workers/hf-mirror-proxy
npm install
```

### 2. 登录 Cloudflare（若从未部署过 Worker）

```bash
npx wrangler login
```

浏览器弹出授权页，登录你的 Cloudflare 账号（与 `lumi-push`、`link-preview` 同一账号即可）。

### 3. 部署

```bash
npm run deploy
```

终端会输出类似：

```text
Published hf-mirror-proxy (X.XX sec)
  https://hf-mirror-proxy.你的子域.workers.dev
```

**复制这个地址**，后面要用。末尾会自动带路径，变量里要写成 **以 `/` 结尾**，例如：

```text
https://hf-mirror-proxy.你的子域.workers.dev/
```

### 4. 自测（浏览器打开）

把下面链接里的域名换成你的 Worker 地址：

```text
https://hf-mirror-proxy.你的子域.workers.dev/Xenova/bge-small-zh-v1.5/resolve/main/config.json
```

应看到 **JSON**（一堆 `"model_type"` 之类字段），不是网页 HTML。

健康检查：

```text
https://hf-mirror-proxy.你的子域.workers.dev/health
```

应返回 `{"ok":true,"service":"hf-mirror-proxy"}`。

---

## 二、在 GitHub 仓库里配置（只需做一次）

### 1. 打开变量设置

1. 浏览器打开你的 GitHub 仓库  
2. 点 **Settings**（设置）  
3. 左侧 **Secrets and variables** → **Actions**  
4. 切到 **Variables** 标签（不是 Secrets）  
5. 点 **New repository variable**

### 2. 新建变量

| 字段 | 填什么 |
|------|--------|
| Name | `VITE_HF_REMOTE_HOST` |
| Value | `https://hf-mirror-proxy.你的子域.workers.dev/`（**末尾必须有 `/`**） |

点 **Add variable** 保存。

> 若不配置此变量，构建时会默认用 `https://hf-mirror.com/`；国内多数能访问，但 GitHub Pages 上可能遇 CORS，建议仍部署 Worker 并填变量。

---

## 三、把代码推上 GitHub 触发重新部署

若你本地已拉取包含 workflow 改动的代码，在项目根目录：

```bash
git add .
git commit -m "chore: GitHub Pages 本地向量模型镜像配置"
git push origin main
```

### 看部署是否成功

1. 仓库页 → **Actions**  
2. 点最新的 **Deploy GitHub Pages**  
3. 两个 job 都绿勾 = 成功  
4. 等 1～2 分钟，打开你的 Pages 地址（Settings → Pages 里能看到）

---

## 四、在网页里验证模型下载

1. 打开 **GitHub Pages 上的 Lumi**（不是 localhost）  
2. 进入 **记忆 / 记忆配置 → 语义向量**  
3. 「算意思放哪」选 **自动** 或 **仅本地**  
4. 点 **下载模型**  
5. 进度条走完、显示「已下载」= 成功  

---

## 常见问题

### 部署 Worker 报 Failed to retrieve account IDs

```bash
npx wrangler login
```

或在 [Cloudflare 控制台](https://dash.cloudflare.com/) 复制 **Account ID**，写入 `wrangler.toml`：

```toml
account_id = "你的32位账号ID"
```

### 模型下载仍失败

- 确认 Variables 里 `VITE_HF_REMOTE_HOST` 末尾有 `/`  
- 确认 push 后 Actions 已重新跑完  
- 浏览器 F12 → Network，看第一个红字请求是不是你的 Worker 域名  
- 临时改用 **仅 API**（填 embedding 接口），不依赖本地模型  

### workers.dev 在国内很慢或打不开

Worker 仅用于 **拉模型文件**；若你访问 Worker 健康检查都失败，可：

- 换网络 / 时段再试  
- 或记忆配置里选 **仅 API**  

### 本地开发要不要配这些？

**不用。** `npm run dev` 会自动走本机 `/hf-proxy`，无需 Worker、无需 GitHub Variables。
