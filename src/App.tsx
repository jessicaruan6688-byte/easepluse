import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  buildInsight,
  defaultCustomSnapshot,
  evaluateSnapshot,
  scenarios,
  symptomLabels,
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
    badge: "官方说明",
    label: "查看华为手环配对说明",
    note: "官方链路仍然是先接入 Huawei Health，再做后续数据桥接。",
    href: "https://consumer.huawei.com/en/support/content/en-us15935171/",
  },
  {
    badge: "浏览器能力",
    label: "查看 Chrome Web Bluetooth",
    note: "桌面网页可尝试连接心率广播，但前提是设备真的开放标准 BLE 服务。",
    href: "https://developer.chrome.com/docs/capabilities/bluetooth",
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
    tag: "Gentle Wellness",
    name: "Gentler Streak",
    vibe: "语气温和，强调恢复和节奏，不会一味要求用户更努力。",
    takeaway: "很适合我们参考“放松、轻盈、可信”的产品氛围。",
    href: "https://gentler.app/",
  },
  {
    tag: "Calm Guidance",
    name: "Headspace",
    vibe: "留白足、节奏慢、入口按场景组织，压力大时不需要思考就能往下走。",
    takeaway: "适合参考首页的引导方式和文案语气。",
    href: "https://www.headspace.com/",
  },
  {
    tag: "Rest Content",
    name: "Calm",
    vibe: "内容块清楚，睡眠和放松内容都能在第一屏快速建立信任。",
    takeaway: "适合参考情绪支持模块和更柔和的色彩氛围。",
    href: "https://www.calm.com/",
  },
];

const designNotes = [
  {
    title: "更轻的蒂凡尼蓝",
    body: "主色从深青绿改成浅海盐蓝和玻璃感白，整体更松弛，页面不会显得闷。",
  },
  {
    title: "把“比赛 Demo”降到二级",
    body: "右上角不再用两颗大徽标抢注意力，只保留更克制的状态信息。",
  },
  {
    title: "把可点击入口做实",
    body: "首页现在有真实线上站点、GitHub、官方配对说明和竞品参考外链，不再只是卡片摆设。",
  },
];

const bluetoothChecklist = [
  "需要 HTTPS 下的 Chrome 或 Edge，Safari 目前不适合做这条链路。",
  "手环需要支持并开启 HR Data Broadcasts，浏览器才能发现标准心率服务。",
  "网页现在能真实联动的是心率广播；甩手动作的 IMU 事件需要原生桥接，不应在网页里假装已打通。",
];

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
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>("idle");
  const [bluetoothMessage, setBluetoothMessage] = useState(
    "在 Chrome + HTTPS 下，可以尝试连接华为手环的心率广播。",
  );
  const [connectedDeviceName, setConnectedDeviceName] = useState("");
  const [liveHeartRate, setLiveHeartRate] = useState<number | null>(null);
  const [lastSignalAt, setLastSignalAt] = useState("");
  const deviceRef = useRef<any>(null);
  const characteristicRef = useRef<any>(null);

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

  return (
    <div className={`app-shell mode-${liveMode.key}`}>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">EasePulse 息伴</p>
          <h1>让今天的疲惫，有一个温和的出口。</h1>
          <p className="topbar-lede">
            我把页面往更轻、更安静、更真实可用的方向收了一次：颜色换成更浅的海盐蓝，
            比赛信息降级，首页保留真实入口，数据桥接页补上了桌面蓝牙心率联动的 Beta 能力。
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
              <p>给高压成年人留一个先被看见、再被支持的缓冲区。</p>
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
              <section className="card hero-card hero-grid">
                <div>
                  <p className="eyebrow">Calm Recovery Companion</p>
                  <h2>先看清状态，再给一个真的能执行的动作。</h2>
                  <p className="lede">
                    息伴不再只是一层展示卡片。首页现在有真实线上入口、竞品参考、官方文档和设备桥接说明；
                    数据页则能在支持的浏览器里尝试连接心率广播，让网页自己跟着实时状态变化。
                  </p>
                  <div className="hero-actions">
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => setView("connect")}
                    >
                      接入我的设备
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setView("dashboard")}
                    >
                      查看今日状态
                    </button>
                  </div>
                </div>

                <div className="hero-side">
                  <div className="hero-orb" aria-hidden="true" />
                  <div className="hero-summary">
                    <span>现在可用</span>
                    <strong>Zeabur 在线站点 + GitHub 自动更新</strong>
                    <p>{liveMode.detail}</p>
                  </div>
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
                      我挑了 4 个官方站点，分别看它们怎么组织恢复、情绪支持和更放松的视觉。
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
                  <span>主色方向</span>
                  <strong>浅蒂凡尼蓝 + 海盐白</strong>
                </div>
                <div>
                  <span>交互原则</span>
                  <strong>入口真实可点，不做假桥接</strong>
                </div>
                <div>
                  <span>设备能力</span>
                  <strong>网页先接心率广播，动作识别后补原生</strong>
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
            </div>
          )}

          {view === "support" && (
            <div className="page-grid support-layout">
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
                  比赛版先用截图和手工桥接保证真实性；如果要做动作联动或系统级同步，下一阶段再上原生桥。
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
