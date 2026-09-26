
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
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
          proxy.on('error', (err) => {
            // Suppress benign ECONNRESET socket disconnect errors on client browser page reload
            if ((err as any).code !== 'ECONNRESET') {
              console.error('[vite ws proxy error]', err.message);
            }
          });
        },
      },
    },
  },
});




