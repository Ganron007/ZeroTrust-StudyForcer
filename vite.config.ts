import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const variant = process.env.VITE_VARIANT || 'original'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_VARIANT__: JSON.stringify(variant),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      '@radix-ui/react-slot',
      '@tauri-apps/api/core',
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
})