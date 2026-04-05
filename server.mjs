import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3001);
const storePath = path.join(__dirname, "data", "auth-store.json");
const distDir = path.join(__dirname, "dist");
const appBaseUrl = (process.env.APP_BASE_URL || "https://easepluse.zeabur.app").replace(/\/$/, "");
const mailFrom = process.env.MAIL_FROM || "";
const resendApiKey = process.env.RESEND_API_KEY || "";
const allowedOrigins = [
  appBaseUrl,
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3001",
  "http://localhost:4173",
  "http://127.0.0.1",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:4173",
];

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const emptyStore = {
  users: [],
  sessions: [],
};

function ensureStore() {
  if (!existsSync(path.dirname(storePath))) {
    mkdirSync(path.dirname(storePath), { recursive: true });
  }

  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify(emptyStore, null, 2));
  }
}

function loadStore() {
  ensureStore();
  try {
    const raw = readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return structuredClone(emptyStore);
  }
}

function saveStore(store) {
  ensureStore();
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeText(value, fallback = "") {
  return String(value || fallback).trim();
}

function hashSecret(secret, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(secret, salt, 64).toString("hex"),
  };
}

function verifySecret(secret, salt, hash) {
  const derived = scryptSync(secret, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function createVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

function createId(prefix) {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    profile: user.profile,
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  if (
    allowedOrigins.includes(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getToken(req, url) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return url.searchParams.get("token") || "";
}

function createSession(store, userId) {
  const now = new Date();
  const token = createSessionToken();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();

  store.sessions = store.sessions.filter((session) => {
    return session.userId !== userId && new Date(session.expiresAt).getTime() > now.getTime();
  });

  const session = {
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt,
    lastSeenAt: now.toISOString(),
  };

  store.sessions.push(session);
  return session;
}

async function deliverVerificationEmail({ email, code, profile }) {
  const verificationLink = `${appBaseUrl}/?mode=verify&email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
  const name = sanitizeText(profile.preferredName || profile.fullName, "there");

  if (!resendApiKey || !mailFrom) {
    return {
      deliveryMode: "preview",
      previewCode: code,
      message: "当前构建未配置外发邮件服务，已切到预览验证码模式。",
    };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #173543; line-height: 1.6;">
      <p>Hi ${name},</p>
      <p>欢迎注册 <strong>EasePulse 息伴</strong>。你的邮箱验证码是：</p>
      <p style="font-size: 32px; letter-spacing: 0.24em; font-weight: 700; color: #27858a;">${code}</p>
      <p>验证码 10 分钟内有效。你也可以直接点击下面的链接完成验证：</p>
      <p><a href="${verificationLink}">${verificationLink}</a></p>
      <p>如果这不是你发起的注册，请忽略这封邮件。</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom,
      to: [email],
      subject: "EasePulse 邮箱验证码",
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`邮件发送失败: ${text}`);
  }

  return {
    deliveryMode: "email",
    previewCode: null,
    message: `验证码已发送到 ${email}`,
  };
}

function readStaticFile(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolvedPath = path.join(distDir, pathname);
  const safePath = path.normalize(resolvedPath);

  if (!safePath.startsWith(distDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const filePath = existsSync(safePath) ? safePath : path.join(distDir, "index.html");
  const extension = path.extname(filePath);
  const stream = createReadStream(filePath);

  stream.on("error", () => {
    sendJson(res, 404, { error: "Not Found" });
  });

  res.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
  });
  stream.pipe(res);
}

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const profile = {
    fullName: sanitizeText(body.profile?.fullName),
    preferredName: sanitizeText(body.profile?.preferredName),
    ageRange: sanitizeText(body.profile?.ageRange),
    city: sanitizeText(body.profile?.city),
    role: sanitizeText(body.profile?.role),
    deviceModel: sanitizeText(body.profile?.deviceModel),
    wellbeingGoal: sanitizeText(body.profile?.wellbeingGoal),
  };

  if (!email || !password) {
    sendJson(res, 400, { error: "邮箱和密码不能为空。" });
    return;
  }

  if (password.length < 8) {
    sendJson(res, 400, { error: "密码至少需要 8 位。" });
    return;
  }

  if (!profile.fullName || !profile.city || !profile.role) {
    sendJson(res, 400, { error: "请补全姓名、城市和角色信息。" });
    return;
  }

  const store = loadStore();
  const existing = store.users.find((user) => user.email === email);

  if (existing?.emailVerified) {
    sendJson(res, 409, { error: "这个邮箱已经注册过了，请直接登录。" });
    return;
  }

  const verificationCode = createVerificationCode();
  const passwordSecret = hashSecret(password);
  const codeSecret = hashSecret(verificationCode);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 10).toISOString();

  let delivery;
  try {
    delivery = await deliverVerificationEmail({
      email,
      code: verificationCode,
      profile,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "验证码邮件发送失败。",
    });
    return;
  }

  const nextUser = existing || {
    id: createId("user"),
    createdAt: now.toISOString(),
  };

  Object.assign(nextUser, {
    email,
    emailVerified: false,
    passwordSalt: passwordSecret.salt,
    passwordHash: passwordSecret.hash,
    verificationSalt: codeSecret.salt,
    verificationHash: codeSecret.hash,
    verificationExpiresAt: expiresAt,
    verificationSentAt: now.toISOString(),
    profile,
    updatedAt: now.toISOString(),
    lastPreviewCode: delivery.previewCode,
  });

  if (existing) {
    const index = store.users.findIndex((user) => user.id === existing.id);
    store.users[index] = nextUser;
  } else {
    store.users.push(nextUser);
  }

  saveStore(store);

  sendJson(res, 200, {
    email,
    expiresAt,
    deliveryMode: delivery.deliveryMode,
    previewCode: delivery.previewCode,
    message: delivery.message,
  });
}

async function handleVerify(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const code = sanitizeText(body.code);
  const store = loadStore();
  const user = store.users.find((entry) => entry.email === email);

  if (!user) {
    sendJson(res, 404, { error: "没有找到这个邮箱对应的注册记录。" });
    return;
  }

  if (user.emailVerified) {
    sendJson(res, 409, { error: "这个邮箱已经验证过了，请直接登录。" });
    return;
  }

  if (!user.verificationExpiresAt || new Date(user.verificationExpiresAt).getTime() < Date.now()) {
    sendJson(res, 410, { error: "验证码已过期，请重新发送。" });
    return;
  }

  if (!verifySecret(code, user.verificationSalt, user.verificationHash)) {
    sendJson(res, 401, { error: "验证码不正确，请重新输入。" });
    return;
  }

  user.emailVerified = true;
  user.verificationSalt = "";
  user.verificationHash = "";
  user.verificationExpiresAt = "";
  user.lastPreviewCode = null;
  user.updatedAt = new Date().toISOString();

  const session = createSession(store, user.id);
  saveStore(store);

  sendJson(res, 200, {
    token: session.token,
    user: serializeUser(user),
  });
}

async function handleResend(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const store = loadStore();
  const user = store.users.find((entry) => entry.email === email);

  if (!user) {
    sendJson(res, 404, { error: "没有找到这个邮箱对应的注册记录。" });
    return;
  }

  if (user.emailVerified) {
    sendJson(res, 409, { error: "这个邮箱已经验证完成，请直接登录。" });
    return;
  }

  const verificationCode = createVerificationCode();
  const codeSecret = hashSecret(verificationCode);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  let delivery;
  try {
    delivery = await deliverVerificationEmail({
      email,
      code: verificationCode,
      profile: user.profile,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : "验证码邮件发送失败。",
    });
    return;
  }

  user.verificationSalt = codeSecret.salt;
  user.verificationHash = codeSecret.hash;
  user.verificationExpiresAt = expiresAt;
  user.verificationSentAt = new Date().toISOString();
  user.lastPreviewCode = delivery.previewCode;
  user.updatedAt = new Date().toISOString();

  saveStore(store);

  sendJson(res, 200, {
    email,
    expiresAt,
    deliveryMode: delivery.deliveryMode,
    previewCode: delivery.previewCode,
    message: delivery.message,
  });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const store = loadStore();
  const user = store.users.find((entry) => entry.email === email);

  if (!user) {
    sendJson(res, 404, { error: "没有找到这个邮箱，请先注册。" });
    return;
  }

  if (!verifySecret(password, user.passwordSalt, user.passwordHash)) {
    sendJson(res, 401, { error: "邮箱或密码不正确。" });
    return;
  }

  if (!user.emailVerified) {
    sendJson(res, 403, {
      error: "邮箱还没有验证。",
      verificationRequired: true,
      email,
    });
    return;
  }

  const session = createSession(store, user.id);
  saveStore(store);

  sendJson(res, 200, {
    token: session.token,
    user: serializeUser(user),
  });
}

function handleSession(req, res, url) {
  const token = getToken(req, url);
  const store = loadStore();
  const session = store.sessions.find((entry) => entry.token === token);

  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    sendJson(res, 401, { error: "会话已失效，请重新登录。" });
    return;
  }

  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) {
    sendJson(res, 404, { error: "找不到当前账号。" });
    return;
  }

  session.lastSeenAt = new Date().toISOString();
  saveStore(store);

  sendJson(res, 200, { user: serializeUser(user) });
}

async function handleProfile(req, res, url) {
  const token = getToken(req, url);
  const body = await readJsonBody(req);
  const store = loadStore();
  const session = store.sessions.find((entry) => entry.token === token);

  if (!session) {
    sendJson(res, 401, { error: "会话已失效，请重新登录。" });
    return;
  }

  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) {
    sendJson(res, 404, { error: "找不到当前账号。" });
    return;
  }

  user.profile = {
    ...user.profile,
    fullName: sanitizeText(body.profile?.fullName, user.profile.fullName),
    preferredName: sanitizeText(body.profile?.preferredName, user.profile.preferredName),
    ageRange: sanitizeText(body.profile?.ageRange, user.profile.ageRange),
    city: sanitizeText(body.profile?.city, user.profile.city),
    role: sanitizeText(body.profile?.role, user.profile.role),
    deviceModel: sanitizeText(body.profile?.deviceModel, user.profile.deviceModel),
    wellbeingGoal: sanitizeText(body.profile?.wellbeingGoal, user.profile.wellbeingGoal),
  };
  user.updatedAt = new Date().toISOString();
  saveStore(store);

  sendJson(res, 200, { user: serializeUser(user) });
}

async function handleLogout(req, res, url) {
  const token = getToken(req, url);
  const store = loadStore();
  store.sessions = store.sessions.filter((entry) => entry.token !== token);
  saveStore(store);
  sendJson(res, 200, { ok: true });
}

const server = createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, appBaseUrl });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      await handleRegister(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/verify-email") {
      await handleVerify(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/resend-code") {
      await handleResend(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/session") {
      handleSession(req, res, url);
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/auth/profile") {
      await handleProfile(req, res, url);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      await handleLogout(req, res, url);
      return;
    }

    readStaticFile(req, res, url);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "服务器发生未知错误。",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`EasePulse server listening on http://0.0.0.0:${port}`);
});
