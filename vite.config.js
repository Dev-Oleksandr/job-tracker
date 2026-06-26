import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' makes all asset paths relative so they resolve under the
// Capacitor WebView (which serves from a file:// style origin).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
})
