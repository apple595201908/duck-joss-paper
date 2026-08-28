import atlasMetadata from '../assets/duck-atlas.json';
import { faithfulPreset } from './config';
import type { GameState } from './model';
import { formatTime, getReadyCallout } from './scenes';

type FrameName = keyof typeof atlasMetadata.frames;

export interface GameRenderer {
  render: (state: GameState) => void;
  destroy: () => void;
}

export function createGameRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is not supported');

  const image = new Image();
  let imageReady = false;
  image.onload = () => { imageReady = true; };
  image.src = atlasMetadata.image;

  const render = (state: GameState) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== 400 * dpr || canvas.height !== 300 * dpr) {
      canvas.width = 400 * dpr;
      canvas.height = 300 * dpr;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;

    const warningProgress = Math.max(0, state.risk / faithfulPreset.riskLimit - faithfulPreset.warningRatio);
    const shakeAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shakeStrength = state.scene === 'playing' && warningProgress > 0.45 && shakeAllowed
      ? Math.min(3, warningProgress * 4)
      : 0;

    context.save();
    if (shakeStrength) {
      context.translate(
        Math.sin(state.animationFrame * 2.47) * shakeStrength,
        Math.cos(state.animationFrame * 1.93) * shakeStrength,
      );
    }

    drawRoom(context);
    drawHud(context, state);
    drawCharacter(context, state, imageReady ? image : null);
    drawBottle(context, state);
    drawWarning(context, state, imageReady ? image : null);
    drawSceneOverlay(context, state);
    context.restore();
  };

  return { render, destroy: () => { image.onload = null; } };
}

function drawRoom(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#fff3bd');
  sky.addColorStop(0.62, '#b7e6d8');
  sky.addColorStop(1, '#7fc2ae');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 400, 300);

  ctx.fillStyle = '#fff9e8';
  ctx.fillRect(0, 207, 400, 93);
  ctx.fillStyle = '#e8bd72';
  ctx.fillRect(0, 207, 400, 8);

  ctx.fillStyle = '#ffffff9c';
  roundedRect(ctx, 20, 42, 90, 74, 18);
  ctx.fill();
  ctx.strokeStyle = '#85bfae';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(65, 44);
  ctx.lineTo(65, 114);
  ctx.moveTo(22, 79);
  ctx.lineTo(108, 79);
  ctx.stroke();

  ctx.fillStyle = '#f3a953';
  ctx.beginPath();
  ctx.arc(356, 52, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f6c66f';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(356 + Math.cos(angle) * 29, 52 + Math.sin(angle) * 29);
    ctx.lineTo(356 + Math.cos(angle) * 38, 52 + Math.sin(angle) * 38);
    ctx.stroke();
  }

  ctx.fillStyle = '#d5a561';
  ctx.fillRect(0, 270, 400, 30);
  ctx.strokeStyle = '#bd8a4a';
  ctx.lineWidth = 1;
  for (let x = 0; x < 400; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 271);
    ctx.lineTo(x - 4, 300);
    ctx.stroke();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = '#fffdf0e8';
  roundedRect(ctx, 121, 10, 158, 42, 18);
  ctx.fill();
  ctx.fillStyle = state.elapsedMs > 50_000 ? '#d54d36' : '#46362f';
  ctx.font = '900 28px ui-rounded, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const time = state.scene === 'title' || state.scene === 'ready'
    ? faithfulPreset.timeLimitMs
    : Math.max(0, faithfulPreset.timeLimitMs - state.elapsedMs);
  ctx.fillText(formatTime(time), 200, 31);
  ctx.font = '800 9px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('剩餘秒數', 131, 31);

  ctx.fillStyle = '#4e4139';
  ctx.font = '800 10px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('喝奶速度', 16, 152);
  const speedColors = ['#ddd2b9', '#f8a955', '#ef6d48'];
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i <= state.speedLevel ? speedColors[state.speedLevel] : '#ffffff80';
    roundedRect(ctx, 17 + i * 20, 161 - i * 4, 15, 13 + i * 4, 5);
    ctx.fill();
  }

  const riskRatio = Math.min(1, state.risk / faithfulPreset.riskLimit);
  if (riskRatio >= faithfulPreset.warningRatio) {
    ctx.fillStyle = '#fff8e6dd';
    roundedRect(ctx, 15, 188, 82, 13, 7);
    ctx.fill();
    const riskGradient = ctx.createLinearGradient(18, 0, 94, 0);
    riskGradient.addColorStop(0, '#f3c94d');
    riskGradient.addColorStop(0.62, '#f28a3d');
    riskGradient.addColorStop(1, '#da3e39');
    ctx.fillStyle = riskGradient;
    roundedRect(ctx, 18, 191, 76 * riskRatio, 7, 4);
    ctx.fill();
  }
}

function drawCharacter(ctx: CanvasRenderingContext2D, state: GameState, atlas: HTMLImageElement | null) {
  const band = Math.min(2, Math.floor(state.progress / (faithfulPreset.capacity / 3)));
  const frame: FrameName = state.scene === 'title' || state.scene === 'ready'
    ? 'duck_ready'
    : state.scene === 'clear'
      ? 'duck_success'
      : state.scene === 'fail' && state.failureReason === 'spew'
        ? (`band${band}_spew` as FrameName)
        : state.holding
          ? (`band${band}_drink` as FrameName)
          : (`band${band}_idle` as FrameName);

  const bob = state.scene === 'playing' ? Math.sin(state.animationFrame / (9 - state.speedLevel * 2)) * (2 + state.speedLevel) : 0;
  if (atlas) {
    drawFrame(ctx, atlas, frame, 105, 69 + bob, 190, 190);
    return;
  }

  drawFallbackDuck(ctx, state, bob);
}

function drawFallbackDuck(ctx: CanvasRenderingContext2D, state: GameState, bob: number) {
  ctx.save();
  ctx.translate(200, 168 + bob);
  ctx.fillStyle = '#ffdf62';
  ctx.strokeStyle = '#c88932';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 35, 62, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-8, -14, 43, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#45352f';
  ctx.beginPath();
  ctx.arc(-22, -21, 4, 0, Math.PI * 2);
  ctx.arc(4, -21, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f18a32';
  ctx.beginPath();
  ctx.ellipse(-6, -6, 24, state.holding ? 9 : 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBottle(ctx: CanvasRenderingContext2D, state: GameState) {
  const totalProgress = Math.min(faithfulPreset.capacity, state.progress + state.charge);
  const milkRatio = 1 - totalProgress / faithfulPreset.capacity;
  ctx.save();
  ctx.translate(315, 92);
  ctx.fillStyle = '#ffffffb8';
  ctx.strokeStyle = '#5589a3';
  ctx.lineWidth = 4;
  roundedRect(ctx, 0, 18, 48, 111, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6aaec6';
  roundedRect(ctx, 9, 0, 30, 27, 7);
  ctx.fill();
  ctx.fillStyle = '#fffdf1';
  const fillHeight = 90 * milkRatio;
  roundedRect(ctx, 7, 121 - fillHeight, 34, fillHeight, 8);
  ctx.fill();
  ctx.fillStyle = '#4f4139';
  ctx.font = '900 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round((1 - milkRatio) * 100)}%`, 24, 146);
  ctx.restore();

  if (state.holding && state.charge > 0) {
    const chargeRatio = state.charge / faithfulPreset.chargeCap;
    ctx.fillStyle = '#ffffffbb';
    roundedRect(ctx, 121, 254, 158, 16, 8);
    ctx.fill();
    const gradient = ctx.createLinearGradient(124, 0, 276, 0);
    gradient.addColorStop(0, '#6ec9b2');
    gradient.addColorStop(0.65, '#f2c753');
    gradient.addColorStop(1, '#ee7748');
    ctx.fillStyle = gradient;
    roundedRect(ctx, 124, 257, 152 * chargeRatio, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#514139';
    ctx.font = '800 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('這一口', 200, 281);
  }
}

function drawWarning(ctx: CanvasRenderingContext2D, state: GameState, atlas: HTMLImageElement | null) {
  const ratio = state.risk / faithfulPreset.riskLimit;
  if (ratio < faithfulPreset.warningRatio || state.scene === 'title') return;
  const normalized = (ratio - faithfulPreset.warningRatio) / (1 - faithfulPreset.warningRatio);
  const size = 48 + normalized * 45 + Math.sin(state.animationFrame * 0.3) * 3;
  const name: FrameName = ratio > 0.72 ? 'danger_red' : 'warning_yellow';
  if (atlas) drawFrame(ctx, atlas, name, 19, 64, size, size);
  else drawStar(ctx, 59, 105, size / 2, ratio > 0.72 ? '#e8483e' : '#f7ce45');
  ctx.fillStyle = '#fff';
  ctx.font = `1000 ${Math.round(size * 0.45)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 19 + size / 2, 64 + size / 2 + 2);
}

function drawSceneOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene === 'playing' && !state.paused) return;

  if (state.scene === 'ready') {
    ctx.fillStyle = '#3b2e2dcc';
    roundedRect(ctx, 83, 117, 234, 70, 24);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '1000 46px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getReadyCallout(state), 200, 151);
    return;
  }

  ctx.fillStyle = '#2a3731a8';
  ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#fffdf2f2';
  roundedRect(ctx, 57, 68, 286, 151, 28);
  ctx.fill();
  ctx.fillStyle = '#463730';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state.scene === 'title') {
    ctx.font = '1000 35px ui-rounded, system-ui';
    ctx.fillText('鴨鴨喝牛奶', 200, 108);
    ctx.fillStyle = '#d9663c';
    ctx.font = '900 17px ui-rounded, system-ui';
    ctx.fillText('60 秒節奏挑戰', 200, 143);
    ctx.fillStyle = '#716158';
    ctx.font = '700 13px system-ui';
    ctx.fillText('按住累積・放開吞下・太急會嗆到', 200, 179);
  } else if (state.paused) {
    ctx.font = '1000 37px ui-rounded, system-ui';
    ctx.fillText('暫停一下', 200, 120);
    ctx.fillStyle = '#716158';
    ctx.font = '800 14px system-ui';
    ctx.fillText('計時也停住了，準備好再繼續', 200, 164);
  } else if (state.scene === 'clear') {
    ctx.fillStyle = '#25866e';
    ctx.font = '1000 38px ui-rounded, system-ui';
    ctx.fillText('喝完啦！', 200, 110);
    ctx.fillStyle = '#493931';
    ctx.font = '900 27px ui-rounded, system-ui';
    ctx.fillText(`${formatTime(state.finalTimeMs ?? 0)} 秒`, 200, 152);
    ctx.fillStyle = '#75665d';
    ctx.font = '800 13px system-ui';
    ctx.fillText('鴨鴨擦擦嘴，還想再挑戰一次', 200, 187);
  } else {
    ctx.fillStyle = '#d14b3b';
    ctx.font = '1000 35px ui-rounded, system-ui';
    ctx.fillText(state.failureReason === 'timeout' ? '時間到！' : '噗——！', 200, 109);
    ctx.fillStyle = '#493931';
    ctx.font = '900 17px ui-rounded, system-ui';
    ctx.fillText(state.failureReason === 'timeout' ? '牛奶還沒喝完' : '鴨鴨喝得太急了', 200, 151);
    ctx.fillStyle = '#75665d';
    ctx.font = '800 13px system-ui';
    ctx.fillText('放慢幾拍，等警示退下再喝', 200, 186);
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frameName: FrameName,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const frame = atlasMetadata.frames[frameName];
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, width, height);
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ac4b32';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 8;
    const length = i % 2 === 0 ? radius : radius * 0.55;
    const px = x + Math.cos(angle) * length;
    const py = y + Math.sin(angle) * length;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, width), Math.max(0, height), safeRadius);
}
