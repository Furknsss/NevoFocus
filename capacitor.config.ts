import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.furknsss.nevofocus',
  appName: 'NevoFocus',
  webDir: 'dist',
  android: {
    // Keep a secure local origin for Firebase and modern web APIs.
    buildOptions: {},
  },
};

export default config;
