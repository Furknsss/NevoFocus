import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
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
          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url.startsWith('/auth/callback') || req.url.includes('code='))) {
              if (req.url.startsWith('/auth/callback')) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(`<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>Hesap Bağlanıyor...</title></head>
<body style="background:#050505;color:#fff;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="padding:24px 32px;border-radius:20px;background:#111;border:1px solid #262626;text-align:center;">
    <h3 style="margin:0 0 8px 0;color:#1DB954;">Bağlantı Başarılı</h3>
    <p style="margin:0;font-size:13px;color:#a3a3a3;">Hesabınız doğrulandı, pencere otomatik kapatılıyor...</p>
  </div>
  <script>
    (function() {
      try {
        var params = new URLSearchParams(window.location.search);
        var hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        var code = params.get('code') || hashParams.get('code');
        var accessToken = params.get('access_token') || hashParams.get('access_token');
        if (window.opener) {
          if (code) {
            window.opener.postMessage({ type: 'SPOTIFY_AUTH_CODE', code: code, redirectUri: window.location.origin + '/auth/callback' }, '*');
          } else if (accessToken) {
            window.opener.postMessage({ type: 'SPOTIFY_ACCESS_TOKEN', accessToken: accessToken }, '*');
          }
          setTimeout(function() { window.close(); }, 250);
        } else {
          window.location.href = '/?code=' + encodeURIComponent(code || '');
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`);
                return;
              }
            }
            next();
          });
          server.httpServer?.on('error', () => {
            // Suppress server-level socket/websocket errors
          });
          server.httpServer?.on('clientError', (_err, socket) => {
            try {
              socket.destroy();
            } catch {}
          });
          server.httpServer?.on('upgrade', (req, socket) => {
            socket.on('error', () => {});
            const key = req.headers['sec-websocket-key'];
            const proto = req.headers['sec-websocket-protocol'];
            if (!key || typeof key !== 'string') {
              try {
                socket.destroy();
              } catch {}
              return;
            }
            try {
              const accept = crypto
                .createHash('sha1')
                .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
                .digest('base64');
              const headers = [
                'HTTP/1.1 101 Switching Protocols',
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Accept: ${accept}`,
              ];
              if (proto) {
                const firstProto = String(proto).split(',')[0].trim();
                if (firstProto) {
                  headers.push(`Sec-WebSocket-Protocol: ${firstProto}`);
                }
              }
              headers.push('', '');
              socket.write(headers.join('\r\n'));

              // Send a valid RFC 6455 unmasked text frame: {"type":"connected"}
              const payload = Buffer.from('{"type":"connected"}', 'utf8');
              const frame = Buffer.alloc(2 + payload.length);
              frame[0] = 0x81; // FIN + text frame
              frame[1] = payload.length;
              payload.copy(frame, 2);
              socket.write(frame);
            } catch {
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


