import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 10000,
    strictPort: false,
    host: true,
    allowedHosts: ['hold-the-line-0orl.onrender.com', '.onrender.com', 'localhost'],
  },
  preview: {
    port: Number(process.env.PORT) || 4173,
    host: true,
    allowedHosts: ['hold-the-line-0orl.onrender.com', '.onrender.com', 'localhost'],
  },
})
