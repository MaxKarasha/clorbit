import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The dev proxy follows the server port (CLORBIT_PORT, legacy FLEET_PORT, default 4980).
const apiPort = Number(process.env.CLORBIT_PORT || process.env.FLEET_PORT) || 4980;

export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
  build: { outDir: '../dist', emptyOutDir: true },
});
