// Procedural 2D Canvas Textures for 3D Grounding Floors
import * as THREE from 'three';

/**
 * Creates rich hardwood floor planks for Study Hall
 */
export function createHardwoodFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base background
  ctx.fillStyle = '#3a200e';
  ctx.fillRect(0, 0, 512, 512);

  // 8 horizontal wood planks
  const plankHeight = 64;
  const plankTones = ['#422511', '#4b2a14', '#3d220e', '#532f17', '#462712', '#3f230f', '#4e2c15', '#452611'];

  for (let i = 0; i < 8; i++) {
    const y = i * plankHeight;
    ctx.fillStyle = plankTones[i % plankTones.length];
    ctx.fillRect(0, y, 512, plankHeight - 2);

    // Subtle wood grain lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let g = 0; g < 4; g++) {
      ctx.fillRect(0, y + 8 + g * 14, 512, 1);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let g = 0; g < 4; g++) {
      ctx.fillRect(0, y + 14 + g * 14, 512, 1);
    }

    // Plank seams (dark groove)
    ctx.fillStyle = '#1e0f06';
    ctx.fillRect(0, y + plankHeight - 2, 512, 2);
  }

  // Staggered vertical plank joints
  ctx.fillStyle = '#1e0f06';
  ctx.fillRect(180, 0, 2, plankHeight * 2);
  ctx.fillRect(360, plankHeight * 2, 2, plankHeight * 2);
  ctx.fillRect(140, plankHeight * 4, 2, plankHeight * 2);
  ctx.fillRect(320, plankHeight * 6, 2, plankHeight * 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/**
 * Creates raked garden gravel with mossy stones for Zen Garden
 */
export function createGardenGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base zen gravel tone
  ctx.fillStyle = '#4a554a';
  ctx.fillRect(0, 0, 512, 512);

  // Concentric raked ripples
  ctx.strokeStyle = '#3d463d';
  ctx.lineWidth = 3;
  for (let r = 20; r < 360; r += 24) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft moss patches
  ctx.fillStyle = 'rgba(46, 75, 46, 0.35)';
  for (let m = 0; m < 8; m++) {
    const mx = 60 + (m * 58) % 400;
    const my = 80 + (m * 73) % 400;
    ctx.beginPath();
    ctx.arc(mx, my, 25 + (m % 3) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/**
 * Creates dark polished marble floor for Sky Penthouse
 */
export function createMarbleFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark obsidian slate
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  // 4 large polished floor slabs (2x2)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeRect(256, 0, 256, 256);
  ctx.strokeRect(0, 256, 256, 256);
  ctx.strokeRect(256, 256, 256, 256);

  // Subtle marble veining
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, 20);
  ctx.bezierCurveTo(90, 80, 160, 40, 230, 120);
  ctx.bezierCurveTo(280, 180, 360, 140, 480, 230);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(400, 30);
  ctx.bezierCurveTo(340, 120, 260, 200, 200, 340);
  ctx.bezierCurveTo(150, 420, 80, 450, 20, 490);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/**
 * Creates warm coffeehouse parquet wood for Cozy Cafe
 */
export function createParquetFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2c160b';
  ctx.fillRect(0, 0, 512, 512);

  // Checkered parquet blocks (4x4)
  const size = 128;
  const tonesA = ['#381e0e', '#341b0c', '#3c200f', '#361d0d'];
  const tonesB = ['#30180a', '#3a1f0e', '#2e1709', '#371e0d'];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const isAlt = (r + c) % 2 === 0;
      ctx.fillStyle = isAlt ? tonesA[(r + c) % tonesA.length] : tonesB[(r * 2 + c) % tonesB.length];
      ctx.fillRect(c * size + 1, r * size + 1, size - 2, size - 2);

      // Fine parquet slat texture inside each block
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let s = 10; s < size; s += 20) {
        if (isAlt) {
          ctx.fillRect(c * size + 1, r * size + s, size - 2, 1);
        } else {
          ctx.fillRect(c * size + s, r * size + 1, 1, size - 2);
        }
      }
    }
  }

  // Dark border grout
  ctx.strokeStyle = '#170a04';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += size) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}
