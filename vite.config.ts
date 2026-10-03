import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Browser player for GitHub Pages. PAGES_BASE is the repository subpath (e.g. /PixelParade/).
export default defineConfig({
  root: 'web',
  base: process.env.PAGES_BASE ?? '/',
  publicDir: '../public',
  plugins: [react()],
  build: {outDir: '../dist/web', emptyOutDir: true, chunkSizeWarningLimit: 8000},
});
