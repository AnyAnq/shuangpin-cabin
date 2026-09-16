import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { proxyVocabularyRequest } from './functions/api/vocabularies/[[path]]'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'vocabulary-api',
      configureServer(server) {
        server.middlewares.use('/api/vocabularies', async (req, res) => {
          if (req.method !== 'GET') {
            res.writeHead(405, { Allow: 'GET' });
            res.end();
            return;
          }
          try {
            const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice(1));
            const response = await proxyVocabularyRequest(path);
            const body = await response.text();
            res.writeHead(response.status, Object.fromEntries(response.headers));
            res.end(body);
          } catch {
            res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('词库源暂时无法连接，请稍后重试。');
          }
        });
      },
    },
  ],
  server: {
    proxy: {
      '/external-api': {
        target: 'https://api.xygeng.cn/openapi',
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
