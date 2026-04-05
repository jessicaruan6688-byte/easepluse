import { useEffect, useState } from "react";
import type {
  AccountProfile,
  DeliveryMode,
  LoginPayload,
  RegisterPayload,
  VerificationPayload,
} from "../lib/auth-client";

type AuthScreen = "register" | "login" | "verify";

type AuthGateProps = {
  defaultScreen?: AuthScreen;
  errorMessage: string;
  infoMessage: string;
  isLoading: boolean;
  pendingEmail: string;
  previewCode: string | null;
  deliveryMode: DeliveryMode | null;
  initialVerificationCode?: string;
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onLogin: (payload: LoginPayload) => Promise<void>;
  onVerify: (payload: VerificationPayload) => Promise<void>;
  onResend: (email: string) => Promise<void>;
};

const blankProfile: AccountProfile = {
  fullName: "",
  preferredName: "",
  ageRange: "",
  city: "",
  role: "",
  deviceModel: "Huawei Band 9 + iPhone",
  wellbeingGoal: "",
};

export function AuthGate({
  defaultScreen = "register",
  errorMessage,
  infoMessage,
  isLoading,
  pendingEmail,
  previewCode,
  deliveryMode,
  initialVerificationCode = "",
  onRegister,
  onLogin,
  onVerify,
  onResend,
}: AuthGateProps) {
  const [screen, setScreen] = useState<AuthScreen>(defaultScreen);
  const [registerForm, setRegisterForm] = useState<RegisterPayload>({
    email: pendingEmail,
    password: "",
    profile: blankProfile,
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginForm, setLoginForm] = useState<LoginPayload>({
    email: pendingEmail,
    password: "",
  });
  const [verificationCode, setVerificationCode] = useState(initialVerificationCode);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setScreen(defaultScreen);
  }, [defaultScreen]);

  useEffect(() => {
    if (pendingEmail) {
      setRegisterForm((current) => ({ ...current, email: pendingEmail }));
      setLoginForm((current) => ({ ...current, email: pendingEmail }));
    }
  }, [pendingEmail]);

  useEffect(() => {
    if (initialVerificationCode) {
      setVerificationCode(initialVerificationCode);
    }
  }, [initialVerificationCode]);

  async function handleRegisterSubmit() {
    setLocalError("");

    if (registerForm.password !== confirmPassword) {
      setLocalError("两次密码输入不一致。");
      return;
    }

    if (registerForm.password.length < 8) {
      setLocalError("密码至少需要 8 位。");
      return;
    }

    await onRegister(registerForm);
  }

  async function handleLoginSubmit() {
    setLocalError("");
    await onLogin(loginForm);
  }

  async function handleVerifySubmit() {
    setLocalError("");
    await onVerify({
      email: pendingEmail || registerForm.email || loginForm.email,
      code: verificationCode,
    });
  }

  return (
    <div className="auth-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <section className="auth-marketing">
        <p className="eyebrow">EasePulse 息伴</p>
        <h1>注册后，把你的恢复画像和支持关系保存下来。</h1>
        <p className="auth-lede">
          首页已经先开放给你看项目本体。这里的注册登录只负责保存邮箱验证、个人资料、恢复工作台和关怀圈关系，不再挡住第一屏。
        </p>

        <div className="auth-feature-list">
          <article className="auth-feature-card">
            <span>01</span>
            <strong>保存恢复画像</strong>
            <p>把你的邮箱、设备和恢复目标写进账号，后续才能形成长期工作台。</p>
          </article>
          <article className="auth-feature-card">
            <span>02</span>
            <strong>邮箱验证</strong>
            <p>验证码链路已经接好；配置邮件服务后会直接发到用户邮箱。</p>
          </article>
          <article className="auth-feature-card">
            <span>03</span>
            <strong>关怀关系</strong>
            <p>姓名、城市、角色、设备和恢复目标会被带进登录后的工作台与关怀圈。</p>
          </article>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-switch">
          <button
            type="button"
            className={screen === "register" ? "chip chip-solid" : "chip"}
            onClick={() => setScreen("register")}
          >
            注册
          </button>
          <button
            type="button"
            className={screen === "login" ? "chip chip-solid" : "chip"}
            onClick={() => setScreen("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={screen === "verify" ? "chip chip-solid" : "chip"}
            onClick={() => setScreen("verify")}
          >
            验证邮箱
          </button>
        </div>

        {infoMessage ? <div className="auth-notice auth-notice-info">{infoMessage}</div> : null}
        {previewCode ? (
          <div className="auth-notice auth-notice-preview">
            当前环境未接真实外发邮件，验证码预览为 <strong>{previewCode}</strong>
          </div>
        ) : null}
        {errorMessage || localError ? (
          <div className="auth-notice auth-notice-error">{localError || errorMessage}</div>
        ) : null}

        {screen === "register" ? (
          <div className="auth-form-grid">
            <label>
              <span>邮箱</span>
              <input
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <label>
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <label>
              <span>姓名</span>
              <input
                type="text"
                value={registerForm.profile.fullName}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, fullName: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              <span>想怎么称呼你</span>
              <input
                type="text"
                value={registerForm.profile.preferredName}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, preferredName: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              <span>年龄段</span>
              <select
                value={registerForm.profile.ageRange}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, ageRange: event.target.value },
                  }))
                }
              >
                <option value="">请选择</option>
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45+">45+</option>
              </select>
            </label>
            <label>
              <span>城市</span>
              <input
                type="text"
                value={registerForm.profile.city}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, city: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              <span>当前角色</span>
              <input
                type="text"
                value={registerForm.profile.role}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, role: event.target.value },
                  }))
                }
              />
            </label>
            <label>
              <span>设备</span>
              <input
                type="text"
                value={registerForm.profile.deviceModel}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, deviceModel: event.target.value },
                  }))
                }
              />
            </label>
            <label className="auth-full-span">
              <span>你现在最想改善什么</span>
              <textarea
                rows={4}
                value={registerForm.profile.wellbeingGoal}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, wellbeingGoal: event.target.value },
                  }))
                }
              />
            </label>

            <button type="button" className="button-primary auth-submit" disabled={isLoading} onClick={handleRegisterSubmit}>
              {isLoading ? "提交中..." : "创建账号并发送验证码"}
            </button>
          </div>
        ) : null}

        {screen === "login" ? (
          <div className="auth-form-grid">
            <label>
              <span>邮箱</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <button type="button" className="button-primary auth-submit" disabled={isLoading} onClick={handleLoginSubmit}>
              {isLoading ? "登录中..." : "登录进入 App"}
            </button>
          </div>
        ) : null}

        {screen === "verify" ? (
          <div className="auth-form-grid">
            <label>
              <span>待验证邮箱</span>
              <input type="email" value={pendingEmail || registerForm.email || loginForm.email} disabled />
            </label>
            <label>
              <span>6 位验证码</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
              />
            </label>
            <div className="auth-inline-actions">
              <button type="button" className="button-primary" disabled={isLoading} onClick={handleVerifySubmit}>
                {isLoading ? "验证中..." : "验证并进入 App"}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={isLoading || !(pendingEmail || registerForm.email || loginForm.email)}
                onClick={() => onResend(pendingEmail || registerForm.email || loginForm.email)}
              >
                重新发送
              </button>
            </div>
            <p className="auth-help-text">
              {deliveryMode === "email"
                ? "验证码会发送到你的邮箱。"
                : "当前是预览验证码模式，方便本地和模拟器先把整条链路跑通。"}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
