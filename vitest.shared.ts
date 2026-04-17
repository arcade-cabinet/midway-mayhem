import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const sharedVitestConfig = {
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  define: {
    __DEV__: JSON.stringify(true),
  },
};
