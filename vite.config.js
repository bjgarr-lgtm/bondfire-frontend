import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: we're serving the built app under /app/ on Netlify,
// so Vite must generate asset URLs with that base.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
})

