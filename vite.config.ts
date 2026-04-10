import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import sacnBridge from './vite-plugins/sacn-bridge';

// WLED_HOST environment variable: set to your cube's IP when proxying WLED locally.
// Usage: WLED_HOST=192.168.1.100 npm run dev
// Then access WLED API at http://localhost:5173/api/wled/... in development.
const wledHost = process.env['WLED_HOST'];

export default defineConfig({
  plugins: [react(), tailwindcss(), sacnBridge()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Expose to local network (phone access)
    ...(wledHost
      ? {
          proxy: {
            // Proxy WLED API through Vite dev server to avoid mixed content in dev
            // Only active when WLED_HOST env var is set
            '/api/wled': {
              target: `http://${wledHost}`,
              rewrite: (p) => p.replace(/^\/api\/wled/, ''),
              changeOrigin: true,
            },
          },
        }
      : {}),
  },
});
