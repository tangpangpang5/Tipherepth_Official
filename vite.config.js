import { defineConfig } from 'vite';

// base './'：站点可部署在子路径（例如 music.example.com/ 或 example.com/music/）
// three 通过 src/scene/wall.js 里的动态 import 引入，Vite 会自动切成独立 chunk。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0
  },
  server: {
    host: '127.0.0.1',
    port: 5177
  }
});
