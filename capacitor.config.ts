import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hypercube.control',
  appName: 'HyperCube',
  webDir: 'dist',
  plugins: {
    // Route all fetch() through native HTTP layer — bypasses WebView
    // CORS, mixed content, and private network access restrictions
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
