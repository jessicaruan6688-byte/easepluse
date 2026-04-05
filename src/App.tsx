import { ChangeEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import {
  beaconRooms,
  buildBeaconGuardrail,
  buildCareHeadline,
  buildInsight,
  careContacts,
  defaultCustomSnapshot,
  evaluateSnapshot,
  growthLoopSteps,
  scenarios,
  sharingTierLabels,
  symptomLabels,
  type BeaconRoom,
  type CareContact,
  type Scenario,
  type Snapshot,
  type SymptomKey,
  type TrendPoint,
} from "./lib/easepulse";

type ViewKey =
  | "overview"
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

const storageKey = "easepulse-custom-snapshot";
const uploadStorageKey = "easepulse-uploads";

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "overview", label: "概览" },
  { key: "connect", label: "数据桥接" },
  { key: "dashboard", label: "今日状态" },
  { key: "support", label: "恢复支持" },
  { key: "care", label: "关怀圈" },
  { key: "beacon", label: "匿名支持" },
  { key: "trends", label: "趋势复盘" },
  { key: "safety", label: "安全边界" },
];

const symptomOptions: SymptomKey[] = [
  "none",
  "panic",
  "palpitation",
  "chestTightness",
  "breathless",
  "dizzy",
];

const quickLinks: QuickLink[] = [
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
    label: "查看华为手环配对说明",
    note: "官方链路仍然是先接入 Huawei Health，再做后续数据桥接。",
    href: "https://consumer.huawei.com/en/support/content/en-us15935171/",
  },
];

const referenceLinks: ReferenceLink[] = [
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

const designNotes = [
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

const bluetoothChecklist = [
  "需要 HTTPS 下的 Chrome 或 Edge，Safari 目前不适合做这条链路。",
  "手环需要支持并开启 HR Data Broadcasts，浏览器才能发现标准心率服务。",
  "网页现在能真实联动的是心率广播；甩手动作的 IMU 事件需要原生桥接，不应在网页里假装已打通。",
];

const demoSleepHours = 5.3;

const judgeHighlights = [
  {
    title: "Recovery First",
    body: "先讲恢复不足，再讲情绪支持，让评委理解产品不是普通陪聊。",
  },
  {
    title: "Care Circle Handoff",
    body: "当状态持续变差，页面会自然把用户推向可信联系人，而不是留在虚拟安慰里。",
  },
  {
    title: "Beacon Guardrail",
    body: "匿名世界只接主动求助，不公开危险状态，增长和安全边界一起成立。",
  },
];

const demoTimelineCheckpoints = [
  { label: "08:10", heartRate: 72, risk: 28 },
  { label: "09:05", heartRate: 86, risk: 44 },
  { label: "09:42", heartRate: 98, risk: 63 },
  { label: "10:06", heartRate: 111, risk: 78 },
  { label: "10:18", heartRate: 118, risk: 88 },
];

const sharingNotes = [
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

const productLayers = [
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

function getSimulationStage(progress: number, riskScore: number) {
  if (progress < 0.2) {
    return {
      label: "Steady",
      detail: "昨晚睡眠偏少，但系统先保持观察，不把用户直接吓进危险区。",
    };
  }

  if (progress < 0.55) {
    return {
      label: "Building",
      detail: "心率开始上扬，压力在堆积，界面逐步把注意力往恢复上拉。",
    };
  }

  if (riskScore < 70) {
    return {
      label: "Needs Care",
      detail: "情绪球进入橙色区，系统开始准备更明确的支持提示。",
    };
  }

  return {
    label: "Support Ready",
    detail: "风险分已越过 70，系统不让用户继续硬撑，而是立刻给出恢复动作，并建议联系关怀圈。",
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
): { key: LiveModeKey; label: string; detail: string } {
  if (bluetoothState === "connected" && heartRate !== null) {
    if (heartRate < 82) {
      return {
        key: "rest",
        label: "平稳模式",
        detail: "页面保持最柔和的蓝绿色，适合观察今天的恢复状态。",
      };
    }

    if (heartRate < 104) {
      return {
        key: "focus",
        label: "激活模式",
        detail: "心率已开始上来，页面会强调当前状态和快速恢复动作。",
      };
    }

    return {
      key: "release",
      label: "释放模式",
      detail: "负荷已明显升高，页面会优先强调减负和恢复支持。",
    };
  }

  if (isCustomMode) {
    return {
      key: "focus",
      label: "真实录入",
      detail: "当前展示的是你手动录入的真实数据，而不是预设演示场景。",
    };
  }

  return {
    key: "rest",
    label: "演示浏览",
    detail: "当前展示的是可切换的演示数据，用于看清产品闭环。",
  };
}

function getBluetoothLabel(state: BluetoothState) {
  if (state === "connected") {
    return "已连接";
  }

  if (state === "connecting") {
    return "连接中";
  }

  if (state === "unsupported") {
    return "浏览器不支持";
  }

  if (state === "error") {
    return "连接失败";
  }

  return "未连接";
}

function App() {
  const [view, setView] = useState<ViewKey>("overview");
  const [scenarioId, setScenarioId] = useState<string>(scenarios[0].id);
  const [customSnapshot, setCustomSnapshot] = useState<Snapshot>(() =>
    readStoredValue(storageKey, defaultCustomSnapshot),
  );
  const [uploads, setUploads] = useState<UploadMap>(() =>
    readStoredValue(uploadStorageKey, { sleep: null, heart: null, stress: null }),
  );
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [timer, setTimer] = useState(90);
  const [isBreathing, setIsBreathing] = useState(false);
  const [supportResult, setSupportResult] = useState("还没开始恢复动作");
  const [careAction, setCareAction] = useState(
    "关怀圈不是监视，而是让用户指定谁可以在什么时候被拉进来。",
  );
  const [beaconAction, setBeaconAction] = useState(
    "匿名支持房间只接主动求助，不公开危险状态，不做陌生人预警。",
  );
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>("idle");
  const [bluetoothMessage, setBluetoothMessage] = useState(
    "在 Chrome + HTTPS 下，可以尝试连接华为手环的心率广播。",
  );
  const [connectedDeviceName, setConnectedDeviceName] = useState("");
  const [liveHeartRate, setLiveHeartRate] = useState<number | null>(null);
  const [lastSignalAt, setLastSignalAt] = useState("");
  const [isSimulatingStress, setIsSimulatingStress] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const deviceRef = useRef<any>(null);
  const characteristicRef = useRef<any>(null);
  const simulationStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(customSnapshot));
  }, [customSnapshot]);

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
          setSupportResult("呼吸练习完成，建议现在重新感受一下肩颈和呼吸是否放松了一点。");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isBreathing, timer]);

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
      setBluetoothMessage("当前浏览器不支持 Web Bluetooth。请用 HTTPS 下的 Chrome 或 Edge 打开。");
      return;
    }

    bluetoothApi
      .getAvailability?.()
      .then((available: boolean) => {
        if (!available) {
          setBluetoothMessage("浏览器支持蓝牙，但当前系统蓝牙不可用或未开启。");
        }
      })
      .catch(() => {
        setBluetoothMessage("浏览器支持蓝牙，但还需要在点击按钮后再请求设备权限。");
      });
  }, []);

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

  const activeScenario: Scenario =
    scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const activeSnapshot = isCustomMode ? customSnapshot : activeScenario.snapshot;
  const evaluation = evaluateSnapshot(activeSnapshot);
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
  const liveMode = getLiveMode(bluetoothState, liveHeartRate, isCustomMode);
  const demoHeartRate = Math.round(72 + simulationProgress * 46);
  const demoRiskScore = Math.round(28 + simulationProgress * 60);
  const demoStage = getSimulationStage(simulationProgress, demoRiskScore);
  const demoInterventionVisible = demoRiskScore >= 70;
  const careHeadline = buildCareHeadline(evaluation.status);
  const beaconGuardrail = buildBeaconGuardrail();

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
    setSupportResult("正在进行 90 秒恢复呼吸，先把注意力从任务里抽离出来。");
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
    setSupportResult("已载入你的自定义状态，可以开始恢复流程。");
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
    setBluetoothMessage("蓝牙设备已断开。要继续联动，请重新连接心率广播。");
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
      new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date()),
    );
    setBluetoothMessage("正在接收实时心率，页面模式会随心率区间自动变化。");
  }

  async function connectBand() {
    const bluetoothApi =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { bluetooth?: any }).bluetooth
        : undefined;

    if (!bluetoothApi) {
      setBluetoothState("unsupported");
      setBluetoothMessage("当前浏览器不支持 Web Bluetooth，请改用 Chrome 或 Edge。");
      return;
    }

    try {
      setBluetoothState("connecting");
      setBluetoothMessage("正在请求蓝牙权限，请从弹窗中选择开启心率广播的设备。");

      const device = await bluetoothApi.requestDevice({
        filters: [{ services: ["heart_rate"] }],
        optionalServices: ["battery_service", "device_information"],
      });
      const server = await device.gatt?.connect();

      if (!server) {
        throw new Error("设备已选择，但未能建立蓝牙连接。");
      }

      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");

      deviceRef.current = device;
      characteristicRef.current = characteristic;

      device.addEventListener("gattserverdisconnected", handleDeviceDisconnected);
      characteristic.addEventListener("characteristicvaluechanged", handleHeartRateChanged);
      await characteristic.startNotifications();

      setBluetoothState("connected");
      setConnectedDeviceName(device.name ?? "心率广播设备");
      setBluetoothMessage("已连接设备，等待第一条心率数据。");
      setView("connect");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setBluetoothState("idle");
        setBluetoothMessage("已取消设备选择，没有建立新的蓝牙连接。");
        return;
      }

      const message = error instanceof Error ? error.message : "连接蓝牙设备失败。";
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
    setBluetoothMessage("已手动断开。需要时可以重新连接心率广播。");
  }

  function handleCareAction(contact: CareContact, action: "message" | "call" | "lighten") {
    if (action === "message") {
      setCareAction(`已向 ${contact.name} 发送关怀留言草稿：我今天恢复有点跟不上，晚点能提醒我先下线吗？`);
      return;
    }

    if (action === "call") {
      setCareAction(`已为 ${contact.name} 准备电话动作。真正危险时，EasePulse 会优先把你推向真实通话，而不是继续停留在 App 里。`);
      return;
    }

    setCareAction(`已向 ${contact.name} 发出减负请求：帮我挡掉一个高耗能安排，让我先恢复一下。`);
  }

  function handleBeaconAction(room: BeaconRoom, mode: "post" | "join") {
    if (mode === "post") {
      setBeaconAction(`已在「${room.title}」生成匿名求助卡片：${room.prompt}`);
      return;
    }

    setBeaconAction(`已进入「${room.title}」，系统只开放预设支持和恢复动作，不开放高风险围观。`);
  }

  return (
    <div className={`app-shell mode-${liveMode.key}`}>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">EasePulse 息伴</p>
          <h1>把透支感，变成能被回应的恢复网络。</h1>
          <p className="topbar-lede">
            这版在原有数据桥接和恢复闭环上，补上了关怀圈、匿名支持和增长路径：
            先让用户自己看懂状态，再把可信的人拉进来，最后用匿名支持房间承接那些一时不想打扰熟人的时刻。
          </p>
        </div>

        <div className="status-panel">
          <a
            className="status-pill status-pill-link"
            href="https://easepluse.zeabur.app/"
            rel="noreferrer"
            target="_blank"
          >
            <span>线上站点</span>
            <strong>easepluse.zeabur.app</strong>
          </a>
          <div className="status-pill">
            <span>当前模式</span>
            <strong>{liveMode.label}</strong>
          </div>
          <div className="status-pill">
            <span>设备状态</span>
            <strong>
              {bluetoothState === "connected" && liveHeartRate !== null
                ? `${liveHeartRate} bpm`
                : getBluetoothLabel(bluetoothState)}
            </strong>
          </div>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <section className="brand-card">
            <div className="pulse-mark">EP</div>
            <div>
              <h2>息伴</h2>
              <p>给高压成年人留一个先被看见、再被接住的缓冲区。</p>
            </div>
          </section>

          <nav className="nav-list" aria-label="页面导航">
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

          <section className="scenario-card">
            <div className="split-header split-header-tight">
              <div>
                <p className="section-title">演示场景</p>
                <p className="section-subtitle">
                  这里保留的是场景切换，不再把“比赛 Demo”作为页面主视觉。
                </p>
              </div>
              <div className="chip">{isCustomMode ? "真实录入中" : "演示数据"}</div>
            </div>

            <div className="scenario-list">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  className={
                    scenario.id === scenarioId ? "scenario-button active" : "scenario-button"
                  }
                  type="button"
                  onClick={() => {
                    setScenarioId(scenario.id);
                    setIsCustomMode(false);
                    setView("dashboard");
                  }}
                >
                  <strong>{scenario.name}</strong>
                  <span>{scenario.subtitle}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="content">
          {view === "overview" && (
            <div className="page-grid">
              <section className="card hero-card pitch-card-shell">
                <PitchDemo
                  heartRate={demoHeartRate}
                  highlights={judgeHighlights}
                  interventionVisible={demoInterventionVisible}
                  isSimulating={isSimulatingStress}
                  onOpenConnect={() => setView("connect")}
                  onOpenSupport={() => {
                    startBreathing();
                    setView("support");
                  }}
                  onReset={resetStressSimulation}
                  onSimulate={startStressSimulation}
                  progress={simulationProgress}
                  riskScore={demoRiskScore}
                  sleepHours={demoSleepHours}
                  stage={demoStage}
                />
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">产品分层</p>
                    <p className="section-subtitle">
                      这不是一个泛健康面板，而是从“我自己”逐层走向“真实支持网络”的产品结构。
                    </p>
                  </div>
                </div>
                <div className="layer-grid">
                  {productLayers.map((item) => (
                    <article key={item.title} className="layer-card">
                      <span>{item.tag}</span>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="card growth-card-shell">
                <div className="split-header">
                  <div>
                    <p className="section-title">增长闭环</p>
                    <p className="section-subtitle">
                      增长不是额外拼接的拉新手段，而是产品机制本身会自然扩散到关怀关系里。
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

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">真实入口</p>
                    <p className="section-subtitle">
                      这些都是真正能点开的链接，不再只是视觉上的“像按钮”。
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
                      <span className="link-arrow">打开</span>
                    </a>
                  ))}
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">竞品参考</p>
                    <p className="section-subtitle">
                      这一版不是抄一个竞品，而是分别借鉴恢复逻辑、可信共享和温和交互。
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
                  <span>增长买点</span>
                  <strong>关怀圈邀请 + 匿名支持补位</strong>
                </div>
                <div>
                  <span>安全边界</span>
                  <strong>陌生人看不到危险状态</strong>
                </div>
                <div>
                  <span>设备路径</span>
                  <strong>先 Huawei Health，再补 iOS 原生桥</strong>
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
                    <p className="section-title">数据桥接路径</p>
                    <p className="section-subtitle">
                      现在把真实能做、赛后再补、以及不该假装已经完成的部分拆开写清楚。
                    </p>
                  </div>
                  <div className="chip chip-solid">{getBluetoothLabel(bluetoothState)}</div>
                </div>

                <div className="bridge-grid">
                  <article className="bridge-card success">
                    <span>01</span>
                    <h3>华为运动健康</h3>
                    <p>手环真实数据的起点仍然在 Huawei Health，这个基础链路保留不变。</p>
                  </article>
                  <article className="bridge-card info">
                    <span>02</span>
                    <h3>桌面浏览器蓝牙</h3>
                    <p>在支持的浏览器里，可以尝试直接连接标准心率广播，让网页出现实时联动。</p>
                  </article>
                  <article className="bridge-card caution">
                    <span>03</span>
                    <h3>动作传感桥接</h3>
                    <p>如果要把“甩手”变成网页模式切换，需要 Android 或 iOS 原生桥，不应该伪装成纯网页能力。</p>
                  </article>
                </div>
              </section>

              <section className="card bluetooth-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">电脑蓝牙连接 Beta</p>
                    <p className="section-subtitle">
                      如果你的 HUAWEI Band 9 开启了心率广播，这里可以直接尝试连接。连接后，网页色调和模式会随心率区间变化。
                    </p>
                  </div>
                  <div className="chip">{connectedDeviceName || "等待选择设备"}</div>
                </div>

                <div className="bluetooth-grid">
                  <article className="live-metric-card">
                    <span>实时心率</span>
                    <strong>{liveHeartRate ?? "--"}</strong>
                    <small>{liveHeartRate !== null ? "bpm" : "尚未接收到心率数据"}</small>
                  </article>
                  <article className={`mode-card mode-card-${liveMode.key}`}>
                    <span>页面联动模式</span>
                    <strong>{liveMode.label}</strong>
                    <p>{liveMode.detail}</p>
                    <small>{lastSignalAt ? `最后更新 ${lastSignalAt}` : bluetoothMessage}</small>
                  </article>
                </div>

                <div className="hero-actions">
                  <button
                    type="button"
                    className="button-primary"
                    disabled={bluetoothState === "connecting"}
                    onClick={() => void connectBand()}
                  >
                    {bluetoothState === "connecting" ? "请求设备中..." : "连接心率广播"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={bluetoothState !== "connected"}
                    onClick={() => void disconnectBand()}
                  >
                    断开蓝牙
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
                    华为官方心率广播说明
                  </a>
                  <a
                    className="doc-link"
                    href="https://developer.huawei.com/consumer/en/doc/distribution/service/health-kit-overview-0000001077085579"
                    rel="noreferrer"
                    target="_blank"
                  >
                    华为 Health Kit
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
                    <p className="section-title">上传真实截图</p>
                    <p className="section-subtitle">
                      睡眠、心率、压力三类截图依然保留。这是比赛和评审时最稳妥的真实性证明。
                    </p>
                  </div>
                  <div className="chip">{screenshotCount}/3 已上传</div>
                </div>

                <div className="upload-grid">
                  {(
                    [
                      ["sleep", "睡眠截图"],
                      ["heart", "心率截图"],
                      ["stress", "压力截图"],
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
                        <div className="upload-placeholder">点击导入截图</div>
                      )}
                    </label>
                  ))}
                </div>
              </section>

              <section className="card form-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">录入今天的关键指标</p>
                    <p className="section-subtitle">
                      比赛版先走人工桥接，产品逻辑保持真实闭环，不用假装“自动同步”已经完成。
                    </p>
                  </div>
                  <button type="button" className="button-primary" onClick={applyCustomMode}>
                    应用到我的状态
                  </button>
                </div>

                <div className="form-grid">
                  <label>
                    睡眠时长（小时）
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
                    睡眠评分
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customSnapshot.sleepScore}
                      onChange={(event) => handleNumberChange("sleepScore", event)}
                    />
                  </label>
                  <label>
                    静息心率
                    <input
                      type="number"
                      min="40"
                      max="120"
                      value={customSnapshot.restingHeartRate}
                      onChange={(event) => handleNumberChange("restingHeartRate", event)}
                    />
                  </label>
                  <label>
                    个人基线静息心率
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
                    压力值
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customSnapshot.stressLevel}
                      onChange={(event) => handleNumberChange("stressLevel", event)}
                    />
                  </label>
                  <label>
                    活动分钟
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={customSnapshot.activeMinutes}
                      onChange={(event) => handleNumberChange("activeMinutes", event)}
                    />
                  </label>
                  <label>
                    久坐时长（小时）
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
                    主观感受（1-5）
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
                  今天的说明
                  <textarea
                    rows={3}
                    value={customSnapshot.notes}
                    onChange={(event) => updateSnapshot("notes", event.target.value)}
                  />
                </label>

                <div className="symptom-wrap">
                  <span>是否存在不适</span>
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
                  <p className="eyebrow">{isCustomMode ? "你的当前状态" : activeScenario.name}</p>
                  <h2>{evaluation.statusLabel}</h2>
                  <p className="lede">{evaluation.message}</p>
                </div>
                <div className="score-ring">
                  <div>
                    <strong>{evaluation.recoveryScore}</strong>
                    <span>恢复分</span>
                  </div>
                </div>
              </section>

              <section className="card summary-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">为什么是这个判断</p>
                    <p className="section-subtitle">
                      状态不是由单个指标决定，而是由基线偏离 + 当下主观感受共同决定。
                    </p>
                  </div>
                  {isCustomMode ? (
                    <button type="button" className="button-secondary" onClick={resetCustomMode}>
                      回到演示场景
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
                  <MetricCard label="睡眠" value={`${activeSnapshot.sleepHours} h`} />
                  <MetricCard
                    label="静息心率"
                    value={`${activeSnapshot.restingHeartRate} bpm`}
                    detail={`基线 ${activeSnapshot.baselineRestingHeartRate} bpm`}
                  />
                  <MetricCard label="压力" value={`${activeSnapshot.stressLevel}`} />
                  <MetricCard label="主观感受" value={`${activeSnapshot.moodScore}/5`} />
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
                    立即恢复
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setView("trends")}
                  >
                    查看趋势
                  </button>
                </div>
              </section>

              <section className="card care-preview-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">今天谁会接住你</p>
                    <h3>{careHeadline}</h3>
                    <p className="section-subtitle">
                      如果你今天不想一个人扛，这里会优先把你推向可信的人，而不是陌生人的围观。
                    </p>
                  </div>
                  <div className="chip">{careContacts.length} 位关怀联系人</div>
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
                    打开关怀圈
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("beacon")}>
                    查看匿名支持
                  </button>
                </div>
              </section>
            </div>
          )}

          {view === "support" && (
            <div className="page-grid">
              <div className="support-layout">
                <section className="card breathing-card">
                  <p className="section-title">即时恢复动作</p>
                  <div className={isBreathing ? "breathing-visual active" : "breathing-visual"}>
                    <div className="breathing-core" />
                  </div>
                  <div className="timer-block">
                    <strong>{timer}s</strong>
                    <span>吸气 4 秒，停 2 秒，呼气 6 秒</span>
                  </div>
                  <div className="hero-actions">
                    <button type="button" className="button-primary" onClick={startBreathing}>
                      开始 90 秒呼吸
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        setSupportResult("已经跳过呼吸练习，建议至少起身走 3 分钟。")
                      }
                    >
                      跳过，先走动
                    </button>
                  </div>
                </section>

                <section className="card coach-card">
                  <p className="section-title">支持文案</p>
                  <blockquote>
                    {evaluation.status === "safety"
                      ? "你现在最重要的不是继续扛，而是先把自己交给可信任的人照看。"
                      : "你现在的状态值得被认真对待，但不需要用恐慌解决。先把节律找回来。"}
                  </blockquote>
                  <p className="support-result">{supportResult}</p>
                  <div className="feedback-row">
                    <button
                      type="button"
                      onClick={() =>
                        setSupportResult("反馈已记录：有好一些。下一步保持低强度节奏。")
                      }
                    >
                      好一些
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupportResult("反馈已记录：变化不大。建议再做一次 3 分钟离屏恢复。")
                      }
                    >
                      没变化
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupportResult("反馈已记录：更差。请进入安全边界页面，不建议继续普通安抚。")
                      }
                    >
                      更差
                    </button>
                  </div>
                </section>
              </div>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">支持网络</p>
                    <p className="section-subtitle">
                      息伴不会把所有支持都塞进一个聊天框里，而是根据场景把你带向不同的人和不同的支持强度。
                    </p>
                  </div>
                </div>
                <div className="support-network-grid">
                  <article className="network-card">
                    <span>Care Circle</span>
                    <strong>把恢复动作交给熟人世界继续接住</strong>
                    <p>适合联系伴侣、朋友、家人或工作搭子，让留言变成电话、陪伴和减负。</p>
                    <button type="button" className="button-secondary" onClick={() => setView("care")}>
                      去关怀圈
                    </button>
                  </article>
                  <article className="network-card">
                    <span>Support Beacon</span>
                    <strong>不想打扰熟人时，先进入匿名支持房间</strong>
                    <p>适合会前紧张、跨时区和深夜难以下线这类场景，但不承接危险广播。</p>
                    <button type="button" className="button-secondary" onClick={() => setView("beacon")}>
                      去匿名支持
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
                  关怀圈不是让所有人看到你的原始数据，而是让你选择谁能在关键时刻真的做点什么。
                </p>
                <div className="hero-actions">
                  <button type="button" className="button-primary" onClick={() => setView("support")}>
                    回到恢复动作
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("safety")}>
                    查看安全计划
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">共享分层</p>
                    <p className="section-subtitle">
                      先分清谁能看什么，再设计提醒和互动，才能既安全又有增长价值。
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
                    <p className="section-title">我的关怀联系人</p>
                    <p className="section-subtitle">
                      比赛版先展示最真实的动作：留言、电话、帮忙减负。后续 iOS 才接系统级共享与通知。
                    </p>
                  </div>
                </div>
                <div className="care-grid">
                  {careContacts.map((contact) => (
                    <CareContactCard
                      key={contact.id}
                      contact={contact}
                      onAction={handleCareAction}
                    />
                  ))}
                </div>
                <div className="action-log">{careAction}</div>
              </section>

              <section className="card growth-card-shell">
                <div className="split-header">
                  <div>
                    <p className="section-title">为什么它会增长</p>
                    <p className="section-subtitle">
                      每一个关怀联系人都不是被动围观者，而是会因为真实互动安装 App、留下来、形成双人关系的入口。
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
                <h2>当你不想立刻打扰熟人，也不该一个人扛。</h2>
                <p className="lede">
                  匿名支持房间不是危险广播广场，而是一个先承接主动求助、再把人温和送回真实支持网络的过渡层。
                </p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => handleBeaconAction(beaconRooms[0], "post")}
                  >
                    发起匿名求助
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("care")}>
                    转到关怀圈
                  </button>
                </div>
              </section>

              <section className="card">
                <div className="split-header">
                  <div>
                    <p className="section-title">匿名支持房间</p>
                    <p className="section-subtitle">
                      房间按工作与恢复场景划分，不按疾病标签划分，也不展示任何敏感原始数据。
                    </p>
                  </div>
                </div>
                <div className="beacon-grid">
                  {beaconRooms.map((room) => (
                    <BeaconRoomCard key={room.id} room={room} onAction={handleBeaconAction} />
                  ))}
                </div>
              </section>

              <section className="card guardrail-card">
                <p className="section-title">匿名支持边界</p>
                <h3>{beaconGuardrail}</h3>
                <ul className="bullet-list">
                  <li>只有用户主动发起，才会进入匿名支持房间。</li>
                  <li>第一阶段不开放私信和原始生理数据展示。</li>
                  <li>一旦出现危险症状或明显恶化，只转向关怀圈和安全升级。</li>
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
                    <p className="section-title">7 天趋势</p>
                    <p className="section-subtitle">
                      息伴不只看今天，更看你是不是在持续透支。
                    </p>
                  </div>
                  <div className="chip">数据源：{isCustomMode ? "自定义录入" : activeScenario.name}</div>
                </div>
                <TrendChart history={activeHistory} />
              </section>

              <section className="card insight-card">
                <p className="section-title">本周洞察</p>
                <h3>{buildInsight(activeHistory)}</h3>
                <p>
                  比赛版先用截图和手工桥接保证真实性；如果要做系统级共享、亲友提醒和匿名支持分发，下一阶段再上 iOS 原生桥和服务端权限层。
                </p>
              </section>
            </div>
          )}

          {view === "safety" && (
            <div className="page-grid">
              <section className="card safety-card">
                <p className="section-title">安全边界</p>
                <h2>息伴不是医疗诊断工具。</h2>
                <ul className="bullet-list">
                  <li>不会承诺预防猝死，不会替代医生判断。</li>
                  <li>遇到胸闷、呼吸困难、明显头晕等急性不适，停止普通支持流程。</li>
                  <li>高风险场景优先提示联系紧急联系人、急救或专业帮助。</li>
                  <li>陌生人世界不会看到你的危险状态，也不承担风险判断责任。</li>
                </ul>
              </section>

              <section className="card contact-card">
                <p className="section-title">建议的安全升级动作</p>
                <div className="contact-grid">
                  <article>
                    <h3>联系 1 位真人支持</h3>
                    <p>比如伴侣、同事、朋友或家人，避免一个人继续硬扛。</p>
                  </article>
                  <article>
                    <h3>停止继续工作</h3>
                    <p>把注意力从任务目标转回生理安全，不建议继续输出。</p>
                  </article>
                  <article>
                    <h3>必要时及时就医</h3>
                    <p>如果出现危险症状，不要把它解释成“只是情绪问题”。</p>
                  </article>
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PitchDemo({
  heartRate,
  highlights,
  interventionVisible,
  isSimulating,
  onOpenConnect,
  onOpenSupport,
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
  onOpenConnect: () => void;
  onOpenSupport: () => void;
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
        <p className="eyebrow">iPhone-First Demo</p>
        <h2>先让评委看见透支是怎么被发现、被接住、再被转交给真实支持网络的。</h2>
        <p className="lede">
          这一屏不去卖复杂技术，而是把节奏讲清楚：先是睡眠不足与心率上扬，再是风险跨线，随后给出恢复动作，并把用户引向关怀圈而不是继续独自硬扛。
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="button-primary"
            disabled={isSimulating}
            onClick={onSimulate}
          >
            {isSimulating ? "Simulating..." : "Simulate Stress"}
          </button>
          <button type="button" className="button-secondary" onClick={onReset}>
            Reset Demo
          </button>
          <button type="button" className="button-secondary" onClick={onOpenConnect}>
            Open Device Bridge
          </button>
        </div>

        <div className="pitch-chip-row">
          <span className="chip chip-solid">Demo Mode · Simulated Data</span>
          <span className="chip">Not Medical Advice</span>
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
              <span>EasePulse Demo</span>
              <span>{stage.label}</span>
            </div>

            <div className="phone-score">
              <div className="phone-score-copy">
                <span>Emotional Risk Score</span>
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
                  <span>Heart Rate</span>
                  <strong>{heartRate} bpm</strong>
                  <small>rising in demo playback</small>
                </div>
                <div className="mini-stat-card">
                  <span>Sleep</span>
                  <strong>{sleepHours} h</strong>
                  <small>low baseline kept constant</small>
                </div>
              </div>
            </div>

            <div className="timeline-demo-card">
              <div className="timeline-demo-header">
                <span>Stress Timeline</span>
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
                <span>Breathing 4-4-4</span>
                <p>Inhale 4s · Hold 4s · Exhale 4s</p>
              </div>
            </div>

            {interventionVisible ? (
              <div className="intervention-sheet">
                <span>AI Intervention</span>
                <strong>You don&apos;t have to push through this alone.</strong>
                <p>Your load is rising fast. Pause for one minute, then decide whether to invite your care circle.</p>
                <button type="button" className="button-primary" onClick={onOpenSupport}>
                  Begin 4-4-4 Breathing
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function CareContactCard({
  contact,
  onAction,
}: {
  contact: CareContact;
  onAction: (contact: CareContact, action: "message" | "call" | "lighten") => void;
}) {
  const statusLabel =
    contact.status === "online"
      ? "在线"
      : contact.status === "reachable"
        ? "可联系"
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
          留一句话
        </button>
        <button type="button" className="button-secondary" onClick={() => onAction(contact, "call")}>
          打电话
        </button>
        <button type="button" className="button-secondary" onClick={() => onAction(contact, "lighten")}>
          请他减负
        </button>
      </div>
    </article>
  );
}

function BeaconRoomCard({
  room,
  onAction,
}: {
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
          <small>{room.members} 人</small>
          <small>{room.responseTime}</small>
        </div>
      </div>
      <p className="contact-promise">{room.description}</p>
      <p className="contact-note">求助卡片：{room.prompt}</p>
      <div className="card-actions">
        <button type="button" className="button-secondary" onClick={() => onAction(room, "post")}>
          匿名发起
        </button>
        <button type="button" className="button-secondary" onClick={() => onAction(room, "join")}>
          进入房间
        </button>
      </div>
    </article>
  );
}

function TrendChart({ history }: { history: TrendPoint[] }) {
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="趋势图">
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
          恢复分
        </span>
        <span>
          <i className="legend-dot rose" />
          压力值
        </span>
      </div>
    </div>
  );
}

export default App;
