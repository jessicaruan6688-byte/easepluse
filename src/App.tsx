import { ChangeEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import { AuthGate } from "./components/AuthGate";
import {
  buildBeaconGuardrail,
  buildCareHeadline,
  buildInsight,
  evaluateSnapshot,
  getBeaconRooms,
  getCareContacts,
  getDefaultCustomSnapshot,
  getGrowthLoopSteps,
  getScenarios,
  getSharingTierLabels,
  getSymptomLabels,
  type Locale,
  type BeaconRoom,
  type CareContact,
  type Scenario,
  type Snapshot,
  type SymptomKey,
  type TrendPoint,
} from "./lib/easepulse";
import {
  clearSessionToken,
  fetchSession,
  loginAccount,
  logoutAccount,
  readStoredSessionToken,
  readVerificationLink,
  registerAccount,
  resendVerificationCode,
  storeSessionToken,
  verifyEmailCode,
  type DeliveryMode,
  type LoginPayload,
  type RegisterPayload,
  type SessionUser,
  type VerificationPayload,
} from "./lib/auth-client";
import {
  requestRecoveryBrief,
  type RecoveryBriefResponse,
} from "./lib/ai-client";

type ViewKey =
  | "overview"
  | "story"
  | "connect"
  | "dashboard"
  | "support"
  | "care"
  | "beacon"
  | "trends"
  | "safety";

type UploadMap = Record<"sleep" | "heart" | "stress", string | null>;
type BluetoothState = "idle" | "connecting" | "connected" | "unsupported" | "error";
type LiveModeKey = "rest" | "focus" | "release";
type AuthScreen = "register" | "login" | "verify";
type PreviewMode = "guest" | "demo";

type QuickLink = {
  badge: string;
  label: string;
  note: string;
  href: string;
};

type ReferenceLink = {
  tag: string;
  name: string;
  vibe: string;
  takeaway: string;
  href: string;
};

type LifestyleScene = {
  id: string;
  title: string;
  body: string;
  image: string;
  credit: string;
  creditHref: string;
  targetView: ViewKey;
};

type CommercialPlan = {
  id: "beta" | "personal" | "team";
  badge: string;
  state: string;
  title: string;
  summary: string;
  points: string[];
  cta: string;
};

const storageKey = "easepulse-custom-snapshot";
const uploadStorageKey = "easepulse-uploads";
const localeStorageKey = "easepulse-locale";
const previewModeStorageKey = "easepulse-preview-mode";

function getNavItems(locale: Locale): Array<{ key: ViewKey; label: string }> {
  if (locale === "en") {
    return [
      { key: "overview", label: "Overview" },
      { key: "story", label: "Story" },
      { key: "connect", label: "Bridge" },
      { key: "dashboard", label: "Today" },
      { key: "support", label: "Recovery" },
      { key: "care", label: "Care Circle" },
      { key: "beacon", label: "Beacon" },
      { key: "trends", label: "Trends" },
      { key: "safety", label: "Safety" },
    ];
  }

  if (locale === "es") {
    return [
      { key: "overview", label: "Resumen" },
      { key: "story", label: "Historia" },
      { key: "connect", label: "Conexión" },
      { key: "dashboard", label: "Hoy" },
      { key: "support", label: "Recuperación" },
      { key: "care", label: "Círculo" },
      { key: "beacon", label: "Beacon" },
      { key: "trends", label: "Tendencias" },
      { key: "safety", label: "Seguridad" },
    ];
  }

  return [
    { key: "overview", label: "概览" },
    { key: "story", label: "故事页" },
    { key: "connect", label: "数据桥接" },
    { key: "dashboard", label: "今日状态" },
    { key: "support", label: "恢复支持" },
    { key: "care", label: "关怀圈" },
    { key: "beacon", label: "匿名支持" },
    { key: "trends", label: "趋势复盘" },
    { key: "safety", label: "安全边界" },
  ];
}

const symptomOptions: SymptomKey[] = [
  "none",
  "panic",
  "palpitation",
  "chestTightness",
  "breathless",
  "dizzy",
];

function getQuickLinks(locale: Locale): QuickLink[] {
  if (locale === "en") {
    return [
      {
        badge: "Live Site",
        label: "Open the Zeabur production page",
        note: "GitHub auto-deploy is connected, so pushes should refresh the public site.",
        href: "https://easepluse.zeabur.app/",
      },
      {
        badge: "Repository",
        label: "Open the GitHub repo",
        note: "All changes are pushed here first, then Zeabur builds from this source.",
        href: "https://github.com/jessicaruan6688-byte/easepluse",
      },
      {
        badge: "Sharing",
        label: "See Apple Health Sharing",
        note: "Trusted-contact consent flows are a strong reference for the care-circle permission model.",
        href: "https://support.apple.com/en-us/108323",
      },
      {
        badge: "Wearables",
        label: "See a wearable pairing example",
        note: "The broader wearable path can begin with Huawei Health, Xiaomi Fitness, Apple Health, Garmin Connect, Fitbit, or similar companion apps.",
        href: "https://consumer.huawei.com/en/support/content/en-us15935171/",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        badge: "Sitio en vivo",
        label: "Abrir la página pública en Zeabur",
        note: "El auto-deploy desde GitHub está conectado, así que los pushes deberían actualizar el sitio.",
        href: "https://easepluse.zeabur.app/",
      },
      {
        badge: "Repositorio",
        label: "Abrir el repositorio de GitHub",
        note: "Todos los cambios se empujan primero aquí y luego Zeabur construye desde esta fuente.",
        href: "https://github.com/jessicaruan6688-byte/easepluse",
      },
      {
        badge: "Compartir",
        label: "Ver Apple Health Sharing",
        note: "El consentimiento con contactos de confianza es una gran referencia para el modelo de permisos del círculo de cuidado.",
        href: "https://support.apple.com/en-us/108323",
      },
      {
        badge: "Wearables",
        label: "Ver un ejemplo de emparejamiento wearable",
        note: "La ruta general puede empezar desde Huawei Health, Xiaomi Fitness, Apple Health, Garmin Connect, Fitbit u otras apps compañeras.",
        href: "https://consumer.huawei.com/en/support/content/en-us15935171/",
      },
    ];
  }

  return [
    {
      badge: "线上站点",
      label: "查看 Zeabur 真实网页",
      note: "已经接入 GitHub 自动部署，推送后会自动更新线上站。",
      href: "https://easepluse.zeabur.app/",
    },
    {
      badge: "代码仓库",
      label: "打开 GitHub 主仓库",
      note: "所有改动都从这里推送，再由 Zeabur 自动构建。",
      href: "https://github.com/jessicaruan6688-byte/easepluse",
    },
    {
      badge: "共享参考",
      label: "查看 Apple Health Sharing",
      note: "亲友共享必须走明确授权和联系人机制，这对关怀圈设计有直接参考价值。",
      href: "https://support.apple.com/en-us/108323",
    },
    {
      badge: "设备说明",
      label: "查看可穿戴设备接入示例",
      note: "设备链路可以从 Huawei Health、Xiaomi Fitness、Apple Health、Garmin Connect、Fitbit 等 companion app 开始，再进入后续桥接。",
      href: "https://consumer.huawei.com/en/support/content/en-us15935171/",
    },
  ];
}

function getReferenceLinks(locale: Locale): ReferenceLink[] {
  if (locale === "en") {
    return [
      {
        tag: "Wearable Recovery",
        name: "WHOOP",
        vibe: "The information hierarchy is clear. Recovery, strain, and sleep are split into three entry points users understand instantly.",
        takeaway: "Good reference for metric architecture without copying the harder black-tech visual language.",
        href: "https://www.whoop.com/us/en/",
      },
      {
        tag: "Trust Sharing",
        name: "Apple Health Sharing",
        vibe: "Health sharing is restricted to trusted contacts with explicit invite, consent, and revoke flows.",
        takeaway: "Useful for designing permission boundaries and emotional safety in the care circle.",
        href: "https://support.apple.com/en-us/108323",
      },
      {
        tag: "Gentle Wellness",
        name: "Gentler Streak",
        vibe: "The tone is soft and recovery-focused. It does not constantly push the user to do more.",
        takeaway: "A strong reference for a calm, trustworthy, restorative atmosphere.",
        href: "https://gentler.app/",
      },
      {
        tag: "Calm Guidance",
        name: "Headspace",
        vibe: "High whitespace, slower pacing, and scenario-first navigation reduce cognitive load during stress.",
        takeaway: "Useful for homepage guidance and tone of voice.",
        href: "https://www.headspace.com/",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        tag: "Recuperación wearable",
        name: "WHOOP",
        vibe: "La jerarquía es muy clara: recuperación, carga y sueño se entienden al instante.",
        takeaway: "Sirve como referencia para ordenar métricas sin copiar su estética más dura y negra.",
        href: "https://www.whoop.com/us/en/",
      },
      {
        tag: "Confianza y compartir",
        name: "Apple Health Sharing",
        vibe: "Limita el compartir salud a contactos de confianza con invitación, consentimiento y revocación explícitos.",
        takeaway: "Muy útil para diseñar límites de permisos y seguridad emocional en el círculo de cuidado.",
        href: "https://support.apple.com/en-us/108323",
      },
      {
        tag: "Bienestar amable",
        name: "Gentler Streak",
        vibe: "El tono es suave y orientado a recuperación, no a exigir más esfuerzo todo el tiempo.",
        takeaway: "Gran referencia para una atmósfera tranquila, ligera y confiable.",
        href: "https://gentler.app/",
      },
      {
        tag: "Guía serena",
        name: "Headspace",
        vibe: "Mucho espacio en blanco, ritmo más lento y navegación por escenarios reducen la carga mental durante el estrés.",
        takeaway: "Útil para la guía de la home y el tono de voz.",
        href: "https://www.headspace.com/",
      },
    ];
  }

  return [
    {
      tag: "Wearable Recovery",
      name: "WHOOP",
      vibe: "信息层级很清楚，把恢复、负荷、睡眠拆成用户能立刻理解的三个入口。",
      takeaway: "适合借鉴指标编排方式，不需要复制它偏硬核的黑色科技感。",
      href: "https://www.whoop.com/us/en/",
    },
    {
      tag: "Trust Sharing",
      name: "Apple Health Sharing",
      vibe: "把健康共享限制在可信联系人里，强调邀请、同意和随时撤回。",
      takeaway: "很适合我们设计关怀圈的授权边界和社交安全感。",
      href: "https://support.apple.com/en-us/108323",
    },
    {
      tag: "Gentle Wellness",
      name: "Gentler Streak",
      vibe: "语气温和，强调恢复和节奏，不会一味要求用户更努力。",
      takeaway: "适合我们参考“放松、轻盈、可信”的产品氛围。",
      href: "https://gentler.app/",
    },
    {
      tag: "Calm Guidance",
      name: "Headspace",
      vibe: "留白足、节奏慢、入口按场景组织，压力大时不需要思考就能往下走。",
      takeaway: "适合参考首页的引导方式和文案语气。",
      href: "https://www.headspace.com/",
    },
  ];
}

function getDesignNotes(locale: Locale) {
  if (locale === "en") {
    return [
      {
        title: "Lead with software, not risky hardware claims",
        body: "Keep the band and health data, but position the product as a recovery system for high-pressure adults instead of a dramatic anti-sudden-death gadget.",
      },
      {
        title: "Embed growth inside product structure",
        body: "Move from solo recovery to care-circle invites and then anonymous rooms, so growth comes from support relationships rather than forced acquisition.",
      },
      {
        title: "Strangers only receive explicit asks for help",
        body: "The anonymous layer does not broadcast danger states or raw health data. High-risk situations still move only to trusted contacts and safety escalation.",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        title: "Primero software, no relato de hardware peligroso",
        body: "Se mantiene el wearable y los datos de salud, pero el producto se presenta como un sistema de recuperación para adultos bajo presión, no como un gadget dramático.",
      },
      {
        title: "El crecimiento va dentro de la estructura",
        body: "Se pasa de la recuperación individual a invitaciones del círculo de cuidado y luego a salas anónimas, así que el crecimiento nace de relaciones de apoyo reales.",
      },
      {
        title: "Las personas desconocidas solo reciben ayuda pedida",
        body: "La capa anónima no difunde estados de peligro ni datos de salud en bruto. Los casos de alto riesgo siguen yendo solo a contactos de confianza y escalada de seguridad.",
      },
    ];
  }

  return [
    {
      title: "先做软件，不做危险硬件叙事",
      body: "保留手环和健康数据，但不把项目讲成“防猝死硬件”，而是高压工作者的恢复力系统。",
    },
    {
      title: "把增长嵌进产品结构",
      body: "从单人恢复，到关怀圈邀请，再到匿名支持房间，增长不靠生硬拉新，而靠支持关系扩散。",
    },
    {
      title: "陌生人只承接主动求助",
      body: "匿名世界不广播危险状态，不公开原始健康数据，高风险场景仍然只走亲友和安全升级链路。",
    },
  ];
}

function getBluetoothChecklist(locale: Locale) {
  if (locale === "en") {
    return [
      "Use Chrome or Edge over HTTPS. Safari is still not the right browser for this path.",
      "The wearable must support and enable heart-rate data broadcast so the browser can discover a standard HR service.",
      "What the web can truly demo today is heart-rate broadcast. Motion-trigger gestures still need a native bridge.",
    ];
  }

  if (locale === "es") {
    return [
      "Usa Chrome o Edge bajo HTTPS. Safari todavía no es el navegador correcto para esta ruta.",
      "El wearable debe soportar y activar la emisión de frecuencia cardíaca para que el navegador descubra el servicio estándar.",
      "Lo que la web puede demostrar hoy de forma real es la emisión de frecuencia cardíaca. Los gestos por movimiento todavía requieren puente nativo.",
    ];
  }

  return [
    "需要 HTTPS 下的 Chrome 或 Edge，Safari 目前不适合做这条链路。",
    "手环需要支持并开启 HR Data Broadcasts，浏览器才能发现标准心率服务。",
    "网页现在能真实联动的是心率广播；甩手动作的 IMU 事件需要原生桥接，不应在网页里假装已打通。",
  ];
}

const demoSleepHours = 5.3;

function getJudgeHighlights(locale: Locale) {
  if (locale === "en") {
    return [
      {
        title: "Recovery First",
        body: "Lead with under-recovery before emotional support.",
      },
      {
        title: "Care Circle Handoff",
        body: "If the state worsens, hand the user to trusted contacts.",
      },
      {
        title: "Beacon Guardrail",
        body: "Anonymous support stays opt-in. Danger states stay private.",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        title: "Recuperación primero",
        body: "Empieza por la recuperación insuficiente antes del apoyo emocional.",
      },
      {
        title: "Transferencia al círculo de cuidado",
        body: "Si el estado empeora, deriva hacia contactos de confianza.",
      },
      {
        title: "Límite del Beacon",
        body: "El apoyo anónimo es opt-in. Los estados de peligro siguen privados.",
      },
    ];
  }

  return [
    {
      title: "Recovery First",
      body: "先讲恢复不足，再进情绪支持。",
    },
    {
      title: "Care Circle Handoff",
      body: "状态继续变差时，把人交给可信联系人。",
    },
    {
      title: "Beacon Guardrail",
      body: "匿名层只接受主动求助，危险状态不公开。",
    },
  ];
}

const demoTimelineCheckpoints = [
  { label: "08:10", heartRate: 72, risk: 28 },
  { label: "09:05", heartRate: 86, risk: 44 },
  { label: "09:42", heartRate: 98, risk: 63 },
  { label: "10:06", heartRate: 111, risk: 78 },
  { label: "10:18", heartRate: 118, risk: 88 },
];

function getSharingNotes(locale: Locale) {
  if (locale === "en") {
    return [
      {
        title: "State summary",
        detail: "Best for family. They only see whether today looks steady, recovery-low, or needs attention.",
      },
      {
        title: "Trends and notes",
        detail: "Best for a partner or work buddy. They can see trends and leave one actually useful message.",
      },
      {
        title: "Safety escalation",
        detail: "Only for the most trusted person. High-risk cases prioritize calls and real-world check-ins instead of more chat.",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        title: "Resumen del estado",
        detail: "Ideal para familia. Solo ven si hoy estás estable, con recuperación baja o si conviene prestar atención.",
      },
      {
        title: "Tendencias y notas",
        detail: "Ideal para pareja o compañero de trabajo. Pueden ver la tendencia y dejar un mensaje realmente útil.",
      },
      {
        title: "Escalada de seguridad",
        detail: "Solo para la persona más confiable. En alto riesgo se priorizan llamadas y comprobaciones reales, no más chat.",
      },
    ];
  }

  return [
    {
      title: "状态等级",
      detail: "适合家人，只看你今天平稳、恢复不足还是建议关注。",
    },
    {
      title: "趋势与留言",
      detail: "适合伴侣和工作搭子，既能看到趋势，也能留一句真正有帮助的话。",
    },
    {
      title: "安全升级提醒",
      detail: "只给最可信的人，高风险场景优先电话和线下确认，而不是继续聊天。",
    },
  ];
}

function getProductLayers(locale: Locale) {
  if (locale === "en") {
    return [
      {
        tag: "My Recovery",
        title: "Am I running on overdraw today?",
        body: "Explain the body and emotional state first, then give the single next action that matters most.",
      },
      {
        tag: "Care Circle",
        title: "Who can truly catch me when I start slipping?",
        body: "Let trusted contacts see the authorized state and turn notes into calls, load-shedding, and real care.",
      },
      {
        tag: "Support Beacon",
        title: "If I do not want to disturb people I know, where can I ask for help?",
        body: "The anonymous layer only handles active help-seeking. It does not expose raw health data or broadcast danger.",
      },
      {
        tag: "Safety Plan",
        title: "When things are truly risky, who should I reach?",
        body: "High-risk states move only toward family, emergency care, and professional help instead of strangers.",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        tag: "Mi recuperación",
        title: "¿Hoy me estoy sosteniendo a puro desgaste?",
        body: "Primero explica el estado físico y emocional, y luego da la acción única que más conviene hacer ahora.",
      },
      {
        tag: "Círculo de cuidado",
        title: "¿Quién puede sostenerme de verdad cuando empiezo a caer?",
        body: "Permite que contactos de confianza vean el estado autorizado y conviertan notas en llamadas, alivio de carga y cuidado real.",
      },
      {
        tag: "Support Beacon",
        title: "Si no quiero molestar a conocidos, ¿dónde puedo pedir ayuda?",
        body: "La capa anónima solo atiende ayuda pedida activamente. No expone datos de salud en bruto ni difunde peligro.",
      },
      {
        tag: "Plan de seguridad",
        title: "Si la situación es realmente peligrosa, ¿a quién recurro?",
        body: "Los estados de alto riesgo solo se derivan a familia, emergencias y ayuda profesional, nunca a desconocidos.",
      },
    ];
  }

  return [
    {
      tag: "My Recovery",
      title: "我今天是不是快透支了？",
      body: "先把身体和情绪状态解释清楚，再给一个最该做的动作。",
    },
    {
      tag: "Care Circle",
      title: "谁能在我状态变差时真的接住我？",
      body: "让可信联系人看到被授权的状态，并把留言变成电话、减负和实际照看。",
    },
    {
      tag: "Support Beacon",
      title: "我不想打扰熟人时，去哪里求助？",
      body: "匿名场只承接主动求助，不公开原始健康数据，不广播危险状态。",
    },
    {
      tag: "Safety Plan",
      title: "真正危险时，该找谁？",
      body: "高风险只进入亲友、急救和专业帮助，不把判断交给陌生人。",
    },
  ];
}

function getDefaultAuthInfo(locale: Locale) {
  if (locale === "en") {
    return "Create an account to save your recovery profile, device preferences, and care contacts.";
  }

  if (locale === "es") {
    return "Crea una cuenta para guardar tu perfil de recuperación, preferencias de dispositivo y contactos de cuidado.";
  }

  return "注册后可以保存你的恢复画像、设备偏好和关怀联系人。";
}

function getDefaultSupportResult(locale: Locale) {
  if (locale === "en") {
    return "No recovery action started yet.";
  }

  if (locale === "es") {
    return "Todavía no empezó ninguna acción de recuperación.";
  }

  return "还没开始恢复动作";
}

function getDefaultCareAction(locale: Locale) {
  if (locale === "en") {
    return "The care circle is not surveillance. It lets the user decide who can be brought in, and when.";
  }

  if (locale === "es") {
    return "El círculo de cuidado no es vigilancia. Permite decidir quién puede entrar y en qué momento.";
  }

  return "关怀圈不是监视，而是让用户指定谁可以在什么时候被拉进来。";
}

function getDefaultBeaconAction(locale: Locale) {
  if (locale === "en") {
    return "Anonymous support rooms only receive active requests for help. They do not expose danger states or trigger stranger alerts.";
  }

  if (locale === "es") {
    return "Las salas de apoyo anónimo solo reciben pedidos activos de ayuda. No exponen estados de peligro ni generan alertas a desconocidos.";
  }

  return "匿名支持房间只接主动求助，不公开危险状态，不做陌生人预警。";
}

function getDefaultBluetoothMessage(locale: Locale) {
  if (locale === "en") {
    return "In Chrome over HTTPS, you can try connecting a band that broadcasts standard heart-rate data.";
  }

  if (locale === "es") {
    return "En Chrome bajo HTTPS puedes intentar conectar una pulsera que emita frecuencia cardíaca estándar.";
  }

  return "在 Chrome + HTTPS 下，可以尝试连接支持标准心率广播的手环。";
}

function getLocaleCode(locale: Locale) {
  if (locale === "en") {
    return "en-US";
  }

  if (locale === "es") {
    return "es-ES";
  }

  return "zh-CN";
}

function getScreenshotEvidence(locale: Locale) {
  if (locale === "en") {
    return [
      { image: "/media/evidence/IMG_7308.PNG", alt: "Huawei sleep nap screenshot", source: "Huawei Health", metric: "Midday recovery nap", value: "43 min", note: "A fragmented midday nap suggests recovery is being patched together in small pieces." },
      { image: "/media/evidence/IMG_7310.PNG", alt: "Huawei emotional pressure screenshot", source: "Huawei Health", metric: "Emotional pressure", value: "52 normal", note: "Average pressure is still in a normal zone, but the body is already asking not to push harder." },
      { image: "/media/evidence/IMG_7313.PNG", alt: "Apple Health heart-rate screenshot", source: "Apple Health", metric: "Heart-rate range", value: "56-126 bpm", note: "The daily range is widening, which suggests output rhythm is becoming less stable." },
      { image: "/media/evidence/IMG_7309.PNG", alt: "Huawei heart-health screenshot", source: "Huawei Heart Health", metric: "Latest heart rate", value: "87 bpm", note: "High-day fluctuation makes a good cross-check against the Apple Health range." },
      { image: "/media/evidence/IMG_7312.PNG", alt: "Apple Health resting energy screenshot", source: "Apple Health", metric: "Resting energy", value: "1,071 kcal", note: "Baseline energy burn keeps running even when recovery windows are not catching up." },
      { image: "/media/evidence/IMG_7314.PNG", alt: "Huawei sleep score screenshot", source: "Huawei Sleep Score", metric: "Night sleep score", value: "No data today", note: "Night recovery is still not established, which strengthens the recovery-first story." },
    ];
  }

  if (locale === "es") {
    return [
      { image: "/media/evidence/IMG_7308.PNG", alt: "captura de siesta en Huawei", source: "Huawei Health", metric: "Siesta de recuperación", value: "43 min", note: "Una siesta fragmentada al mediodía sugiere que la recuperación se está compensando en trozos." },
      { image: "/media/evidence/IMG_7310.PNG", alt: "captura de presión emocional en Huawei", source: "Huawei Health", metric: "Presión emocional", value: "52 normal", note: "La media sigue en rango normal, pero el cuerpo ya está pidiendo no seguir forzando." },
      { image: "/media/evidence/IMG_7313.PNG", alt: "captura de frecuencia cardíaca en Apple Health", source: "Apple Health", metric: "Rango cardíaco", value: "56-126 lpm", note: "El rango diario se ensancha, señal de que el ritmo de esfuerzo se está volviendo inestable." },
      { image: "/media/evidence/IMG_7309.PNG", alt: "captura de salud cardíaca en Huawei", source: "Huawei Heart Health", metric: "Frecuencia más reciente", value: "87 lpm", note: "La fluctuación del día sirve para cruzar evidencia con el rango de Apple Health." },
      { image: "/media/evidence/IMG_7312.PNG", alt: "captura de energía en reposo de Apple Health", source: "Apple Health", metric: "Energía en reposo", value: "1,071 kcal", note: "El gasto basal sigue corriendo incluso cuando la recuperación no alcanza a compensar." },
      { image: "/media/evidence/IMG_7314.PNG", alt: "captura de puntuación de sueño en Huawei", source: "Huawei Sleep Score", metric: "Puntuación nocturna", value: "Sin datos hoy", note: "La recuperación nocturna todavía no se consolida, lo que refuerza la narrativa de recuperación primero." },
    ];
  }

  return [
    { image: "/media/evidence/IMG_7308.PNG", alt: "华为运动健康中的零星小睡截图", source: "华为运动健康", metric: "午间补觉", value: "43 分钟", note: "4 月 1 日 12:20-13:03 的零星小睡，说明恢复开始依赖碎片化补偿。" },
    { image: "/media/evidence/IMG_7310.PNG", alt: "华为运动健康中的情绪健康压力截图", source: "华为运动健康", metric: "情绪健康压力", value: "52 正常", note: "今日压力均值 52，最新值 10:07，身体已经在提醒你不要继续硬扛。" },
    { image: "/media/evidence/IMG_7313.PNG", alt: "Apple 健康中的心率截图", source: "Apple 健康", metric: "心率范围", value: "56-126 次/分", note: "白天区间被拉宽，说明输出节奏已经开始不稳定。" },
    { image: "/media/evidence/IMG_7309.PNG", alt: "华为心脏健康中的日心率截图", source: "华为心脏健康", metric: "最新心率", value: "87 次/分", note: "同一日内心率仍在高位波动，适合和 Apple 健康区间一起做交叉印证。" },
    { image: "/media/evidence/IMG_7312.PNG", alt: "Apple 健康中的静息能量截图", source: "Apple 健康", metric: "静息能量", value: "1,071 千卡", note: "4 月 5 日周视图总计，说明身体基础消耗一直在跑，恢复窗口却没有同步补上。" },
    { image: "/media/evidence/IMG_7314.PNG", alt: "华为睡眠评分截图", source: "华为睡眠评分", metric: "晚睡眠评分", value: "今日无数据", note: "夜间连续睡眠没有建立，恢复更像依赖碎片化补偿，这正好能衬托产品的恢复叙事。" },
  ];
}

function getSupportJourney(locale: Locale) {
  if (locale === "en") {
    return [
      { step: "01", title: "Overload is detected", detail: "The system combines fragmented sleep, stress shifts, heart-rate range, and energy burn to show that output is being sustained by overdraw." },
      { step: "02", title: "The user is held", detail: "EasePulse does not start with panic. It gives the most useful recovery action for the moment and explains why it is time to pause." },
      { step: "03", title: "Support is handed off", detail: "If the state keeps worsening, the app converts digital prompts into care-circle notes, calls, and real-world check-ins." },
    ];
  }

  if (locale === "es") {
    return [
      { step: "01", title: "Se detecta la sobrecarga", detail: "El sistema combina sueño fragmentado, variaciones de estrés, rango cardíaco y gasto energético para mostrar que el rendimiento se sostiene a costa del cuerpo." },
      { step: "02", title: "La persona es contenida", detail: "EasePulse no empieza sembrando pánico. Propone la acción de recuperación más útil en ese momento y explica por qué conviene pausar." },
      { step: "03", title: "El apoyo se transfiere", detail: "Si el estado sigue empeorando, la app convierte avisos digitales en mensajes al círculo de cuidado, llamadas y comprobaciones reales." },
    ];
  }

  return [
    { step: "01", title: "透支被发现", detail: "系统先把睡眠碎片、压力波动、心率区间和能量消耗拼起来，判断你是在靠透支维持输出。" },
    { step: "02", title: "用户被接住", detail: "EasePulse 不先制造恐慌，而是给一个当下最有效的恢复动作，并解释为什么现在该停一下。" },
    { step: "03", title: "支持被转交", detail: "如果状态持续恶化，就把线上提醒转成关怀圈留言、电话和线下确认，交给真实支持网络处理。" },
  ];
}

function getLifestyleScenes(locale: Locale): LifestyleScene[] {
  if (locale === "en") {
    return [
      {
        id: "stress-work",
        title: "Work strain should look real",
        body: "A realistic scene for deadline pressure, rising heart rate, and the moment the product needs to interrupt the grind.",
        image: "/media/lifestyle/stress-work.jpg",
        credit: "Pexels",
        creditHref: "https://www.pexels.com/photo/stressed-woman-looking-at-a-laptop-4226218/",
        targetView: "dashboard",
      },
      {
        id: "recovery-breathing",
        title: "Recovery should feel warm, not clinical",
        body: "This supports the breathing and reset flow better than a wall of text on the homepage.",
        image: "/media/lifestyle/recovery-breathing.jpg",
        credit: "Pexels",
        creditHref: "https://www.pexels.com/photo/young-woman-sitting-near-sofa-3759657/",
        targetView: "support",
      },
      {
        id: "late-night-reset",
        title: "Late-night off-ramp",
        body: "A softer home scene helps explain the end-of-day shutdown story and why care-circle support matters.",
        image: "/media/lifestyle/late-night-reset.jpg",
        credit: "Pexels",
        creditHref: "https://www.pexels.com/photo/woman-sitting-on-sofa-while-using-a-laptop-7671291/",
        targetView: "care",
      },
    ];
  }

  if (locale === "es") {
    return [
      {
        id: "stress-work",
        title: "La tensión laboral debe verse real",
        body: "Una escena creíble para presión de entrega, pulso al alza y ese punto en el que el producto debe interrumpir la inercia.",
        image: "/media/lifestyle/stress-work.jpg",
        credit: "Pexels",
        creditHref: "https://www.pexels.com/photo/stressed-woman-looking-at-a-laptop-4226218/",
        targetView: "dashboard",
      },
      {
        id: "recovery-breathing",
        title: "La recuperación debe sentirse cálida",
        body: "Esta imagen acompaña mejor la respiración y el reset que otra pantalla llena de texto en la home.",
        image: "/media/lifestyle/recovery-breathing.jpg",
        credit: "Pexels",
        creditHref: "https://www.pexels.com/photo/young-woman-sitting-near-sofa-3759657/",
        targetView: "support",
      },
      {
        id: "late-night-reset",
        title: "Salida suave de la noche",
        body: "La escena doméstica ayuda a explicar el cierre del día y por qué importa el círculo de cuidado.",
        image: "/media/lifestyle/late-night-reset.jpg",
        credit: "Pexels",
        creditHref: "https://www.pexels.com/photo/woman-sitting-on-sofa-while-using-a-laptop-7671291/",
        targetView: "care",
      },
    ];
  }

  return [
    {
      id: "stress-work",
      title: "高压工作场景要看起来真实",
      body: "这张图更适合承接截止日期压力、心率上扬，以及产品开始打断硬扛的那一刻。",
      image: "/media/lifestyle/stress-work.jpg",
      credit: "Pexels",
      creditHref: "https://www.pexels.com/photo/stressed-woman-looking-at-a-laptop-4226218/",
      targetView: "dashboard",
    },
    {
      id: "recovery-breathing",
      title: "恢复场景要更柔和",
      body: "这张图比首页堆很多字更适合解释呼吸练习和慢下来的感觉。",
      image: "/media/lifestyle/recovery-breathing.jpg",
      credit: "Pexels",
      creditHref: "https://www.pexels.com/photo/young-woman-sitting-near-sofa-3759657/",
      targetView: "support",
    },
    {
      id: "late-night-reset",
      title: "深夜下线要有生活感",
      body: "更像真实居家状态，适合讲晚间收工、被接住和关怀圈的产品故事。",
      image: "/media/lifestyle/late-night-reset.jpg",
      credit: "Pexels",
      creditHref: "https://www.pexels.com/photo/woman-sitting-on-sofa-while-using-a-laptop-7671291/",
      targetView: "care",
    },
  ];
}

function getStoryDrilldowns(locale: Locale): Array<{
  title: string;
  body: string;
  view: ViewKey;
}> {
  if (locale === "en") {
    return [
      { title: "Open Story Deck", body: "Screenshots, references, and links live there.", view: "story" },
      { title: "See Device Bridge", body: "Open wearable details only when needed.", view: "connect" },
      { title: "Open Today's State", body: "Jump straight into the recovery dashboard.", view: "dashboard" },
      { title: "Open Care Circle", body: "Open the human-support layer as a next step.", view: "care" },
    ];
  }

  if (locale === "es") {
    return [
      { title: "Abrir Story Deck", body: "Ahí viven capturas, referencias y enlaces.", view: "story" },
      { title: "Ver puente de dispositivos", body: "Abre los detalles wearable solo cuando haga falta.", view: "connect" },
      { title: "Abrir estado de hoy", body: "Entra directo al dashboard de recuperación.", view: "dashboard" },
      { title: "Abrir círculo de cuidado", body: "Abre la capa humana como siguiente paso.", view: "care" },
    ];
  }

  return [
    { title: "打开 Story 二级页", body: "截图、竞品和真实链接都在里面。", view: "story" },
    { title: "查看设备桥接", body: "设备桥接细节按需打开。", view: "connect" },
    { title: "打开今日状态", body: "直接进入恢复仪表盘。", view: "dashboard" },
    { title: "进入关怀圈", body: "把社交支持层放到下一步。", view: "care" },
  ];
}

function getCommercialPath(locale: Locale): {
  title: string;
  body: string;
  note: string;
  plans: CommercialPlan[];
} {
  if (locale === "en") {
    return {
      title: "Beta free first, then a clean path into personal and team plans.",
      body: "This belongs right after the homepage hero: visible enough to explain the business model, but not loud enough to interrupt the demo.",
      note: "First payment should appear where ongoing recovery value becomes obvious, not as a hard paywall on the first screen.",
      plans: [
        {
          id: "beta",
          badge: "Now",
          state: "Free",
          title: "Beta Free",
          summary: "For judges, early testers, and the first public product loop.",
          points: ["Live web demo and multilingual preview", "Basic wearable bridge path", "Feedback and waitlist access"],
          cta: "Open beta preview",
        },
        {
          id: "personal",
          badge: "Next",
          state: "Subscription",
          title: "Personal",
          summary: "For one user who wants daily recovery guidance, AI support, and private history.",
          points: ["AI recovery brief", "Longer-term trends and rituals", "Personalized recovery routines"],
          cta: "See personal plan",
        },
        {
          id: "team",
          badge: "Later",
          state: "Seats",
          title: "Team",
          summary: "For family, school, or employer pilots that need shared visibility and coordinated care.",
          points: ["Care-circle seats", "Escalation routing and shared notes", "Manager or coordinator summary layer"],
          cta: "See team plan",
        },
      ],
    };
  }

  if (locale === "es") {
    return {
      title: "Beta gratis primero, luego una ruta clara hacia plan personal y de equipo.",
      body: "Esta sección va justo después del hero: visible para explicar el negocio, pero sin romper la calma de la home.",
      note: "El primer cobro debe aparecer donde el valor continuo de recuperación ya se siente indispensable, no como muro en la primera pantalla.",
      plans: [
        {
          id: "beta",
          badge: "Ahora",
          state: "Gratis",
          title: "Beta Gratis",
          summary: "Para jurado, primeros testers y el primer ciclo público del producto.",
          points: ["Demo web en vivo y vista multilingüe", "Ruta base de integración wearable", "Acceso a feedback y lista de espera"],
          cta: "Abrir beta",
        },
        {
          id: "personal",
          badge: "Luego",
          state: "Suscripción",
          title: "Personal",
          summary: "Para quien quiere guía diaria de recuperación, apoyo IA e historial privado.",
          points: ["Resumen IA de recuperación", "Tendencias e historial personal", "Rutinas de recuperación personalizadas"],
          cta: "Ver plan personal",
        },
        {
          id: "team",
          badge: "Escala",
          state: "Asientos",
          title: "Equipo",
          summary: "Para pilotos con familia, campus o empresa que necesitan visibilidad compartida y coordinación.",
          points: ["Asientos para círculo de cuidado", "Escalación y notas compartidas", "Capa de resumen para coordinadores"],
          cta: "Ver plan de equipo",
        },
      ],
    };
  }

  return {
    title: "先用 Beta 免费跑通，再升级到个人版和团队版。",
    body: "这块放在首页首屏之后最合适，能说明商业路径，但不会打断演示节奏。",
    note: "真正开始收费，应该放在用户已经感受到持续恢复价值之后，而不是第一屏就硬拦。",
    plans: [
      {
        id: "beta",
        badge: "当前",
        state: "免费",
        title: "Beta 免费",
        summary: "给评审、早期用户和第一轮公开体验使用。",
        points: ["真实网页演示和多语言预览", "基础设备桥接链路", "反馈回收和候补入口"],
        cta: "进入 Beta 演示",
      },
      {
        id: "personal",
        badge: "下一步",
        state: "订阅",
        title: "个人版",
        summary: "给真正想长期使用的人，重点是日常恢复、AI 辅助和个人历史。",
        points: ["AI 恢复简报", "长期趋势和复盘", "更个性化的恢复提醒"],
        cta: "查看个人版",
      },
      {
        id: "team",
        badge: "后续",
        state: "多席位",
        title: "团队版",
        summary: "给家庭、校园或机构试点，重点是协同查看和关怀响应。",
        points: ["关怀圈席位", "升级提醒与共享记录", "面向协调者的汇总视图"],
        cta: "查看团队版",
      },
    ],
  };
}

function getScenarioTags(locale: Locale): Record<string, string> {
  if (locale === "en") {
    return {
      "late-nights": "Sleep",
      "meeting-stress": "Meeting",
      "overload-watch": "Trend",
      "safety-escalation": "Safety",
    };
  }

  if (locale === "es") {
    return {
      "late-nights": "Sueño",
      "meeting-stress": "Reunión",
      "overload-watch": "Tendencia",
      "safety-escalation": "Seguridad",
    };
  }

  return {
    "late-nights": "睡眠不足",
    "meeting-stress": "会前上扬",
    "overload-watch": "连续偏离",
    "safety-escalation": "安全升级",
  };
}

function getSimulationStage(progress: number, riskScore: number, locale: Locale) {
  if (progress < 0.2) {
    return {
      label: "Steady",
      detail:
        locale === "en"
          ? "Sleep was short last night, but the system starts with observation instead of forcing the user into danger language."
          : locale === "es"
            ? "Anoche se durmió poco, pero el sistema empieza observando y no empuja de inmediato a un lenguaje de peligro."
            : "昨晚睡眠偏少，但系统先保持观察，不把用户直接吓进危险区。",
    };
  }

  if (progress < 0.55) {
    return {
      label: "Building",
      detail:
        locale === "en"
          ? "Heart rate is climbing and strain is stacking up, so the interface gradually shifts attention toward recovery."
          : locale === "es"
            ? "La frecuencia cardíaca sube y la tensión se acumula, así que la interfaz empieza a llevar la atención hacia la recuperación."
            : "心率开始上扬，压力在堆积，界面逐步把注意力往恢复上拉。",
    };
  }

  if (riskScore < 70) {
    return {
      label: "Needs Care",
      detail:
        locale === "en"
          ? "The emotion orb has entered the orange zone, and the system is preparing a clearer support prompt."
          : locale === "es"
            ? "La esfera emocional ya entró en zona naranja y el sistema empieza a preparar una indicación de apoyo más clara."
            : "情绪球进入橙色区，系统开始准备更明确的支持提示。",
    };
  }

  return {
    label: "Support Ready",
    detail:
      locale === "en"
        ? "Risk has crossed 70. The system does not ask the user to push through. It surfaces a recovery action and suggests reaching the care circle."
        : locale === "es"
          ? "El riesgo ya superó 70. El sistema no pide seguir aguantando: muestra una acción de recuperación y sugiere contactar al círculo de cuidado."
          : "风险分已越过 70，系统不让用户继续硬撑，而是立刻给出恢复动作，并建议联系关怀圈。",
  };
}

function getOrbTone(riskScore: number) {
  if (riskScore < 45) {
    return "calm";
  }

  if (riskScore < 70) {
    return "warn";
  }

  return "alert";
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getLiveMode(
  bluetoothState: BluetoothState,
  heartRate: number | null,
  isCustomMode: boolean,
  locale: Locale,
): { key: LiveModeKey; label: string; detail: string } {
  if (bluetoothState === "connected" && heartRate !== null) {
    if (heartRate < 82) {
      return {
        key: "rest",
        label: locale === "en" ? "Steady Mode" : locale === "es" ? "Modo estable" : "平稳模式",
        detail:
          locale === "en"
            ? "The page keeps the softest teal tone, which is better for reviewing today's recovery state."
            : locale === "es"
              ? "La página mantiene el tono turquesa más suave, ideal para revisar el estado de recuperación de hoy."
              : "页面保持最柔和的蓝绿色，适合观察今天的恢复状态。",
      };
    }

    if (heartRate < 104) {
      return {
        key: "focus",
        label: locale === "en" ? "Focus Mode" : locale === "es" ? "Modo foco" : "激活模式",
        detail:
          locale === "en"
            ? "Heart rate is already rising, so the page highlights the current state and a fast recovery action."
            : locale === "es"
              ? "La frecuencia cardíaca ya está subiendo, así que la página destaca el estado actual y una acción rápida de recuperación."
              : "心率已开始上来，页面会强调当前状态和快速恢复动作。",
      };
    }

    return {
      key: "release",
      label: locale === "en" ? "Release Mode" : locale === "es" ? "Modo descarga" : "释放模式",
      detail:
        locale === "en"
          ? "Load is clearly elevated, so the page prioritizes unloading and recovery support."
          : locale === "es"
            ? "La carga ya está claramente elevada, así que la página prioriza bajar carga y apoyo de recuperación."
            : "负荷已明显升高，页面会优先强调减负和恢复支持。",
    };
  }

  if (isCustomMode) {
    return {
      key: "focus",
      label: locale === "en" ? "Real Input" : locale === "es" ? "Entrada real" : "真实录入",
      detail:
        locale === "en"
          ? "This view is using your manually entered data instead of a preset demo scenario."
          : locale === "es"
            ? "Esta vista usa tus datos ingresados manualmente en vez de un escenario demo predefinido."
            : "当前展示的是你手动录入的真实数据，而不是预设演示场景。",
    };
  }

  return {
    key: "rest",
    label: locale === "en" ? "Demo Browse" : locale === "es" ? "Exploración demo" : "演示浏览",
    detail:
      locale === "en"
        ? "This view uses switchable demo data to explain the full product loop."
        : locale === "es"
          ? "Esta vista usa datos demo intercambiables para explicar el ciclo completo del producto."
          : "当前展示的是可切换的演示数据，用于看清产品闭环。",
  };
}

function getBluetoothLabel(state: BluetoothState, locale: Locale) {
  if (state === "connected") {
    return locale === "en" ? "Connected" : locale === "es" ? "Conectado" : "已连接";
  }

  if (state === "connecting") {
    return locale === "en" ? "Connecting" : locale === "es" ? "Conectando" : "连接中";
  }

  if (state === "unsupported") {
    return locale === "en" ? "Browser Unsupported" : locale === "es" ? "Navegador no compatible" : "浏览器不支持";
  }

  if (state === "error") {
    return locale === "en" ? "Connection Failed" : locale === "es" ? "Conexión fallida" : "连接失败";
  }

  return locale === "en" ? "Not Connected" : locale === "es" ? "Sin conectar" : "未连接";
}

function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    readStoredValue(localeStorageKey, "zh"),
  );
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("register");
  const [authInfo, setAuthInfo] = useState(() => getDefaultAuthInfo(readStoredValue(localeStorageKey, "zh")));
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [prefilledVerificationCode, setPrefilledVerificationCode] = useState("");
  const [view, setView] = useState<ViewKey>("overview");
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() =>
    readStoredValue(previewModeStorageKey, "guest"),
  );
  const localizedScenarios = getScenarios(locale);
  const [scenarioId, setScenarioId] = useState<string>(localizedScenarios[0].id);
  const [customSnapshot, setCustomSnapshot] = useState<Snapshot>(() =>
    readStoredValue(
      storageKey,
      getDefaultCustomSnapshot(readStoredValue(localeStorageKey, "zh")),
    ),
  );
  const [uploads, setUploads] = useState<UploadMap>(() =>
    readStoredValue(uploadStorageKey, { sleep: null, heart: null, stress: null }),
  );
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [timer, setTimer] = useState(90);
  const [isBreathing, setIsBreathing] = useState(false);
  const [supportResult, setSupportResult] = useState(() =>
    getDefaultSupportResult(readStoredValue(localeStorageKey, "zh")),
  );
  const [careAction, setCareAction] = useState(() =>
    getDefaultCareAction(readStoredValue(localeStorageKey, "zh")),
  );
  const [beaconAction, setBeaconAction] = useState(() =>
    getDefaultBeaconAction(readStoredValue(localeStorageKey, "zh")),
  );
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>("idle");
  const [bluetoothMessage, setBluetoothMessage] = useState(() =>
    getDefaultBluetoothMessage(readStoredValue(localeStorageKey, "zh")),
  );
  const [connectedDeviceName, setConnectedDeviceName] = useState("");
  const [liveHeartRate, setLiveHeartRate] = useState<number | null>(null);
  const [lastSignalAt, setLastSignalAt] = useState("");
  const [isSimulatingStress, setIsSimulatingStress] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [recoveryBrief, setRecoveryBrief] = useState<RecoveryBriefResponse | null>(null);
  const [recoveryBriefLoading, setRecoveryBriefLoading] = useState(false);
  const [recoveryBriefError, setRecoveryBriefError] = useState("");
  const deviceRef = useRef<any>(null);
  const characteristicRef = useRef<any>(null);
  const simulationStartedAtRef = useRef<number | null>(null);
  const recoveryBriefKeyRef = useRef("");

  useEffect(() => {
    const verificationLink = readVerificationLink();
    if (verificationLink) {
      setAuthScreen("verify");
      setShowAuthGate(true);
      setPendingEmail(verificationLink.email);
      setPrefilledVerificationCode(verificationLink.code);
      setAuthInfo(
        locale === "en"
          ? "A verification link was detected. Please confirm the code."
          : locale === "es"
            ? "Se detectó un enlace de verificación. Confirma el código."
            : "检测到邮箱验证链接，请完成验证码确认。",
      );
    }

    const token = readStoredSessionToken();
    if (!token) {
      setSessionReady(true);
      return;
    }

    fetchSession(token)
      .then((result) => {
        setSessionUser(result.user);
        setAuthInfo(
          locale === "en"
            ? "Welcome back."
            : locale === "es"
              ? "Qué bueno verte de nuevo."
              : "欢迎回来。",
        );
        setAuthError("");
      })
      .catch(() => {
        clearSessionToken();
        setSessionUser(null);
      })
      .finally(() => {
        setSessionReady(true);
      });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(customSnapshot));
  }, [customSnapshot]);

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, JSON.stringify(locale));
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem(previewModeStorageKey, JSON.stringify(previewMode));
  }, [previewMode]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang =
      locale === "en" ? "en" : locale === "es" ? "es" : "zh-CN";
    document.title =
      locale === "en"
        ? "EasePulse | Recovery OS"
        : locale === "es"
          ? "EasePulse | Recovery OS"
          : "EasePulse | 息伴";

    const description =
      locale === "en"
        ? "EasePulse is a recovery-first assistant for high-pressure adults, designed to work with Huawei, Xiaomi, Apple Watch, Garmin, Fitbit, and other wearables."
        : locale === "es"
          ? "EasePulse es un asistente centrado en la recuperación para personas bajo alta presión, pensado para Huawei, Xiaomi, Apple Watch, Garmin, Fitbit y otros wearables."
          : "EasePulse 息伴：面向高压成年人的恢复优先助手，可配合华为、小米、Apple Watch、Garmin、Fitbit 等可穿戴设备使用。";

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", description);
    }
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem(uploadStorageKey, JSON.stringify(uploads));
  }, [uploads]);

  useEffect(() => {
    if (!isBreathing || timer === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setIsBreathing(false);
          setSupportResult(
            locale === "en"
              ? "Breathing complete. Check whether your shoulders and breath feel a little softer now."
              : locale === "es"
                ? "La respiración terminó. Revisa si hombros y respiración se sienten un poco más sueltos."
                : "呼吸练习完成，建议现在重新感受一下肩颈和呼吸是否放松了一点。",
          );
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isBreathing, locale, timer]);

  useEffect(() => {
    if (!isSimulatingStress) {
      simulationStartedAtRef.current = null;
      return;
    }

    simulationStartedAtRef.current = performance.now();

    const interval = window.setInterval(() => {
      const startedAt = simulationStartedAtRef.current ?? performance.now();
      const nextProgress = Math.min((performance.now() - startedAt) / 18000, 1);
      setSimulationProgress(nextProgress);

      if (nextProgress >= 1) {
        window.clearInterval(interval);
        setIsSimulatingStress(false);
      }
    }, 120);

    return () => window.clearInterval(interval);
  }, [isSimulatingStress]);

  useEffect(() => {
    const bluetoothApi =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { bluetooth?: any }).bluetooth
        : undefined;

    if (!bluetoothApi) {
      setBluetoothState("unsupported");
      setBluetoothMessage(
        locale === "en"
          ? "Web Bluetooth is not available in this browser. Open the page in Chrome or Edge over HTTPS."
          : locale === "es"
            ? "Web Bluetooth no está disponible en este navegador. Abre la página en Chrome o Edge bajo HTTPS."
            : "当前浏览器不支持 Web Bluetooth。请用 HTTPS 下的 Chrome 或 Edge 打开。",
      );
      return;
    }

    bluetoothApi
      .getAvailability?.()
      .then((available: boolean) => {
        if (!available) {
          setBluetoothMessage(
            locale === "en"
              ? "The browser supports Bluetooth, but the system adapter is unavailable or turned off."
              : locale === "es"
                ? "El navegador soporta Bluetooth, pero el adaptador del sistema no está disponible o está apagado."
                : "浏览器支持蓝牙，但当前系统蓝牙不可用或未开启。",
          );
        }
      })
      .catch(() => {
        setBluetoothMessage(
          locale === "en"
            ? "Bluetooth is supported, but device permission can only be requested after a button click."
            : locale === "es"
              ? "Bluetooth está soportado, pero el permiso del dispositivo solo puede pedirse después de pulsar un botón."
              : "浏览器支持蓝牙，但还需要在点击按钮后再请求设备权限。",
        );
      });
  }, [locale]);

  useEffect(() => {
    return () => {
      const characteristic = characteristicRef.current;
      const device = deviceRef.current;

      if (characteristic) {
        characteristic.removeEventListener("characteristicvaluechanged", handleHeartRateChanged);
        void characteristic.stopNotifications?.().catch(() => undefined);
      }

      if (device) {
        device.removeEventListener("gattserverdisconnected", handleDeviceDisconnected);
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
      }
    };
  }, []);

  const navItems = getNavItems(locale);
  const quickLinks = getQuickLinks(locale);
  const referenceLinks = getReferenceLinks(locale);
  const bluetoothChecklist = getBluetoothChecklist(locale);
  const screenshotEvidence = getScreenshotEvidence(locale);
  const supportJourney = getSupportJourney(locale);
  const lifestyleScenes = getLifestyleScenes(locale);
  const storyDrilldowns = getStoryDrilldowns(locale);
  const commercialPath = getCommercialPath(locale);
  const scenarioTags = getScenarioTags(locale);
  const featuredScene = lifestyleScenes[0];
  const calmScene = lifestyleScenes[1] ?? featuredScene;
  const homeResetScene = lifestyleScenes[2] ?? calmScene;
  const designNotes = getDesignNotes(locale);
  const judgeHighlights = getJudgeHighlights(locale);
  const activeScenario: Scenario =
    localizedScenarios.find((item) => item.id === scenarioId) ?? localizedScenarios[0];
  const activeSnapshot = isCustomMode ? customSnapshot : activeScenario.snapshot;
  const evaluation = evaluateSnapshot(activeSnapshot, locale);
  const activeHistory: TrendPoint[] = isCustomMode
    ? activeScenario.history.map((point, index, history) =>
        index === history.length - 1
          ? {
              ...point,
              recoveryScore: evaluation.recoveryScore,
              sleepHours: activeSnapshot.sleepHours,
              stressLevel: activeSnapshot.stressLevel,
              moodScore: activeSnapshot.moodScore,
              restingHeartRate: activeSnapshot.restingHeartRate,
            }
          : point,
      )
    : activeScenario.history;
  const screenshotCount = Object.values(uploads).filter(Boolean).length;
  const liveMode = getLiveMode(bluetoothState, liveHeartRate, isCustomMode, locale);
  const demoHeartRate = Math.round(72 + simulationProgress * 46);
  const demoRiskScore = Math.round(28 + simulationProgress * 60);
  const demoStage = getSimulationStage(simulationProgress, demoRiskScore, locale);
  const demoInterventionVisible = demoRiskScore >= 70;
  const careHeadline = buildCareHeadline(evaluation.status, locale);
  const beaconGuardrail = buildBeaconGuardrail(locale);
  const careContacts = getCareContacts(locale);
  const beaconRooms = getBeaconRooms(locale);
  const growthLoopSteps = getGrowthLoopSteps(locale);
  const symptomLabels = getSymptomLabels(locale);
  const sharingTierLabels = getSharingTierLabels(locale);
  const sharingNotes = getSharingNotes(locale);
  const productLayers = getProductLayers(locale);
  const recoveryBriefRequestKey = JSON.stringify({
    locale,
    scenarioId,
    isCustomMode,
    sleepHours: activeSnapshot.sleepHours,
    sleepScore: activeSnapshot.sleepScore,
    restingHeartRate: activeSnapshot.restingHeartRate,
    baselineRestingHeartRate: activeSnapshot.baselineRestingHeartRate,
    stressLevel: activeSnapshot.stressLevel,
    activeMinutes: activeSnapshot.activeMinutes,
    sedentaryHours: activeSnapshot.sedentaryHours,
    moodScore: activeSnapshot.moodScore,
    notes: activeSnapshot.notes,
    symptoms: activeSnapshot.symptoms,
    status: evaluation.status,
    recoveryScore: evaluation.recoveryScore,
    reasons: evaluation.reasons,
    nextActionTitle: evaluation.nextActionTitle,
    nextActionDetail: evaluation.nextActionDetail,
    careContacts: careContacts.length,
    liveHeartRate,
    bluetoothState,
  });

  function updateSnapshot<K extends keyof Snapshot>(key: K, value: Snapshot[K]) {
    setCustomSnapshot((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleNumberChange(
    key: keyof Snapshot,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const value = Number(event.target.value);
    updateSnapshot(key as never, value as never);
  }

  function handleFileUpload(
    key: keyof UploadMap,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploads((current) => ({
        ...current,
        [key]: typeof reader.result === "string" ? reader.result : null,
      }));
    };
    reader.readAsDataURL(file);
  }

  function toggleSymptom(symptom: SymptomKey) {
    if (symptom === "none") {
      updateSnapshot("symptoms", ["none"]);
      return;
    }

    const next = customSnapshot.symptoms.includes(symptom)
      ? customSnapshot.symptoms.filter((item) => item !== symptom)
      : [...customSnapshot.symptoms.filter((item) => item !== "none"), symptom];

    updateSnapshot("symptoms", next.length > 0 ? next : ["none"]);
  }

  function startBreathing() {
    setTimer(90);
    setIsBreathing(true);
    setSupportResult(
      locale === "en"
        ? "Starting a 90-second recovery breath. Pull your attention out of the task first."
        : locale === "es"
          ? "Empezando una respiración de recuperación de 90 segundos. Primero saca tu atención de la tarea."
          : "正在进行 90 秒恢复呼吸，先把注意力从任务里抽离出来。",
    );
  }

  function startStressSimulation() {
    simulationStartedAtRef.current = null;
    setSimulationProgress(0);
    setIsSimulatingStress(true);
  }

  function resetStressSimulation() {
    simulationStartedAtRef.current = null;
    setIsSimulatingStress(false);
    setSimulationProgress(0);
  }

  function applyCustomMode() {
    setIsCustomMode(true);
    setView("dashboard");
    setSupportResult(
      locale === "en"
        ? "Your custom state is loaded. You can start the recovery flow now."
        : locale === "es"
          ? "Tu estado personalizado ya está cargado. Puedes empezar la recuperación."
          : "已载入你的自定义状态，可以开始恢复流程。",
    );
  }

  function resetCustomMode() {
    setIsCustomMode(false);
    setView("dashboard");
  }

  function handleDeviceDisconnected() {
    characteristicRef.current?.removeEventListener(
      "characteristicvaluechanged",
      handleHeartRateChanged,
    );
    characteristicRef.current = null;
    deviceRef.current = null;
    setBluetoothState("idle");
    setConnectedDeviceName("");
    setLiveHeartRate(null);
    setBluetoothMessage(
      locale === "en"
        ? "The Bluetooth device disconnected. Reconnect the heart-rate broadcast to resume live sync."
        : locale === "es"
          ? "El dispositivo Bluetooth se desconectó. Vuelve a conectar la emisión cardíaca para reanudar la sincronización."
          : "蓝牙设备已断开。要继续联动，请重新连接心率广播。",
    );
  }

  function handleHeartRateChanged(event: Event) {
    const value = (event.target as { value?: DataView | null }).value;

    if (!value) {
      return;
    }

    const flags = value.getUint8(0);
    const usesLongValue = (flags & 0x1) === 1;
    const heartRate = usesLongValue ? value.getUint16(1, true) : value.getUint8(1);

    setLiveHeartRate(heartRate);
    setLastSignalAt(
      new Intl.DateTimeFormat(getLocaleCode(locale), {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date()),
    );
    setBluetoothMessage(
      locale === "en"
        ? "Live heart-rate data is flowing. The page mode will change with the incoming range."
        : locale === "es"
          ? "Ya está entrando frecuencia cardíaca en tiempo real. El modo de la página cambiará según el rango recibido."
          : "正在接收实时心率，页面模式会随心率区间自动变化。",
    );
  }

  async function connectBand() {
    const bluetoothApi =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { bluetooth?: any }).bluetooth
        : undefined;

    if (!bluetoothApi) {
      setBluetoothState("unsupported");
      setBluetoothMessage(
        locale === "en"
          ? "This browser does not support Web Bluetooth. Please switch to Chrome or Edge."
          : locale === "es"
            ? "Este navegador no soporta Web Bluetooth. Cambia a Chrome o Edge."
            : "当前浏览器不支持 Web Bluetooth，请改用 Chrome 或 Edge。",
      );
      return;
    }

    try {
      setBluetoothState("connecting");
      setBluetoothMessage(
        locale === "en"
          ? "Requesting Bluetooth permission. Choose a device that has heart-rate broadcast enabled."
          : locale === "es"
            ? "Solicitando permiso Bluetooth. Elige un dispositivo con emisión de frecuencia cardíaca activada."
            : "正在请求蓝牙权限，请从弹窗中选择开启心率广播的设备。",
      );

      const device = await bluetoothApi.requestDevice({
        filters: [{ services: ["heart_rate"] }],
        optionalServices: ["battery_service", "device_information"],
      });
      const server = await device.gatt?.connect();

      if (!server) {
        throw new Error(
          locale === "en"
            ? "A device was selected, but the Bluetooth connection could not be established."
            : locale === "es"
              ? "Se seleccionó un dispositivo, pero no se pudo establecer la conexión Bluetooth."
              : "设备已选择，但未能建立蓝牙连接。",
        );
      }

      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");

      deviceRef.current = device;
      characteristicRef.current = characteristic;

      device.addEventListener("gattserverdisconnected", handleDeviceDisconnected);
      characteristic.addEventListener("characteristicvaluechanged", handleHeartRateChanged);
      await characteristic.startNotifications();

      setBluetoothState("connected");
      setConnectedDeviceName(
        device.name ??
          (locale === "en"
            ? "Heart-rate broadcast device"
            : locale === "es"
              ? "Dispositivo de emisión cardíaca"
              : "心率广播设备"),
      );
      setBluetoothMessage(
        locale === "en"
          ? "Device connected. Waiting for the first heart-rate reading."
          : locale === "es"
            ? "Dispositivo conectado. Esperando la primera lectura cardíaca."
            : "已连接设备，等待第一条心率数据。",
      );
      setView("connect");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setBluetoothState("idle");
        setBluetoothMessage(
          locale === "en"
            ? "Device selection was canceled. No new Bluetooth connection was created."
            : locale === "es"
              ? "Se canceló la selección del dispositivo. No se creó una nueva conexión Bluetooth."
              : "已取消设备选择，没有建立新的蓝牙连接。",
        );
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : locale === "en"
            ? "Failed to connect to the Bluetooth device."
            : locale === "es"
              ? "No se pudo conectar con el dispositivo Bluetooth."
              : "连接蓝牙设备失败。";
      setBluetoothState("error");
      setConnectedDeviceName("");
      setLiveHeartRate(null);
      setBluetoothMessage(message);
    }
  }

  async function disconnectBand() {
    const characteristic = characteristicRef.current;
    const device = deviceRef.current;

    if (characteristic) {
      characteristic.removeEventListener("characteristicvaluechanged", handleHeartRateChanged);
      await characteristic.stopNotifications?.().catch(() => undefined);
      characteristicRef.current = null;
    }

    if (device) {
      device.removeEventListener("gattserverdisconnected", handleDeviceDisconnected);
      if (device.gatt?.connected) {
        device.gatt.disconnect();
      }
      deviceRef.current = null;
    }

    setBluetoothState("idle");
    setConnectedDeviceName("");
    setLiveHeartRate(null);
    setLastSignalAt("");
    setBluetoothMessage(
      locale === "en"
        ? "Disconnected manually. Reconnect the heart-rate broadcast whenever you need it."
        : locale === "es"
          ? "Se desconectó manualmente. Puedes volver a conectar la emisión cardíaca cuando quieras."
          : "已手动断开。需要时可以重新连接心率广播。",
    );
  }

  function handleCareAction(contact: CareContact, action: "message" | "call" | "lighten") {
    if (action === "message") {
      setCareAction(
        locale === "en"
          ? `A care-note draft is ready for ${contact.name}: My recovery is lagging today. Can you remind me to sign off later?`
          : locale === "es"
            ? `Ya está listo un borrador para ${contact.name}: Hoy mi recuperación va rezagada. ¿Puedes recordarme que cierre más tarde?`
            : `已向 ${contact.name} 发送关怀留言草稿：我今天恢复有点跟不上，晚点能提醒我先下线吗？`,
      );
      return;
    }

    if (action === "call") {
      setCareAction(
        locale === "en"
          ? `A call action is prepared for ${contact.name}. In real danger, EasePulse prioritizes real voice contact instead of keeping you inside the app.`
          : locale === "es"
            ? `Ya quedó preparada una acción de llamada para ${contact.name}. En un riesgo real, EasePulse prioriza el contacto de voz antes que seguir dentro de la app.`
            : `已为 ${contact.name} 准备电话动作。真正危险时，EasePulse 会优先把你推向真实通话，而不是继续停留在 App 里。`,
      );
      return;
    }

    setCareAction(
      locale === "en"
        ? `A load-shedding request was sent to ${contact.name}: please block one high-drain commitment so I can recover first.`
        : locale === "es"
          ? `Se envió una petición de alivio de carga a ${contact.name}: ayúdame a bloquear un compromiso de alto desgaste para recuperarme primero.`
          : `已向 ${contact.name} 发出减负请求：帮我挡掉一个高耗能安排，让我先恢复一下。`,
    );
  }

  function handleBeaconAction(room: BeaconRoom, mode: "post" | "join") {
    if (mode === "post") {
      setBeaconAction(
        locale === "en"
          ? `An anonymous help card was created in "${room.title}": ${room.prompt}`
          : locale === "es"
            ? `Se creó una tarjeta de ayuda anónima en "${room.title}": ${room.prompt}`
            : `已在「${room.title}」生成匿名求助卡片：${room.prompt}`,
      );
      return;
    }

    setBeaconAction(
      locale === "en"
        ? `Entered "${room.title}". Only preset support and recovery actions are open here. High-risk spectatorship is not allowed.`
        : locale === "es"
          ? `Entraste en "${room.title}". Aquí solo se abren apoyos y acciones de recuperación predefinidas. No se permite el morbo de alto riesgo.`
          : `已进入「${room.title}」，系统只开放预设支持和恢复动作，不开放高风险围观。`,
    );
  }

  async function handleRegister(payload: RegisterPayload) {
    setAuthError("");
    const result = await registerAccount(payload);
    setPendingEmail(result.email);
    setDeliveryMode(result.deliveryMode);
    setPreviewCode(result.previewCode);
    setAuthScreen("verify");
    setAuthInfo(result.message);
  }

  async function handleVerify(payload: VerificationPayload) {
    setAuthError("");
    const result = await verifyEmailCode(payload);
    storeSessionToken(result.token);
    setSessionUser(result.user);
    setShowAuthGate(false);
    setPreviewCode(null);
    setDeliveryMode(null);
    setPrefilledVerificationCode("");
    setAuthInfo(
      locale === "en"
        ? "Email verified. You are now inside the workspace."
        : locale === "es"
          ? "Correo verificado. Ya entraste al espacio de trabajo."
          : "邮箱已验证，已进入应用工作台。",
    );

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  async function handleLogin(payload: LoginPayload) {
    setAuthError("");

    try {
      const result = await loginAccount(payload);
      storeSessionToken(result.token);
      setSessionUser(result.user);
      setShowAuthGate(false);
      setAuthInfo(
        locale === "en"
          ? "Login successful."
          : locale === "es"
            ? "Inicio de sesión correcto."
            : "登录成功。",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : locale === "en"
            ? "Login failed."
            : locale === "es"
              ? "Falló el inicio de sesión."
              : "登录失败。";
      if (message.includes("没有验证") || message.toLowerCase().includes("verify")) {
        setPendingEmail(payload.email);
        setAuthScreen("verify");
        setShowAuthGate(true);
        setAuthInfo(
          locale === "en"
            ? "This account has not finished email verification yet. Enter the code first."
            : locale === "es"
              ? "Esta cuenta todavía no terminó la verificación por correo. Introduce primero el código."
              : "这个账号还没有完成邮箱验证，请先输入验证码。",
        );
      }
      throw error;
    }
  }

  async function handleResend(email: string) {
    setAuthError("");
    const result = await resendVerificationCode(email);
    setPendingEmail(result.email);
    setDeliveryMode(result.deliveryMode);
    setPreviewCode(result.previewCode);
    setAuthInfo(result.message);
  }

  async function handleLogout() {
    const token = readStoredSessionToken();
    if (token) {
      await logoutAccount(token).catch(() => undefined);
    }

    clearSessionToken();
    setSessionUser(null);
    setAuthScreen("login");
    setPendingEmail("");
    setDeliveryMode(null);
    setPreviewCode(null);
    setAuthInfo(
      locale === "en"
        ? "You are signed out."
        : locale === "es"
          ? "Ya cerraste sesión."
          : "你已经退出账号。",
    );
  }

  const welcomeName =
    sessionUser?.profile.preferredName || sessionUser?.profile.fullName || "你";
  const heroTitle = sessionUser
    ? locale === "en"
      ? `${welcomeName}, review today's recovery state first.`
      : locale === "es"
        ? `${welcomeName}, revisa primero tu estado de recuperación de hoy.`
        : `${welcomeName}，先看今天的恢复状态。`
    : previewMode === "demo"
      ? locale === "en"
        ? "Turn stress into a clear recovery demo."
        : locale === "es"
          ? "Convierte el estrés en una demo clara de recuperación."
          : "把压力演示成一条清楚的恢复链。"
      : locale === "en"
        ? "Start from stillness before entering the system."
        : locale === "es"
          ? "Empieza desde la quietud antes de entrar en el sistema."
          : "先回到安静，再进入系统。";
  const heroLede = sessionUser
    ? locale === "en"
      ? `${sessionUser.email} is already connected. This page opens straight into the product chain and your data.`
      : locale === "es"
        ? `${sessionUser.email} ya está conectado. Esta página abre directo al producto y a tus datos.`
        : `${sessionUser.email} 已接入。现在直接看产品链路和你的数据。`
    : previewMode === "demo"
      ? locale === "en"
        ? "Demo preview keeps the pressure rise, AI intervention, and support handoff visible in one chain."
        : locale === "es"
          ? "La vista demo mantiene en una sola cadena el aumento de presión, la intervención IA y el traspaso de apoyo."
          : "演示预览会把压力上升、AI 干预和支持转交放在一条链路里。"
      : locale === "en"
        ? "Visitor preview stays softer: calmer imagery, lighter entry points, and one clear path into the live demo."
        : locale === "es"
          ? "La vista visitante es más suave: imágenes tranquilas, entradas ligeras y una ruta clara hacia la demo."
          : "访客预览会更柔和一些：先看静谧图片，再决定是否进入演示。";
  const authStatusLabel = sessionUser
    ? locale === "en"
      ? "Workspace connected"
      : locale === "es"
        ? "Espacio conectado"
        : "已登录工作台"
    : sessionReady
      ? locale === "en"
        ? "Guest access"
        : locale === "es"
          ? "Acceso invitado"
          : "访客访问"
      : locale === "en"
        ? "Checking session"
        : locale === "es"
          ? "Verificando sesión"
        : "检查会话中";
  const previewModeLabel =
    previewMode === "demo"
      ? locale === "en"
        ? "Demo preview"
        : locale === "es"
          ? "Vista demo"
          : "演示预览"
      : locale === "en"
        ? "Visitor preview"
        : locale === "es"
          ? "Vista visitante"
          : "访客预览";

  async function refreshRecoveryBrief(force = false) {
    if (!force && recoveryBriefKeyRef.current === recoveryBriefRequestKey && recoveryBrief) {
      return;
    }

    if (!force && recoveryBriefLoading && recoveryBriefKeyRef.current === recoveryBriefRequestKey) {
      return;
    }

    recoveryBriefKeyRef.current = recoveryBriefRequestKey;
    setRecoveryBriefLoading(true);
    setRecoveryBriefError("");

    try {
      const result = await requestRecoveryBrief({
        locale,
        snapshot: activeSnapshot,
        evaluation: {
          status: evaluation.status,
          statusLabel: evaluation.statusLabel,
          recoveryScore: evaluation.recoveryScore,
          reasons: evaluation.reasons,
          message: evaluation.message,
          nextActionTitle: evaluation.nextActionTitle,
          nextActionDetail: evaluation.nextActionDetail,
          focusLabel: evaluation.focusLabel,
        },
        context: {
          scenarioName: isCustomMode ? evaluation.statusLabel : activeScenario.name,
          careContactsCount: careContacts.length,
          bluetoothState,
          liveHeartRate,
        },
      });

      setRecoveryBrief(result);
    } catch (error) {
      setRecoveryBriefError(
        error instanceof Error
          ? error.message
          : locale === "en"
            ? "Failed to load the AI recovery brief."
            : locale === "es"
              ? "No se pudo cargar el brief de recuperación."
              : "AI 恢复简报加载失败。",
      );
    } finally {
      setRecoveryBriefLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "dashboard" && view !== "support") {
      return;
    }

    void refreshRecoveryBrief();
  }, [view, recoveryBriefRequestKey]);

  return (
    <div className={`app-shell mode-${liveMode.key}`}>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">EasePulse 息伴 · Recovery OS</p>
          <h1>{heroTitle}</h1>
          <p className="topbar-lede">{heroLede}</p>
          <div className="hero-actions">
            <button type="button" className={locale === "zh" ? "chip chip-solid" : "chip"} onClick={() => setLocale("zh")}>
              中文
            </button>
            <button type="button" className={locale === "en" ? "chip chip-solid" : "chip"} onClick={() => setLocale("en")}>
              English
            </button>
            <button type="button" className={locale === "es" ? "chip chip-solid" : "chip"} onClick={() => setLocale("es")}>
              Español
            </button>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className={previewMode === "guest" ? "chip chip-solid" : "chip"}
              onClick={() => setPreviewMode("guest")}
            >
              {locale === "en" ? "Visitor Preview" : locale === "es" ? "Vista visitante" : "访客预览"}
            </button>
            <button
              type="button"
              className={previewMode === "demo" ? "chip chip-solid" : "chip"}
              onClick={() => setPreviewMode("demo")}
            >
              {locale === "en" ? "Demo Preview" : locale === "es" ? "Vista demo" : "演示预览"}
            </button>
          </div>
        </div>

        <div className="status-panel">
          <a
            className="status-pill status-pill-link"
            href="https://easepluse.zeabur.app/"
            rel="noreferrer"
            target="_blank"
          >
            <span>{locale === "en" ? "Live site" : locale === "es" ? "Sitio en vivo" : "线上站点"}</span>
            <strong>easepluse.zeabur.app</strong>
          </a>
          <a
            className="status-pill status-pill-link"
            href="https://github.com/jessicaruan6688-byte/easepluse"
            rel="noreferrer"
            target="_blank"
          >
            <span>GitHub</span>
            <strong>{locale === "en" ? "Auto-deploy source repo" : locale === "es" ? "Repositorio fuente del auto-deploy" : "自动部署源仓库"}</strong>
          </a>
          <div className="status-pill">
            <span>{locale === "en" ? "Access" : locale === "es" ? "Acceso" : "访问状态"}</span>
            <strong>{authStatusLabel}</strong>
          </div>
          <div className="status-pill">
            <span>{locale === "en" ? "Preview" : locale === "es" ? "Vista" : "当前预览"}</span>
            <strong>{previewModeLabel}</strong>
          </div>
          <div className="status-pill">
            <span>{locale === "en" ? "Device" : locale === "es" ? "Dispositivo" : "设备状态"}</span>
            <strong>
              {bluetoothState === "connected" && liveHeartRate !== null
                ? `${liveHeartRate} bpm`
                : getBluetoothLabel(bluetoothState, locale)}
            </strong>
          </div>
          {sessionUser ? (
            <button
              className="status-pill status-pill-button"
              type="button"
              onClick={() => void handleLogout()}
            >
              <span>{locale === "en" ? "Account" : locale === "es" ? "Cuenta" : "当前账号"}</span>
              <strong>{sessionUser.profile.fullName || sessionUser.email}</strong>
            </button>
          ) : (
            <button
              className="status-pill status-pill-button"
              type="button"
              disabled={!sessionReady}
              onClick={() => {
                setAuthScreen("register");
                setShowAuthGate(true);
              }}
            >
              <span>{locale === "en" ? "Session" : locale === "es" ? "Sesión" : "会话操作"}</span>
              <strong>
                {sessionReady
                  ? locale === "en"
                    ? "Sign up / Login"
                    : locale === "es"
                      ? "Registro / Entrar"
                      : "注册 / 登录"
                  : locale === "en"
                    ? "Loading..."
                    : locale === "es"
                      ? "Cargando..."
                      : "加载中..."}
              </strong>
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <section className="brand-card">
            <div className="pulse-mark">EP</div>
            <div>
              <h2>{locale === "en" ? "EasePulse" : locale === "es" ? "EasePulse" : "息伴"}</h2>
              <p>
                {locale === "en"
                  ? "A buffer for high-pressure adults to be seen first, then held."
                  : locale === "es"
                    ? "Un espacio amortiguador para personas bajo alta presión: primero ser vistas, luego sostenidas."
                    : "给高压成年人留一个先被看见、再被接住的缓冲区。"}
              </p>
            </div>
          </section>

          <nav className="nav-list" aria-label={locale === "en" ? "Navigation" : locale === "es" ? "Navegación" : "页面导航"}>
            {navItems.map((item) => (
              <button
                key={item.key}
                className={item.key === view ? "nav-item active" : "nav-item"}
                onClick={() => setView(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {previewMode === "demo" ? (
            <section className="scenario-card">
              <div className="split-header split-header-tight">
                <div>
                  <p className="section-title">
                    {locale === "en" ? "Demo scenarios" : locale === "es" ? "Escenarios demo" : "演示场景"}
                  </p>
                  <p className="section-subtitle">
                    {locale === "en"
                      ? "Scenario switching only appears in demo preview."
                      : locale === "es"
                        ? "El cambio de escenarios solo aparece en la vista demo."
                        : "只有演示预览会显示场景切换。"}
                  </p>
                </div>
                <div className="chip">
                  {isCustomMode
                    ? locale === "en"
                      ? "Real input"
                      : locale === "es"
                        ? "Entrada real"
                        : "真实录入中"
                    : locale === "en"
                      ? "Demo data"
                      : locale === "es"
                        ? "Datos demo"
                        : "演示数据"}
                </div>
              </div>

              <div className="scenario-list">
                {localizedScenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    className={
                      scenario.id === scenarioId ? "scenario-button active" : "scenario-button"
                    }
                    type="button"
                    onClick={() => {
                      setScenarioId(scenario.id);
                      setIsCustomMode(false);
                      setPreviewMode("demo");
                      setView("dashboard");
                    }}
                  >
                    <strong>{scenario.name}</strong>
                    <small>{scenarioTags[scenario.id] ?? scenario.name}</small>
                  </button>
                ))}
              </div>

              <div className="scenario-current-note">
                <span>{locale === "en" ? "Current scene" : locale === "es" ? "Escena actual" : "当前场景"}</span>
                <p>{activeScenario.subtitle}</p>
              </div>
            </section>
          ) : (
            <section className="scenario-card visitor-side-card">
              <div className="visitor-side-frame">
                <img src={calmScene.image} alt={calmScene.title} loading="lazy" />
              </div>
              <div className="scenario-current-note">
                <span>{locale === "en" ? "Visitor preview" : locale === "es" ? "Vista visitante" : "访客预览"}</span>
                <p>
                  {locale === "en"
                    ? "Start with quieter visuals and product atmosphere first, then enter the demo when you want to see the stress flow."
                    : locale === "es"
                      ? "Empieza con una atmósfera más tranquila y entra en la demo cuando quieras ver el flujo de estrés."
                      : "先看更安静的画面和产品气质，需要时再进入完整演示。"}
                </p>
              </div>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setPreviewMode("demo");
                  setView("overview");
                }}
              >
                {locale === "en" ? "Enter demo preview" : locale === "es" ? "Entrar en vista demo" : "进入演示预览"}
              </button>
            </section>
          )}
        </aside>

        <section className="content">
          {view === "overview" && (
            <div className="page-grid">
              {previewMode === "guest" ? (
                <>
                  <section className="card visitor-hero-card">
                    <div className="visitor-hero-copy">
                      <p className="section-title">{locale === "en" ? "Visitor preview" : locale === "es" ? "Vista visitante" : "访客预览"}</p>
                      <h2>
                        {locale === "en"
                          ? "A softer first look before the stress demo begins."
                          : locale === "es"
                            ? "Una primera mirada más suave antes de que empiece la demo."
                            : "先看一眼更静、更轻的页面，再决定是否进入演示。"}
                      </h2>
                      <p className="section-subtitle">
                        {locale === "en"
                          ? "This version keeps the page quiet: serene imagery, real links, and one obvious path into the live product flow."
                          : locale === "es"
                            ? "Esta versión se mantiene tranquila: imágenes serenas, enlaces reales y una ruta clara hacia la demo."
                            : "这一层先保持安静：看图、看真实入口、看产品气质，需要时再进入完整演示链路。"}
                      </p>
                      <div className="hero-actions">
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => {
                            setPreviewMode("demo");
                            setView("overview");
                          }}
                        >
                          {locale === "en" ? "Enter demo preview" : locale === "es" ? "Entrar en vista demo" : "进入演示预览"}
                        </button>
                        <button type="button" className="button-secondary" onClick={() => setView("story")}>
                          {locale === "en" ? "Open story deck" : locale === "es" ? "Abrir story deck" : "打开 Story 二级页"}
                        </button>
                        <a className="button-secondary visitor-link-button" href="https://easepluse.zeabur.app/" rel="noreferrer" target="_blank">
                          {locale === "en" ? "Open live site" : locale === "es" ? "Abrir sitio real" : "打开线上站"}
                        </a>
                      </div>
                      <div className="visitor-step-grid">
                        <article className="visitor-step-card">
                          <span>{locale === "en" ? "Quiet entry" : locale === "es" ? "Entrada suave" : "静一点进入"}</span>
                          <strong>{locale === "en" ? "See the tone first" : locale === "es" ? "Mira primero el tono" : "先看页面气质"}</strong>
                          <p>{locale === "en" ? "The visitor view should feel restorative before it feels technical." : locale === "es" ? "La vista visitante debe sentirse reparadora antes que técnica." : "访客页先要让人放松，再让人理解功能。"}</p>
                        </article>
                        <article className="visitor-step-card">
                          <span>{locale === "en" ? "Real path" : locale === "es" ? "Ruta real" : "真实入口"}</span>
                          <strong>{locale === "en" ? "Everything clickable stays real" : locale === "es" ? "Todo lo clickable es real" : "所有入口都要真能点开"}</strong>
                          <p>{locale === "en" ? "Live site, story deck, and later the product demo are separate moves." : locale === "es" ? "Sitio real, story deck y demo del producto son pasos distintos." : "线上站、Story 页和产品演示要分成不同路径。"}</p>
                        </article>
                        <article className="visitor-step-card">
                          <span>{locale === "en" ? "Switch later" : locale === "es" ? "Cambia después" : "按需切换"}</span>
                          <strong>{locale === "en" ? "Demo starts only when you want it" : locale === "es" ? "La demo solo empieza cuando tú quieres" : "需要时再切到演示"}</strong>
                          <p>{locale === "en" ? "The pressure playback no longer has to dominate the first screen." : locale === "es" ? "La reproducción de presión ya no domina la primera pantalla." : "压力演示不再强行占据访客的第一屏。"}</p>
                        </article>
                      </div>
                    </div>

                    <div className="visitor-gallery">
                      <div className="visitor-gallery-main">
                        <img src={calmScene.image} alt={calmScene.title} loading="lazy" />
                      </div>
                      <div className="visitor-gallery-stack">
                        <div className="visitor-gallery-small">
                          <img src={homeResetScene.image} alt={homeResetScene.title} loading="lazy" />
                        </div>
                        <article className="visitor-quote-card">
                          <span>{locale === "en" ? "Atmosphere" : locale === "es" ? "Atmósfera" : "气质"}</span>
                          <strong>
                            {locale === "en"
                              ? "Gentle enough to lower the shoulders."
                              : locale === "es"
                                ? "Lo bastante suave como para bajar los hombros."
                                : "要柔和到让人先把肩膀放下来。"}
                          </strong>
                        </article>
                      </div>
                    </div>
                  </section>

                  <CommercialPathSection
                    locale={locale}
                    path={commercialPath}
                    onOpenBeta={() => {
                      setPreviewMode("demo");
                      setView("dashboard");
                    }}
                    onOpenPersonal={() => setView("support")}
                    onOpenTeam={() => setView("care")}
                  />

                  <section className="card overview-drilldown-card">
                    <div className="split-header">
                      <div>
                        <p className="section-title">{locale === "en" ? "Next step" : locale === "es" ? "Siguiente paso" : "下一步"}</p>
                        <p className="section-subtitle">
                          {locale === "en"
                            ? "Visitor preview stays lighter. Use the cards below to decide where to go next."
                            : locale === "es"
                              ? "La vista visitante se mantiene más ligera. Usa estas tarjetas para decidir a dónde ir."
                              : "访客预览保持更轻，下面这些入口再决定你下一步去哪里。"}
                        </p>
                      </div>
                    </div>
                    <div className="compact-nav-grid">
                      {storyDrilldowns.map((item) => (
                        <article key={item.title} className="drilldown-card">
                          <strong>{item.title}</strong>
                          <p>{item.body}</p>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => {
                              if (item.view === "dashboard") {
                                setPreviewMode("demo");
                              }
                              setView(item.view);
                            }}
                          >
                            {locale === "en" ? "Open" : locale === "es" ? "Abrir" : "打开"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="card launch-hero-card launch-hero-card-compact">
                    <div className="launch-hero-copy">
                      <div className="split-header">
                        <div>
                          <p className="section-title">{locale === "en" ? "Demo preview" : locale === "es" ? "Vista demo" : "演示预览"}</p>
                          <h2>
                            {locale === "en"
                              ? "Show stress, recovery, and support in one visible chain."
                              : locale === "es"
                                ? "Muestra estrés, recuperación y apoyo en una sola cadena visible."
                                : "把压力、恢复和支持转交放到一条清楚的链路里。"}
                          </h2>
                          <p className="section-subtitle">
                            {locale === "en"
                              ? "This layer is for judges and product review. It keeps the risk rise, intervention, and next-step routing on screen."
                              : locale === "es"
                                ? "Esta capa es para jurado y revisión del producto. Mantiene en pantalla el ascenso del riesgo, la intervención y el desvío posterior."
                                : "这一层专门给演示和评审看，会把风险上升、干预动作和后续分流留在屏幕上。"}
                          </p>
                        </div>
                        <div className="chip chip-solid">
                          {sessionUser
                            ? locale === "en"
                              ? "Workspace connected"
                              : locale === "es"
                                ? "Espacio conectado"
                                : "工作台已连接"
                            : locale === "en"
                              ? "Demo mode"
                              : locale === "es"
                                ? "Modo demo"
                                : "演示模式"}
                        </div>
                      </div>

                      <div className="hero-actions">
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() => {
                            setPreviewMode("demo");
                            setView("dashboard");
                          }}
                        >
                          {locale === "en" ? "Open today's state" : locale === "es" ? "Abrir estado de hoy" : "打开今日状态"}
                        </button>
                        <button type="button" className="button-secondary" onClick={() => setView("story")}>
                          {locale === "en" ? "Open story deck" : locale === "es" ? "Abrir story deck" : "打开 Story 二级页"}
                        </button>
                        <button type="button" className="button-secondary" onClick={() => setPreviewMode("guest")}>
                          {locale === "en" ? "Back to visitor view" : locale === "es" ? "Volver a vista visitante" : "回到访客预览"}
                        </button>
                      </div>

                      <div className="launch-metric-grid">
                        <article className="launch-metric-card">
                          <span>{locale === "en" ? "Evidence" : locale === "es" ? "Evidencia" : "真实证据"}</span>
                          <strong>
                            {locale === "en"
                              ? `${screenshotEvidence.length} proof shots`
                              : locale === "es"
                                ? `${screenshotEvidence.length} pruebas reales`
                                : `${screenshotEvidence.length} 张截图`}
                          </strong>
                          <small>
                            {locale === "en"
                              ? "Keep screenshots and references ready for judge questions."
                              : locale === "es"
                                ? "Mantén listas las capturas y referencias para las preguntas del jurado."
                                : "把截图证据和参考入口都留给评委追问。"}
                          </small>
                        </article>
                        <article className="launch-metric-card">
                          <span>{locale === "en" ? "Main loop" : locale === "es" ? "Bucle principal" : "产品主闭环"}</span>
                          <strong>{locale === "en" ? "Recovery first" : locale === "es" ? "Recuperación primero" : "恢复优先"}</strong>
                          <small>
                            {locale === "en"
                              ? "Make overload visible, run one reset, then hand off to real support."
                              : locale === "es"
                                ? "Haz visible la sobrecarga, ejecuta un reset y luego deriva a apoyo real."
                                : "先看见透支，做一个恢复动作，再交给真实支持网络。"}
                          </small>
                        </article>
                        <article className="launch-metric-card">
                          <span>{locale === "en" ? "Wearables" : locale === "es" ? "Wearables" : "设备支持"}</span>
                          <strong>{locale === "en" ? "Huawei, Xiaomi, Apple Watch+" : locale === "es" ? "Huawei, Xiaomi, Apple Watch+" : "华为、小米、Apple Watch+"}</strong>
                          <small>
                            {locale === "en"
                              ? "Device details stay one layer deeper so the demo can stay focused."
                              : locale === "es"
                                ? "Los detalles del dispositivo quedan una capa más abajo para mantener el foco de la demo."
                                : "设备细节放在下一层，演示首页只保留主线。"}
                          </small>
                        </article>
                      </div>
                    </div>

                    <div className="featured-scene-card">
                      <div className="featured-scene-frame">
                        <img src={featuredScene.image} alt={featuredScene.title} loading="lazy" />
                      </div>
                      <div className="featured-scene-copy">
                        <span>{locale === "en" ? "Demo scene" : locale === "es" ? "Escena demo" : "演示场景"}</span>
                        <strong>{featuredScene.title}</strong>
                        <p>{featuredScene.body}</p>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => setView(featuredScene.targetView)}
                        >
                          {locale === "en"
                            ? "Open scene page"
                            : locale === "es"
                              ? "Abrir página de escena"
                              : "打开场景页"}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="card hero-card pitch-card-shell">
                    <PitchDemo
                      heartRate={demoHeartRate}
                      highlights={judgeHighlights}
                      interventionVisible={demoInterventionVisible}
                      isSimulating={isSimulatingStress}
                      locale={locale}
                      onOpenSupport={() => {
                        startBreathing();
                        setView("support");
                      }}
                      onOpenStory={() => setView("story")}
                      onReset={resetStressSimulation}
                      onSimulate={startStressSimulation}
                      progress={simulationProgress}
                      riskScore={demoRiskScore}
                      sleepHours={demoSleepHours}
                      stage={demoStage}
                    />
                  </section>

                  <CommercialPathSection
                    locale={locale}
                    path={commercialPath}
                    onOpenBeta={() => {
                      setPreviewMode("demo");
                      setView("dashboard");
                    }}
                    onOpenPersonal={() => setView("support")}
                    onOpenTeam={() => setView("care")}
                  />

                  <section className="card overview-drilldown-card">
                    <div className="split-header">
                      <div>
                        <p className="section-title">{locale === "en" ? "Next step" : locale === "es" ? "Siguiente paso" : "下一步"}</p>
                        <p className="section-subtitle">
                          {locale === "en"
                            ? "After the demo, these pages answer the deeper product questions."
                            : locale === "es"
                              ? "Después de la demo, estas páginas responden a las preguntas más profundas del producto."
                              : "演示看完后，再进入这些页面回答更深一层的问题。"}
                        </p>
                      </div>
                    </div>
                    <div className="compact-nav-grid">
                      {storyDrilldowns.map((item) => (
                        <article key={item.title} className="drilldown-card">
                          <strong>{item.title}</strong>
                          <p>{item.body}</p>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setView(item.view)}
                          >
                            {locale === "en" ? "Open" : locale === "es" ? "Abrir" : "打开"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {view === "story" && (
            <div className="page-grid">
              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Story deck" : locale === "es" ? "Story deck" : "Story 二级页"}</p>
                    <h2>
                      {locale === "en"
                        ? "The long explanation stays here, not on the homepage."
                        : locale === "es"
                          ? "La explicación larga se queda aquí y ya no presiona la home."
                          : "长说明放在这里，不再全部堆在首页。"}
                    </h2>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "This page holds the screenshot proof, support handoff logic, product layers, references, and deployment links."
                        : locale === "es"
                          ? "Aquí viven las capturas de prueba, la lógica de relevo, las capas de producto, las referencias y los enlaces reales."
                          : "这里集中放截图证据、支持转交逻辑、产品分层、竞品参考和部署链接。"}
                    </p>
                  </div>
                  <button type="button" className="button-secondary" onClick={() => setView("overview")}>
                    {locale === "en" ? "Back to overview" : locale === "es" ? "Volver al resumen" : "回到首页概览"}
                  </button>
                </div>

                <div className="pitch-storyboard">
                  <div className="pitch-media-board">
                    {screenshotEvidence.map((item) => (
                      <article key={`${item.source}-${item.metric}`} className="evidence-card">
                        <div className="evidence-image">
                          <img src={item.image} alt={item.alt} loading="lazy" />
                        </div>
                        <div className="evidence-copy">
                          <span>{item.source}</span>
                          <strong>{item.metric}</strong>
                          <b>{item.value}</b>
                          <p>{item.note}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="journey-board">
                    {supportJourney.map((item) => (
                      <article key={item.step} className="journey-card">
                        <span>{item.step}</span>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card scene-gallery-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Real-life scenes" : locale === "es" ? "Escenas reales" : "真实生活场景"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "These lifestyle photos now live in the Story page instead of stretching the homepage."
                        : locale === "es"
                          ? "Estas fotos reales ahora viven en Story y ya no alargan la home."
                          : "这些真实生活图现在放到 Story 页，不再继续把首页拉长。"}
                    </p>
                  </div>
                </div>
                <div className="scene-grid">
                  {lifestyleScenes.map((item) => (
                    <article key={item.id} className="scene-card">
                      <div className="scene-image-frame">
                        <img src={item.image} alt={item.title} loading="lazy" />
                      </div>
                      <div className="scene-card-copy">
                        <span>{locale === "en" ? "Scenario" : locale === "es" ? "Escenario" : "场景"}</span>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                        <div className="scene-card-footer">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setView(item.targetView)}
                          >
                            {locale === "en" ? "Open" : locale === "es" ? "Abrir" : "打开"}
                          </button>
                          <a
                            className="scene-credit"
                            href={item.creditHref}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {item.credit}
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Real entry points" : locale === "es" ? "Entradas reales" : "真实入口"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "These links really open. They are no longer just shapes that look clickable."
                        : locale === "es"
                          ? "Estos enlaces se pueden abrir de verdad. Ya no son solo botones falsos."
                          : "这些都是真正能点开的链接，不再只是视觉上的“像按钮”。"}
                    </p>
                  </div>
                </div>

                <div className="quick-link-grid">
                  {quickLinks.map((item) => (
                    <a
                      key={item.label}
                      className="quick-link-card"
                      href={item.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="link-badge">{item.badge}</span>
                      <strong>{item.label}</strong>
                      <p>{item.note}</p>
                      <span className="link-arrow">{locale === "en" ? "Open" : locale === "es" ? "Abrir" : "打开"}</span>
                    </a>
                  ))}
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Reference products" : locale === "es" ? "Referencias de producto" : "竞品参考"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "This version does not copy one competitor. It borrows recovery logic, trusted sharing, and gentle interaction from different references."
                        : locale === "es"
                          ? "Esta versión no copia a un solo competidor. Toma referencias separadas de lógica de recuperación, compartición confiable e interacción amable."
                          : "这一版不是抄一个竞品，而是分别借鉴恢复逻辑、可信共享和温和交互。"}
                    </p>
                  </div>
                </div>

                <div className="reference-grid">
                  {referenceLinks.map((item) => (
                    <a
                      key={item.name}
                      className="reference-card"
                      href={item.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="reference-tag">{item.tag}</span>
                      <h3>{item.name}</h3>
                      <p>{item.vibe}</p>
                      <small>{item.takeaway}</small>
                    </a>
                  ))}
                </div>
              </section>

              <section className="card metrics-strip">
                <div>
                  <span>{locale === "en" ? "Growth hook" : locale === "es" ? "Gancho de crecimiento" : "增长买点"}</span>
                  <strong>
                    {locale === "en"
                      ? "Care-circle invites + anonymous support backfill"
                      : locale === "es"
                        ? "Invitación al círculo de cuidado + apoyo anónimo de respaldo"
                        : "关怀圈邀请 + 匿名支持补位"}
                  </strong>
                </div>
                <div>
                  <span>{locale === "en" ? "Safety boundary" : locale === "es" ? "Límite de seguridad" : "安全边界"}</span>
                  <strong>
                    {locale === "en"
                      ? "Strangers never see danger states"
                      : locale === "es"
                        ? "Las personas desconocidas nunca ven estados de peligro"
                        : "陌生人看不到危险状态"}
                  </strong>
                </div>
                <div>
                  <span>{locale === "en" ? "Wearable path" : locale === "es" ? "Ruta wearable" : "设备路径"}</span>
                  <strong>
                    {locale === "en"
                      ? "Companion apps first, native iOS bridge next"
                      : locale === "es"
                        ? "Primero apps compañeras, luego puente nativo en iOS"
                        : "先 companion app，再补 iOS 原生桥"}
                  </strong>
                </div>
              </section>

              <section className="card note-grid">
                {designNotes.map((item) => (
                  <article key={item.title} className="note-card">
                    <p className="section-title">{item.title}</p>
                    <p>{item.body}</p>
                  </article>
                ))}
              </section>
            </div>
          )}

          {view === "connect" && (
            <div className="page-grid">
              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Data bridge path" : locale === "es" ? "Ruta del puente de datos" : "数据桥接路径"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "This separates what already works, what should land after the demo, and what we should not pretend is already complete."
                        : locale === "es"
                          ? "Aquí se separa lo que ya funciona, lo que va después del demo y lo que no debemos fingir que ya está resuelto."
                          : "现在把真实能做、赛后再补、以及不该假装已经完成的部分拆开写清楚。"}
                    </p>
                  </div>
                  <div className="chip chip-solid">{getBluetoothLabel(bluetoothState, locale)}</div>
                </div>

                <div className="bridge-grid">
                  <article className="bridge-card success">
                    <span>01</span>
                    <h3>
                      {locale === "en"
                        ? "Companion health apps"
                        : locale === "es"
                          ? "Apps de salud compañeras"
                          : "Companion 健康应用"}
                    </h3>
                    <p>
                      {locale === "en"
                        ? "Real wearable data can start from Huawei Health, Xiaomi Fitness, Apple Health, Garmin Connect, Fitbit, or another companion app."
                        : locale === "es"
                          ? "Los datos reales pueden empezar en Huawei Health, Xiaomi Fitness, Apple Health, Garmin Connect, Fitbit u otra app compañera."
                          : "真实手环数据可以从 Huawei Health、Xiaomi Fitness、Apple Health、Garmin Connect、Fitbit 或其他 companion app 开始。"}
                    </p>
                  </article>
                  <article className="bridge-card info">
                    <span>02</span>
                    <h3>{locale === "en" ? "Desktop browser Bluetooth" : locale === "es" ? "Bluetooth en navegador de escritorio" : "桌面浏览器蓝牙"}</h3>
                    <p>
                      {locale === "en"
                        ? "In supported browsers, you can try connecting a standard heart-rate broadcast so the web page responds in real time."
                        : locale === "es"
                          ? "En navegadores compatibles puedes intentar conectar una emisión cardíaca estándar para que la web responda en tiempo real."
                          : "在支持的浏览器里，可以尝试直接连接标准心率广播，让网页出现实时联动。"}
                    </p>
                  </article>
                  <article className="bridge-card caution">
                    <span>03</span>
                    <h3>{locale === "en" ? "Motion-sensor bridge" : locale === "es" ? "Puente de sensor de movimiento" : "动作传感桥接"}</h3>
                    <p>
                      {locale === "en"
                        ? "If a wrist gesture should switch modes, that still needs an Android or iOS native bridge. It should not be faked as pure web capability."
                        : locale === "es"
                          ? "Si un gesto de muñeca debe cambiar el modo, todavía hace falta un puente nativo en Android o iOS. No debe fingirse como capacidad puramente web."
                          : "如果要把“甩手”变成网页模式切换，需要 Android 或 iOS 原生桥，不应该伪装成纯网页能力。"}
                    </p>
                  </article>
                </div>
              </section>

              <section className="card bluetooth-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Desktop Bluetooth beta" : locale === "es" ? "Beta de Bluetooth en desktop" : "电脑蓝牙连接 Beta"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "If your Huawei Band, Xiaomi Band, or another device exposes standard heart-rate broadcast, you can try connecting it here. The page tone and mode will react to the incoming range."
                        : locale === "es"
                          ? "Si tu Huawei Band, Xiaomi Band u otro dispositivo expone la emisión cardíaca estándar, puedes intentar conectarlo aquí. El tono y el modo de la página reaccionarán al rango recibido."
                          : "如果你的华为手环、小米手环或其他设备开启了标准心率广播，这里可以直接尝试连接。连接后，网页色调和模式会随心率区间变化。"}
                    </p>
                  </div>
                  <div className="chip">
                    {connectedDeviceName ||
                      (locale === "en"
                        ? "Waiting for device"
                        : locale === "es"
                          ? "Esperando dispositivo"
                          : "等待选择设备")}
                  </div>
                </div>

                <div className="bluetooth-grid">
                  <article className="live-metric-card">
                    <span>{locale === "en" ? "Live heart rate" : locale === "es" ? "Frecuencia en vivo" : "实时心率"}</span>
                    <strong>{liveHeartRate ?? "--"}</strong>
                    <small>
                      {liveHeartRate !== null
                        ? "bpm"
                        : locale === "en"
                          ? "No heart-rate reading yet"
                          : locale === "es"
                            ? "Aún no llega lectura cardíaca"
                            : "尚未接收到心率数据"}
                    </small>
                  </article>
                  <article className={`mode-card mode-card-${liveMode.key}`}>
                    <span>{locale === "en" ? "Live page mode" : locale === "es" ? "Modo vivo de la página" : "页面联动模式"}</span>
                    <strong>{liveMode.label}</strong>
                    <p>{liveMode.detail}</p>
                    <small>
                      {lastSignalAt
                        ? locale === "en"
                          ? `Last update ${lastSignalAt}`
                          : locale === "es"
                            ? `Última actualización ${lastSignalAt}`
                            : `最后更新 ${lastSignalAt}`
                        : bluetoothMessage}
                    </small>
                  </article>
                </div>

                <div className="hero-actions">
                  <button
                    type="button"
                    className="button-primary"
                    disabled={bluetoothState === "connecting"}
                    onClick={() => void connectBand()}
                  >
                    {bluetoothState === "connecting"
                      ? locale === "en"
                        ? "Requesting device..."
                        : locale === "es"
                          ? "Solicitando dispositivo..."
                          : "请求设备中..."
                      : locale === "en"
                        ? "Connect heart-rate broadcast"
                        : locale === "es"
                          ? "Conectar emisión cardíaca"
                          : "连接心率广播"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={bluetoothState !== "connected"}
                    onClick={() => void disconnectBand()}
                  >
                    {locale === "en" ? "Disconnect Bluetooth" : locale === "es" ? "Desconectar Bluetooth" : "断开蓝牙"}
                  </button>
                </div>

                <ul className="bullet-list">
                  {bluetoothChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <div className="doc-link-row">
                  <a
                    className="doc-link"
                    href="https://consumer.huawei.com/lk/support/content/en-us15827504/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {locale === "en" ? "Huawei HR broadcast guide" : locale === "es" ? "Guía de emisión cardíaca de Huawei" : "华为官方心率广播说明"}
                  </a>
                  <a
                    className="doc-link"
                    href="https://developer.huawei.com/consumer/en/doc/distribution/service/health-kit-overview-0000001077085579"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {locale === "en" ? "Huawei Health Kit" : locale === "es" ? "Huawei Health Kit" : "华为 Health Kit"}
                  </a>
                  <a
                    className="doc-link"
                    href="https://developer.huawei.com/consumer/en/doc/distribution/service/wear-engine-introduction-0000001051006053"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Huawei Wear Engine
                  </a>
                </div>
              </section>

              <section className="card upload-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Upload real screenshots" : locale === "es" ? "Subir capturas reales" : "上传真实截图"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "Sleep, heart-rate, and stress screenshots stay in the flow. They are still the most stable proof of authenticity for demo and judging."
                        : locale === "es"
                          ? "Las capturas de sueño, frecuencia cardíaca y estrés siguen aquí. Siguen siendo la prueba más estable de autenticidad para demo y jurado."
                          : "睡眠、心率、压力三类截图依然保留。这是比赛和评审时最稳妥的真实性证明。"}
                    </p>
                  </div>
                  <div className="chip">
                    {locale === "en"
                      ? `${screenshotCount}/3 uploaded`
                      : locale === "es"
                        ? `${screenshotCount}/3 subidas`
                        : `${screenshotCount}/3 已上传`}
                  </div>
                </div>

                <div className="upload-grid">
                  {(
                    [
                      ["sleep", locale === "en" ? "Sleep screenshot" : locale === "es" ? "Captura de sueño" : "睡眠截图"],
                      ["heart", locale === "en" ? "Heart-rate screenshot" : locale === "es" ? "Captura cardíaca" : "心率截图"],
                      ["stress", locale === "en" ? "Stress screenshot" : locale === "es" ? "Captura de estrés" : "压力截图"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="upload-box">
                      <span>{label}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleFileUpload(key, event)}
                      />
                      {uploads[key] ? (
                        <img src={uploads[key] ?? ""} alt={label} />
                      ) : (
                        <div className="upload-placeholder">
                          {locale === "en" ? "Click to import" : locale === "es" ? "Haz clic para importar" : "点击导入截图"}
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </section>

              <section className="card form-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Enter today's key signals" : locale === "es" ? "Introduce las señales clave de hoy" : "录入今天的关键指标"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "For the demo, manual bridging comes first. The product loop stays real without pretending auto-sync is already finished."
                        : locale === "es"
                          ? "Para el demo, primero va el puente manual. El ciclo del producto sigue siendo real sin fingir que el auto-sync ya está resuelto."
                          : "比赛版先走人工桥接，产品逻辑保持真实闭环，不用假装“自动同步”已经完成。"}
                    </p>
                  </div>
                  <button type="button" className="button-primary" onClick={applyCustomMode}>
                    {locale === "en" ? "Apply to my state" : locale === "es" ? "Aplicar a mi estado" : "应用到我的状态"}
                  </button>
                </div>

                <div className="form-grid">
                  <label>
                    {locale === "en" ? "Sleep hours" : locale === "es" ? "Horas de sueño" : "睡眠时长（小时）"}
                    <input
                      type="number"
                      min="0"
                      max="12"
                      step="0.1"
                      value={customSnapshot.sleepHours}
                      onChange={(event) => handleNumberChange("sleepHours", event)}
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Sleep score" : locale === "es" ? "Puntuación del sueño" : "睡眠评分"}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customSnapshot.sleepScore}
                      onChange={(event) => handleNumberChange("sleepScore", event)}
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Resting heart rate" : locale === "es" ? "Frecuencia en reposo" : "静息心率"}
                    <input
                      type="number"
                      min="40"
                      max="120"
                      value={customSnapshot.restingHeartRate}
                      onChange={(event) => handleNumberChange("restingHeartRate", event)}
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Baseline resting heart rate" : locale === "es" ? "Frecuencia basal en reposo" : "个人基线静息心率"}
                    <input
                      type="number"
                      min="40"
                      max="120"
                      value={customSnapshot.baselineRestingHeartRate}
                      onChange={(event) =>
                        handleNumberChange("baselineRestingHeartRate", event)
                      }
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Stress score" : locale === "es" ? "Puntuación de estrés" : "压力值"}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customSnapshot.stressLevel}
                      onChange={(event) => handleNumberChange("stressLevel", event)}
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Active minutes" : locale === "es" ? "Minutos activos" : "活动分钟"}
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={customSnapshot.activeMinutes}
                      onChange={(event) => handleNumberChange("activeMinutes", event)}
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Sedentary hours" : locale === "es" ? "Horas sedentarias" : "久坐时长（小时）"}
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={customSnapshot.sedentaryHours}
                      onChange={(event) => handleNumberChange("sedentaryHours", event)}
                    />
                  </label>
                  <label>
                    {locale === "en" ? "Subjective feeling (1-5)" : locale === "es" ? "Sensación subjetiva (1-5)" : "主观感受（1-5）"}
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={customSnapshot.moodScore}
                      onChange={(event) => handleNumberChange("moodScore", event)}
                    />
                  </label>
                </div>

                <label className="notes-field">
                  {locale === "en" ? "Notes for today" : locale === "es" ? "Notas de hoy" : "今天的说明"}
                  <textarea
                    rows={3}
                    value={customSnapshot.notes}
                    onChange={(event) => updateSnapshot("notes", event.target.value)}
                  />
                </label>

                <div className="symptom-wrap">
                  <span>{locale === "en" ? "Any warning symptoms?" : locale === "es" ? "¿Hay síntomas de alerta?" : "是否存在不适"}</span>
                  <div className="symptom-grid">
                    {symptomOptions.map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        className={
                          customSnapshot.symptoms.includes(symptom)
                            ? "symptom-button active"
                            : "symptom-button"
                        }
                        onClick={() => toggleSymptom(symptom)}
                      >
                        {symptomLabels[symptom]}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {view === "dashboard" && (
            <div className="page-grid">
              <section className="card status-hero">
                <div>
                  <p className="eyebrow">
                    {isCustomMode
                      ? locale === "en"
                        ? "Your current state"
                        : locale === "es"
                          ? "Tu estado actual"
                          : "你的当前状态"
                      : activeScenario.name}
                  </p>
                  <h2>{evaluation.statusLabel}</h2>
                  <p className="lede">{evaluation.message}</p>
                </div>
                <div className="score-ring">
                  <div>
                    <strong>{evaluation.recoveryScore}</strong>
                    <span>{locale === "en" ? "Recovery" : locale === "es" ? "Recuperación" : "恢复分"}</span>
                  </div>
                </div>
              </section>

              <section className="card summary-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Why this result" : locale === "es" ? "Por qué salió este resultado" : "为什么是这个判断"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "The state is not decided by one metric alone. It comes from baseline drift plus your current subjective feeling."
                        : locale === "es"
                          ? "El estado no lo decide una sola métrica. Sale de la desviación respecto a tu línea base más tu sensación subjetiva actual."
                          : "状态不是由单个指标决定，而是由基线偏离 + 当下主观感受共同决定。"}
                    </p>
                  </div>
                  {isCustomMode ? (
                    <button type="button" className="button-secondary" onClick={resetCustomMode}>
                      {locale === "en" ? "Back to demo scenarios" : locale === "es" ? "Volver a escenarios demo" : "回到演示场景"}
                    </button>
                  ) : null}
                </div>
                <div className="reason-list">
                  {evaluation.reasons.map((reason) => (
                    <div key={reason} className="reason-item">
                      {reason}
                    </div>
                  ))}
                </div>
                <div className="metric-grid">
                  <MetricCard locale={locale} label="sleep" value={`${activeSnapshot.sleepHours} h`} />
                  <MetricCard
                    locale={locale}
                    label="restingHeartRate"
                    value={`${activeSnapshot.restingHeartRate} bpm`}
                    detail={
                      locale === "en"
                        ? `Baseline ${activeSnapshot.baselineRestingHeartRate} bpm`
                        : locale === "es"
                          ? `Base ${activeSnapshot.baselineRestingHeartRate} lpm`
                          : `基线 ${activeSnapshot.baselineRestingHeartRate} bpm`
                    }
                  />
                  <MetricCard locale={locale} label="stress" value={`${activeSnapshot.stressLevel}`} />
                  <MetricCard locale={locale} label="feeling" value={`${activeSnapshot.moodScore}/5`} />
                </div>
              </section>

              <section className="card action-card">
                <p className="section-title">{evaluation.focusLabel}</p>
                <h3>{evaluation.nextActionTitle}</h3>
                <p>{evaluation.nextActionDetail}</p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setView("support")}
                  >
                    {locale === "en" ? "Recover now" : locale === "es" ? "Recuperar ahora" : "立即恢复"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setView("trends")}
                  >
                    {locale === "en" ? "View trends" : locale === "es" ? "Ver tendencias" : "查看趋势"}
                  </button>
                </div>
              </section>

              <RecoveryBriefCard
                brief={recoveryBrief}
                error={recoveryBriefError}
                loading={recoveryBriefLoading}
                locale={locale}
                onRefresh={() => void refreshRecoveryBrief(true)}
              />

              <section className="card care-preview-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Who holds you today" : locale === "es" ? "Quién te sostiene hoy" : "今天谁会接住你"}</p>
                    <h3>{careHeadline}</h3>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "If you do not want to carry today alone, this flow pushes you toward trusted people first instead of stranger spectatorship."
                        : locale === "es"
                          ? "Si hoy no quieres cargar con todo sola, este flujo te lleva primero hacia personas de confianza y no hacia miradas anónimas."
                          : "如果你今天不想一个人扛，这里会优先把你推向可信的人，而不是陌生人的围观。"}
                    </p>
                  </div>
                  <div className="chip">
                    {locale === "en"
                      ? `${careContacts.length} care contacts`
                      : locale === "es"
                        ? `${careContacts.length} contactos de cuidado`
                        : `${careContacts.length} 位关怀联系人`}
                  </div>
                </div>
                <div className="care-preview-grid">
                  {careContacts.slice(0, 2).map((contact) => (
                    <article key={contact.id} className="care-mini-card">
                      <span>{contact.role}</span>
                      <strong>{contact.name}</strong>
                      <p>{contact.promise}</p>
                    </article>
                  ))}
                </div>
                <div className="hero-actions">
                  <button type="button" className="button-primary" onClick={() => setView("care")}>
                    {locale === "en" ? "Open care circle" : locale === "es" ? "Abrir círculo de cuidado" : "打开关怀圈"}
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("beacon")}>
                    {locale === "en" ? "Open anonymous support" : locale === "es" ? "Abrir apoyo anónimo" : "查看匿名支持"}
                  </button>
                </div>
              </section>
            </div>
          )}

          {view === "support" && (
            <div className="page-grid">
              <div className="support-layout">
                <section className="card breathing-card">
                  <p className="section-title">{locale === "en" ? "Immediate recovery action" : locale === "es" ? "Acción inmediata de recuperación" : "即时恢复动作"}</p>
                  <div className={isBreathing ? "breathing-visual active" : "breathing-visual"}>
                    <div className="breathing-core" />
                  </div>
                  <div className="timer-block">
                    <strong>{timer}s</strong>
                    <span>{locale === "en" ? "Inhale 4s, hold 2s, exhale 6s" : locale === "es" ? "Inhala 4s, sostén 2s, exhala 6s" : "吸气 4 秒，停 2 秒，呼气 6 秒"}</span>
                  </div>
                  <div className="hero-actions">
                    <button type="button" className="button-primary" onClick={startBreathing}>
                      {locale === "en" ? "Start 90-second breath" : locale === "es" ? "Empezar respiración de 90 segundos" : "开始 90 秒呼吸"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        setSupportResult(
                          locale === "en"
                            ? "Breathing was skipped. At least stand up and walk for 3 minutes."
                            : locale === "es"
                              ? "Se omitió la respiración. Al menos levántate y camina 3 minutos."
                              : "已经跳过呼吸练习，建议至少起身走 3 分钟。",
                        )
                      }
                    >
                      {locale === "en" ? "Skip and move first" : locale === "es" ? "Omitir y moverte primero" : "跳过，先走动"}
                    </button>
                  </div>
                </section>

                <section className="card coach-card">
                  <p className="section-title">{locale === "en" ? "Support copy" : locale === "es" ? "Mensaje de apoyo" : "支持文案"}</p>
                  <blockquote>
                    {evaluation.status === "safety"
                      ? locale === "en"
                        ? "The most important thing now is not to keep pushing, but to place yourself in trusted human care."
                        : locale === "es"
                          ? "Lo más importante ahora no es seguir aguantando, sino ponerte primero en manos de alguien de confianza."
                          : "你现在最重要的不是继续扛，而是先把自己交给可信任的人照看。"
                      : locale === "en"
                        ? "Your current state deserves to be taken seriously, but it does not need panic. Get your rhythm back first."
                        : locale === "es"
                          ? "Tu estado merece tomarse en serio, pero no necesita pánico. Primero recupera el ritmo."
                          : "你现在的状态值得被认真对待，但不需要用恐慌解决。先把节律找回来。"}
                  </blockquote>
                  <p className="support-result">{supportResult}</p>
                  <div className="feedback-row">
                    <button
                      type="button"
                      onClick={() =>
                        setSupportResult(
                          locale === "en"
                            ? "Feedback saved: a little better. Keep the next step low intensity."
                            : locale === "es"
                              ? "Comentario guardado: un poco mejor. Mantén el siguiente paso en baja intensidad."
                              : "反馈已记录：有好一些。下一步保持低强度节奏。",
                        )
                      }
                    >
                      {locale === "en" ? "A bit better" : locale === "es" ? "Un poco mejor" : "好一些"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupportResult(
                          locale === "en"
                            ? "Feedback saved: no major change. Try another 3-minute off-screen reset."
                            : locale === "es"
                              ? "Comentario guardado: casi sin cambios. Prueba otro reinicio de 3 minutos lejos de la pantalla."
                              : "反馈已记录：变化不大。建议再做一次 3 分钟离屏恢复。",
                        )
                      }
                    >
                      {locale === "en" ? "No change" : locale === "es" ? "Sin cambios" : "没变化"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupportResult(
                          locale === "en"
                            ? "Feedback saved: worse. Go to the safety page now instead of staying in normal calming flow."
                            : locale === "es"
                              ? "Comentario guardado: peor. Entra ahora en la página de seguridad en vez de seguir con el apoyo normal."
                              : "反馈已记录：更差。请进入安全边界页面，不建议继续普通安抚。",
                        )
                      }
                    >
                      {locale === "en" ? "Worse" : locale === "es" ? "Peor" : "更差"}
                    </button>
                  </div>
                </section>
              </div>

              <RecoveryBriefCard
                brief={recoveryBrief}
                compact
                error={recoveryBriefError}
                loading={recoveryBriefLoading}
                locale={locale}
                onRefresh={() => void refreshRecoveryBrief(true)}
              />

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Support network" : locale === "es" ? "Red de apoyo" : "支持网络"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "EasePulse does not stuff all support into one chat box. It routes you toward different people and support intensities based on the situation."
                        : locale === "es"
                          ? "EasePulse no mete todo el apoyo en un solo chat. Te dirige hacia distintas personas y distintos niveles de ayuda según la situación."
                          : "息伴不会把所有支持都塞进一个聊天框里，而是根据场景把你带向不同的人和不同的支持强度。"}
                    </p>
                  </div>
                </div>
                <div className="support-network-grid">
                  <article className="network-card">
                    <span>Care Circle</span>
                    <strong>{locale === "en" ? "Hand recovery off to people you know" : locale === "es" ? "Entrega la recuperación a gente conocida" : "把恢复动作交给熟人世界继续接住"}</strong>
                    <p>{locale === "en" ? "Best for contacting a partner, friend, family member, or work buddy so a note can become a call, companionship, or load relief." : locale === "es" ? "Ideal para contactar pareja, amistad, familia o compañero de trabajo y convertir una nota en llamada, compañía o alivio de carga." : "适合联系伴侣、朋友、家人或工作搭子，让留言变成电话、陪伴和减负。"}</p>
                    <button type="button" className="button-secondary" onClick={() => setView("care")}>
                      {locale === "en" ? "Go to care circle" : locale === "es" ? "Ir al círculo de cuidado" : "去关怀圈"}
                    </button>
                  </article>
                  <article className="network-card">
                    <span>Support Beacon</span>
                    <strong>{locale === "en" ? "Use anonymous rooms when you do not want to disturb people you know" : locale === "es" ? "Usa salas anónimas cuando no quieras molestar a conocidos" : "不想打扰熟人时，先进入匿名支持房间"}</strong>
                    <p>{locale === "en" ? "Useful for pre-meeting tension, cross-timezone overload, or late-night shutdown trouble, but never for danger broadcasting." : locale === "es" ? "Útil para tensión antes de reuniones, sobrecarga por husos horarios o dificultad para cortar de noche, pero nunca para difundir peligro." : "适合会前紧张、跨时区和深夜难以下线这类场景，但不承接危险广播。"}</p>
                    <button type="button" className="button-secondary" onClick={() => setView("beacon")}>
                      {locale === "en" ? "Go to anonymous support" : locale === "es" ? "Ir al apoyo anónimo" : "去匿名支持"}
                    </button>
                  </article>
                </div>
              </section>
            </div>
          )}

          {view === "care" && (
            <div className="page-grid">
              <section className="card care-hero-card">
                <p className="section-title">Care Circle</p>
                <h2>{careHeadline}</h2>
                <p className="lede">
                  {locale === "en"
                    ? "The care circle is not for exposing your raw data to everyone. It lets you choose who can actually do something when it matters."
                    : locale === "es"
                      ? "El círculo de cuidado no es para mostrar tus datos en bruto a todo el mundo. Te deja elegir quién puede hacer algo real cuando importa."
                      : "关怀圈不是让所有人看到你的原始数据，而是让你选择谁能在关键时刻真的做点什么。"}
                </p>
                <div className="hero-actions">
                  <button type="button" className="button-primary" onClick={() => setView("support")}>
                    {locale === "en" ? "Back to recovery" : locale === "es" ? "Volver a recuperación" : "回到恢复动作"}
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("safety")}>
                    {locale === "en" ? "View safety plan" : locale === "es" ? "Ver plan de seguridad" : "查看安全计划"}
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Sharing layers" : locale === "es" ? "Capas de compartición" : "共享分层"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "Safety and growth only work together when you decide who can see what before designing alerts and interaction."
                        : locale === "es"
                          ? "La seguridad y el crecimiento solo conviven si primero decides quién puede ver qué antes de diseñar alertas e interacción."
                          : "先分清谁能看什么，再设计提醒和互动，才能既安全又有增长价值。"}
                    </p>
                  </div>
                </div>
                <div className="sharing-grid">
                  {sharingNotes.map((item) => (
                    <article key={item.title} className="sharing-card">
                      <span>{item.title}</span>
                      <strong>{item.detail}</strong>
                    </article>
                  ))}
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "My care contacts" : locale === "es" ? "Mis contactos de cuidado" : "我的关怀联系人"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "For the demo, show the most real actions first: a note, a call, or load relief. System-level sharing and notifications can come later on iOS."
                        : locale === "es"
                          ? "Para el demo, primero muestra acciones realmente útiles: nota, llamada o alivio de carga. El compartir y las notificaciones del sistema llegarán después en iOS."
                          : "比赛版先展示最真实的动作：留言、电话、帮忙减负。后续 iOS 才接系统级共享与通知。"}
                    </p>
                  </div>
                </div>
                <div className="care-grid">
                  {careContacts.map((contact) => (
                    <CareContactCard
                      key={contact.id}
                      contact={contact}
                      locale={locale}
                      onAction={handleCareAction}
                      sharingTierLabels={sharingTierLabels}
                    />
                  ))}
                </div>
                <div className="action-log">{careAction}</div>
              </section>

              <section className="card growth-card-shell">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Why this grows" : locale === "es" ? "Por qué esto crece" : "为什么它会增长"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "Every care contact is not a passive observer. Real interaction gives them a reason to install the app, stay, and build a two-person habit."
                        : locale === "es"
                          ? "Cada contacto de cuidado no es un espectador pasivo. La interacción real le da motivo para instalar la app, quedarse y formar un hábito de dos personas."
                          : "每一个关怀联系人都不是被动围观者，而是会因为真实互动安装 App、留下来、形成双人关系的入口。"}
                    </p>
                  </div>
                </div>
                <div className="growth-grid">
                  {growthLoopSteps.map((item, index) => (
                    <article key={item.title} className="growth-step-card">
                      <span>{`0${index + 1}`}</span>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {view === "beacon" && (
            <div className="page-grid">
              <section className="card beacon-hero-card">
                <p className="section-title">Support Beacon</p>
                <h2>
                  {locale === "en"
                    ? "When you do not want to disturb people you know right away, but also should not carry it alone."
                    : locale === "es"
                      ? "Cuando no quieres molestar de inmediato a gente conocida, pero tampoco deberías cargar sola con todo."
                      : "当你不想立刻打扰熟人，也不该一个人扛。"}
                </h2>
                <p className="lede">
                  {locale === "en"
                    ? "Anonymous support rooms are not a danger-broadcast plaza. They are a transition layer that first receives active help-seeking, then gently returns the person to a real support network."
                    : locale === "es"
                      ? "Las salas de apoyo anónimo no son una plaza para difundir peligro. Son una capa de transición que recibe pedidos activos de ayuda y luego devuelve con suavidad a una red de apoyo real."
                      : "匿名支持房间不是危险广播广场，而是一个先承接主动求助、再把人温和送回真实支持网络的过渡层。"}
                </p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => handleBeaconAction(beaconRooms[0], "post")}
                  >
                    {locale === "en" ? "Start anonymous help request" : locale === "es" ? "Iniciar pedido de ayuda anónima" : "发起匿名求助"}
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("care")}>
                    {locale === "en" ? "Move to care circle" : locale === "es" ? "Ir al círculo de cuidado" : "转到关怀圈"}
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "Anonymous support rooms" : locale === "es" ? "Salas de apoyo anónimo" : "匿名支持房间"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "Rooms are organized by work and recovery situations, not disease labels, and they never expose sensitive raw data."
                        : locale === "es"
                          ? "Las salas se organizan por situaciones de trabajo y recuperación, no por etiquetas de enfermedad, y nunca muestran datos sensibles en bruto."
                          : "房间按工作与恢复场景划分，不按疾病标签划分，也不展示任何敏感原始数据。"}
                    </p>
                  </div>
                </div>
                <div className="beacon-grid">
                  {beaconRooms.map((room) => (
                    <BeaconRoomCard key={room.id} locale={locale} room={room} onAction={handleBeaconAction} />
                  ))}
                </div>
              </section>

              <section className="card guardrail-card">
                <p className="section-title">{locale === "en" ? "Anonymous support boundary" : locale === "es" ? "Límite del apoyo anónimo" : "匿名支持边界"}</p>
                <h3>{beaconGuardrail}</h3>
                <ul className="bullet-list">
                  <li>{locale === "en" ? "A user enters anonymous support only after actively starting it." : locale === "es" ? "Una persona entra al apoyo anónimo solo cuando lo inicia de forma activa." : "只有用户主动发起，才会进入匿名支持房间。"}</li>
                  <li>{locale === "en" ? "Phase one does not include private messages or raw physiological data display." : locale === "es" ? "La primera fase no abre mensajes privados ni muestra datos fisiológicos en bruto." : "第一阶段不开放私信和原始生理数据展示。"}</li>
                  <li>{locale === "en" ? "If danger symptoms or visible deterioration appear, the flow redirects only to the care circle and safety escalation." : locale === "es" ? "Si aparecen síntomas de peligro o un deterioro claro, el flujo se redirige solo al círculo de cuidado y a la escalada de seguridad." : "一旦出现危险症状或明显恶化，只转向关怀圈和安全升级。"}</li>
                </ul>
                <p className="support-result">{beaconAction}</p>
              </section>
            </div>
          )}

          {view === "trends" && (
            <div className="page-grid">
              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">{locale === "en" ? "7-day trend" : locale === "es" ? "Tendencia de 7 días" : "7 天趋势"}</p>
                    <p className="section-subtitle">
                      {locale === "en"
                        ? "EasePulse does not only look at today. It also checks whether you have been living in sustained overdraw."
                        : locale === "es"
                          ? "EasePulse no mira solo hoy. También observa si llevas varios días funcionando a puro desgaste."
                          : "息伴不只看今天，更看你是不是在持续透支。"}
                    </p>
                  </div>
                  <div className="chip">
                    {locale === "en"
                      ? `Source: ${isCustomMode ? "custom input" : activeScenario.name}`
                      : locale === "es"
                        ? `Fuente: ${isCustomMode ? "entrada personalizada" : activeScenario.name}`
                        : `数据源：${isCustomMode ? "自定义录入" : activeScenario.name}`}
                  </div>
                </div>
                <TrendChart history={activeHistory} locale={locale} />
              </section>

              <section className="card insight-card">
                <p className="section-title">{locale === "en" ? "This week's insight" : locale === "es" ? "Insight de esta semana" : "本周洞察"}</p>
                <h3>{buildInsight(activeHistory, locale)}</h3>
                <p>
                  {locale === "en"
                    ? "For the demo, screenshots and manual bridging protect credibility first. System-level sharing, trusted-contact alerts, and anonymous-support distribution can move to a native iOS bridge plus backend permissions next."
                    : locale === "es"
                      ? "En el demo, las capturas y el puente manual protegen primero la credibilidad. El compartir a nivel sistema, las alertas a contactos de confianza y la distribución del apoyo anónimo pueden pasar después a un puente nativo en iOS y una capa de permisos backend."
                      : "比赛版先用截图和手工桥接保证真实性；如果要做系统级共享、亲友提醒和匿名支持分发，下一阶段再上 iOS 原生桥和服务端权限层。"}
                </p>
              </section>
            </div>
          )}

          {view === "safety" && (
            <div className="page-grid">
              <section className="card safety-card">
                <p className="section-title">{locale === "en" ? "Safety boundary" : locale === "es" ? "Límite de seguridad" : "安全边界"}</p>
                <h2>{locale === "en" ? "EasePulse is not a medical diagnostic tool." : locale === "es" ? "EasePulse no es una herramienta de diagnóstico médico." : "息伴不是医疗诊断工具。"}</h2>
                <ul className="bullet-list">
                  <li>{locale === "en" ? "It does not promise to prevent sudden death and does not replace medical judgment." : locale === "es" ? "No promete prevenir muerte súbita ni sustituye el criterio médico." : "不会承诺预防猝死，不会替代医生判断。"}</li>
                  <li>{locale === "en" ? "If chest tightness, shortness of breath, strong dizziness, or other acute symptoms appear, stop the normal support flow." : locale === "es" ? "Si aparecen opresión en el pecho, falta de aire, mareo intenso u otros síntomas agudos, detén el flujo normal de apoyo." : "遇到胸闷、呼吸困难、明显头晕等急性不适，停止普通支持流程。"}</li>
                  <li>{locale === "en" ? "High-risk situations should prioritize emergency contacts, urgent care, or professional help." : locale === "es" ? "Las situaciones de alto riesgo deben priorizar contactos de emergencia, atención urgente o ayuda profesional." : "高风险场景优先提示联系紧急联系人、急救或专业帮助。"}</li>
                  <li>{locale === "en" ? "The stranger layer never sees your danger state and does not carry responsibility for risk judgment." : locale === "es" ? "La capa de desconocidos nunca ve tu estado de peligro ni asume la responsabilidad de evaluar el riesgo." : "陌生人世界不会看到你的危险状态，也不承担风险判断责任。"}</li>
                </ul>
              </section>

              <section className="card contact-card">
                <p className="section-title">{locale === "en" ? "Suggested safety escalation actions" : locale === "es" ? "Acciones sugeridas de escalada de seguridad" : "建议的安全升级动作"}</p>
                <div className="contact-grid">
                  <article>
                    <h3>{locale === "en" ? "Contact one real person now" : locale === "es" ? "Contacta ahora a una persona real" : "联系 1 位真人支持"}</h3>
                    <p>{locale === "en" ? "A partner, colleague, friend, or family member is enough. Do not keep pushing alone." : locale === "es" ? "Basta con pareja, colega, amistad o familiar. No sigas aguantando sola." : "比如伴侣、同事、朋友或家人，避免一个人继续硬扛。"}</p>
                  </article>
                  <article>
                    <h3>{locale === "en" ? "Stop working further" : locale === "es" ? "Detén el trabajo" : "停止继续工作"}</h3>
                    <p>{locale === "en" ? "Move attention from task output back to physiological safety. More output is not the right move here." : locale === "es" ? "Lleva la atención del rendimiento a la seguridad fisiológica. Seguir produciendo no es la jugada correcta aquí." : "把注意力从任务目标转回生理安全，不建议继续输出。"}</p>
                  </article>
                  <article>
                    <h3>{locale === "en" ? "Seek medical care when needed" : locale === "es" ? "Busca atención médica si hace falta" : "必要时及时就医"}</h3>
                    <p>{locale === "en" ? "If warning symptoms appear, do not explain them away as “just emotional.”" : locale === "es" ? "Si aparecen síntomas de alarma, no los expliques como “solo algo emocional”." : "如果出现危险症状，不要把它解释成“只是情绪问题”。"}</p>
                  </article>
                </div>
              </section>
            </div>
          )}
        </section>
      </main>

      {showAuthGate && !sessionUser ? (
        <div
          className="auth-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={locale === "en" ? "Sign up and login" : locale === "es" ? "Registro e inicio" : "注册和登录"}
        >
          <button
            type="button"
            className="auth-overlay-close"
            onClick={() => setShowAuthGate(false)}
          >
            {locale === "en" ? "Close" : locale === "es" ? "Cerrar" : "关闭"}
          </button>
          <AuthGate
            defaultScreen={authScreen}
            locale={locale}
            deliveryMode={deliveryMode}
            errorMessage={authError}
            infoMessage={authInfo}
            initialVerificationCode={prefilledVerificationCode}
            isLoading={!sessionReady || authSubmitting}
            onLogin={async (payload) => {
              setAuthSubmitting(true);
              try {
                await handleLogin(payload);
              } catch (error) {
                setAuthError(
                  error instanceof Error
                    ? error.message
                    : locale === "en"
                      ? "Login failed."
                      : locale === "es"
                        ? "Falló el inicio de sesión."
                        : "登录失败。",
                );
              } finally {
                setAuthSubmitting(false);
              }
            }}
            onRegister={async (payload) => {
              setAuthSubmitting(true);
              try {
                await handleRegister(payload);
              } catch (error) {
                setAuthError(
                  error instanceof Error
                    ? error.message
                    : locale === "en"
                      ? "Registration failed."
                      : locale === "es"
                        ? "Falló el registro."
                        : "注册失败。",
                );
              } finally {
                setAuthSubmitting(false);
              }
            }}
            onResend={async (email) => {
              setAuthSubmitting(true);
              try {
                await handleResend(email);
              } catch (error) {
                setAuthError(
                  error instanceof Error
                    ? error.message
                    : locale === "en"
                      ? "Resend failed."
                      : locale === "es"
                        ? "Falló el reenvío."
                        : "重新发送失败。",
                );
              } finally {
                setAuthSubmitting(false);
              }
            }}
            onVerify={async (payload) => {
              setAuthSubmitting(true);
              try {
                await handleVerify(payload);
              } catch (error) {
                setAuthError(
                  error instanceof Error
                    ? error.message
                    : locale === "en"
                      ? "Verification failed."
                      : locale === "es"
                        ? "Falló la verificación."
                        : "验证失败。",
                );
              } finally {
                setAuthSubmitting(false);
              }
            }}
            pendingEmail={pendingEmail}
            previewCode={previewCode}
          />
        </div>
      ) : null}
    </div>
  );
}

function PitchDemo({
  heartRate,
  highlights,
  interventionVisible,
  isSimulating,
  locale,
  onOpenSupport,
  onOpenStory,
  onReset,
  onSimulate,
  progress,
  riskScore,
  sleepHours,
  stage,
}: {
  heartRate: number;
  highlights: Array<{ title: string; body: string }>;
  interventionVisible: boolean;
  isSimulating: boolean;
  locale: Locale;
  onOpenSupport: () => void;
  onOpenStory: () => void;
  onReset: () => void;
  onSimulate: () => void;
  progress: number;
  riskScore: number;
  sleepHours: number;
  stage: { label: string; detail: string };
}) {
  const orbTone = getOrbTone(riskScore);
  const gaugeStyle = {
    "--gauge-angle": `${Math.max(18, riskScore * 3.6)}deg`,
  } as CSSProperties;

  return (
    <div className="pitch-layout">
      <div className="pitch-copy">
        <p className="eyebrow">
          {locale === "en" ? "iPhone-First Demo" : locale === "es" ? "Demo iPhone-first" : "iPhone 优先 Demo"}
        </p>
        <div className="pitch-media-intro pitch-media-intro-compact">
          <div className="pitch-media-heading">
            <p className="section-title">{locale === "en" ? "Judge demo" : locale === "es" ? "Demo para jurado" : "评委演示"}</p>
            <h2>
              {locale === "en"
                ? "One tap should raise stress and trigger the intervention."
                : locale === "es"
                  ? "Un toque debe subir el estrés y activar la intervención."
                  : "一键让压力上升，并触发 AI 干预。"}
            </h2>
            <p className="lede">
              {locale === "en"
                ? "This card stays short. Proof and references moved to Story."
                : locale === "es"
                  ? "Esta tarjeta se mantiene corta. Las pruebas y referencias ya viven en Story."
                  : "这张卡片只保留演示本身，证据和参考都移到 Story。"}
            </p>
          </div>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="button-primary"
            disabled={isSimulating}
            onClick={onSimulate}
          >
            {isSimulating
              ? locale === "en"
                ? "Simulating..."
                : locale === "es"
                  ? "Simulando..."
                  : "模拟中..."
              : locale === "en"
                ? "Simulate Stress"
                : locale === "es"
                  ? "Simular estrés"
                  : "模拟压力变化"}
          </button>
          <button type="button" className="button-secondary" onClick={onReset}>
            {locale === "en" ? "Reset Demo" : locale === "es" ? "Reiniciar demo" : "重置演示"}
          </button>
          <button type="button" className="button-secondary" onClick={onOpenStory}>
            {locale === "en" ? "Story" : locale === "es" ? "Story" : "Story"}
          </button>
        </div>

        <div className="pitch-chip-row">
          <span className="chip chip-solid">
            {locale === "en"
              ? "Demo Mode · Simulated Data"
              : locale === "es"
                ? "Modo demo · Datos simulados"
                : "演示模式 · 模拟数据"}
          </span>
          <span className="chip">
            {locale === "en" ? "Not Medical Advice" : locale === "es" ? "No es consejo médico" : "非医疗建议"}
          </span>
        </div>

        <div className="pitch-points">
          {highlights.map((item) => (
            <article key={item.title} className="pitch-point-card">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="phone-stage">
        <div className="phone-shell">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="phone-topline">
              <span>{locale === "en" ? "EasePulse Demo" : locale === "es" ? "Demo EasePulse" : "EasePulse 演示"}</span>
              <span>{stage.label}</span>
            </div>

            <div className="phone-score">
              <div className="phone-score-copy">
                <span>{locale === "en" ? "Emotional Risk Score" : locale === "es" ? "Puntuación de riesgo emocional" : "情绪风险分"}</span>
                <strong>{riskScore}</strong>
                <p>{stage.detail}</p>
              </div>
              <div className="emotion-orb-wrap">
                <div className={`emotion-orb orb-${orbTone}`} aria-hidden="true" />
              </div>
            </div>

            <div className="gauge-panel">
              <div className="gauge-ring" style={gaugeStyle}>
                <div className="gauge-core">
                  <strong>{riskScore}</strong>
                  <span>/100</span>
                </div>
              </div>

              <div className="gauge-side">
                <div className="mini-stat-card">
                  <span>{locale === "en" ? "Heart Rate" : locale === "es" ? "Frecuencia cardíaca" : "心率"}</span>
                  <strong>{heartRate} bpm</strong>
                  <small>{locale === "en" ? "rising in demo playback" : locale === "es" ? "subiendo durante el demo" : "演示播放中持续上升"}</small>
                </div>
                <div className="mini-stat-card">
                  <span>{locale === "en" ? "Sleep" : locale === "es" ? "Sueño" : "睡眠"}</span>
                  <strong>{sleepHours} h</strong>
                  <small>{locale === "en" ? "low baseline kept constant" : locale === "es" ? "línea base baja y constante" : "低睡眠基线保持不变"}</small>
                </div>
              </div>
            </div>

            <div className="timeline-demo-card">
              <div className="timeline-demo-header">
                <span>{locale === "en" ? "Stress Timeline" : locale === "es" ? "Línea de estrés" : "压力时间线"}</span>
                <small>{Math.round(progress * 100)}%</small>
              </div>
              <div className="timeline-bars">
                {demoTimelineCheckpoints.map((point, index) => {
                  const activated = progress >= index / (demoTimelineCheckpoints.length - 1);
                  return (
                    <div
                      key={point.label}
                      className={activated ? "timeline-bar active" : "timeline-bar"}
                    >
                      <div
                        className="timeline-bar-fill"
                        style={{ height: `${Math.max(28, point.risk)}%` }}
                      />
                      <strong>{point.heartRate}</strong>
                      <span>{point.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="phone-recovery-card">
              <div className="breathing-orbit active">
                <div className="breathing-orbit-core" />
              </div>
              <div>
                <span>{locale === "en" ? "Breathing 4-4-4" : locale === "es" ? "Respiración 4-4-4" : "呼吸 4-4-4"}</span>
                <p>{locale === "en" ? "Inhale 4s · Hold 4s · Exhale 4s" : locale === "es" ? "Inhala 4s · Sostén 4s · Exhala 4s" : "吸气 4 秒 · 停 4 秒 · 呼气 4 秒"}</p>
              </div>
            </div>

            {interventionVisible ? (
              <div className="intervention-sheet">
                <span>{locale === "en" ? "AI Intervention" : locale === "es" ? "Intervención IA" : "AI 干预"}</span>
                <strong>
                  {locale === "en"
                    ? "You don't have to push through this alone."
                    : locale === "es"
                      ? "No tienes que aguantar esto sola."
                      : "你不需要一个人继续硬扛。"}
                </strong>
                <p>
                  {locale === "en"
                    ? "Your load is rising fast. Pause for one minute, then decide whether to invite your care circle."
                    : locale === "es"
                      ? "La carga está subiendo rápido. Haz una pausa de un minuto y luego decide si quieres invitar a tu círculo de cuidado."
                      : "当前负荷上升得很快。先暂停 1 分钟，再决定是否把关怀圈拉进来。"}
                </p>
                <button type="button" className="button-primary" onClick={onOpenSupport}>
                  {locale === "en" ? "Begin 4-4-4 Breathing" : locale === "es" ? "Empezar respiración 4-4-4" : "开始 4-4-4 呼吸"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommercialPathSection({
  locale,
  onOpenBeta,
  onOpenPersonal,
  onOpenTeam,
  path,
}: {
  locale: Locale;
  onOpenBeta: () => void;
  onOpenPersonal: () => void;
  onOpenTeam: () => void;
  path: ReturnType<typeof getCommercialPath>;
}) {
  return (
    <section className="card commercial-path-card">
      <div className="commercial-path-header">
        <div className="commercial-path-copy">
          <p className="section-title">{locale === "en" ? "Commercial path" : locale === "es" ? "Ruta comercial" : "商业路径"}</p>
          <h2>{path.title}</h2>
          <p className="section-subtitle">{path.body}</p>
        </div>
        <p className="commercial-path-note">{path.note}</p>
      </div>

      <div className="commercial-path-grid">
        {path.plans.map((plan) => {
          const action =
            plan.id === "beta"
              ? onOpenBeta
              : plan.id === "personal"
                ? onOpenPersonal
                : onOpenTeam;

          return (
            <article
              key={plan.id}
              className={plan.id === "beta" ? "commercial-plan-card is-active" : "commercial-plan-card"}
            >
              <div className="commercial-plan-topline">
                <span>{plan.badge}</span>
                <small>{plan.state}</small>
              </div>
              <strong>{plan.title}</strong>
              <p>{plan.summary}</p>
              <ul className="bullet-list commercial-plan-points">
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <button
                type="button"
                className={plan.id === "beta" ? "button-primary" : "button-secondary"}
                onClick={action}
              >
                {plan.cta}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetricCard({
  locale,
  label,
  value,
  detail,
}: {
  locale: Locale;
  label: "sleep" | "restingHeartRate" | "stress" | "feeling";
  value: string;
  detail?: string;
}) {
  const labelMap = {
    sleep: locale === "en" ? "Sleep" : locale === "es" ? "Sueño" : "睡眠",
    restingHeartRate:
      locale === "en"
        ? "Resting heart rate"
        : locale === "es"
          ? "Frecuencia en reposo"
          : "静息心率",
    stress: locale === "en" ? "Stress" : locale === "es" ? "Estrés" : "压力",
    feeling:
      locale === "en"
        ? "Subjective feeling"
        : locale === "es"
          ? "Sensación subjetiva"
          : "主观感受",
  } as const;

  return (
    <article className="metric-card">
      <span>{labelMap[label]}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function RecoveryBriefCard({
  brief,
  compact = false,
  error,
  loading,
  locale,
  onRefresh,
}: {
  brief: RecoveryBriefResponse | null;
  compact?: boolean;
  error: string;
  loading: boolean;
  locale: Locale;
  onRefresh: () => void;
}) {
  const title =
    locale === "en"
      ? "AI Recovery Brief"
      : locale === "es"
        ? "Brief IA de recuperación"
        : "AI 恢复简报";

  const subtitle =
    locale === "en"
      ? "This stays server-side. If no AI key is configured, the card falls back to a local brief."
      : locale === "es"
        ? "Esto se genera en el servidor. Si no hay AI key configurada, la tarjeta vuelve a un brief local."
        : "这张卡片只走服务端；如果没配 AI key，会自动回退到本地简报。";

  return (
    <section className={compact ? "card ai-brief-card ai-brief-card-compact" : "card ai-brief-card"}>
      <div className="split-header">
        <div>
          <p className="section-title">{title}</p>
          <p className="section-subtitle">
            {locale === "en"
              ? "The brief turns the current state into one calm summary plus the next 2 to 3 actions."
              : locale === "es"
                ? "El brief convierte el estado actual en un resumen sereno y las siguientes 2 o 3 acciones."
                : "把当前状态压缩成一段冷静总结和接下来的 2 到 3 个动作。"}
          </p>
        </div>
        <div className="card-actions">
          {brief ? (
            <span className={brief.mode === "ai" ? "chip chip-solid" : "chip"}>
              {brief.mode === "ai"
                ? locale === "en"
                  ? "AI"
                  : locale === "es"
                    ? "IA"
                    : "AI"
                : locale === "en"
                  ? "Fallback"
                  : locale === "es"
                    ? "Plantilla"
                    : "本地回退"}
            </span>
          ) : null}
          <button type="button" className="button-secondary" onClick={onRefresh}>
            {loading
              ? locale === "en"
                ? "Refreshing..."
                : locale === "es"
                  ? "Actualizando..."
                  : "刷新中..."
              : locale === "en"
                ? "Refresh Brief"
                : locale === "es"
                  ? "Actualizar brief"
                  : "刷新简报"}
          </button>
        </div>
      </div>

      {error ? <p className="support-result">{error}</p> : null}

      {brief ? (
        <div className="ai-brief-layout">
          <div className="ai-brief-copy">
            <h3>{brief.headline}</h3>
            <p>{brief.summary}</p>
          </div>
          <div className="ai-brief-panel">
            <strong>{locale === "en" ? "Next moves" : locale === "es" ? "Siguientes pasos" : "下一步动作"}</strong>
            <ul className="bullet-list">
              {brief.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <p className="ai-brief-note">{brief.escalationNote}</p>
            <small>
              {brief.mode === "ai" && brief.model
                ? locale === "en"
                  ? `Model: ${brief.model}`
                  : locale === "es"
                    ? `Modelo: ${brief.model}`
                    : `模型：${brief.model}`
                : locale === "en"
                  ? "Using local fallback logic"
                  : locale === "es"
                    ? "Usando lógica local de respaldo"
                    : "当前使用本地回退逻辑"}
            </small>
          </div>
        </div>
      ) : (
        <p className="support-result">
          {loading
            ? locale === "en"
              ? "Generating a calm brief for the current state..."
              : locale === "es"
                ? "Generando un brief sereno para el estado actual..."
                : "正在为当前状态生成一份冷静的恢复简报..."
            : subtitle}
        </p>
      )}
    </section>
  );
}

function CareContactCard({
  contact,
  locale,
  onAction,
  sharingTierLabels,
}: {
  contact: CareContact;
  locale: Locale;
  onAction: (contact: CareContact, action: "message" | "call" | "lighten") => void;
  sharingTierLabels: ReturnType<typeof getSharingTierLabels>;
}) {
  const statusLabel =
    contact.status === "online"
      ? locale === "en"
        ? "Online"
        : locale === "es"
          ? "En línea"
          : "在线"
      : contact.status === "reachable"
        ? locale === "en"
          ? "Reachable"
          : locale === "es"
            ? "Disponible"
            : "可联系"
        : locale === "en"
          ? "Later"
          : locale === "es"
            ? "Más tarde"
            : "稍后联系";

  return (
    <article className="care-contact-card">
      <div className="contact-topline">
        <div>
          <span>{contact.role}</span>
          <strong>{contact.name}</strong>
        </div>
        <span className={`status-badge status-${contact.status}`}>{statusLabel}</span>
      </div>
      <div className="contact-meta">
        <span className="sharing-chip">{sharingTierLabels[contact.sharingTier]}</span>
      </div>
      <p className="contact-promise">{contact.promise}</p>
      <p className="contact-note">{contact.note}</p>
      <div className="card-actions">
        <button type="button" className="button-secondary" onClick={() => onAction(contact, "message")}>
          {locale === "en" ? "Leave a note" : locale === "es" ? "Dejar un mensaje" : "留一句话"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onAction(contact, "call")}>
          {locale === "en" ? "Call" : locale === "es" ? "Llamar" : "打电话"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onAction(contact, "lighten")}>
          {locale === "en" ? "Ask for load relief" : locale === "es" ? "Pedir alivio de carga" : "请他减负"}
        </button>
      </div>
    </article>
  );
}

function BeaconRoomCard({
  locale,
  room,
  onAction,
}: {
  locale: Locale;
  room: BeaconRoom;
  onAction: (room: BeaconRoom, mode: "post" | "join") => void;
}) {
  return (
    <article className="beacon-room-card">
      <div className="contact-topline">
        <div>
          <span className={`tone-chip tone-${room.tone}`}>{room.tone}</span>
          <strong>{room.title}</strong>
        </div>
        <div className="room-meta">
          <small>
            {locale === "en"
              ? `${room.members} people`
              : locale === "es"
                ? `${room.members} personas`
                : `${room.members} 人`}
          </small>
          <small>{room.responseTime}</small>
        </div>
      </div>
      <p className="contact-promise">{room.description}</p>
      <p className="contact-note">
        {locale === "en" ? "Help card:" : locale === "es" ? "Tarjeta de ayuda:" : "求助卡片："}
        {room.prompt}
      </p>
      <div className="card-actions">
        <button type="button" className="button-secondary" onClick={() => onAction(room, "post")}>
          {locale === "en" ? "Post anonymously" : locale === "es" ? "Publicar en anónimo" : "匿名发起"}
        </button>
        <button type="button" className="button-secondary" onClick={() => onAction(room, "join")}>
          {locale === "en" ? "Join room" : locale === "es" ? "Entrar en sala" : "进入房间"}
        </button>
      </div>
    </article>
  );
}

function TrendChart({ history, locale }: { history: TrendPoint[]; locale: Locale }) {
  const width = 720;
  const height = 220;
  const padding = 24;

  function buildPoints(values: number[], maxValue: number) {
    return values
      .map((value, index) => {
        const x = padding + (index * (width - padding * 2)) / (values.length - 1);
        const y =
          height - padding - (value / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={locale === "en" ? "Trend chart" : locale === "es" ? "Gráfico de tendencia" : "趋势图"}
      >
        <defs>
          <linearGradient id="stressLine" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#f2be7c" />
            <stop offset="100%" stopColor="#f49ca8" />
          </linearGradient>
          <linearGradient id="recoveryLine" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#73c9d1" />
            <stop offset="100%" stopColor="#59c6c3" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          points={buildPoints(
            history.map((point) => point.recoveryScore),
            100,
          )}
          stroke="url(#recoveryLine)"
          strokeWidth="4"
        />
        <polyline
          fill="none"
          points={buildPoints(
            history.map((point) => point.stressLevel),
            100,
          )}
          stroke="url(#stressLine)"
          strokeWidth="4"
        />
        {history.map((point, index) => {
          const x = padding + (index * (width - padding * 2)) / (history.length - 1);
          const recoveryY =
            height - padding - (point.recoveryScore / 100) * (height - padding * 2);
          const stressY =
            height - padding - (point.stressLevel / 100) * (height - padding * 2);

          return (
            <g key={point.label}>
              <circle cx={x} cy={recoveryY} fill="#4fbab8" r="5" />
              <circle cx={x} cy={stressY} fill="#f2a0ae" r="5" />
              <text x={x} y={height - 6} textAnchor="middle">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="chart-legend">
        <span>
          <i className="legend-dot teal" />
          {locale === "en" ? "Recovery" : locale === "es" ? "Recuperación" : "恢复分"}
        </span>
        <span>
          <i className="legend-dot rose" />
          {locale === "en" ? "Stress" : locale === "es" ? "Estrés" : "压力值"}
        </span>
      </div>
    </div>
  );
}

export default App;
