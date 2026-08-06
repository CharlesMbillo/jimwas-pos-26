import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    // v0 previews terminate TLS and proxy the Vite websocket on the public host.
    // Keep the client on the preview origin instead of advertising the VM address.
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.vercel.run',
      '.vercel.app',
      '.vusercontent.net',
    ],
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
