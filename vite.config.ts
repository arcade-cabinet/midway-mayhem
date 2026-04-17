import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const isCapacitor = process.env.CAPACITOR === 'true';

const src = (sub: string) => path.resolve(__dirname, `src/${sub}`);

export default defineConfig({
  base: isCapacitor ? './' : '/midway-mayhem/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/audio': src('audio/index.ts'),
      '@/obstacles': src('obstacles/index.ts'),
      '@/cockpit': src('cockpit/index.ts'),
      '@/hud': src('hud/index.ts'),
      '@/track': src('track/index.ts'),
      '@/systems': src('systems/index.ts'),
      '@/config': src('config/index.ts'),
      '@/persistence': src('persistence/index.ts'),
      '@/design': src('design/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // three.js core + examples/jsm together to avoid split imports
          if (id.includes('node_modules/three')) return 'three-vendor';
          // React Three Fiber ecosystem
          if (
            id.includes('node_modules/@react-three/') ||
            id.includes('node_modules/postprocessing')
          )
            return 'r3f-vendor';
          // Audio synthesis libraries
          if (id.includes('node_modules/tone') || id.includes('node_modules/spessasynth_lib'))
            return 'audio-vendor';
          // Yuka AI driver
          if (id.includes('node_modules/yuka')) return 'ai-vendor';
        },
      },
    },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4175 },
  optimizeDeps: { exclude: ['sql.js'] },
});
