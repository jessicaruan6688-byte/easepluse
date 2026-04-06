import type { Locale, Snapshot } from "./easepulse";

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

export type RecoveryBriefPayload = {
  locale: Locale;
  snapshot: Snapshot;
  evaluation: {
    status: string;
    statusLabel: string;
    recoveryScore: number;
    reasons: string[];
    message: string;
    nextActionTitle: string;
    nextActionDetail: string;
    focusLabel: string;
  };
  context: {
    scenarioName: string;
    careContactsCount: number;
    bluetoothState: string;
    liveHeartRate: number | null;
  };
};

export type RecoveryBriefResponse = {
  mode: "ai" | "fallback";
  headline: string;
  summary: string;
  actions: string[];
  escalationNote: string;
  generatedAt: string;
  model: string | null;
};

export async function requestRecoveryBrief(payload: RecoveryBriefPayload) {
  const base = getApiOrigin();
  const response = await fetch(`${base}/api/ai/recovery-brief`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Failed to generate recovery brief.");
  }

  return result as RecoveryBriefResponse;
}
