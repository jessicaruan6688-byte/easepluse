import { useEffect, useState } from "react";
import type {
  AccountProfile,
  DeliveryMode,
  LoginPayload,
  RegisterPayload,
  VerificationPayload,
} from "../lib/auth-client";
import type { Locale } from "../lib/easepulse";

type AuthScreen = "register" | "login" | "verify";

type AuthGateProps = {
  defaultScreen?: AuthScreen;
  locale: Locale;
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

function getBlankProfile(locale: Locale): AccountProfile {
  return {
    fullName: "",
    preferredName: "",
    ageRange: "",
    city: "",
    role: "",
    deviceModel:
      locale === "en"
        ? "Huawei Band + Phone"
        : locale === "es"
          ? "Huawei Band + Teléfono"
          : "华为手环 + 手机",
    wellbeingGoal: "",
  };
}

function getDeviceOptions(locale: Locale) {
  if (locale === "en") {
    return [
      "Huawei Band + Phone",
      "Xiaomi Band + Phone",
      "Apple Watch + iPhone",
      "Garmin + Phone",
      "Fitbit + Phone",
      "Other wearable + Phone",
    ];
  }

  if (locale === "es") {
    return [
      "Huawei Band + Teléfono",
      "Xiaomi Band + Teléfono",
      "Apple Watch + iPhone",
      "Garmin + Teléfono",
      "Fitbit + Teléfono",
      "Otro wearable + Teléfono",
    ];
  }

  return [
    "华为手环 + 手机",
    "小米手环 + 手机",
    "Apple Watch + iPhone",
    "Garmin + 手机",
    "Fitbit + 手机",
    "其他手环 + 手机",
  ];
}

export function AuthGate({
  defaultScreen = "register",
  locale,
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
  const deviceOptions = getDeviceOptions(locale);
  const [screen, setScreen] = useState<AuthScreen>(defaultScreen);
  const [registerForm, setRegisterForm] = useState<RegisterPayload>({
    email: pendingEmail,
    password: "",
    profile: getBlankProfile(locale),
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
      setLocalError(
        locale === "en"
          ? "The passwords do not match."
          : locale === "es"
            ? "Las contraseñas no coinciden."
            : "两次密码输入不一致。",
      );
      return;
    }

    if (registerForm.password.length < 8) {
      setLocalError(
        locale === "en"
          ? "Password must be at least 8 characters."
          : locale === "es"
            ? "La contraseña debe tener al menos 8 caracteres."
            : "密码至少需要 8 位。",
      );
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
        <h1>
          {locale === "en"
            ? "Save your recovery profile and support network."
            : locale === "es"
              ? "Guarda tu perfil de recuperación y tu red de apoyo."
              : "注册后，把你的恢复画像和支持关系保存下来。"}
        </h1>
        <p className="auth-lede">
          {locale === "en"
            ? "The homepage now opens straight into the product. Sign-up and login only save email verification, profile, recovery workspace, and care-circle relationships."
            : locale === "es"
              ? "La home ya abre directamente el producto. El registro y el acceso solo sirven para guardar verificación por correo, perfil, espacio de recuperación y relaciones del círculo de cuidado."
              : "首页已经先开放给你看项目本体。这里的注册登录只负责保存邮箱验证、个人资料、恢复工作台和关怀圈关系，不再挡住第一屏。"}
        </p>

        <div className="auth-feature-list">
          <article className="auth-feature-card">
            <span>01</span>
            <strong>{locale === "en" ? "Save your profile" : locale === "es" ? "Guardar perfil" : "保存恢复画像"}</strong>
            <p>{locale === "en" ? "Store your email, device, and recovery goals so the workspace can persist." : locale === "es" ? "Guarda tu correo, dispositivo y objetivos para que el espacio de trabajo persista." : "把你的邮箱、设备和恢复目标写进账号，后续才能形成长期工作台。"}</p>
          </article>
          <article className="auth-feature-card">
            <span>02</span>
            <strong>{locale === "en" ? "Email verification" : locale === "es" ? "Verificación por correo" : "邮箱验证"}</strong>
            <p>{locale === "en" ? "The verification flow is wired. Once mail delivery is configured, codes go straight to the inbox." : locale === "es" ? "El flujo de verificación ya está conectado. Cuando el envío de correo esté configurado, los códigos irán directo a la bandeja." : "验证码链路已经接好；配置邮件服务后会直接发到用户邮箱。"}</p>
          </article>
          <article className="auth-feature-card">
            <span>03</span>
            <strong>{locale === "en" ? "Care relationships" : locale === "es" ? "Relaciones de cuidado" : "关怀关系"}</strong>
            <p>{locale === "en" ? "Name, city, role, wearable choice, and goals flow into the workspace and care circle after login." : locale === "es" ? "Nombre, ciudad, rol, wearable elegido y objetivos pasan al espacio de trabajo y al círculo de cuidado tras iniciar sesión." : "姓名、城市、角色、设备和恢复目标会被带进登录后的工作台与关怀圈。"}</p>
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
            {locale === "en" ? "Sign up" : locale === "es" ? "Registro" : "注册"}
          </button>
          <button
            type="button"
            className={screen === "login" ? "chip chip-solid" : "chip"}
            onClick={() => setScreen("login")}
          >
            {locale === "en" ? "Login" : locale === "es" ? "Entrar" : "登录"}
          </button>
          <button
            type="button"
            className={screen === "verify" ? "chip chip-solid" : "chip"}
            onClick={() => setScreen("verify")}
          >
            {locale === "en" ? "Verify email" : locale === "es" ? "Verificar correo" : "验证邮箱"}
          </button>
        </div>

        {infoMessage ? <div className="auth-notice auth-notice-info">{infoMessage}</div> : null}
        {previewCode ? (
          <div className="auth-notice auth-notice-preview">
            {locale === "en" ? "Outbound email is not configured in this environment. Preview code:" : locale === "es" ? "El envío real de correo no está configurado en este entorno. Código de vista previa:" : "当前环境未接真实外发邮件，验证码预览为 "} <strong>{previewCode}</strong>
          </div>
        ) : null}
        {errorMessage || localError ? (
          <div className="auth-notice auth-notice-error">{localError || errorMessage}</div>
        ) : null}

        {screen === "register" ? (
          <div className="auth-form-grid">
            <label>
              <span>{locale === "en" ? "Email" : locale === "es" ? "Correo" : "邮箱"}</span>
              <input
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{locale === "en" ? "Password" : locale === "es" ? "Contraseña" : "密码"}</span>
              <input
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{locale === "en" ? "Confirm password" : locale === "es" ? "Confirmar contraseña" : "确认密码"}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <label>
              <span>{locale === "en" ? "Full name" : locale === "es" ? "Nombre completo" : "姓名"}</span>
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
              <span>{locale === "en" ? "Preferred name" : locale === "es" ? "Nombre preferido" : "想怎么称呼你"}</span>
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
              <span>{locale === "en" ? "Age range" : locale === "es" ? "Rango de edad" : "年龄段"}</span>
              <select
                value={registerForm.profile.ageRange}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, ageRange: event.target.value },
                  }))
                }
              >
                <option value="">{locale === "en" ? "Please choose" : locale === "es" ? "Selecciona" : "请选择"}</option>
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45+">45+</option>
              </select>
            </label>
            <label>
              <span>{locale === "en" ? "City" : locale === "es" ? "Ciudad" : "城市"}</span>
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
              <span>{locale === "en" ? "Role" : locale === "es" ? "Rol" : "当前角色"}</span>
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
              <span>{locale === "en" ? "Wearable / device" : locale === "es" ? "Wearable / dispositivo" : "设备"}</span>
              <select
                value={registerForm.profile.deviceModel}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    profile: { ...current.profile, deviceModel: event.target.value },
                  }))
                }
              >
                {deviceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-full-span">
              <span>{locale === "en" ? "What do you most want to improve right now?" : locale === "es" ? "¿Qué es lo que más quieres mejorar ahora?" : "你现在最想改善什么"}</span>
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
              {isLoading ? (locale === "en" ? "Submitting..." : locale === "es" ? "Enviando..." : "提交中...") : locale === "en" ? "Create account and send code" : locale === "es" ? "Crear cuenta y enviar código" : "创建账号并发送验证码"}
            </button>
          </div>
        ) : null}

        {screen === "login" ? (
          <div className="auth-form-grid">
            <label>
              <span>{locale === "en" ? "Email" : locale === "es" ? "Correo" : "邮箱"}</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              <span>{locale === "en" ? "Password" : locale === "es" ? "Contraseña" : "密码"}</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <button type="button" className="button-primary auth-submit" disabled={isLoading} onClick={handleLoginSubmit}>
              {isLoading ? (locale === "en" ? "Logging in..." : locale === "es" ? "Entrando..." : "登录中...") : locale === "en" ? "Login to app" : locale === "es" ? "Entrar en la app" : "登录进入 App"}
            </button>
          </div>
        ) : null}

        {screen === "verify" ? (
          <div className="auth-form-grid">
            <label>
              <span>{locale === "en" ? "Email to verify" : locale === "es" ? "Correo a verificar" : "待验证邮箱"}</span>
              <input type="email" value={pendingEmail || registerForm.email || loginForm.email} disabled />
            </label>
            <label>
              <span>{locale === "en" ? "6-digit code" : locale === "es" ? "Código de 6 dígitos" : "6 位验证码"}</span>
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
                {isLoading ? (locale === "en" ? "Verifying..." : locale === "es" ? "Verificando..." : "验证中...") : locale === "en" ? "Verify and enter app" : locale === "es" ? "Verificar y entrar" : "验证并进入 App"}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={isLoading || !(pendingEmail || registerForm.email || loginForm.email)}
                onClick={() => onResend(pendingEmail || registerForm.email || loginForm.email)}
              >
                {locale === "en" ? "Resend" : locale === "es" ? "Reenviar" : "重新发送"}
              </button>
            </div>
            <p className="auth-help-text">
              {deliveryMode === "email"
                ? locale === "en"
                  ? "The verification code will be sent to your inbox."
                  : locale === "es"
                    ? "El código de verificación se enviará a tu correo."
                    : "验证码会发送到你的邮箱。"
                : locale === "en"
                  ? "This environment is using preview-code mode so the full flow can be tested locally and in the simulator."
                  : locale === "es"
                    ? "Este entorno usa modo de código de vista previa para probar toda la cadena en local y en el simulador."
                    : "当前是预览验证码模式，方便本地和模拟器先把整条链路跑通。"}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
