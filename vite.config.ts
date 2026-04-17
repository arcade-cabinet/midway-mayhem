import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isCapacitor = process.env.CAPACITOR === 'true';

export default defineConfig({
  base: isCapacitor ? './' : '/midway-mayhem/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4175 },
  optimizeDeps: { exclude: ['sql.js'] },
});
