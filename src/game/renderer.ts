import furnaceMetadata from '../assets/joss-furnace-states.json';
import poseMetadata from '../assets/joss-duck-poses.json';
import { festivalPreset } from './config';
import { getDisplayedElapsedMs, getPaperRemainingPercent, getPaperRemainingRatio } from './metrics';
import type { GameState } from './model';
import { formatTime, getReadyCallout } from './scenes';

type FurnaceName = keyof typeof furnaceMetadata.frames;
type PoseName = keyof typeof poseMetadata.frames;

export interface GameRenderer {
  render: (state: GameState) => void;
  destroy: () => void;
}

export function createGameRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is not supported');

  const background = new Image();
  const poses = new Image();
  const furnace = new Image();
  let backgroundReady = false;
  let posesReady = false;
  let furnaceReady = false;
  background.onload = () => { backgroundReady = true; };
  poses.onload = () => { posesReady = true; };
  furnace.onload = () => { furnaceReady = true; };
  background.src = '/assets/ghost-festival-background.png';
  poses.src = poseMetadata.image;
  furnace.src = furnaceMetadata.image;

  const render = (state: GameState) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    const viewWidth = Math.max(1, Math.round(bounds.width));
    const viewHeight = Math.max(1, Math.round(bounds.height));
    const pixelWidth = Math.round(viewWidth * dpr);
    const pixelHeight = Math.round(viewHeight * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;

    drawRoom(context, backgroundReady ? background : null, viewWidth, viewHeight);

    const stageScale = Math.min(viewWidth / 400, viewHeight / 300);
    const stageX = (viewWidth - 400 * stageScale) / 2;
    const stageY = (viewHeight - 300 * stageScale) / 2;

    const warningProgress = Math.max(0, state.risk / festivalPreset.riskLimit - festivalPreset.warningRatio);
    const shakeAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shakeStrength = shakeAllowed && state.scene === 'flaring'
      ? 4
      : state.scene === 'playing' && warningProgress > 0.45 && shakeAllowed
        ? Math.min(3, warningProgress * 4)
        : 0;

    context.save();
    context.translate(stageX, stageY);
    context.scale(stageScale, stageScale);
    if (shakeStrength) {
      context.translate(
        Math.sin(state.animationFrame * 2.47) * shakeStrength,
        Math.cos(state.animationFrame * 1.93) * shakeStrength,
      );
    }

    drawDangerVignette(context, state);
    drawCharacter(context, state, posesReady ? poses : null);
    drawFlyingPaper(context, state);
    drawFurnace(context, state, furnaceReady ? furnace : null);
    drawWarning(context, state, furnaceReady ? furnace : null);
    drawHud(context, state);
    drawSceneOverlay(context, state);
    context.restore();
  };

  return {
    render,
    destroy: () => {
      background.onload = null;
      poses.onload = null;
      furnace.onload = null;
    },
  };
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  background: HTMLImageElement | null,
  width: number,
  height: number,
) {
  if (background) {
    const imageRatio = background.naturalWidth / background.naturalHeight;
    const viewRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = background.naturalWidth;
    let sourceHeight = background.naturalHeight;
    if (viewRatio > imageRatio) {
      sourceHeight = background.naturalWidth / viewRatio;
      sourceY = (background.naturalHeight - sourceHeight) / 2;
    } else {
      sourceWidth = background.naturalHeight * viewRatio;
      sourceX = (background.naturalWidth - sourceWidth) / 2;
    }
    ctx.drawImage(background, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    const wash = ctx.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, '#17206008');
    wash.addColorStop(0.72, '#ffffff00');
    wash.addColorStop(1, '#33206a1f');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#fff3bd');
  sky.addColorStop(0.62, '#b7e6d8');
  sky.addColorStop(1, '#7fc2ae');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState) {
  const elapsedTime = getDisplayedElapsedMs(state);
  const [whole, decimals] = formatTime(elapsedTime).padStart(5, '0').split('.');
  const urgent = elapsedTime >= festivalPreset.timeLimitMs - 10_000 && state.scene === 'playing';
  const pulse = urgent ? 1 + Math.sin(state.animationFrame * 0.34) * 0.045 : 1;

  ctx.save();
  ctx.translate(200, 31);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#fff8cced';
  ctx.strokeStyle = '#ffaf38';
  ctx.lineWidth = 2;
  roundedRect(ctx, -102, -27, 204, 54, 24);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = urgent ? '#ff3e63aa' : '#24dcf5aa';
  ctx.shadowBlur = urgent ? 12 : 8;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '1000 42px ui-rounded, system-ui';
  drawOutlinedText(ctx, `${whole}.${decimals}`, -4, 0, urgent ? '#ff615d' : '#72f4d2', '#2b267d', 7, '#fffceb', 3);
  ctx.shadowBlur = 0;
  ctx.font = '1000 12px ui-rounded, system-ui';
  drawOutlinedText(ctx, 'SEC', 78, 10, '#ffcb48', '#2b267d', 4, '#fffceb', 1.5);
  ctx.restore();
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  poses: HTMLImageElement | null,
) {
  const riskRatio = state.risk / festivalPreset.riskLimit;
  const isThrowing = state.scene === 'playing' && state.throwAnimationFrames > 0;

  const bob = state.scene === 'playing' ? Math.sin(state.animationFrame / (9 - state.speedLevel * 2)) * (2 + state.speedLevel) : 0;
  if (poses) {
    const pose: PoseName = state.scene === 'clear'
      ? 'success'
      : state.scene === 'flaring' || (state.scene === 'fail' && state.failureReason === 'flare')
        ? 'flare'
        : riskRatio >= festivalPreset.criticalRatio
          ? 'nearFlare'
          : isThrowing && state.speedLevel >= 2
            ? 'fastThrow'
            : isThrowing
              ? 'throw'
              : 'ready';
    const target = pose === 'flare'
      ? { x: 86, y: 58 + bob, w: 220, h: 220 }
      : pose === 'fastThrow'
        ? { x: 98, y: 63 + bob, w: 210, h: 210 }
        : { x: 108, y: 66 + bob, w: 198, h: 198 };
    ctx.save();
    if (isThrowing && state.speedLevel >= 2) ctx.rotate(Math.sin(state.animationFrame * 0.42) * 0.008);
    drawPoseFrame(ctx, poses, pose, target.x, target.y, target.w, target.h);
    ctx.restore();
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
  ctx.ellipse(-6, -6, 24, state.throwAnimationFrames > 0 ? 9 : 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFurnace(ctx: CanvasRenderingContext2D, state: GameState, furnace: HTMLImageElement | null) {
  const paperRatio = getPaperRemainingRatio(state);
  const paperPercent = getPaperRemainingPercent(state);
  const riskRatio = state.risk / festivalPreset.riskLimit;
  const furnaceState: FurnaceName = state.scene === 'flaring' || (state.scene === 'fail' && state.failureReason === 'flare')
    ? 'flare'
    : riskRatio >= festivalPreset.criticalRatio
      ? 'danger'
      : riskRatio >= festivalPreset.warningRatio
        ? 'warm'
        : 'calm';
  const pulse = furnaceState === 'danger' || furnaceState === 'flare'
    ? 1 + Math.sin(state.animationFrame * 0.34) * 0.025
    : 1;

  ctx.save();
  ctx.translate(337, 167);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = furnaceState === 'flare' ? '#ff4015cc' : '#e39b3877';
  ctx.shadowBlur = furnaceState === 'flare' ? 18 : 8;
  if (furnace) drawFurnaceFrame(ctx, furnace, furnaceState, -63, -72, 126, 126);
  else drawFallbackFurnace(ctx, furnaceState);
  ctx.shadowBlur = 0;

  const visibleSheets = Math.max(0, Math.ceil(paperRatio * 7));
  for (let index = 0; index < visibleSheets; index += 1) {
    const sheetX = -58 + (index % 2) * 13;
    const sheetY = 42 - Math.floor(index / 2) * 6;
    ctx.save();
    ctx.translate(sheetX, sheetY);
    ctx.rotate((index % 2 === 0 ? -1 : 1) * 0.08);
    ctx.fillStyle = '#ffd84e';
    ctx.strokeStyle = '#352252';
    ctx.lineWidth = 1.5;
    roundedRect(ctx, -12, -5, 25, 10, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f06a35';
    ctx.fillRect(-4, -3, 9, 6);
    ctx.restore();
  }

  ctx.fillStyle = '#fff3b9f2';
  ctx.strokeStyle = '#352252';
  ctx.lineWidth = 2;
  roundedRect(ctx, -34, 59, 68, 21, 9);
  ctx.fill();
  ctx.stroke();
  ctx.font = '1000 11px ui-rounded, system-ui';
  ctx.textAlign = 'center';
  drawOutlinedText(ctx, `金紙 ${paperPercent}%`, 0, 70, '#fff36a', '#352252', 4, '#c24136', 1.4);
  ctx.restore();
}

function drawFlyingPaper(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene !== 'playing' || state.throwAnimationFrames <= 0) return;
  const progress = 1 - state.throwAnimationFrames / festivalPreset.tapThrowAnimationFrames;
  const count = state.speedLevel >= 2 ? 2 : 1;
  for (let index = 0; index < count; index += 1) {
    const phase = (progress + index * 0.42) % 1;
    const x = 248 + phase * 73;
    const y = 137 - Math.sin(phase * Math.PI) * 27 + index * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.25 + phase * 0.9 + Math.sin(state.animationFrame * 0.4 + index) * 0.08);
    ctx.fillStyle = '#ffd84e';
    ctx.strokeStyle = '#352252';
    ctx.lineWidth = 2;
    roundedRect(ctx, -12, -7, 25, 14, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f06a35';
    ctx.fillRect(-4, -4, 9, 8);
    ctx.restore();
  }
}

function drawFallbackFurnace(ctx: CanvasRenderingContext2D, state: FurnaceName) {
  ctx.fillStyle = '#b93432';
  ctx.strokeStyle = '#352252';
  ctx.lineWidth = 4;
  roundedRect(ctx, -42, -18, 84, 69, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = state === 'calm' ? '#ffb52f' : state === 'warm' ? '#ff7b2f' : '#ff4135';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(-20, -20, -7, -48);
  ctx.quadraticCurveTo(3, -27, 12, -57);
  ctx.quadraticCurveTo(28, -25, 7, 8);
  ctx.closePath();
  ctx.fill();
}

function drawWarning(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  furnace: HTMLImageElement | null,
) {
  const ratio = state.risk / festivalPreset.riskLimit;
  if (ratio < festivalPreset.warningRatio || state.scene === 'title') return;
  const normalized = (ratio - festivalPreset.warningRatio) / (1 - festivalPreset.warningRatio);
  const size = 72 + normalized * 72 + Math.sin(state.animationFrame * 0.3) * 5;
  const x = 6 - normalized * 8;
  const y = 54 - normalized * 10;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  ctx.save();
  ctx.globalAlpha = 0.42 + normalized * 0.38;
  ctx.strokeStyle = ratio >= festivalPreset.criticalRatio ? '#ff496a' : '#ffd84e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * (0.48 + Math.sin(state.animationFrame * 0.22) * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawStar(ctx, centerX, centerY, size / 2, ratio >= festivalPreset.criticalRatio ? '#ff4a5d' : '#ffda3f');
  if (ratio >= festivalPreset.criticalRatio) {
    ctx.strokeStyle = '#fff4a8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i += 1) {
      const angle = i * Math.PI * 2 / 7 + state.animationFrame * 0.025;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * size * 0.48, centerY + Math.sin(angle) * size * 0.48);
      ctx.lineTo(centerX + Math.cos(angle) * size * 0.65, centerY + Math.sin(angle) * size * 0.65);
      ctx.stroke();
    }
  }

  const previewState: FurnaceName = state.scene === 'flaring' || state.scene === 'fail'
    ? 'flare'
    : ratio >= festivalPreset.criticalRatio
      ? 'danger'
      : 'warm';
  if (furnace) drawFurnaceFrame(ctx, furnace, previewState, centerX - size * 0.33, centerY - size * 0.33, size * 0.66, size * 0.66);

  if (ratio >= festivalPreset.criticalRatio && (state.scene === 'playing' || state.scene === 'flaring')) {
    ctx.font = '1000 17px ui-rounded, system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, '快發爐了！', 10, 252, '#fff56f', '#392675', 6, '#ff4d34', 2.5);
  }
  ctx.restore();
}

function drawDangerVignette(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene !== 'playing' && state.scene !== 'flaring') return;
  const ratio = state.risk / festivalPreset.riskLimit;
  if (ratio < 0.52) return;
  const intensity = Math.min(1, (ratio - 0.52) / 0.48);
  const pulse = 0.72 + Math.sin(state.animationFrame * 0.28) * 0.28;

  const vignette = ctx.createRadialGradient(200, 150, 78, 200, 150, 275);
  vignette.addColorStop(0, '#ff466400');
  vignette.addColorStop(0.68, '#ff466400');
  vignette.addColorStop(1, `rgba(255, 48, 84, ${0.18 * intensity * pulse})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 400, 300);

  ctx.save();
  ctx.translate(200, 158);
  ctx.rotate(state.animationFrame * 0.004);
  ctx.globalAlpha = intensity * 0.32;
  ctx.strokeStyle = ratio > 0.78 ? '#ff526a' : '#ffdd4d';
  ctx.lineWidth = 5;
  for (let i = 0; i < 12; i += 1) {
    const angle = i * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 92, Math.sin(angle) * 68);
    ctx.lineTo(Math.cos(angle) * 188, Math.sin(angle) * 142);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSceneOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene === 'playing' && !state.paused) return;

  if (state.scene === 'flaring') {
    const pulse = 1 + Math.sin(state.animationFrame * 0.42) * 0.06;
    ctx.save();
    ctx.translate(200, 248);
    ctx.scale(pulse, pulse);
    ctx.font = '1000 25px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, '轟！金爐發爐啦！', 0, 0, '#fff56f', '#392675', 7, '#ff4d34', 2.5);
    ctx.restore();
    return;
  }

  if (state.scene === 'title') {
    const banner = ctx.createLinearGradient(0, 226, 0, 298);
    banner.addColorStop(0, '#28216ccc');
    banner.addColorStop(1, '#161249f2');
    ctx.fillStyle = banner;
    ctx.strokeStyle = '#7df1d5';
    ctx.lineWidth = 3;
    roundedRect(ctx, 54, 225, 292, 64, 22);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '1000 27px ui-rounded, system-ui';
    drawOutlinedText(ctx, '鴨鴨燒紙錢', 200, 247, '#fff27d', '#2f204f', 7, '#ff6a3d', 2.5);
    ctx.font = '900 11px ui-rounded, system-ui';
    drawOutlinedText(ctx, '快速連點・看火勢別發爐', 200, 274, '#ffffff', '#2f204f', 4);
    return;
  }

  if (state.scene === 'ready') {
    ctx.fillStyle = '#28216cde';
    ctx.strokeStyle = '#fff36e';
    ctx.lineWidth = 4;
    roundedRect(ctx, 80, 112, 240, 78, 28);
    ctx.fill();
    ctx.stroke();
    ctx.font = '1000 46px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, getReadyCallout(state), 200, 150, '#71f1d1', '#211957', 8, '#fff36e', 3);
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

  if (state.paused) {
    ctx.font = '1000 37px ui-rounded, system-ui';
    ctx.fillText('暫停一下', 200, 120);
    ctx.fillStyle = '#716158';
    ctx.font = '800 14px system-ui';
    ctx.fillText('計時也停住了，準備好再繼續', 200, 164);
  } else if (state.scene === 'clear') {
    ctx.fillStyle = '#25866e';
    ctx.font = '1000 38px ui-rounded, system-ui';
    ctx.fillText('金紙燒完啦！', 200, 110);
    ctx.fillStyle = '#493931';
    ctx.font = '900 27px ui-rounded, system-ui';
    ctx.fillText(`${formatTime(state.finalTimeMs ?? 0)} 秒`, 200, 152);
    ctx.fillStyle = '#75665d';
    ctx.font = '800 13px system-ui';
    ctx.fillText('鴨鴨拍拍翅膀，還想再挑戰一次', 200, 187);
  } else {
    ctx.fillStyle = '#d14b3b';
    ctx.font = '1000 35px ui-rounded, system-ui';
    ctx.fillText(state.failureReason === 'timeout' ? '時間到！' : '噗——！', 200, 109);
    ctx.fillStyle = '#493931';
    ctx.font = '900 17px ui-rounded, system-ui';
    ctx.fillText(state.failureReason === 'timeout' ? '金紙還沒燒完' : '鴨鴨丟得太急了', 200, 151);
    ctx.fillStyle = '#75665d';
    ctx.font = '800 13px system-ui';
    ctx.fillText('放慢幾拍，等火勢退下再丟', 200, 186);
  }
}

function drawFurnaceFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frameName: FurnaceName,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const frame = furnaceMetadata.frames[frameName];
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, width, height);
}

function drawPoseFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  poseName: PoseName,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const frame = poseMetadata.frames[poseName];
  const scale = Math.min(width / frame.w, height / frame.h);
  const renderedWidth = frame.w * scale;
  const renderedHeight = frame.h * scale;
  const renderedX = x + (width - renderedWidth) / 2;
  const renderedY = y + (height - renderedHeight) / 2;
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, renderedX, renderedY, renderedWidth, renderedHeight);
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  outerStroke: string,
  outerWidth: number,
  innerStroke?: string,
  innerWidth = 0,
) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outerStroke;
  ctx.lineWidth = outerWidth;
  ctx.strokeText(text, x, y);
  if (innerStroke && innerWidth > 0) {
    ctx.strokeStyle = innerStroke;
    ctx.lineWidth = innerWidth;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
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
