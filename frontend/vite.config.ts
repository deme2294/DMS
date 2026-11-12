import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const customLogger = createLogger();
const originalLoggerError = customLogger.error;

// Suppress noisy ECONNRESET / ECONNREFUSED WebSocket proxy errors
// (e.g. when browser reloads/closes a tab or backend restarts)
customLogger.error = (msg, options) => {
  const errCode = (options?.error as { code?: string } | null | undefined)?.code;
  if (
    msg.includes('ws proxy socket error') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    errCode === 'ECONNRESET' ||
    errCode === 'ECONNREFUSED'
  ) {
    return;
  }
  originalLoggerError(msg, options);
};

export default defineConfig({
  customLogger,
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            // Suppress noisy ECONNREFUSED / ECONNRESET when backend server is restarting or offline
            if (err?.code !== 'ECONNRESET' && err?.code !== 'ECONNREFUSED') {
              console.error('[vite ws proxy error]', err?.message || err);
            }
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket: any) => {
            socket.on('error', (err: any) => {
              if (err?.code === 'ECONNRESET' || err?.code === 'ECONNREFUSED' || err?.code === 'EPIPE') {
                return;
              }
            });
          });
        },
      },
    },
  },
});



