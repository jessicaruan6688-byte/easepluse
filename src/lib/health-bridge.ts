import { Capacitor, registerPlugin, type Plugin } from "@capacitor/core";
import type { Locale, Snapshot } from "./easepulse";

export type NativeHealthPermissionStatus =
  | "notDetermined"
  | "sharingDenied"
  | "sharingAuthorized"
  | "unavailable";

export type NativeHealthAuthorizationStatus =
  | NativeHealthPermissionStatus
  | "partiallyAuthorized";

export type NativeHealthPermissions = {
  sleepAnalysis?: NativeHealthPermissionStatus;
  restingHeartRate?: NativeHealthPermissionStatus;
  heartRate?: NativeHealthPermissionStatus;
  stepCount?: NativeHealthPermissionStatus;
  activeEnergyBurned?: NativeHealthPermissionStatus;
  appleExerciseTime?: NativeHealthPermissionStatus;
};

export type NativeHealthAvailability = {
  available: boolean;
  status: NativeHealthAuthorizationStatus;
  permissions: NativeHealthPermissions;
};

export type NativeHealthSummary = {
  source: "appleHealth";
  fetchedAt: number;
  todayStart: number;
  todayEnd: number;
  sleepWindowStart: number;
  sleepWindowEnd: number;
  permissions: NativeHealthPermissions;
  metrics: {
    sleepHours?: number;
    restingHeartRate?: number;
    latestHeartRate?: number;
    baselineRestingHeartRate?: number;
    stepCount?: number;
    activeEnergyKcal?: number;
    exerciseMinutes?: number;
  };
  coverage: {
    sleepSampleCount: number;
    heartRateSampleCount: number;
    baselineDays: number;
  };
  errors?: string[];
};

export interface HealthBridgePlugin extends Plugin {
  isAvailable(): Promise<NativeHealthAvailability>;
  getAuthorizationStatus(): Promise<NativeHealthAvailability>;
  requestPermissions(): Promise<NativeHealthAvailability>;
  getDailySummary(): Promise<NativeHealthSummary>;
}

export const HealthBridge = registerPlugin<HealthBridgePlugin>("HealthBridge");

export function isNativeHealthBridgeSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pickNumber(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value));
}

export function buildSnapshotFromHealthSummary(
  summary: NativeHealthSummary,
  locale: Locale,
): Snapshot {
  const sleepHours = Number((pickNumber(summary.metrics.sleepHours, 6.2) ?? 6.2).toFixed(1));
  const restingHeartRate = Math.round(
    pickNumber(summary.metrics.restingHeartRate, summary.metrics.latestHeartRate, 66) ?? 66,
  );
  const baselineRestingHeartRate = Math.round(
    pickNumber(
      summary.metrics.baselineRestingHeartRate,
      restingHeartRate - 4,
      62,
    ) ?? 62,
  );
  const stepCount = Math.round(pickNumber(summary.metrics.stepCount, 0) ?? 0);
  const activeMinutes = Math.round(
    pickNumber(
      summary.metrics.exerciseMinutes,
      stepCount > 0 ? Math.min(60, Math.max(8, stepCount / 260)) : 12,
      12,
    ) ?? 12,
  );
  const sleepScore = clamp(Math.round(34 + sleepHours * 7.4), 52, 96);

  let stressLevel =
    44 +
    Math.max(0, 6.6 - sleepHours) * 9 +
    Math.max(0, restingHeartRate - baselineRestingHeartRate) * 4;

  if (stepCount < 4000) {
    stressLevel += 6;
  }

  if (activeMinutes < 20) {
    stressLevel += 6;
  }

  if ((summary.metrics.activeEnergyKcal ?? 0) > 700) {
    stressLevel += 4;
  }

  stressLevel = clamp(Math.round(stressLevel), 32, 86);

  const sedentaryHours = clamp(
    Math.round(11.5 - activeMinutes / 18 - Math.min(stepCount / 5000, 2.5)),
    5,
    12,
  );
  const moodScore = stressLevel >= 72 ? 2 : stressLevel >= 58 ? 3 : 4;

  const missing: string[] = [];
  if (typeof summary.metrics.sleepHours !== "number") {
    missing.push(locale === "en" ? "sleep" : locale === "es" ? "sueño" : "睡眠");
  }
  if (typeof summary.metrics.restingHeartRate !== "number") {
    missing.push(locale === "en" ? "resting heart rate" : locale === "es" ? "frecuencia en reposo" : "静息心率");
  }

  const summaryText =
    locale === "en"
      ? `Synced from Apple Health. Sleep ${sleepHours} h, resting heart rate ${restingHeartRate} bpm, steps ${stepCount}.`
      : locale === "es"
        ? `Sincronizado desde Apple Health. Sueño ${sleepHours} h, frecuencia en reposo ${restingHeartRate} lpm y ${stepCount} pasos.`
        : `已从 Apple 健康同步。睡眠 ${sleepHours} 小时，静息心率 ${restingHeartRate} 次/分，步数 ${stepCount}。`;

  const missingText =
    missing.length === 0
      ? ""
      : locale === "en"
        ? ` Missing: ${missing.join(", ")}.`
        : locale === "es"
          ? ` Faltan: ${missing.join(", ")}.`
          : ` 暂缺：${missing.join("、")}。`;

  return {
    sleepHours,
    sleepScore,
    restingHeartRate,
    baselineRestingHeartRate,
    stressLevel,
    activeMinutes,
    sedentaryHours,
    moodScore,
    notes: `${summaryText}${missingText}`,
    symptoms: ["none"],
  };
}
