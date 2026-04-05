export type StatusKey =
  | "stable"
  | "stress"
  | "recovery"
  | "attention"
  | "safety";

export type Locale = "zh" | "en" | "es";

export type SymptomKey =
  | "none"
  | "chestTightness"
  | "breathless"
  | "dizzy"
  | "panic"
  | "palpitation";

export type Snapshot = {
  sleepHours: number;
  sleepScore: number;
  restingHeartRate: number;
  baselineRestingHeartRate: number;
  stressLevel: number;
  activeMinutes: number;
  sedentaryHours: number;
  moodScore: number;
  notes: string;
  symptoms: SymptomKey[];
};

export type TrendPoint = {
  label: string;
  recoveryScore: number;
  stressLevel: number;
  moodScore: number;
  sleepHours: number;
  restingHeartRate: number;
};

export type Scenario = {
  id: string;
  name: string;
  subtitle: string;
  snapshot: Snapshot;
  history: TrendPoint[];
};

export type Evaluation = {
  status: StatusKey;
  statusLabel: string;
  recoveryScore: number;
  reasons: string[];
  message: string;
  nextActionTitle: string;
  nextActionDetail: string;
  focusLabel: string;
};

export type SharingTier = "summary" | "trend" | "alerts";

export type CareContact = {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline" | "reachable";
  sharingTier: SharingTier;
  promise: string;
  note: string;
};

export type BeaconRoom = {
  id: string;
  title: string;
  prompt: string;
  description: string;
  members: number;
  responseTime: string;
  tone: "steady" | "warm" | "guarded";
};

export type GrowthLoopStep = {
  title: string;
  body: string;
};

const statusMeta: Record<
  StatusKey,
  Pick<Evaluation, "statusLabel" | "message" | "nextActionTitle" | "focusLabel">
> = {
  stable: {
    statusLabel: "平稳",
    message: "你的状态在个人基线附近。今天不需要额外用力修复，保持节律就够了。",
    nextActionTitle: "继续维持节奏",
    focusLabel: "稳态维护",
  },
  stress: {
    statusLabel: "压力升高",
    message: "你还在可自我调节区间，但压力已经开始堆积。现在先把紧绷感卸掉。",
    nextActionTitle: "做一次 90 秒呼吸",
    focusLabel: "快速卸压",
  },
  recovery: {
    statusLabel: "恢复不足",
    message: "你不是扛不住，而是身体已经在提示恢复跟不上消耗了。",
    nextActionTitle: "把今晚下线时间提前 30 分钟",
    focusLabel: "恢复优先",
  },
  attention: {
    statusLabel: "建议关注",
    message: "你的多项指标连续偏离基线，今天不建议继续硬扛。先做减负，再观察。",
    nextActionTitle: "减少 1 个高耗能安排",
    focusLabel: "主动减负",
  },
  safety: {
    statusLabel: "安全升级",
    message: "当前场景不适合只靠自我调节。请优先联系身边的人或专业帮助。",
    nextActionTitle: "立即联系支持对象",
    focusLabel: "安全优先",
  },
};

function getStatusMeta(locale: Locale) {
  if (locale === "en") {
    return {
      stable: {
        statusLabel: "Steady",
        message: "Your state is close to your personal baseline. No extra recovery push is needed today. Keep a stable rhythm.",
        nextActionTitle: "Maintain your rhythm",
        focusLabel: "Steady state",
      },
      stress: {
        statusLabel: "Stress Rising",
        message: "You are still within a self-regulation range, but stress is stacking up. Release the tension now.",
        nextActionTitle: "Do one 90-second breathing cycle",
        focusLabel: "Fast reset",
      },
      recovery: {
        statusLabel: "Recovery Low",
        message: "This is not weakness. Your body is signaling that recovery is lagging behind output.",
        nextActionTitle: "Move tonight's sign-off 30 minutes earlier",
        focusLabel: "Recovery first",
      },
      attention: {
        statusLabel: "Needs Attention",
        message: "Several signals are drifting away from baseline. Do not power through today. Reduce load first, then observe.",
        nextActionTitle: "Remove one high-drain task",
        focusLabel: "Reduce load",
      },
      safety: {
        statusLabel: "Safety Escalation",
        message: "This situation should not rely on self-regulation alone. Reach a trusted person or professional help first.",
        nextActionTitle: "Contact support now",
        focusLabel: "Safety first",
      },
    } satisfies typeof statusMeta;
  }

  if (locale === "es") {
    return {
      stable: {
        statusLabel: "Estable",
        message: "Tu estado está cerca de tu línea base personal. Hoy no hace falta forzar más recuperación. Mantén un ritmo estable.",
        nextActionTitle: "Mantén tu ritmo",
        focusLabel: "Estado estable",
      },
      stress: {
        statusLabel: "Estrés en aumento",
        message: "Sigues dentro de un rango de autorregulación, pero el estrés se está acumulando. Suelta la tensión ahora.",
        nextActionTitle: "Haz una respiración de 90 segundos",
        focusLabel: "Descarga rápida",
      },
      recovery: {
        statusLabel: "Recuperación baja",
        message: "No es que no puedas más. Tu cuerpo está señalando que la recuperación va por detrás del desgaste.",
        nextActionTitle: "Cierra el día 30 minutos antes",
        focusLabel: "Recuperación primero",
      },
      attention: {
        statusLabel: "Conviene prestar atención",
        message: "Varias señales se están alejando de tu línea base. Hoy no conviene seguir forzando. Reduce carga y observa.",
        nextActionTitle: "Quita una tarea de alto desgaste",
        focusLabel: "Reducir carga",
      },
      safety: {
        statusLabel: "Escalada de seguridad",
        message: "Esta situación no debería depender solo de tu autorregulación. Contacta primero a una persona de confianza o ayuda profesional.",
        nextActionTitle: "Contacta apoyo ahora",
        focusLabel: "Seguridad primero",
      },
    } satisfies typeof statusMeta;
  }

  return statusMeta;
}

const dangerSymptoms: SymptomKey[] = ["chestTightness", "breathless", "dizzy"];

export const symptomLabels: Record<SymptomKey, string> = {
  none: "无明显不适",
  chestTightness: "胸闷或胸痛",
  breathless: "呼吸困难",
  dizzy: "明显头晕或濒晕",
  panic: "强烈惊恐感",
  palpitation: "持续心悸",
};

export function getSymptomLabels(locale: Locale): Record<SymptomKey, string> {
  if (locale === "en") {
    return {
      none: "No clear symptoms",
      chestTightness: "Chest tightness or pain",
      breathless: "Shortness of breath",
      dizzy: "Strong dizziness or near-fainting",
      panic: "Intense panic",
      palpitation: "Persistent palpitations",
    };
  }

  if (locale === "es") {
    return {
      none: "Sin síntomas claros",
      chestTightness: "Opresión o dolor en el pecho",
      breathless: "Dificultad para respirar",
      dizzy: "Mareo fuerte o sensación de desmayo",
      panic: "Pánico intenso",
      palpitation: "Palpitaciones persistentes",
    };
  }

  return symptomLabels;
}

export function evaluateSnapshot(snapshot: Snapshot, locale: Locale = "zh"): Evaluation {
  const reasons: string[] = [];
  let recoveryScore = 86;
  const heartRateDelta =
    snapshot.restingHeartRate - snapshot.baselineRestingHeartRate;
  const metaMap = getStatusMeta(locale);

  if (snapshot.symptoms.some((symptom) => dangerSymptoms.includes(symptom))) {
    return {
      status: "safety",
      statusLabel: metaMap.safety.statusLabel,
      recoveryScore: 24,
      reasons:
        locale === "en"
          ? [
              "There are warning symptoms that should not be handled by the app alone",
              "Stop the normal calming flow and prioritize human support or medical care",
            ]
          : locale === "es"
            ? [
                "Hay síntomas de alarma que no deberían manejarse solo con la app",
                "Detén el flujo normal de apoyo y prioriza apoyo humano o atención médica",
              ]
            : [
                "出现了不适合仅靠 App 处理的危险症状",
                "建议停止普通安抚流程，优先联系真人支持或就医",
              ],
      message: metaMap.safety.message,
      nextActionTitle: metaMap.safety.nextActionTitle,
      nextActionDetail:
        locale === "en"
          ? "Contact your emergency contact and seek urgent or professional help when needed."
          : locale === "es"
            ? "Contacta a tu persona de emergencia y busca ayuda urgente o profesional si hace falta."
            : "联系紧急联系人，并在必要时寻求急救或专业帮助。",
      focusLabel: metaMap.safety.focusLabel,
    };
  }

  if (snapshot.sleepHours < 6) {
    recoveryScore -= 16;
    reasons.push(
      locale === "en"
        ? "Sleep duration is under 6 hours"
        : locale === "es"
          ? "La duración del sueño está por debajo de 6 horas"
          : "睡眠时长低于 6 小时",
    );
  } else if (snapshot.sleepHours < 6.8) {
    recoveryScore -= 9;
    reasons.push(
      locale === "en"
        ? "Last night's sleep was shorter than usual"
        : locale === "es"
          ? "El sueño de anoche fue más corto de lo normal"
          : "昨夜睡眠偏短",
    );
  }

  if (snapshot.sleepScore < 75) {
    recoveryScore -= 10;
    reasons.push(
      locale === "en"
        ? "Sleep quality has not returned to your comfortable zone"
        : locale === "es"
          ? "La calidad del sueño aún no volvió a tu zona cómoda"
          : "睡眠质量未恢复到个人舒适区",
    );
  }

  if (heartRateDelta >= 8) {
    recoveryScore -= 14;
    reasons.push(
      locale === "en"
        ? "Resting heart rate is far above your personal baseline"
        : locale === "es"
          ? "La frecuencia cardíaca en reposo está muy por encima de tu línea base"
          : "静息心率显著高于个人基线",
    );
  } else if (heartRateDelta >= 5) {
    recoveryScore -= 9;
    reasons.push(
      locale === "en"
        ? "Morning resting heart rate is above your baseline"
        : locale === "es"
          ? "La frecuencia cardíaca en reposo por la mañana está por encima de tu línea base"
          : "晨间静息心率高于个人基线",
    );
  }

  if (snapshot.stressLevel >= 72) {
    recoveryScore -= 17;
    reasons.push(
      locale === "en"
        ? "Stress score is in a high zone"
        : locale === "es"
          ? "La puntuación de estrés está en una zona alta"
          : "压力值处在高位",
    );
  } else if (snapshot.stressLevel >= 58) {
    recoveryScore -= 9;
    reasons.push(
      locale === "en"
        ? "Stress score is above your usual comfort zone"
        : locale === "es"
          ? "La puntuación de estrés está por encima de tu zona cómoda habitual"
          : "压力值高于日常舒适区",
    );
  }

  if (snapshot.activeMinutes < 20) {
    recoveryScore -= 6;
    reasons.push(
      locale === "en"
        ? "Today's activity level is low"
        : locale === "es"
          ? "El nivel de actividad de hoy es bajo"
          : "今天活动量不足",
    );
  }

  if (snapshot.sedentaryHours > 9) {
    recoveryScore -= 6;
    reasons.push(
      locale === "en"
        ? "Sedentary time is too long"
        : locale === "es"
          ? "El tiempo sedentario es demasiado largo"
          : "久坐时间偏长",
    );
  }

  if (snapshot.moodScore <= 2) {
    recoveryScore -= 10;
    reasons.push(
      locale === "en"
        ? "Subjective wellbeing feels clearly low"
        : locale === "es"
          ? "La sensación subjetiva de bienestar es claramente baja"
          : "主观感受明显不佳",
    );
  } else if (snapshot.moodScore === 3) {
    recoveryScore -= 4;
    reasons.push(
      locale === "en"
        ? "Subjective wellbeing feels average"
        : locale === "es"
          ? "La sensación subjetiva es regular"
          : "主观感受一般",
    );
  }

  recoveryScore = Math.max(18, Math.min(96, recoveryScore));

  let status: StatusKey = "stable";
  if (
    recoveryScore < 45 ||
    (snapshot.sleepHours < 6 && heartRateDelta >= 8) ||
    (snapshot.stressLevel >= 72 && snapshot.moodScore <= 2)
  ) {
    status = "attention";
  } else if (
    snapshot.sleepHours < 6.8 ||
    snapshot.sleepScore < 78 ||
    heartRateDelta >= 5
  ) {
    status = "recovery";
  } else if (snapshot.stressLevel >= 58 || snapshot.moodScore === 3) {
    status = "stress";
  }

  const meta = metaMap[status];
  const nextActionDetail =
    status === "stable"
      ? locale === "en"
        ? "Keep today's pace and schedule one 5-minute walk away from the screen."
        : locale === "es"
          ? "Mantén el ritmo de hoy y programa una caminata de 5 minutos lejos de la pantalla."
          : "保持今天的节奏，安排一次 5 分钟离屏散步。"
      : status === "stress"
        ? locale === "en"
          ? "Follow the breathing rhythm for 90 seconds, then decide whether to continue the current task."
          : locale === "es"
            ? "Sigue el ritmo de respiración durante 90 segundos y luego decide si continúas con la tarea actual."
            : "跟着节律动画呼吸 90 秒，再决定是否继续当前任务。"
        : status === "recovery"
          ? locale === "en"
            ? "Put recovery first today: ending 30 minutes earlier is worth more than pushing one extra hour."
            : locale === "es"
              ? "Pon la recuperación primero hoy: terminar 30 minutos antes vale más que aguantar una hora extra."
              : "今天先把恢复放到优先级前面：少熬 30 分钟，比多撑一小时更值。"
          : locale === "en"
            ? "Cut one non-essential task and tell one trusted person that your state is not great today."
            : locale === "es"
              ? "Elimina una tarea no esencial y dile a una persona de confianza que hoy no estás en tu mejor estado."
              : "砍掉一个非必要任务，并告知一个可信任的人你今天状态一般。";

  return {
    status,
    statusLabel: meta.statusLabel,
    recoveryScore,
    reasons,
    message: meta.message,
    nextActionTitle: meta.nextActionTitle,
    nextActionDetail,
    focusLabel: meta.focusLabel,
  };
}

function buildHistory(
  values: Array<Pick<TrendPoint, "sleepHours" | "stressLevel" | "moodScore" | "restingHeartRate">>,
): TrendPoint[] {
  return values.map((value, index) => {
    const tempSnapshot: Snapshot = {
      sleepHours: value.sleepHours,
      sleepScore: Math.round(68 + value.sleepHours * 4),
      restingHeartRate: value.restingHeartRate,
      baselineRestingHeartRate: 62,
      stressLevel: value.stressLevel,
      activeMinutes: 30,
      sedentaryHours: 8,
      moodScore: value.moodScore,
      notes: "",
      symptoms: ["none"],
    };

    return {
      label: `D${index + 1}`,
      recoveryScore: evaluateSnapshot(tempSnapshot).recoveryScore,
      stressLevel: value.stressLevel,
      moodScore: value.moodScore,
      sleepHours: value.sleepHours,
      restingHeartRate: value.restingHeartRate,
    };
  });
}

export const scenarios: Scenario[] = [
  {
    id: "late-nights",
    name: "连续熬夜恢复不足",
    subtitle: "适合演示为什么产品不只看压力，还要看恢复能力。",
    snapshot: {
      sleepHours: 5.4,
      sleepScore: 72,
      restingHeartRate: 70,
      baselineRestingHeartRate: 62,
      stressLevel: 68,
      activeMinutes: 18,
      sedentaryHours: 10.5,
      moodScore: 2,
      notes: "最近连续赶项目，晚上 12:30 以后还在处理消息。",
      symptoms: ["none"],
    },
    history: buildHistory([
      { sleepHours: 6.9, stressLevel: 48, moodScore: 4, restingHeartRate: 62 },
      { sleepHours: 6.4, stressLevel: 53, moodScore: 4, restingHeartRate: 64 },
      { sleepHours: 6.1, stressLevel: 57, moodScore: 3, restingHeartRate: 65 },
      { sleepHours: 5.8, stressLevel: 62, moodScore: 3, restingHeartRate: 66 },
      { sleepHours: 5.5, stressLevel: 67, moodScore: 2, restingHeartRate: 68 },
      { sleepHours: 5.2, stressLevel: 69, moodScore: 2, restingHeartRate: 69 },
      { sleepHours: 5.4, stressLevel: 68, moodScore: 2, restingHeartRate: 70 },
    ]),
  },
  {
    id: "meeting-stress",
    name: "会议前压力上升",
    subtitle: "适合演示低打扰的即时支持，而不是让 AI 长聊。",
    snapshot: {
      sleepHours: 7.1,
      sleepScore: 84,
      restingHeartRate: 64,
      baselineRestingHeartRate: 62,
      stressLevel: 74,
      activeMinutes: 26,
      sedentaryHours: 7.5,
      moodScore: 3,
      notes: "下午有关键汇报，开始反复想最坏结果。",
      symptoms: ["panic"],
    },
    history: buildHistory([
      { sleepHours: 7.4, stressLevel: 42, moodScore: 4, restingHeartRate: 62 },
      { sleepHours: 7.3, stressLevel: 47, moodScore: 4, restingHeartRate: 62 },
      { sleepHours: 7.0, stressLevel: 51, moodScore: 4, restingHeartRate: 63 },
      { sleepHours: 6.8, stressLevel: 56, moodScore: 3, restingHeartRate: 63 },
      { sleepHours: 7.1, stressLevel: 61, moodScore: 3, restingHeartRate: 64 },
      { sleepHours: 7.0, stressLevel: 69, moodScore: 3, restingHeartRate: 64 },
      { sleepHours: 7.1, stressLevel: 74, moodScore: 3, restingHeartRate: 64 },
    ]),
  },
  {
    id: "overload-watch",
    name: "连续异常建议关注",
    subtitle: "适合演示多日偏离后的升级机制。",
    snapshot: {
      sleepHours: 5.7,
      sleepScore: 69,
      restingHeartRate: 72,
      baselineRestingHeartRate: 61,
      stressLevel: 76,
      activeMinutes: 12,
      sedentaryHours: 11,
      moodScore: 2,
      notes: "最近四天跨时区沟通，晨起就觉得累。",
      symptoms: ["palpitation"],
    },
    history: buildHistory([
      { sleepHours: 6.5, stressLevel: 57, moodScore: 3, restingHeartRate: 63 },
      { sleepHours: 6.1, stressLevel: 61, moodScore: 3, restingHeartRate: 65 },
      { sleepHours: 5.9, stressLevel: 67, moodScore: 3, restingHeartRate: 67 },
      { sleepHours: 5.8, stressLevel: 70, moodScore: 2, restingHeartRate: 69 },
      { sleepHours: 5.6, stressLevel: 72, moodScore: 2, restingHeartRate: 70 },
      { sleepHours: 5.5, stressLevel: 75, moodScore: 2, restingHeartRate: 71 },
      { sleepHours: 5.7, stressLevel: 76, moodScore: 2, restingHeartRate: 72 },
    ]),
  },
  {
    id: "safety-escalation",
    name: "极端异常安全升级",
    subtitle: "适合回答评委的安全边界追问。",
    snapshot: {
      sleepHours: 4.9,
      sleepScore: 63,
      restingHeartRate: 76,
      baselineRestingHeartRate: 62,
      stressLevel: 82,
      activeMinutes: 9,
      sedentaryHours: 12,
      moodScore: 1,
      notes: "主观上感到胸闷且头晕。",
      symptoms: ["chestTightness", "dizzy"],
    },
    history: buildHistory([
      { sleepHours: 6.0, stressLevel: 62, moodScore: 3, restingHeartRate: 66 },
      { sleepHours: 5.8, stressLevel: 68, moodScore: 2, restingHeartRate: 68 },
      { sleepHours: 5.5, stressLevel: 70, moodScore: 2, restingHeartRate: 69 },
      { sleepHours: 5.2, stressLevel: 74, moodScore: 2, restingHeartRate: 71 },
      { sleepHours: 5.1, stressLevel: 78, moodScore: 1, restingHeartRate: 73 },
      { sleepHours: 5.0, stressLevel: 80, moodScore: 1, restingHeartRate: 75 },
      { sleepHours: 4.9, stressLevel: 82, moodScore: 1, restingHeartRate: 76 },
    ]),
  },
];

export function getScenarios(locale: Locale): Scenario[] {
  if (locale === "zh") {
    return scenarios;
  }

  const overrides =
    locale === "en"
      ? {
          "late-nights": {
            name: "Late Nights, Low Recovery",
            subtitle: "Shows why the product should track recovery, not stress alone.",
            notes: "Recent project sprint nights have extended past 12:30 a.m. while messages keep coming in.",
          },
          "meeting-stress": {
            name: "Pre-Meeting Stress Rise",
            subtitle: "Good for showing low-friction interventions instead of long AI chat.",
            notes: "A key presentation is coming this afternoon and the mind keeps looping on worst-case outcomes.",
          },
          "overload-watch": {
            name: "Repeated Drift Needs Attention",
            subtitle: "Good for showing escalation after multiple days off baseline.",
            notes: "Four days of cross-time-zone coordination are making mornings feel heavy.",
          },
          "safety-escalation": {
            name: "Extreme Anomaly, Safety Escalation",
            subtitle: "Good for answering judges' safety-boundary questions.",
            notes: "Subjectively feels like chest tightness and dizziness.",
          },
        }
      : {
          "late-nights": {
            name: "Noches largas, recuperación baja",
            subtitle: "Muestra por qué el producto debe seguir la recuperación, no solo el estrés.",
            notes: "Las últimas noches del proyecto se alargaron más allá de las 00:30 y siguen entrando mensajes.",
          },
          "meeting-stress": {
            name: "Estrés antes de la reunión",
            subtitle: "Sirve para mostrar intervenciones de baja fricción en vez de un chat largo con IA.",
            notes: "Hay una presentación clave esta tarde y la mente sigue imaginando el peor escenario.",
          },
          "overload-watch": {
            name: "Desviación continua que requiere atención",
            subtitle: "Sirve para mostrar escalada tras varios días fuera de línea base.",
            notes: "Cuatro días de coordinación entre zonas horarias hacen que las mañanas se sientan pesadas.",
          },
          "safety-escalation": {
            name: "Anomalía extrema, escalada de seguridad",
            subtitle: "Sirve para responder preguntas del jurado sobre límites de seguridad.",
            notes: "Subjetivamente se siente opresión en el pecho y mareo.",
          },
        };

  return scenarios.map((scenario) => {
    const next = overrides[scenario.id as keyof typeof overrides];
    if (!next) {
      return scenario;
    }

    return {
      ...scenario,
      name: next.name,
      subtitle: next.subtitle,
      snapshot: {
        ...scenario.snapshot,
        notes: next.notes,
      },
    };
  });
}

export function buildInsight(history: TrendPoint[], locale: Locale = "zh"): string {
  const latest = history.at(-1);
  if (!latest) {
    return locale === "en"
      ? "No trend data yet."
      : locale === "es"
        ? "Todavía no hay datos de tendencia."
        : "暂无趋势数据。";
  }

  const averageSleep =
    history.reduce((sum, item) => sum + item.sleepHours, 0) / history.length;
  const averageStress =
    history.reduce((sum, item) => sum + item.stressLevel, 0) / history.length;

  if (averageSleep < 6.2) {
    return locale === "en"
      ? "In the last 7 days, the recovery drop has mainly tracked short sleep. Ending work earlier is more effective than adding more tasks."
      : locale === "es"
        ? "En los últimos 7 días, la caída de recuperación se relaciona sobre todo con dormir poco. Terminar antes funciona mejor que añadir más tareas."
        : "过去 7 天里，恢复分下滑主要跟睡眠时长不足有关，先把结束工作的时间前移比继续加任务更有效。";
  }

  if (averageStress > 62) {
    return locale === "en"
      ? "This looks more like sustained daytime tension than a single collapse. The product should prioritize low-friction in-the-moment relief instead of waiting for a nightly reset."
      : locale === "es"
        ? "Esto se parece más a una tensión sostenida durante el día que a un colapso puntual. El producto debería priorizar alivio inmediato de baja fricción, no esperar a compensarlo por la noche."
        : "你的问题更像是白天持续紧绷，而不是单次崩溃。产品建议优先做低打扰的即时卸压，而不是等到晚上统一补救。";
  }

  return locale === "en"
    ? "Recent swings look more like temporary stress spikes. Moving breathing and pause prompts earlier, before key moments, works better than post-event soothing."
    : locale === "es"
      ? "Las variaciones recientes se parecen más a picos temporales de estrés. Adelantar las pausas y respiraciones antes de momentos clave funciona mejor que calmar después."
      : "最近的状态波动更多来自临时压力峰值。把关键节点前的呼吸和暂停动作提前，会比事后安抚更有用。";
}

export const defaultCustomSnapshot: Snapshot = {
  sleepHours: 6.3,
  sleepScore: 78,
  restingHeartRate: 66,
  baselineRestingHeartRate: 62,
  stressLevel: 58,
  activeMinutes: 22,
  sedentaryHours: 9,
  moodScore: 3,
  notes: "这里会写入你自己的 Band 9 数据和当天感受。",
  symptoms: ["none"],
};

export function getDefaultCustomSnapshot(locale: Locale): Snapshot {
  return {
    ...defaultCustomSnapshot,
    notes:
      locale === "en"
        ? "Your wearable data and today's feelings would be written here."
        : locale === "es"
          ? "Aquí se escribirían los datos de tu wearable y cómo te sientes hoy."
          : defaultCustomSnapshot.notes,
  };
}

export const sharingTierLabels: Record<SharingTier, string> = {
  summary: "只看状态等级",
  trend: "查看趋势与留言",
  alerts: "接收安全升级提醒",
};

export function getSharingTierLabels(locale: Locale): Record<SharingTier, string> {
  if (locale === "en") {
    return {
      summary: "Status only",
      trend: "Trends and notes",
      alerts: "Safety alerts",
    };
  }

  if (locale === "es") {
    return {
      summary: "Solo estado",
      trend: "Tendencias y notas",
      alerts: "Alertas de seguridad",
    };
  }

  return sharingTierLabels;
}

export const careContacts: CareContact[] = [
  {
    id: "contact-lina",
    name: "Lina",
    role: "伴侣",
    status: "online",
    sharingTier: "alerts",
    promise: "当你连续两天恢复分下滑时，她会先给你打电话，而不是只发一句“早点睡”。",
    note: "最适合接安全升级提醒和真正的电话联系。",
  },
  {
    id: "contact-hao",
    name: "郝哥",
    role: "工作搭子",
    status: "reachable",
    sharingTier: "trend",
    promise: "当你进入“建议关注”时，他可以帮你顶掉一个高耗能会议。",
    note: "适合承接工作场景里的减负动作。",
  },
  {
    id: "contact-mom",
    name: "妈妈",
    role: "家人",
    status: "offline",
    sharingTier: "summary",
    promise: "她不会看原始数据，只会在状态持续不佳时看到一句更容易理解的提醒。",
    note: "适合情感支持，但不应该承接复杂判断。",
  },
];

export function getCareContacts(locale: Locale): CareContact[] {
  if (locale === "zh") {
    return careContacts;
  }

  if (locale === "en") {
    return [
      {
        id: "contact-lina",
        name: "Lina",
        role: "Partner",
        status: "online",
        sharingTier: "alerts",
        promise: "If your recovery score drops for two days in a row, she will call first instead of sending another 'sleep earlier' message.",
        note: "Best for safety escalation alerts and real phone calls.",
      },
      {
        id: "contact-hao",
        name: "Hao",
        role: "Work ally",
        status: "reachable",
        sharingTier: "trend",
        promise: "When you enter a needs-attention state, he can help remove one high-drain meeting from your day.",
        note: "Useful for load-sharing in work contexts.",
      },
      {
        id: "contact-mom",
        name: "Mom",
        role: "Family",
        status: "offline",
        sharingTier: "summary",
        promise: "She does not need raw data. She only sees a simple prompt when your state stays off for too long.",
        note: "Good for emotional support, not complex judgment.",
      },
    ];
  }

  return [
    {
      id: "contact-lina",
      name: "Lina",
      role: "Pareja",
      status: "online",
      sharingTier: "alerts",
      promise: "Si tu recuperación cae dos días seguidos, te llamará antes de mandar otro 'duerme temprano'.",
      note: "La mejor opción para alertas de seguridad y llamadas reales.",
    },
    {
      id: "contact-hao",
      name: "Hao",
      role: "Aliado de trabajo",
      status: "reachable",
      sharingTier: "trend",
      promise: "Cuando entras en estado de atención, puede quitarte una reunión de alto desgaste.",
      note: "Útil para redistribuir carga en contextos laborales.",
    },
    {
      id: "contact-mom",
      name: "Mamá",
      role: "Familia",
      status: "offline",
      sharingTier: "summary",
      promise: "No necesita ver datos crudos. Solo recibe un aviso simple si tu estado sigue mal demasiado tiempo.",
      note: "Buena para apoyo emocional, no para juicios complejos.",
    },
  ];
}

export const beaconRooms: BeaconRoom[] = [
  {
    id: "cross-timezone",
    title: "跨时区恢复站",
    prompt: "今天又被多个时区拉扯，想找人提醒自己早点下线。",
    description: "给跨境、电商、外贸和远程协作人群的匿名恢复房间，只分享场景，不公开原始健康数据。",
    members: 124,
    responseTime: "约 2 分钟",
    tone: "steady",
  },
  {
    id: "pre-meeting",
    title: "开会前缓冲间",
    prompt: "汇报前心跳有点快，想找人一起做 90 秒呼吸。",
    description: "适合会前紧绷、发言焦虑和临时高压，不鼓励长聊，优先推荐短动作。",
    members: 83,
    responseTime: "约 1 分钟",
    tone: "warm",
  },
  {
    id: "late-night",
    title: "今晚先下线",
    prompt: "我知道该休息，但就是停不下来，想找个出口让自己收工。",
    description: "给熬夜后还在硬撑的人，一个匿名但克制的支持场。",
    members: 156,
    responseTime: "约 3 分钟",
    tone: "guarded",
  },
];

export function getBeaconRooms(locale: Locale): BeaconRoom[] {
  if (locale === "zh") {
    return beaconRooms;
  }

  if (locale === "en") {
    return [
      {
        id: "cross-timezone",
        title: "Cross-Time-Zone Recovery",
        prompt: "Multiple time zones pulled me all day. I want someone to remind me to sign off early.",
        description: "An anonymous recovery room for cross-border, remote, and global operations work. It shares context, not raw health data.",
        members: 124,
        responseTime: "about 2 min",
        tone: "steady",
      },
      {
        id: "pre-meeting",
        title: "Pre-Meeting Buffer",
        prompt: "My heartbeat is rising before a presentation. I want someone to breathe for 90 seconds with me.",
        description: "Built for pre-meeting tension and speaking anxiety. It favors short actions over long chat.",
        members: 83,
        responseTime: "about 1 min",
        tone: "warm",
      },
      {
        id: "late-night",
        title: "Sign Off Tonight",
        prompt: "I know I should stop, but I cannot switch off. I need an exit ramp.",
        description: "A restrained anonymous support room for people who are still pushing late at night.",
        members: 156,
        responseTime: "about 3 min",
        tone: "guarded",
      },
    ];
  }

  return [
    {
      id: "cross-timezone",
      title: "Recuperación entre husos",
      prompt: "Hoy me arrastraron varios husos horarios y necesito que alguien me recuerde cerrar antes.",
      description: "Sala anónima de recuperación para trabajo remoto, comercio y coordinación global. Comparte contexto, no datos crudos.",
      members: 124,
      responseTime: "aprox. 2 min",
      tone: "steady",
    },
    {
      id: "pre-meeting",
      title: "Buffer antes de la reunión",
      prompt: "Mi pulso sube antes de presentar y quiero que alguien respire 90 segundos conmigo.",
      description: "Pensada para tensión previa a reuniones y ansiedad al hablar. Prioriza acciones cortas sobre charlas largas.",
      members: 83,
      responseTime: "aprox. 1 min",
      tone: "warm",
    },
    {
      id: "late-night",
      title: "Hoy sí cierro",
      prompt: "Sé que debería parar, pero no puedo cortar. Necesito una salida.",
      description: "Una sala anónima y contenida para quien sigue empujando demasiado tarde por la noche.",
      members: 156,
      responseTime: "aprox. 3 min",
      tone: "guarded",
    },
  ];
}

export const growthLoopSteps: GrowthLoopStep[] = [
  {
    title: "一个人先用起来",
    body: "用户先为自己记录恢复状态，不需要先拉别人参与，降低首次使用门槛。",
  },
  {
    title: "邀请 1 位关怀联系人",
    body: "当用户发现自己真的会被看见，就更愿意把伴侣、朋友或同事拉进来。",
  },
  {
    title: "形成双人或小圈层习惯",
    body: "留言、提醒、电话和减负动作会把虚拟支持变成真实关系里的协作。",
  },
  {
    title: "匿名恢复社区补位",
    body: "当用户暂时不想打扰熟人时，可进入场景化匿名支持房间，不暴露危险状态。",
  },
];

export function getGrowthLoopSteps(locale: Locale): GrowthLoopStep[] {
  if (locale === "zh") {
    return growthLoopSteps;
  }

  if (locale === "en") {
    return [
      {
        title: "Start with one person",
        body: "The user can begin by tracking their own recovery state. No need to invite others on day one.",
      },
      {
        title: "Invite one care contact",
        body: "Once users feel truly seen, they are more willing to bring in a partner, friend, or teammate.",
      },
      {
        title: "Build a duo or small-circle habit",
        body: "Messages, reminders, calls, and load-sharing turn support from digital comfort into real-world coordination.",
      },
      {
        title: "Use anonymous recovery rooms as a backstop",
        body: "If the user does not want to disturb familiar people yet, they can enter a scenario-based anonymous room without exposing risk signals.",
      },
    ];
  }

  return [
    {
      title: "Empieza con una sola persona",
      body: "La usuaria o el usuario puede empezar siguiendo su propia recuperación sin invitar a nadie el primer día.",
    },
    {
      title: "Invita a una persona de apoyo",
      body: "Cuando la persona siente que realmente la ven, se vuelve más fácil sumar a pareja, amistades o colegas.",
    },
    {
      title: "Crear hábito de dúo o pequeño círculo",
      body: "Mensajes, recordatorios, llamadas y alivio de carga convierten el apoyo digital en coordinación real.",
    },
    {
      title: "Comunidad anónima como respaldo",
      body: "Si todavía no quiere molestar a conocidos, puede entrar en una sala anónima por escenario sin exponer señales de riesgo.",
    },
  ];
}

export function buildCareHeadline(status: StatusKey, locale: Locale = "zh") {
  if (locale === "en") {
    if (status === "safety") {
      return "Right now, contact someone you trust instead of carrying this alone.";
    }

    if (status === "attention") {
      return "Today is a good day to pull one care contact in and share a little of the load.";
    }

    if (status === "recovery") {
      return "When recovery is low, the most effective support usually comes from someone who knows you, not more advice.";
    }

    return "Build the care circle on steady days, so help is already there before overload hits.";
  }

  if (locale === "es") {
    if (status === "safety") {
      return "Ahora conviene contactar a alguien de confianza en vez de cargar con esto sola o solo.";
    }

    if (status === "attention") {
      return "Hoy vale la pena sumar a una persona de apoyo y repartir un poco la carga.";
    }

    if (status === "recovery") {
      return "Cuando la recuperación está baja, el apoyo más útil suele venir de alguien que te conoce, no de más consejos.";
    }

    return "Construye el círculo de cuidado en días estables para que ya exista antes de que llegue la sobrecarga.";
  }

  if (status === "safety") {
    return "现在该联系可信的人，而不是继续独自扛。";
  }

  if (status === "attention") {
    return "今天适合把一位关怀联系人拉进来，一起分担一点负荷。";
  }

  if (status === "recovery") {
    return "恢复不足时，最有效的支持往往来自一个懂你的人，而不是更多道理。";
  }

  return "平稳时建立关怀圈，才不会等到透支时才想起求助。";
}

export function buildBeaconGuardrail(locale: Locale = "zh") {
  if (locale === "en") {
    return "The anonymous layer only handles voluntary help-seeking and light support. It does not expose danger states or hand high-risk judgment to strangers.";
  }

  if (locale === "es") {
    return "La capa anónima solo recibe pedidos voluntarios de ayuda y apoyo ligero. No expone estados de peligro ni deja el juicio de alto riesgo en manos de desconocidos.";
  }

  return "匿名世界只承接主动求助和轻支持，不公开危险状态，不把高风险判断交给陌生人。";
}
