import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/external-api': {
        target: 'https://api.baiwumm.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/external-api/, ''),
      },
      '/poetry-api': {
        target: 'https://v2.xxapi.cn/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/poetry-api/, ''),
      },
      '/tongue-api': {
        target: 'https://api.ruseo.cn/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tongue-api/, ''),
      },
    },
  },
})
