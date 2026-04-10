import { Capacitor, registerPlugin, type PluginListenerHandle, type Plugin } from "@capacitor/core";

export type NativeBandStatus = {
  state: "idle" | "connecting" | "connected" | "unsupported" | "error";
  deviceName?: string;
  heartRate?: number | null;
  lastSignalAt?: number | null;
  errorMessage?: string;
};

type AvailabilityResponse = {
  available: boolean;
  state: NativeBandStatus["state"];
};

type HeartRateEvent = {
  heartRate: number;
  measuredAt: number;
};

export interface BandBridgePlugin extends Plugin {
  isAvailable(): Promise<AvailabilityResponse>;
  getStatus(): Promise<NativeBandStatus>;
  connect(): Promise<NativeBandStatus>;
  disconnect(): Promise<NativeBandStatus>;
  addListener(
    eventName: "statusChange",
    listenerFunc: (status: NativeBandStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "heartRate",
    listenerFunc: (payload: HeartRateEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const BandBridge = registerPlugin<BandBridgePlugin>("BandBridge");

export function isNativeBandBridgeSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}
