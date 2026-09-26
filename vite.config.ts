import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    // The chronometer geometry is static SVG generated at build/runtime; nothing
    // here is code-split because the instrument must be present on first paint
    // for the page to read as a chronometer at all.
    assetsInlineLimit: 0,
  },
})
