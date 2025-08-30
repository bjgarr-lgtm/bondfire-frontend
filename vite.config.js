import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use '/' if the site is served at the domain root.
// If you were serving under a subpath, use base: './'
export default defineConfig({
  plugins: [react()],
  base: '/',                 // or './' if hosted in a subpath
  build: { assetsDir: 'assets' }
})
