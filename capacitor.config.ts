import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hypercube.control',
  appName: 'HyperCube',
  webDir: 'dist',
  server: {
    // Use http:// scheme instead of https:// to avoid mixed content blocking
    // when making HTTP requests to local WLED devices
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
