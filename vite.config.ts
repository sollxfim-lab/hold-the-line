import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 10000,
    strictPort: true,
  },
})
Vite dev server port changed to 10000 in vite.config.ts. Run npm run dev and it will serve on http://localhost:10000.
