// In-VR 3D Floating Control Console & Subtitle HUD (WebXR Interactive Panel)
import * as THREE from 'three';
import { AppState } from '../state.js';
import { triggerAvatarGesture, setFreestyleMode, motionState } from '../avatars/rig.js';
import { getMusicHUDLabel, nextTrack, toggleMusicMute } from '../audio/ambient_music.js';

let hudMesh = null;
let hudCanvas = null;
let hudCtx = null;
let hudTexture = null;
let hudGroup = null;

let currentStatusText = 'Ready';
let currentSpeechText = 'Hi! Press A/X to talk, or B/Y to exit VR back to settings.';
let currentVolumeLevel = 0;
let hoveredButtonKey = null;
let isVRHUDMinimized = false;

// Button bounding boxes in canvas pixel coordinates (1024 x 512)
// Header: Minimize button
// Row 1: Core Navigation & Audio Controls
// Row 2: Direct Expressive Gestures & Freestyle Mode
const HUD_BUTTONS = [
  // Top Header Minimize Button
  { key: 'minimize', label: '➖ Hide Panel', x: 520, y: 32, w: 210, h: 48, color: '#334155', activeColor: '#1e293b' },

  // Row 1
  { key: 'exit', label: '🚪 Exit VR', x: 30, y: 340, w: 160, h: 58, color: '#ef4444', activeColor: '#dc2626' },
  { key: 'mic', label: '🎙️ Talk (A/X)', x: 200, y: 340, w: 185, h: 58, color: '#6366f1', activeColor: '#4f46e5' },
  { key: 'live', label: '⚡ Live Mode', x: 395, y: 340, w: 225, h: 58, color: '#10b981', activeColor: '#059669' },
  { key: 'music', label: '🎵 Music', x: 630, y: 340, w: 140, h: 58, color: '#059669', activeColor: '#047857' },
  { key: 'space', label: '🏛️ Space', x: 780, y: 340, w: 105, h: 58, color: '#38bdf8', activeColor: '#0284c7' },
  { key: 'avatar', label: '👤 Avatar', x: 895, y: 340, w: 100, h: 58, color: '#a855f7', activeColor: '#9333ea' },

  // Row 2: Gesture & Movement Actions + Immersive Focus Mode
  { key: 'wave', label: '👋 Wave', x: 30, y: 418, w: 145, h: 58, color: '#ec4899', activeColor: '#db2777' },
  { key: 'dance', label: '🕺 Dance', x: 185, y: 418, w: 145, h: 58, color: '#f59e0b', activeColor: '#d97706' },
  { key: 'balance', label: '🤸 Balance', x: 340, y: 418, w: 155, h: 58, color: '#8b5cf6', activeColor: '#7c3aed' },
  { key: 'jump', label: '🦘 Jump', x: 505, y: 418, w: 145, h: 58, color: '#06b6d4', activeColor: '#0891b2' },
  { key: 'freestyle', label: '🎲 Freestyle', x: 660, y: 418, w: 165, h: 58, color: '#14b8a6', activeColor: '#0d9488' },
  { key: 'focus', label: '🧘 Focus', x: 835, y: 418, w: 160, h: 58, color: '#475569', activeColor: '#334155' }
];

export function initVRHUD(scene) {
  if (hudGroup) return hudGroup;

  hudGroup = new THREE.Group();
  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 1024;
  hudCanvas.height = 512;
  hudCtx = hudCanvas.getContext('2d');

  hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(1.05, 0.525);
  const mat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide
  });

  hudMesh = new THREE.Mesh(geo, mat);
  hudMesh.name = 'VR_HUD_CONSOLE';

  hudGroup.add(hudMesh);

  // Positioned at chest level, 1.3m in front of user, angled 24 degrees up towards eyes
  hudGroup.position.set(0, 0.92, -1.35);
  hudGroup.rotation.x = -Math.PI * 0.13;
  hudGroup.visible = false;

  scene.add(hudGroup);
  renderHUDCanvas();

  return hudGroup;
}

export function setVRHUDVisibility(visible) {
  if (hudGroup) {
    hudGroup.visible = visible;
    if (visible) renderHUDCanvas();
  }
}

export function updateVRHUDState({ status, text, volume }) {
  if (status !== undefined) currentStatusText = status;
  if (text !== undefined) currentSpeechText = text;
  if (volume !== undefined) currentVolumeLevel = volume;

  renderHUDCanvas();
}

/**
 * Draws rounded rectangle path
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderHUDCanvas() {
  if (!hudCtx) return;
  const ctx = hudCtx;
  const w = 1024;
  const h = 512;

  // Minimized Mode: Render sleek floating pill button only, leaving 95% of canvas 100% transparent
  if (isVRHUDMinimized) {
    ctx.clearRect(0, 0, w, h);
    const isHovered = hoveredButtonKey === 'reopen';
    drawRoundedRect(ctx, 362, 220, 300, 72, 36);
    ctx.fillStyle = isHovered ? 'rgba(99, 102, 241, 0.95)' : 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeStyle = isHovered ? '#a5b4fc' : 'rgba(99, 102, 241, 0.6)';
    ctx.stroke();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('👁️ Reopen Panel ➕', 512, 264);

    if (hudTexture) {
      hudTexture.needsUpdate = true;
    }
    return;
  }

  // 1. Dark Glass Background
  ctx.clearRect(0, 0, w, h);
  drawRoundedRect(ctx, 10, 10, w - 20, h - 20, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
  ctx.stroke();

  // 2. Top Header Bar: Status Pill & Live Indicator
  const isListening = AppState.isListening;
  const isSpeaking = AppState.isSpeaking;
  const isLive = AppState.isLiveMode;

  let pillBg = '#334155';
  let pillText = currentStatusText || 'Ready';
  if (isSpeaking) {
    pillBg = '#8b5cf6';
    pillText = '🗣️ Speaking';
  } else if (isListening) {
    pillBg = '#10b981';
    pillText = isLive ? '⚡ Live: Listening...' : '🎙️ Listening to you...';
  }

  drawRoundedRect(ctx, 40, 32, 260, 48, 24);
  ctx.fillStyle = pillBg;
  ctx.fill();

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(pillText, 170, 63);

  // Audio Level Meter bars (5 animated bars)
  const barCount = 5;
  for (let i = 0; i < barCount; i++) {
    const barHeight = Math.max(6, Math.min(32, (currentVolumeLevel * 36) + (Math.sin(Date.now() * 0.01 + i) * 6)));
    const bx = 320 + i * 14;
    const by = 56 - barHeight / 2;
    ctx.fillStyle = isListening ? '#10b981' : (isSpeaking ? '#a855f7' : '#64748b');
    ctx.fillRect(bx, by, 8, barHeight);
  }

  // Live Mode Badge
  drawRoundedRect(ctx, 760, 32, 225, 48, 24);
  ctx.fillStyle = isLive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(51, 65, 85, 0.6)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isLive ? '#10b981' : '#64748b';
  ctx.stroke();

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = isLive ? '#34d399' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText(isLive ? '⚡ Live Mode: ON' : '⚡ Live Mode: OFF', 872, 63);

  // 3. Subtitles / Speech Text Box
  drawRoundedRect(ctx, 40, 100, w - 80, 220, 16);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#f8fafc';

  // Word-wrap speech text
  const maxLineLength = 58;
  const words = (currentSpeechText || '').split(' ');
  let line = '';
  let lineY = 145;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (testLine.length > maxLineLength && i > 0) {
      ctx.fillText(line, 65, lineY);
      line = words[i] + ' ';
      lineY += 34;
      if (lineY > 290) break;
    } else {
      line = testLine;
    }
  }
  if (lineY <= 290) {
    ctx.fillText(line, 65, lineY);
  }

  // 4. Interactive Bottom Buttons
  HUD_BUTTONS.forEach(btn => {
    const isHovered = hoveredButtonKey === btn.key;
    drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 16);
    ctx.fillStyle = isHovered ? btn.activeColor : btn.color;
    ctx.fill();

    ctx.lineWidth = isHovered ? 3 : 1.5;
    ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    let displayLabel = btn.label;
    if (btn.key === 'live') {
      displayLabel = isLive ? '⚡ Live: ON' : '⚡ Live: OFF';
    } else if (btn.key === 'music') {
      displayLabel = getMusicHUDLabel();
    } else if (btn.key === 'space') {
      displayLabel = `🏛️ ${AppState.spaceId || 'Space'}`;
    } else if (btn.key === 'avatar') {
      displayLabel = `👤 ${AppState.avatarId || 'Avatar'}`;
    } else if (btn.key === 'freestyle') {
      displayLabel = motionState.freestyle ? '🎲 Free: ON' : '🎲 Free: OFF';
    } else if (btn.key === 'focus') {
      displayLabel = AppState.isFocusMode ? '🧘 Focus: ON' : '🧘 Focus: OFF';
    }

    ctx.fillText(displayLabel, btn.x + btn.w / 2, btn.y + btn.h / 2 + 6);
  });

  // 5. Quest Controller Cheat Sheet
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('🎮 Shortcuts: B/Y = Exit VR | A/X = Talk | Grip = Live Mode | Left Stick = Move in Scene | Trigger = Buttons', w / 2, 498);

  if (hudTexture) {
    hudTexture.needsUpdate = true;
  }
}

let lastActionTriggerTime = 0;

/**
 * Handles raycast pointer intersection against the In-VR Console
 */
export function testVRHUDIntersection(raycaster, isTriggerClick, callbacks = {}) {
  if (!hudMesh || !hudGroup || !hudGroup.visible) return null;

  const intersects = raycaster.intersectObject(hudMesh);
  if (intersects.length === 0) {
    if (hoveredButtonKey) {
      hoveredButtonKey = null;
      renderHUDCanvas();
    }
    return null;
  }

  const uv = intersects[0].uv;
  if (!uv) return null;

  // Convert UV (0 to 1) to canvas pixels
  const px = uv.x * 1024;
  const py = (1 - uv.y) * 512;

  // If HUD is currently minimized, test hit only against the compact "Reopen Panel" pill
  if (isVRHUDMinimized) {
    const isOverPill = (px >= 362 && px <= 662 && py >= 220 && py <= 292);
    const prevHover = hoveredButtonKey;
    hoveredButtonKey = isOverPill ? 'reopen' : null;
    if (prevHover !== hoveredButtonKey) {
      renderHUDCanvas();
    }

    if (isOverPill && isTriggerClick) {
      const now = Date.now();
      if (now - lastActionTriggerTime < 350) {
        return { point: intersects[0].point, buttonKey: 'reopen' };
      }
      lastActionTriggerTime = now;
      setVRHUDMinimized(false);
      if (callbacks.onToggleMinimize) callbacks.onToggleMinimize(false);
    }
    return isOverPill ? { point: intersects[0].point, buttonKey: 'reopen' } : null;
  }

  let matched = null;
  for (const btn of HUD_BUTTONS) {
    if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
      matched = btn;
      break;
    }
  }

  const prevHover = hoveredButtonKey;
  hoveredButtonKey = matched ? matched.key : null;
  if (prevHover !== hoveredButtonKey) {
    renderHUDCanvas();
  }

  if (matched && isTriggerClick) {
    const now = Date.now();
    if (now - lastActionTriggerTime < 350) {
      return { point: intersects[0].point, buttonKey: hoveredButtonKey };
    }
    lastActionTriggerTime = now;

    if (matched.key === 'exit' && callbacks.onExitVR) {
      callbacks.onExitVR();
    } else if (matched.key === 'mic' && callbacks.onToggleMic) {
      callbacks.onToggleMic();
    } else if (matched.key === 'live' && callbacks.onToggleLive) {
      callbacks.onToggleLive();
    } else if (matched.key === 'music') {
      if (callbacks.onCycleMusic) callbacks.onCycleMusic();
      else nextTrack();
      renderHUDCanvas();
    } else if (matched.key === 'space' && callbacks.onCycleSpace) {
      callbacks.onCycleSpace(1);
      renderHUDCanvas();
    } else if (matched.key === 'avatar' && callbacks.onCycleAvatar) {
      callbacks.onCycleAvatar(1);
      renderHUDCanvas();
    } else if (matched.key === 'wave') {
      if (callbacks.onTriggerGesture) callbacks.onTriggerGesture('wave');
      else triggerAvatarGesture('wave');
    } else if (matched.key === 'dance') {
      if (callbacks.onTriggerGesture) callbacks.onTriggerGesture('dance');
      else triggerAvatarGesture('dance');
    } else if (matched.key === 'balance') {
      if (callbacks.onTriggerGesture) callbacks.onTriggerGesture('stand_on_one_leg');
      else triggerAvatarGesture('stand_on_one_leg');
    } else if (matched.key === 'jump') {
      if (callbacks.onTriggerGesture) callbacks.onTriggerGesture('jump');
      else triggerAvatarGesture('jump');
    } else if (matched.key === 'freestyle') {
      if (callbacks.onToggleFreestyle) callbacks.onToggleFreestyle();
      else setFreestyleMode(!motionState.freestyle);
      renderHUDCanvas();
    } else if (matched.key === 'focus') {
      if (callbacks.onToggleFocus) callbacks.onToggleFocus();
      renderHUDCanvas();
    } else if (matched.key === 'minimize') {
      setVRHUDMinimized(true);
      if (callbacks.onToggleMinimize) callbacks.onToggleMinimize(true);
    }
  }

  return { point: intersects[0].point, buttonKey: hoveredButtonKey };
}

export function resetHUDActionDebounce() {
  lastActionTriggerTime = 0;
}

export function isVRHUDMinimizedState() {
  return isVRHUDMinimized;
}

export function setVRHUDMinimized(minimized) {
  isVRHUDMinimized = !!minimized;
  renderHUDCanvas();
  return isVRHUDMinimized;
}

export function toggleVRHUDMinimized() {
  return setVRHUDMinimized(!isVRHUDMinimized);
}

export function getVRHUDMesh() {
  return hudMesh;
}
