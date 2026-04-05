export type AccountProfile = {
  fullName: string;
  preferredName: string;
  ageRange: string;
  city: string;
  role: string;
  deviceModel: string;
  wellbeingGoal: string;
};

export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  profile: AccountProfile;
};

export type DeliveryMode = "email" | "preview";

export type RegisterPayload = {
  email: string;
  password: string;
  profile: AccountProfile;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type VerificationPayload = {
  email: string;
  code: string;
};

type SessionResponse = {
  token: string;
  user: SessionUser;
};

const sessionTokenKey = "easepulse-session-token";
const hostedApiOrigin = "https://easepluse.zeabur.app";

function getApiOrigin() {
  const explicit = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }

  if (typeof window === "undefined") {
    return "";
  }

  if (window.location.protocol === "capacitor:") {
    return hostedApiOrigin;
  }

  return "";
}

async function request<T>(path: string, init: RequestInit = {}) {
  const base = getApiOrigin();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "请求失败。");
  }

  return payload as T;
}

export function readStoredSessionToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(sessionTokenKey) || "";
}

export function storeSessionToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(sessionTokenKey, token);
}

export function clearSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(sessionTokenKey);
}

export function readVerificationLink() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const email = params.get("email");
  const code = params.get("code");

  if (mode !== "verify" || !email) {
    return null;
  }

  return {
    email,
    code: code || "",
  };
}

export async function registerAccount(payload: RegisterPayload) {
  return request<{
    email: string;
    expiresAt: string;
    deliveryMode: DeliveryMode;
    previewCode: string | null;
    message: string;
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmailCode(payload: VerificationPayload) {
  return request<SessionResponse>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resendVerificationCode(email: string) {
  return request<{
    email: string;
    expiresAt: string;
    deliveryMode: DeliveryMode;
    previewCode: string | null;
    message: string;
  }>("/api/auth/resend-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function loginAccount(payload: LoginPayload) {
  return request<SessionResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchSession(token: string) {
  return request<{ user: SessionUser }>(`/api/auth/session?token=${encodeURIComponent(token)}`);
}

export async function logoutAccount(token: string) {
  return request<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
