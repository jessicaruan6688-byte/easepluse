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
const aiBaseUrl = (process.env.EASEPULSE_AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const aiApiKey = process.env.EASEPULSE_AI_API_KEY || "";
const aiModel = process.env.EASEPULSE_AI_MODEL || "gpt-5-mini";
const aiTimeoutMs = Number(process.env.EASEPULSE_AI_TIMEOUT_MS || 15000);
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

function normalizeLocale(locale) {
  return locale === "en" || locale === "es" ? locale : "zh";
}

function buildRecoveryBriefFallback(body) {
  const locale = normalizeLocale(body.locale);
  const evaluation = body.evaluation || {};
  const context = body.context || {};
  const recoveryScore = Number(evaluation.recoveryScore || 0);
  const reasons = Array.isArray(evaluation.reasons) ? evaluation.reasons.slice(0, 3) : [];
  const liveHeartRate = Number.isFinite(context.liveHeartRate) ? Number(context.liveHeartRate) : null;
  const scenarioName = sanitizeText(context.scenarioName);
  const careContactsCount = Number(context.careContactsCount || 0);
  const status = sanitizeText(evaluation.status, "stable");
  const nextActionTitle = sanitizeText(evaluation.nextActionTitle);
  const nextActionDetail = sanitizeText(evaluation.nextActionDetail);

  const liveSignalLine =
    liveHeartRate !== null
      ? locale === "en"
        ? ` Live heart rate is currently around ${liveHeartRate} bpm.`
        : locale === "es"
          ? ` La frecuencia en vivo está alrededor de ${liveHeartRate} lpm.`
          : ` 当前实时心率大约 ${liveHeartRate} bpm。`
      : "";

  if (status === "safety") {
    return {
      mode: "fallback",
      headline:
        locale === "en"
          ? "Switch from calming to human help now."
          : locale === "es"
            ? "Ahora cambia de calma a ayuda humana."
            : "现在应从安抚切到真人支持。",
      summary:
        locale === "en"
          ? `This state should not stay inside a normal self-help flow.${liveSignalLine}`
          : locale === "es"
            ? `Este estado no debería quedarse dentro de un flujo normal de autoayuda.${liveSignalLine}`
            : `这个状态不适合继续停留在普通自助流程里。${liveSignalLine}`,
      actions:
        locale === "en"
          ? ["Call one trusted person now", "Do not stay alone with the phone", "Escalate to urgent or professional help if symptoms continue"]
          : locale === "es"
            ? ["Llama ahora a una persona de confianza", "No te quedes sola con el móvil", "Escala a ayuda urgente o profesional si los síntomas siguen"]
            : ["立刻联系一位可信的人", "不要独自一个人继续扛", "如果症状持续，尽快升级到急救或专业帮助"],
      escalationNote:
        locale === "en"
          ? "Danger symptoms should override normal calming features."
          : locale === "es"
            ? "Los síntomas de peligro deben cortar las funciones normales de calma."
            : "一旦出现危险信号，应停止普通安抚功能。",
    };
  }

  if (status === "attention") {
    return {
      mode: "fallback",
      headline:
        locale === "en"
          ? "Reduce load before solving more."
          : locale === "es"
            ? "Reduce carga antes de resolver más."
            : "先减负，再处理更多事情。",
      summary:
        locale === "en"
          ? `${scenarioName || "Today's pattern"} is already drifting away from baseline. ${reasons[0] || "Multiple signals are elevated."}${liveSignalLine}`
          : locale === "es"
            ? `${scenarioName || "El patrón de hoy"} ya se aleja de la línea base. ${reasons[0] || "Varias señales están elevadas."}${liveSignalLine}`
            : `${scenarioName || "今天的状态"}已经明显偏离基线。${reasons[0] || "多项信号都在升高。"}${liveSignalLine}`,
      actions:
        locale === "en"
          ? [nextActionTitle || "Cut one high-drain task", "Take one 3-minute off-screen reset", careContactsCount > 0 ? "Tell your care circle you are not at your best today" : "Avoid adding new commitments today"]
          : locale === "es"
            ? [nextActionTitle || "Quita una tarea de alto desgaste", "Haz un reinicio de 3 minutos lejos de la pantalla", careContactsCount > 0 ? "Avisa a tu círculo de cuidado que hoy no estás en tu mejor punto" : "No añadas nuevos compromisos hoy"]
            : [nextActionTitle || "砍掉一个高消耗任务", "先做一次 3 分钟离屏恢复", careContactsCount > 0 ? "告诉关怀圈你今天状态不太好" : "今天不要再加新的承诺"],
      escalationNote:
        locale === "en"
          ? "If the next check-in feels worse, move to safety instead of repeating calming steps."
          : locale === "es"
            ? "Si el siguiente chequeo sale peor, pasa a seguridad en vez de repetir calma."
            : "如果下一次自查更差，就进入安全升级，而不是重复普通安抚。",
    };
  }

  if (status === "recovery") {
    return {
      mode: "fallback",
      headline:
        locale === "en"
          ? "Recovery is lagging behind output."
          : locale === "es"
            ? "La recuperación va por detrás del desgaste."
            : "恢复速度已经落后于消耗。",
      summary:
        locale === "en"
          ? `Recovery score is ${recoveryScore}. This is a recovery problem first, not a motivation problem.${liveSignalLine}`
          : locale === "es"
            ? `La puntuación de recuperación es ${recoveryScore}. Primero es un problema de recuperación, no de motivación.${liveSignalLine}`
            : `当前恢复分是 ${recoveryScore}。这首先是恢复问题，不是意志力问题。${liveSignalLine}`,
      actions:
        locale === "en"
          ? [nextActionTitle || "End 30 minutes earlier tonight", "Do one low-stimulation breathing cycle", careContactsCount > 0 ? "Send one soft check-in to your care circle" : "Keep tonight lighter than usual"]
          : locale === "es"
            ? [nextActionTitle || "Termina 30 minutos antes esta noche", "Haz una respiración de baja estimulación", careContactsCount > 0 ? "Envía un check-in suave a tu círculo" : "Haz esta noche más ligera de lo normal"]
            : [nextActionTitle || "今晚提前 30 分钟收线", "做一次低刺激呼吸恢复", careContactsCount > 0 ? "给关怀圈发一条轻量报平安" : "今晚的安排尽量放轻"],
      escalationNote:
        locale === "en"
          ? "If short sleep continues for several days, switch from solo recovery to shared support."
          : locale === "es"
            ? "Si el sueño corto sigue varios días, cambia de recuperación en solitario a apoyo compartido."
            : "如果短睡持续几天，就要从单人恢复切到共享支持。",
    };
  }

  if (status === "stress") {
    return {
      mode: "fallback",
      headline:
        locale === "en"
          ? "Tension is rising, but still reversible."
          : locale === "es"
            ? "La tensión sube, pero sigue siendo reversible."
            : "紧绷感在上升，但还可逆。",
      summary:
        locale === "en"
          ? `${reasons[0] || "Stress is above your comfort zone."}${liveSignalLine}`
          : locale === "es"
            ? `${reasons[0] || "El estrés está por encima de tu zona cómoda."}${liveSignalLine}`
            : `${reasons[0] || "压力已经高于舒适区。"}${liveSignalLine}`,
      actions:
        locale === "en"
          ? [nextActionTitle || "Take one 90-second breath", "Step away from the task before replying again", "Lower one expectation for the next hour"]
          : locale === "es"
            ? [nextActionTitle || "Haz una respiración de 90 segundos", "Aléjate de la tarea antes de responder otra vez", "Baja una expectativa para la próxima hora"]
            : [nextActionTitle || "先做一次 90 秒呼吸", "先离开当前任务再回复", "把接下来一小时的要求降一级"],
      escalationNote:
        locale === "en"
          ? "If the body keeps tightening after two resets, do not keep negotiating with yourself."
          : locale === "es"
            ? "Si el cuerpo sigue tenso tras dos reinicios, no sigas negociando contigo misma."
            : "如果做了两次恢复还是继续变紧，就不要再和自己硬谈判。",
    };
  }

  return {
    mode: "fallback",
    headline:
      locale === "en"
        ? "Protect the baseline you still have."
        : locale === "es"
          ? "Protege la línea base que aún tienes."
          : "保护住你现在还拥有的基线。",
    summary:
      locale === "en"
        ? `Recovery score is ${recoveryScore}. Today looks steady enough to protect with small actions.${liveSignalLine}`
        : locale === "es"
          ? `La recuperación es ${recoveryScore}. Hoy parece lo bastante estable como para protegerla con acciones pequeñas.${liveSignalLine}`
          : `当前恢复分是 ${recoveryScore}。今天更适合用小动作守住状态。${liveSignalLine}`,
    actions:
      locale === "en"
        ? ["Keep pace instead of adding more", "Schedule one short walk away from the screen", "Decide what time you will sign off tonight"]
        : locale === "es"
          ? ["Mantén el ritmo sin añadir más", "Programa una caminata corta lejos de la pantalla", "Decide a qué hora vas a cerrar hoy"]
          : ["保持节奏，不再加码", "安排一次短暂离屏走动", "先决定今晚几点收线"],
    escalationNote:
      locale === "en"
        ? "If sleep or heart-rate drift worsens tomorrow, regenerate the brief and shift to recovery-first mode."
        : locale === "es"
          ? "Si mañana empeoran el sueño o el pulso, vuelve a generar el brief y pasa a modo recuperación."
          : "如果明天睡眠或心率继续恶化，就重新生成简报并切到恢复优先模式。",
  };
}

function sanitizeBriefResponse(result, fallback) {
  const actions = Array.isArray(result.actions)
    ? result.actions.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 3)
    : fallback.actions;

  return {
    mode: result.mode === "ai" ? "ai" : fallback.mode,
    headline: sanitizeText(result.headline, fallback.headline),
    summary: sanitizeText(result.summary, fallback.summary),
    actions: actions.length > 0 ? actions : fallback.actions,
    escalationNote: sanitizeText(result.escalationNote, fallback.escalationNote),
    generatedAt: new Date().toISOString(),
    model: sanitizeText(result.model) || null,
  };
}

async function generateRecoveryBrief(body) {
  const fallback = buildRecoveryBriefFallback(body);

  if (!aiApiKey) {
    return {
      ...fallback,
      generatedAt: new Date().toISOString(),
      model: null,
    };
  }

  const locale = normalizeLocale(body.locale);
  const instructions =
    locale === "en"
      ? "Return compact JSON with headline, summary, actions, escalationNote. Keep it calm, concrete, and human. Actions must be 2 to 3 short strings."
      : locale === "es"
        ? "Devuelve JSON compacto con headline, summary, actions y escalationNote. Mantén un tono calmo, concreto y humano. Actions debe tener 2 o 3 frases cortas."
        : "请只返回紧凑 JSON，包含 headline、summary、actions、escalationNote。语气要平静、具体、有人味，actions 保持 2 到 3 条短句。";

  try {
    const response = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        temperature: 0.4,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: instructions,
          },
          {
            role: "user",
            content: JSON.stringify(body),
          },
        ],
      }),
      signal: AbortSignal.timeout(aiTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`AI upstream returned ${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((item) => (typeof item?.text === "string" ? item.text : ""))
              .join("")
          : "";

    if (!text) {
      throw new Error("AI upstream returned empty content");
    }

    const parsed = JSON.parse(text);

    return sanitizeBriefResponse(
      {
        ...parsed,
        mode: "ai",
        model: payload?.model || aiModel,
      },
      fallback,
    );
  } catch {
    return {
      ...fallback,
      generatedAt: new Date().toISOString(),
      model: null,
    };
  }
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

  const hasFileExtension = path.extname(pathname) !== "";
  const isMissingStaticAsset = !existsSync(safePath) && hasFileExtension;
  if (isMissingStaticAsset) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end("Not Found");
    return;
  }

  const filePath = existsSync(safePath) ? safePath : path.join(distDir, "index.html");
  const extension = path.extname(filePath);
  const stream = createReadStream(filePath);

  stream.on("error", () => {
    sendJson(res, 404, { error: "Not Found" });
  });

  const cacheControl =
    extension === ".html"
      ? "no-cache"
      : pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";

  res.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": cacheControl,
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

async function handleRecoveryBrief(req, res) {
  const body = await readJsonBody(req);
  const result = await generateRecoveryBrief(body);
  sendJson(res, 200, result);
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

    if (req.method === "POST" && url.pathname === "/api/ai/recovery-brief") {
      await handleRecoveryBrief(req, res);
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
