import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      /**
       * Two entries. The patient page reached by scanning an invoice QR is
       * built separately from the staff application so a patient downloads
       * only their own screen -- see src/public-main.tsx. Vercel rewrites
       * /r/* to public.html.
       */
      input: {
        main: path.resolve(__dirname, 'index.html'),
        public: path.resolve(__dirname, 'public.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
