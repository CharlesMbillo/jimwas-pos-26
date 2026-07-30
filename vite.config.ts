import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.vercel.run',
      '.vercel.app',
      '.vusercontent.net',
    ],
    // Disable HMR completely - not available in preview environment
    hmr: false,
    middlewareMode: false,
  },
  preview: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.vercel.run',
      '.vercel.app',
      '.vusercontent.net',
    ],
  },
});
