var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/neteaseCrypto.ts
var PRESET_KEY = "0CoJUm6Qyw8W8jud";
var IV = new TextEncoder().encode("0102030405060708");
var PUBLIC_KEY = "010001";
var MODULUS = "00e0b90f8ece75da7eac459fb7400b1ad15176ec011ba428da0ed6f4f64fc90dc27f274e45de5dadc0141e0fa561eb860a5a9f875a4ce80142d5228eaeb9220e2fe580e90d85675eabc546a2ab9fdeee1fba95f9df78ce5c9e93b977454fdc48691977fa469c310ca7d";
function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
__name(bytesToBase64, "bytesToBase64");
async function aesEncryptToBase64(plainText, secKey) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secKey),
    { name: "AES-CBC", length: 128 },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: IV },
    cryptoKey,
    new TextEncoder().encode(plainText)
  );
  return bytesToBase64(new Uint8Array(encrypted));
}
__name(aesEncryptToBase64, "aesEncryptToBase64");
function rsaEncrypt(text) {
  const reversed = text.split("").reverse().join("");
  const bytes = new TextEncoder().encode(reversed);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const biText = BigInt(`0x${hex}`);
  const biEx = BigInt(`0x${PUBLIC_KEY}`);
  const biMod = BigInt(`0x${MODULUS}`);
  let result = 1n;
  let base = biText % biMod;
  let exp = biEx;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = result * base % biMod;
    exp /= 2n;
    base = base * base % biMod;
  }
  return result.toString(16).padStart(256, "0");
}
__name(rsaEncrypt, "rsaEncrypt");
function randomSecretKey(len = 16) {
  const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rnd = new Uint8Array(len);
  crypto.getRandomValues(rnd);
  let out = "";
  for (let i = 0; i < len; i += 1) out += pool[rnd[i] % pool.length];
  return out;
}
__name(randomSecretKey, "randomSecretKey");
async function encryptWeapi(data) {
  const text = JSON.stringify(data);
  const secretKey = randomSecretKey(16);
  const params = await aesEncryptToBase64(
    await aesEncryptToBase64(text, PRESET_KEY),
    secretKey
  );
  const encSecKey = rsaEncrypt(secretKey);
  return { params, encSecKey };
}
__name(encryptWeapi, "encryptWeapi");

// src/neteaseRequest.ts
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var DEFAULT_COOKIE = "os=pc; osver=Microsoft-Windows-10.0; appver=2.10.4; channel=netease; mobilename=netease;";
function mergeCookie(existing, setCookie) {
  if (!setCookie) return existing;
  const jar = /* @__PURE__ */ new Map();
  for (const part of `${existing}; ${setCookie}`.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
__name(mergeCookie, "mergeCookie");
function collectSetCookies(res) {
  const headers = res.headers;
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().join("; ");
  }
  return res.headers.get("Set-Cookie") ?? "";
}
__name(collectSetCookies, "collectSetCookies");
var warmedCookie = "";
async function warmNeteaseCookie() {
  if (warmedCookie.includes("__csrf")) return warmedCookie;
  try {
    const res = await fetch("https://music.163.com/", {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html" }
    });
    warmedCookie = mergeCookie(DEFAULT_COOKIE, collectSetCookies(res));
  } catch {
    warmedCookie = DEFAULT_COOKIE;
  }
  return warmedCookie;
}
__name(warmNeteaseCookie, "warmNeteaseCookie");
function parseNeteaseJson(text, status) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      `\u7F51\u6613\u4E91\u8FD4\u56DE\u7A7A\u5185\u5BB9 (HTTP ${status})\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u68C0\u67E5 Worker \u5230 music.163.com \u7684\u7F51\u7EDC`
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(
      `\u7F51\u6613\u4E91\u8FD4\u56DE\u975E JSON (HTTP ${status}): ${trimmed.slice(0, 120)}`
    );
  }
}
__name(parseNeteaseJson, "parseNeteaseJson");
async function neteaseWeapi(path, data = {}, cookie = "") {
  const baseCookie = cookie || await warmNeteaseCookie();
  const csrfMatch = baseCookie.match(/__csrf=([^;]+)/);
  const csrfToken = csrfMatch?.[1] ?? "";
  const { params, encSecKey } = await encryptWeapi({
    csrf_token: csrfToken,
    ...data
  });
  const body = new URLSearchParams({ params, encSecKey });
  const url = `https://music.163.com/weapi${path}?csrf_token=${encodeURIComponent(csrfToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Referer: "https://music.163.com/",
      Origin: "https://music.163.com",
      Accept: "*/*",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Cookie: baseCookie
    },
    body: body.toString()
  });
  const mergedCookie = mergeCookie(baseCookie, collectSetCookies(res));
  if (mergedCookie) warmedCookie = mergedCookie;
  const text = await res.text();
  const json2 = parseNeteaseJson(text, res.status);
  return { status: res.status, body: json2, cookie: mergedCookie };
}
__name(neteaseWeapi, "neteaseWeapi");

// src/neteaseParse.ts
function pickPayload(body) {
  if (!body || typeof body !== "object") return {};
  const b = body;
  if (b.data && typeof b.data === "object" && !Array.isArray(b.data)) {
    return b.data;
  }
  return b;
}
__name(pickPayload, "pickPayload");
function pickUnikey(body) {
  const p = pickPayload(body);
  const key = p.unikey;
  return typeof key === "string" && key.length > 0 ? key : void 0;
}
__name(pickUnikey, "pickUnikey");
function pickQrCreate(body) {
  const p = pickPayload(body);
  return {
    qrimg: typeof p.qrimg === "string" ? p.qrimg : void 0,
    qrurl: typeof p.qrurl === "string" ? p.qrurl : void 0
  };
}
__name(pickQrCreate, "pickQrCreate");

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}
__name(json, "json");
function withTs(url) {
  url.searchParams.set("timestamp", String(Date.now()));
  return url;
}
__name(withTs, "withTs");
async function qrKey() {
  const result = await neteaseWeapi(
    "/login/qrcode/unikey",
    { type: 1 }
  );
  const unikey = pickUnikey(result.body);
  if (!unikey) {
    return json({ code: 500, message: "\u65E0\u6CD5\u83B7\u53D6\u4E8C\u7EF4\u7801 key", raw: result.body }, 500);
  }
  return json({ code: 200, data: { unikey, key: unikey } });
}
__name(qrKey, "qrKey");
async function qrCreate(key, qrimg) {
  const result = await neteaseWeapi("/login/qrcode/create", {
    key,
    type: 1,
    ...qrimg ? { qrimg: true } : {}
  });
  const body = pickQrCreate(result.body);
  const qrurl = body.qrurl ?? `https://music.163.com/login?codekey=${encodeURIComponent(key)}`;
  let qrimgData = body.qrimg ?? "";
  if (qrimg && qrimgData && !qrimgData.startsWith("data:")) {
    qrimgData = `data:image/png;base64,${qrimgData}`;
  }
  return json({
    code: 200,
    data: {
      key,
      qrurl,
      qrimg: qrimgData || null
    }
  });
}
__name(qrCreate, "qrCreate");
async function qrCheck(key) {
  const result = await neteaseWeapi("/login/qrcode/check", { key, type: 1 });
  const body = result.body;
  const code = body.code;
  const cookie = result.cookie || (typeof body.cookie === "string" ? body.cookie : "");
  return json({
    code,
    message: body.message ?? null,
    cookie: code === 803 ? cookie : "",
    data: body
  });
}
__name(qrCheck, "qrCheck");
async function qrStart(qrimg) {
  const keyRes = await neteaseWeapi(
    "/login/qrcode/unikey",
    { type: 1 }
  );
  const key = pickUnikey(keyRes.body);
  if (!key) {
    return json({ code: 500, message: "\u65E0\u6CD5\u83B7\u53D6\u4E8C\u7EF4\u7801 key", raw: keyRes.body }, 500);
  }
  const createRes = await neteaseWeapi(
    "/login/qrcode/create",
    { key, type: 1, ...qrimg ? { qrimg: true } : {} }
  );
  const body = pickQrCreate(createRes.body);
  const qrurl = body.qrurl ?? `https://music.163.com/login?codekey=${encodeURIComponent(key)}`;
  let qrimgData = body.qrimg ?? "";
  if (qrimg && qrimgData && !qrimgData.startsWith("data:")) {
    qrimgData = `data:image/png;base64,${qrimgData}`;
  }
  return json({
    code: 200,
    data: { key, qrurl, qrimg: qrimgData || null }
  });
}
__name(qrStart, "qrStart");
async function loginStatus(cookie) {
  if (!cookie) return json({ code: 400, message: "\u7F3A\u5C11 cookie" }, 400);
  const result = await neteaseWeapi("/w/nuser/account/get", {}, cookie);
  return json({ code: 200, data: result.body });
}
__name(loginStatus, "loginStatus");
async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const url = withTs(new URL(request.url));
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (path === "/" || path === "/health") {
      return json({
        ok: true,
        service: "netease-qr-login",
        endpoints: [
          "GET  /api/login/qr/key",
          "GET  /api/login/qr/create?key=&qrimg=true",
          "GET  /api/login/qr/check?key=",
          'POST /api/login/qr/start  { "qrimg": true }',
          "GET  /api/login/status?cookie="
        ]
      });
    }
    if (path === "/api/login/qr/key") {
      return qrKey();
    }
    if (path === "/api/login/qr/create") {
      const key = url.searchParams.get("key");
      if (!key) return json({ code: 400, message: "\u7F3A\u5C11 key" }, 400);
      const qrimg = url.searchParams.get("qrimg") !== "false";
      return qrCreate(key, qrimg);
    }
    if (path === "/api/login/qr/check") {
      const key = url.searchParams.get("key");
      if (!key) return json({ code: 400, message: "\u7F3A\u5C11 key" }, 400);
      return qrCheck(key);
    }
    if (path === "/api/login/qr/start" && request.method === "POST") {
      let qrimg = true;
      try {
        const body = await request.json();
        if (body.qrimg === false) qrimg = false;
      } catch {
      }
      return qrStart(qrimg);
    }
    if (path === "/api/login/status") {
      const cookie = url.searchParams.get("cookie") ?? "";
      return loginStatus(cookie);
    }
    if (path === "/login/qr/key") return qrKey();
    if (path === "/login/qr/create") {
      const key = url.searchParams.get("key");
      if (!key) return json({ code: 400, message: "\u7F3A\u5C11 key" }, 400);
      return qrCreate(key, url.searchParams.get("qrimg") === "true");
    }
    if (path === "/login/qr/check") {
      const key = url.searchParams.get("key");
      if (!key) return json({ code: 400, message: "\u7F3A\u5C11 key" }, 400);
      return qrCheck(key);
    }
    return json({ code: 404, message: "Not Found", path }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ code: 500, message }, 500);
  }
}
__name(handleRequest, "handleRequest");
var index_default = {
  async fetch(request) {
    try {
      return await handleRequest(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ code: 500, message: `Worker \u5F02\u5E38: ${message}` }, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
