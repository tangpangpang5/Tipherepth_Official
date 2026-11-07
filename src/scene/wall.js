import * as THREE from 'three';

/** 一张卡带 = 一首歌。场景内只保留 POOL 个卡带实例（滑动窗口），避免 300 首时 draw call 爆炸。 */
const SPACING = 0.78;
const CASSETTE = { w: 0.66, h: 0.42, d: 0.075 };
const POOL = 25;
const CENTER = Math.floor(POOL / 2);
const LABEL_W = 512;
const LABEL_H = 320;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function wrap(ctx, text, maxWidth, maxLines = 2) {
  const chars = Array.from(String(text || ''));
  const lines = [];
  let line = '';
  for (const ch of chars) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines.slice(0, maxLines);
}

function drawLabel(canvas, track, index) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const accent = track.accent || '#E8B10A';

  ctx.fillStyle = '#0b0c0e';
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, LABEL_W, 10);

  ctx.font = '600 24px ui-monospace, monospace';
  ctx.fillStyle = '#8A8F8A';
  ctx.fillText(`TRK ${String(index + 1).padStart(3, '0')}`, 24, 52);

  const album = String(track.album || '').toUpperCase().slice(0, 18);
  ctx.textAlign = 'right';
  ctx.fillText(album, LABEL_W - 24, 52);
  ctx.textAlign = 'left';

  ctx.font = '700 40px "Noto Sans SC", system-ui, sans-serif';
  ctx.fillStyle = '#E6E3DA';
  const lines = wrap(ctx, track.title, LABEL_W - 48, 2);
  lines.forEach((line, i) => ctx.fillText(line, 24, 148 + i * 46));

  ctx.font = '500 22px ui-monospace, monospace';
  ctx.fillStyle = '#8A8F8A';
  ctx.fillText(String(track.artist || '').toUpperCase().slice(0, 26), 24, 272);

  const dur = track.durationMs > 0 ? `${Math.floor(track.durationMs / 60000)}:${String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, '0')}` : '--:--';
  ctx.textAlign = 'right';
  ctx.fillText(dur, LABEL_W - 24, 272);
  ctx.textAlign = 'left';

  // 条形码（确定性伪随机，每次重绘一致）
  let seed = (index + 1) * 2654435761;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = 'rgba(232,177,10,0.55)';
  let x = 24;
  while (x < LABEL_W - 24) {
    const w = rand() > 0.5 ? 2 : 5;
    ctx.fillRect(x, LABEL_H - 26, w, 14);
    x += w + (rand() > 0.6 ? 4 : 2);
  }
}

export function mountWall({ container, tracks, onSelect, onFocus, startIndex = 0 }) {
  const host = container.parentElement || container;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) throw new Error('WebGL not available');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090a);
  scene.fog = new THREE.Fog(0x08090a, 2.8, 6.2);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
  camera.position.set(0, 0.08, 3.05);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'wall__canvas';
  renderer.domElement.setAttribute('aria-label', '卡带墙');
  container.append(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x8891a0, 0.85));
  const key = new THREE.DirectionalLight(0xfff3dc, 1.15);
  key.position.set(1.6, 2.2, 2.4);
  scene.add(key);
  const rim = new THREE.PointLight(new THREE.Color('#E8B10A'), 0.9, 6);
  rim.position.set(0, 0.5, 2.1);
  scene.add(rim);

  const bodyGeo = new THREE.BoxGeometry(CASSETTE.w, CASSETTE.h, CASSETTE.d);
  const labelGeo = new THREE.PlaneGeometry(CASSETTE.w * 0.84, CASSETTE.h * 0.62);
  const accentGeo = new THREE.BoxGeometry(0.045, CASSETTE.h * 0.64, 0.004);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.72, metalness: 0.18 });

  const slots = [];
  const slotByIndex = new Map();
  for (let i = 0; i < POOL; i += 1) {
    const group = new THREE.Group();
    group.visible = false;

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const canvas = document.createElement('canvas');
    canvas.width = LABEL_W;
    canvas.height = LABEL_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;

    const labelMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 0, CASSETTE.d / 2 + 0.002);
    group.add(label);

    const accentMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#E8B10A'), toneMapped: false });
    const accent = new THREE.Mesh(accentGeo, accentMat);
    accent.position.set(-CASSETTE.w / 2 + 0.035, 0, CASSETTE.d / 2 + 0.004);
    group.add(accent);

    scene.add(group);
    slots.push({ group, canvas, texture, accentMat, index: -1 });
  }

  const total = tracks.length;
  let focus = clamp(startIndex, 0, Math.max(0, total - 1));
  let target = focus;
  let lastBase = null;
  let raf = 0;
  let snapTimer = 0;
  let destroyed = false;

  function sync(base) {
    slotByIndex.clear();
    for (let i = 0; i < POOL; i += 1) {
      const slot = slots[i];
      const index = base + (i - CENTER);
      if (index < 0 || index >= total) {
        slot.group.visible = false;
        slot.index = -1;
        continue;
      }
      slot.group.visible = true;
      slot.group.position.set(index * SPACING, 0, 0);
      if (slot.index !== index) {
        slot.index = index;
        const track = tracks[index];
        drawLabel(slot.canvas, track, index);
        slot.texture.needsUpdate = true;
        slot.accentMat.color.set(track.accent || '#E8B10A');
      }
      slotByIndex.set(index, slot);
    }
  }

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging = false;
  let lastX = 0;
  let moved = 0;

  function setPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const groups = slots.filter((slot) => slot.group.visible).map((slot) => slot.group);
    const hits = raycaster.intersectObjects(groups, true);
    if (!hits.length) return;
    let node = hits[0].object;
    while (node && !node.userData?.index && node.userData?.index !== 0) node = node.parent;
    if (node && typeof node.userData.index === 'number' && onSelect) onSelect(node.userData.index);
  }

  // 给每个 group 写入 index，便于拾取
  function tagGroups() {
    for (const slot of slots) {
      if (slot.index >= 0) slot.group.userData.index = slot.index;
    }
  }

  function onPointerDown(event) {
    dragging = true;
    lastX = event.clientX;
    moved = 0;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    moved += Math.abs(dx);
    target = clamp(target - dx / 220, -0.6, total - 1 + 0.6);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    if (moved < 6) {
      tagGroups();
      pick(event);
    } else {
      target = Math.round(target);
    }
  }

  function onWheel(event) {
    event.preventDefault();
    target = clamp(target + Math.sign(event.deltaY) * 0.7, -0.6, total - 1 + 0.6);
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(() => {
      target = clamp(Math.round(target), 0, Math.max(0, total - 1));
    }, 180);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function frame() {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);

    focus += (target - focus) * (reduced ? 1 : 0.16);
    camera.position.x = focus * SPACING;
    camera.lookAt(focus * SPACING, 0.02, 0);

    const base = Math.round(focus);
    if (base !== lastBase) {
      lastBase = base;
      sync(base);
      if (onFocus) onFocus(clamp(base, 0, total - 1));
    }

    renderer.render(scene, camera);
  }

  sync(Math.round(focus));
  lastBase = Math.round(focus);
  if (onFocus && total) onFocus(clamp(Math.round(focus), 0, total - 1));
  frame();

  return {
    dispose() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(snapTimer);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      for (const slot of slots) {
        slot.texture.dispose();
        slot.accentMat.dispose();
        slot.group.removeFromParent();
      }
      bodyGeo.dispose();
      labelGeo.dispose();
      accentGeo.dispose();
      bodyMat.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
}
