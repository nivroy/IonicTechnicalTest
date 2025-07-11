import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'IonicTest',
  webDir: 'www',
  ios: {
    webContentsDebuggingEnabled: true
  }
};

export default config;
