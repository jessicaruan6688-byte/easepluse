import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.easepulse.app",
  appName: "EasePulse",
  webDir: "dist",
  bundledWebRuntime: false,
  ios: {
    scrollEnabled: true,
    contentInset: "automatic",
  },
};

export default config;
