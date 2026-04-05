import { ChangeEvent, useEffect, useState } from "react";
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

function App() {
  const [view, setView] = useState<ViewKey>("overview");
  const [scenarioId, setScenarioId] = useState<string>(scenarios[0].id);
  const [customSnapshot, setCustomSnapshot] = useState<Snapshot>(() => {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Snapshot) : defaultCustomSnapshot;
  });
  const [uploads, setUploads] = useState<UploadMap>(() => {
    const raw = window.localStorage.getItem(uploadStorageKey);
    return raw
      ? (JSON.parse(raw) as UploadMap)
      : { sleep: null, heart: null, stress: null };
  });
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [timer, setTimer] = useState(90);
  const [isBreathing, setIsBreathing] = useState(false);
  const [supportResult, setSupportResult] = useState("还没开始恢复动作");

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

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <div>
          <p className="eyebrow">EasePulse 息伴</p>
          <h1>在你扛不住之前，先被看见，先被支持。</h1>
        </div>
        <div className="topbar-actions">
          <div className="chip chip-solid">Band 9 · iPhone 版比赛 Demo</div>
          <div className="chip">
            {isCustomMode ? "真实录入模式" : "评委演示模式"}
          </div>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <section className="brand-card">
            <div className="pulse-mark">EP</div>
            <div>
              <h2>息伴</h2>
              <p>高压成年人身心状态助手</p>
            </div>
          </section>

          <nav className="nav-list">
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
            <p className="section-title">演示场景</p>
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
              <section className="hero-card card">
                <p className="eyebrow">产品定位</p>
                <h2>把穿戴数据变成温和、克制、可执行的支持。</h2>
                <p className="lede">
                  息伴连接华为手环与 iPhone，围绕睡眠、心率、压力与主观感受，
                  把今天的状态解释清楚，再给出一个可以立刻执行的恢复动作。
                </p>
                <div className="hero-actions">
                  <button type="button" className="button-primary" onClick={() => setView("connect")}>
                    导入我的数据
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("dashboard")}>
                    直接看 Demo
                  </button>
                </div>
              </section>

              <section className="card spotlight-card">
                <p className="section-title">为什么今天先做 Web</p>
                <ul className="bullet-list">
                  <li>华为 Band 9 能配 iPhone，但同步不是为实时设计。</li>
                  <li>苹果健康数据不能直接被网页读取，iOS 原生桥接要放到下一阶段。</li>
                  <li>比赛先证明产品闭环和价值，再补 HealthKit 数据通路。</li>
                </ul>
              </section>

              <section className="card metrics-strip">
                <div>
                  <span>当前主轴</span>
                  <strong>压力恢复与情绪支持</strong>
                </div>
                <div>
                  <span>安全层</span>
                  <strong>极端异常升级提醒</strong>
                </div>
                <div>
                  <span>比赛形态</span>
                  <strong>可部署真实 Web 产品</strong>
                </div>
              </section>
            </div>
          )}

          {view === "connect" && (
            <div className="page-grid">
              <section className="card">
                <p className="section-title">数据桥接状态</p>
                <div className="bridge-grid">
                  <article className="bridge-card success">
                    <span>01</span>
                    <h3>华为运动健康</h3>
                    <p>你已经有 Band 9 数据，这是最真实的产品基础。</p>
                  </article>
                  <article className="bridge-card caution">
                    <span>02</span>
                    <h3>苹果健康</h3>
                    <p>可做权限桥接，但不应假设所有压力/睡眠/心率都能稳定进入 Web。</p>
                  </article>
                  <article className="bridge-card info">
                    <span>03</span>
                    <h3>比赛版 Web</h3>
                    <p>用截图上传 + 指标录入做“真实桥接”，赛后再补 iOS HealthKit 同步。</p>
                  </article>
                </div>
              </section>

              <section className="card upload-card">
                <div className="split-header">
                  <div>
                    <p className="section-title">上传真实截图</p>
                    <p className="section-subtitle">
                      先接睡眠、心率、压力三类截图，比赛时比空讲更有说服力。
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
                      比赛版先走人工桥接，产品逻辑已经是完整闭环。
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
                  <button type="button" className="button-primary" onClick={() => setView("support")}>
                    立即恢复
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setView("trends")}>
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
                  <button type="button" onClick={() => setSupportResult("反馈已记录：有好一些。下一步保持低强度节奏。")}
                  >
                    好一些
                  </button>
                  <button type="button" onClick={() => setSupportResult("反馈已记录：变化不大。建议再做一次 3 分钟离屏恢复。")}
                  >
                    没变化
                  </button>
                  <button type="button" onClick={() => setSupportResult("反馈已记录：更差。请进入安全边界页面，不建议继续普通安抚。")}
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
                  注：比赛版先用截图和手工桥接保证真实性，后续 iOS 版本再把健康数据自动同步到服务端。
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
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
          <linearGradient id="recoveryLine" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="url(#recoveryLine)"
          strokeWidth="4"
          points={buildPoints(
            history.map((point) => point.recoveryScore),
            100,
          )}
        />
        <polyline
          fill="none"
          stroke="url(#stressLine)"
          strokeWidth="4"
          points={buildPoints(
            history.map((point) => point.stressLevel),
            100,
          )}
        />
        {history.map((point, index) => {
          const x = padding + (index * (width - padding * 2)) / (history.length - 1);
          const recoveryY =
            height - padding - (point.recoveryScore / 100) * (height - padding * 2);
          const stressY =
            height - padding - (point.stressLevel / 100) * (height - padding * 2);

          return (
            <g key={point.label}>
              <circle cx={x} cy={recoveryY} fill="#0f766e" r="5" />
              <circle cx={x} cy={stressY} fill="#fb7185" r="5" />
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
