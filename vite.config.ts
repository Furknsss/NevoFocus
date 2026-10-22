import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'suppress-websocket-errors',
        configureServer(server) {
          server.httpServer?.on('error', (err: any) => {
            if (err?.message?.includes('WebSocket') || err?.code === 'ECONNRESET') {
              return;
            }
          });
          server.httpServer?.on('upgrade', (req, socket) => {
            socket.on('error', () => {});
            const proto = req.headers['sec-websocket-protocol'] || '';
            if (String(proto).includes('vite-hmr') || String(proto).includes('vite-ping')) {
              try {
                socket.destroy();
              } catch {}
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio environment to prevent WebSocket errors
      hmr: false,
      ws: false as const,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

