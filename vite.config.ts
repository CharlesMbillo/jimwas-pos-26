import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Supabase integration variables are provisioned without the VITE_ prefix.
// Map only the public URL and anon key into the browser bundle at build time.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

  return {
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
  },
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
  };
});
