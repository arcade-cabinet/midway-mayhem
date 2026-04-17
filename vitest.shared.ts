import path from 'node:path';

export const sharedVitestConfig = {
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  define: {
    __DEV__: JSON.stringify(true),
  },
};
