import './styles/tokens.css';
import './styles/app.css';
import './styles/theme-lc.css';
import './styles/pages.css';
import { loadTracks } from './data.js';
import { loadContent } from './content2.js';
import { createPlayer } from './audio/player.js';
import { createApp } from './ui/app.js';

async function boot() {
  const mountNode = document.getElementById('app');
  const [dataset, content] = await Promise.all([loadTracks(), loadContent()]);
  const player = createPlayer();
  player.setTracks(dataset.tracks);
  // shortcut: app.js 目前以裸标识符引用 player，先挂到全局；之后改成 createApp({ player })
  window.player = player;
  const app = createApp({ dataset, content });
  app.mount(mountNode);
  window.addEventListener('pagehide', () => player.flushPosition());
}

boot().catch((error) => {
  console.error(error);
  const node = document.getElementById('app');
  if (node) {
    node.textContent = 'BOOT FAILURE // ' + (error?.message || 'unknown');
    node.style.cssText = 'padding:32px;font-family:ui-monospace,monospace;color:#C8102E;background:#08090A';
  }
});
