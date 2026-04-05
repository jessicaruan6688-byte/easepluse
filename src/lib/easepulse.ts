export type StatusKey =
  | "stable"
  | "stress"
  | "recovery"
  | "attention"
  | "safety";

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

const dangerSymptoms: SymptomKey[] = ["chestTightness", "breathless", "dizzy"];

export const symptomLabels: Record<SymptomKey, string> = {
  none: "无明显不适",
  chestTightness: "胸闷或胸痛",
  breathless: "呼吸困难",
  dizzy: "明显头晕或濒晕",
  panic: "强烈惊恐感",
  palpitation: "持续心悸",
};

export function evaluateSnapshot(snapshot: Snapshot): Evaluation {
  const reasons: string[] = [];
  let recoveryScore = 86;
  const heartRateDelta =
    snapshot.restingHeartRate - snapshot.baselineRestingHeartRate;

  if (snapshot.symptoms.some((symptom) => dangerSymptoms.includes(symptom))) {
    return {
      status: "safety",
      statusLabel: statusMeta.safety.statusLabel,
      recoveryScore: 24,
      reasons: [
        "出现了不适合仅靠 App 处理的危险症状",
        "建议停止普通安抚流程，优先联系真人支持或就医",
      ],
      message: statusMeta.safety.message,
      nextActionTitle: statusMeta.safety.nextActionTitle,
      nextActionDetail: "联系紧急联系人，并在必要时寻求急救或专业帮助。",
      focusLabel: statusMeta.safety.focusLabel,
    };
  }

  if (snapshot.sleepHours < 6) {
    recoveryScore -= 16;
    reasons.push("睡眠时长低于 6 小时");
  } else if (snapshot.sleepHours < 6.8) {
    recoveryScore -= 9;
    reasons.push("昨夜睡眠偏短");
  }

  if (snapshot.sleepScore < 75) {
    recoveryScore -= 10;
    reasons.push("睡眠质量未恢复到个人舒适区");
  }

  if (heartRateDelta >= 8) {
    recoveryScore -= 14;
    reasons.push("静息心率显著高于个人基线");
  } else if (heartRateDelta >= 5) {
    recoveryScore -= 9;
    reasons.push("晨间静息心率高于个人基线");
  }

  if (snapshot.stressLevel >= 72) {
    recoveryScore -= 17;
    reasons.push("压力值处在高位");
  } else if (snapshot.stressLevel >= 58) {
    recoveryScore -= 9;
    reasons.push("压力值高于日常舒适区");
  }

  if (snapshot.activeMinutes < 20) {
    recoveryScore -= 6;
    reasons.push("今天活动量不足");
  }

  if (snapshot.sedentaryHours > 9) {
    recoveryScore -= 6;
    reasons.push("久坐时间偏长");
  }

  if (snapshot.moodScore <= 2) {
    recoveryScore -= 10;
    reasons.push("主观感受明显不佳");
  } else if (snapshot.moodScore === 3) {
    recoveryScore -= 4;
    reasons.push("主观感受一般");
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

  const meta = statusMeta[status];
  const nextActionDetail =
    status === "stable"
      ? "保持今天的节奏，安排一次 5 分钟离屏散步。"
      : status === "stress"
        ? "跟着节律动画呼吸 90 秒，再决定是否继续当前任务。"
        : status === "recovery"
          ? "今天先把恢复放到优先级前面：少熬 30 分钟，比多撑一小时更值。"
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

function buildHistory(values: Array<Pick<TrendPoint, "sleepHours" | "stressLevel" | "moodScore" | "restingHeartRate">>): TrendPoint[] {
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

export function buildInsight(history: TrendPoint[]): string {
  const latest = history.at(-1);
  if (!latest) {
    return "暂无趋势数据。";
  }

  const averageSleep =
    history.reduce((sum, item) => sum + item.sleepHours, 0) / history.length;
  const averageStress =
    history.reduce((sum, item) => sum + item.stressLevel, 0) / history.length;

  if (averageSleep < 6.2) {
    return "过去 7 天里，恢复分下滑主要跟睡眠时长不足有关，先把结束工作的时间前移比继续加任务更有效。";
  }

  if (averageStress > 62) {
    return "你的问题更像是白天持续紧绷，而不是单次崩溃。产品建议优先做低打扰的即时卸压，而不是等到晚上统一补救。";
  }

  return "最近的状态波动更多来自临时压力峰值。把关键节点前的呼吸和暂停动作提前，会比事后安抚更有用。";
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
