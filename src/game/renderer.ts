import furnaceMetadata from '../assets/joss-furnace-states.json';
import poseMetadata from '../assets/joss-duck-poses.json';
import { festivalPreset } from './config';
import { getDisplayedElapsedMs, getPaperRemainingPercent, getPaperRemainingRatio } from './metrics';
import type { GameState } from './model';
import {
  formatTime,
  getFlareAnimationPhase,
  getFlareAnimationProgress,
  getReadyCallout,
} from './scenes';

type FurnaceName = keyof typeof furnaceMetadata.frames;
type PoseName = keyof typeof poseMetadata.frames;

const FURNACE_CENTER_X = 331;
const FURNACE_CENTER_Y = 168;
const FURNACE_SIZE = 198;
const FURNACE_MOUTH_Y = 171;
const FURNACE_PAPER_TARGET_Y = 147;

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
    const flareProgress = state.scene === 'flaring'
      ? getFlareAnimationProgress(state.reactionFramesRemaining)
      : 0;
    const shakeStrength = shakeAllowed && state.scene === 'flaring'
      ? flareProgress < 0.18
        ? 8
        : flareProgress < 0.78
          ? 5.5
          : 2.2
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
    drawFlareBackdrop(context, state);
    drawCharacter(context, state, posesReady ? poses : null);
    drawFlyingPaper(context, state);
    drawFurnace(context, state, furnaceReady ? furnace : null);
    drawWarning(context, state, furnaceReady ? furnace : null);
    drawPaperSupply(context, state);
    drawFlareForeground(context, state);
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
  ctx.translate(200, 28);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = urgent ? '#ff273dcc' : '#68172e99';
  ctx.shadowBlur = urgent ? 13 : 8;
  const plaque = ctx.createLinearGradient(0, -27, 0, 28);
  plaque.addColorStop(0, '#9d2037');
  plaque.addColorStop(0.46, '#6e132b');
  plaque.addColorStop(1, '#491022');
  ctx.fillStyle = plaque;
  ctx.strokeStyle = '#ffd564';
  ctx.lineWidth = 4;
  roundedRect(ctx, -118, -27, 236, 55, 13);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#170d13';
  ctx.strokeStyle = '#f0a839';
  ctx.lineWidth = 2.5;
  roundedRect(ctx, -96, -21, 181, 43, 8);
  ctx.fill();
  ctx.stroke();

  for (const x of [-108, 108]) {
    for (const y of [-16, 17]) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSevenSegmentTimer(ctx, `${whole}.${decimals}`, -67, -18, urgent);
  ctx.font = '1000 14px ui-rounded, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawOutlinedText(ctx, '秒', 101, 5, '#ffe47d', '#621228', 4, '#fff5ba', 1.2);
  ctx.restore();
}

const SEVEN_SEGMENT_DIGITS: Readonly<Record<string, readonly number[]>> = {
  '0': [0, 1, 2, 3, 4, 5],
  '1': [1, 2],
  '2': [0, 1, 6, 4, 3],
  '3': [0, 1, 6, 2, 3],
  '4': [5, 6, 1, 2],
  '5': [0, 5, 6, 2, 3],
  '6': [0, 5, 6, 4, 2, 3],
  '7': [0, 1, 2],
  '8': [0, 1, 2, 3, 4, 5, 6],
  '9': [0, 1, 2, 3, 5, 6],
};

function drawSevenSegmentTimer(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  urgent: boolean,
) {
  const digitWidth = 22;
  const digitHeight = 36;
  const thickness = 4.6;
  let cursor = x;

  for (const character of value) {
    if (character === '.') {
      ctx.save();
      ctx.shadowColor = '#ff2147';
      ctx.shadowBlur = urgent ? 11 : 7;
      ctx.fillStyle = urgent ? '#ff143c' : '#ed2946';
      ctx.beginPath();
      ctx.arc(cursor + 3.4, y + digitHeight - 2.8, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      cursor += 10;
      continue;
    }

    const activeSegments = new Set(SEVEN_SEGMENT_DIGITS[character] ?? []);
    for (let segment = 0; segment < 7; segment += 1) {
      const active = activeSegments.has(segment);
      ctx.save();
      ctx.fillStyle = active
        ? urgent ? '#ff143c' : '#ed2946'
        : 'rgba(103, 25, 42, 0.24)';
      if (active) {
        ctx.shadowColor = '#ff1c43';
        ctx.shadowBlur = urgent ? 12 : 7;
      }
      drawSevenSegment(ctx, cursor, y, digitWidth, digitHeight, thickness, segment);
      ctx.restore();
    }
    cursor += digitWidth + 5;
  }
}

function drawSevenSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  segment: number,
) {
  const halfHeight = height / 2;
  if (segment === 0) drawHorizontalLed(ctx, x + thickness * 0.6, y, width - thickness * 1.2, thickness);
  else if (segment === 1) drawVerticalLed(ctx, x + width - thickness, y + thickness * 0.55, halfHeight - thickness * 0.8, thickness);
  else if (segment === 2) drawVerticalLed(ctx, x + width - thickness, y + halfHeight + thickness * 0.18, halfHeight - thickness * 0.75, thickness);
  else if (segment === 3) drawHorizontalLed(ctx, x + thickness * 0.6, y + height - thickness, width - thickness * 1.2, thickness);
  else if (segment === 4) drawVerticalLed(ctx, x, y + halfHeight + thickness * 0.18, halfHeight - thickness * 0.75, thickness);
  else if (segment === 5) drawVerticalLed(ctx, x, y + thickness * 0.55, halfHeight - thickness * 0.8, thickness);
  else drawHorizontalLed(ctx, x + thickness * 0.6, y + halfHeight - thickness / 2, width - thickness * 1.2, thickness);
}

function drawHorizontalLed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  thickness: number,
) {
  const bevel = thickness * 0.48;
  ctx.beginPath();
  ctx.moveTo(x + bevel, y);
  ctx.lineTo(x + width - bevel, y);
  ctx.lineTo(x + width, y + thickness / 2);
  ctx.lineTo(x + width - bevel, y + thickness);
  ctx.lineTo(x + bevel, y + thickness);
  ctx.lineTo(x, y + thickness / 2);
  ctx.closePath();
  ctx.fill();
}

function drawVerticalLed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  thickness: number,
) {
  const bevel = thickness * 0.48;
  ctx.beginPath();
  ctx.moveTo(x + thickness / 2, y);
  ctx.lineTo(x + thickness, y + bevel);
  ctx.lineTo(x + thickness, y + height - bevel);
  ctx.lineTo(x + thickness / 2, y + height);
  ctx.lineTo(x, y + height - bevel);
  ctx.lineTo(x, y + bevel);
  ctx.closePath();
  ctx.fill();
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
      ? { x: 72, y: 42 + bob, w: 180, h: 180 }
      : pose === 'fastThrow'
        ? { x: 82, y: 44 + bob, w: 180, h: 180 }
        : { x: 92, y: 48 + bob, w: 176, h: 176 };
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
  ctx.translate(182, 135 + bob);
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
  ctx.translate(FURNACE_CENTER_X, FURNACE_CENTER_Y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = furnaceState === 'flare' ? '#ff4015cc' : '#e39b3877';
  ctx.shadowBlur = furnaceState === 'flare' ? 18 : 8;
  if (furnace) {
    drawFurnaceFrame(
      ctx,
      furnace,
      furnaceState,
      -FURNACE_SIZE / 2,
      -FURNACE_SIZE / 2,
      FURNACE_SIZE,
      FURNACE_SIZE,
    );
  }
  else drawFallbackFurnace(ctx, furnaceState);
  ctx.restore();
}

function drawPaperSupply(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene === 'title') return;
  const paperRatio = getPaperRemainingRatio(state);
  const paperPercent = getPaperRemainingPercent(state);
  const visibleSheets = paperRatio <= 0 ? 0 : Math.max(1, Math.ceil(paperRatio * 18));
  const stackHeight = 7 + paperRatio * 32;
  const pulse = state.scene === 'playing' && state.throwAnimationFrames > 0
    ? Math.sin(state.animationFrame * 0.55) * 1.4
    : 0;

  ctx.save();
  // Keep the paper supply centered along the bottom so it never merges with
  // the left-side flare warning and remains readable during a final sprint.
  ctx.translate(200, 271);
  ctx.shadowColor = '#24144b88';
  ctx.shadowBlur = 9;
  ctx.fillStyle = '#301451e8';
  ctx.strokeStyle = '#ffd84e';
  ctx.lineWidth = 4;
  roundedRect(ctx, -86, -27, 172, 55, 15);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#8f2638';
  roundedRect(ctx, 0, -23, 67, 19, 9);
  ctx.fill();
  ctx.font = '1000 12px ui-rounded, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawOutlinedText(ctx, '金紙剩餘', 33.5, -13.5, '#fff3a1', '#32164f', 3.5);

  ctx.fillStyle = '#762333';
  ctx.strokeStyle = '#f8b73f';
  ctx.lineWidth = 2;
  roundedRect(ctx, -68, 16, 63, 9, 4.5);
  ctx.fill();
  ctx.stroke();

  for (let index = 0; index < visibleSheets; index += 1) {
    const distance = visibleSheets <= 1 ? 0 : index / (visibleSheets - 1);
    const sheetY = 15 - distance * stackHeight + (index === visibleSheets - 1 ? pulse : 0);
    const sheetWidth = 59 - distance * 4;
    ctx.save();
    ctx.translate(-36.5 + Math.sin(index * 2.19) * 1.8, sheetY);
    ctx.rotate(Math.sin(index * 4.7) * 0.025);
    ctx.fillStyle = index === visibleSheets - 1 ? '#ffe66b' : '#f7c93e';
    ctx.strokeStyle = '#7c382e';
    ctx.lineWidth = 1.4;
    roundedRect(ctx, -sheetWidth / 2, -4.5, sheetWidth, 10, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ec6238';
    ctx.fillRect(-8, -2.8, 16, 6.5);
    ctx.restore();
  }

  if (visibleSheets === 0) {
    ctx.font = '900 12px ui-rounded, system-ui';
    drawOutlinedText(ctx, '燒完', -36.5, 2, '#fff0ad', '#32164f', 3);
  }

  ctx.font = '1000 27px ui-rounded, system-ui';
  drawOutlinedText(ctx, `${paperPercent}%`, 34, 11, paperPercent <= 20 ? '#ff8063' : '#fff36a', '#32164f', 6, '#a83b37', 1.5);
  ctx.restore();
}

function drawFlyingPaper(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene !== 'playing' || state.throwAnimationFrames <= 0) return;
  const progress = 1 - state.throwAnimationFrames / festivalPreset.tapThrowAnimationFrames;
  const count = state.speedLevel >= 2 ? 2 : 1;
  for (let index = 0; index < count; index += 1) {
    const phase = (progress + index * 0.42) % 1;
    const startX = 247 - index * 5;
    const startY = 137 + index * 5;
    const controlX = 287 + index * 3;
    const controlY = 94 + index * 7;
    const remaining = 1 - phase;
    const x = remaining * remaining * startX
      + 2 * remaining * phase * controlX
      + phase * phase * FURNACE_CENTER_X;
    const y = remaining * remaining * startY
      + 2 * remaining * phase * controlY
      + phase * phase * (FURNACE_PAPER_TARGET_Y + index * 3);
    const intake = Math.max(0, (phase - 0.68) / 0.32);
    const paperScale = 1 - intake * 0.48;

    for (let trail = 3; trail >= 1; trail -= 1) {
      const trailPhase = Math.max(0, phase - trail * 0.055);
      const trailRemaining = 1 - trailPhase;
      const trailX = trailRemaining * trailRemaining * startX
        + 2 * trailRemaining * trailPhase * controlX
        + trailPhase * trailPhase * FURNACE_CENTER_X;
      const trailY = trailRemaining * trailRemaining * startY
        + 2 * trailRemaining * trailPhase * controlY
        + trailPhase * trailPhase * (FURNACE_PAPER_TARGET_Y + index * 3);
      ctx.save();
      ctx.globalAlpha = (0.20 - trail * 0.035) * (1 - intake * 0.55);
      ctx.fillStyle = '#fff38a';
      ctx.beginPath();
      ctx.ellipse(trailX, trailY, 8 - trail, 3.5 - trail * 0.4, -0.2 + trailPhase, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(paperScale, paperScale);
    ctx.globalAlpha = 1 - intake * 0.28;
    ctx.rotate(-0.25 + phase * 1.48 + Math.sin(state.animationFrame * 0.4 + index) * 0.08);
    ctx.fillStyle = '#ffd84e';
    ctx.strokeStyle = '#352252';
    ctx.lineWidth = 2;
    roundedRect(ctx, -12, -7, 25, 14, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f06a35';
    ctx.fillRect(-4, -4, 9, 8);
    ctx.restore();

    if (phase > 0.72) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.sin(intake * Math.PI) * 0.72;
      const glow = ctx.createRadialGradient(
        FURNACE_CENTER_X,
        FURNACE_PAPER_TARGET_Y,
        1,
        FURNACE_CENTER_X,
        FURNACE_PAPER_TARGET_Y,
        24,
      );
      glow.addColorStop(0, '#fff7a8');
      glow.addColorStop(0.42, '#ffad32aa');
      glow.addColorStop(1, '#ff5a2400');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(FURNACE_CENTER_X, FURNACE_PAPER_TARGET_Y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawFlareBackdrop(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene !== 'flaring') return;
  const progress = getFlareAnimationProgress(state.reactionFramesRemaining);
  const phase = getFlareAnimationPhase(state.reactionFramesRemaining);
  const fireIntensity = phase === 'ignition'
    ? 0.55 + progress / 0.18 * 0.65
    : phase === 'surge'
      ? 1.35
      : phase === 'inferno'
        ? 1.18
        : Math.max(0.48, 1.05 - (progress - 0.78) / 0.22 * 0.57);

  ctx.save();
  const glow = ctx.createRadialGradient(
    FURNACE_CENTER_X,
    FURNACE_MOUTH_Y,
    10,
    FURNACE_CENTER_X,
    FURNACE_MOUTH_Y,
    230,
  );
  glow.addColorStop(0, `rgba(255, 246, 139, ${0.42 * fireIntensity})`);
  glow.addColorStop(0.31, `rgba(255, 86, 31, ${0.28 * fireIntensity})`);
  glow.addColorStop(1, 'rgba(92, 11, 44, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 400, 300);

  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.92;
  const flameCount = phase === 'ignition' ? 5 : phase === 'smoke' ? 6 : 9;
  for (let index = 0; index < flameCount; index += 1) {
    const spread = flameCount <= 1 ? 0 : (index / (flameCount - 1) - 0.5) * 98;
    const centerBoost = 1 - Math.min(1, Math.abs(spread) / 54) * 0.28;
    const flicker = Math.sin(state.animationFrame * 0.24 + index * 1.73) * 0.18;
    drawFireTongue(
      ctx,
      FURNACE_CENTER_X + spread + Math.sin(state.animationFrame * 0.19 + index) * 5,
      FURNACE_MOUTH_Y + 34 + Math.abs(spread) * 0.08,
      (1.55 + fireIntensity * 0.82 + flicker) * centerBoost,
      state.animationFrame * 0.055 + index * 0.82,
    );
  }
  ctx.restore();
}

function drawFlareForeground(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene !== 'flaring') return;
  const progress = getFlareAnimationProgress(state.reactionFramesRemaining);
  const phase = getFlareAnimationPhase(state.reactionFramesRemaining);
  const fireStrength = phase === 'ignition'
    ? 0.72 + progress / 0.18 * 0.48
    : phase === 'surge'
      ? 1.34
      : phase === 'inferno'
        ? 1.15
        : Math.max(0.35, 0.92 - (progress - 0.78) / 0.22 * 0.57);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.88;
  const flameCount = phase === 'smoke' ? 3 : 5;
  for (let index = 0; index < flameCount; index += 1) {
    const spread = flameCount <= 1 ? 0 : (index / (flameCount - 1) - 0.5) * 68;
    const wobble = Math.sin(state.animationFrame * 0.31 + index * 1.81) * 4;
    drawFireTongue(
      ctx,
      FURNACE_CENTER_X + spread + wobble,
      FURNACE_MOUTH_Y + 28 + Math.abs(spread) * 0.08,
      0.92 + fireStrength * (0.62 + (index % 3) * 0.12),
      state.animationFrame * 0.08 + index,
    );
  }

  const sparkAlpha = phase === 'smoke' ? 0.24 : 0.80;
  for (let index = 0; index < 24; index += 1) {
    const travel = (progress * (2.2 + index % 4 * 0.22) + index * 0.083) % 1;
    const x = FURNACE_CENTER_X
      + Math.sin(index * 3.17 + state.animationFrame * 0.04) * (12 + travel * 48);
    const y = FURNACE_MOUTH_Y + 12 - travel * (118 + (index % 5) * 12);
    ctx.globalAlpha = (1 - travel) * sparkAlpha;
    ctx.fillStyle = index % 3 === 0 ? '#fff59a' : index % 3 === 1 ? '#ffb12e' : '#ff5533';
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + (index % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const smokeProgress = Math.min(1, Math.max(0, (progress - 0.54) / 0.46));
  if (smokeProgress > 0) {
    ctx.globalCompositeOperation = 'source-over';
    for (let index = 0; index < 18; index += 1) {
      const rise = (smokeProgress * 1.7 + index / 18) % 1;
      const x = FURNACE_CENTER_X
        + Math.sin(index * 2.37 + state.animationFrame * 0.035) * (12 + rise * 58);
      const y = FURNACE_MOUTH_Y - 6 - rise * 174;
      const radius = 15 + rise * 27 + (index % 3) * 3;
      const smoke = ctx.createRadialGradient(x, y, 1, x, y, radius);
      smoke.addColorStop(0, `rgba(37, 32, 42, ${(0.32 + rise * 0.36) * smokeProgress})`);
      smoke.addColorStop(0.55, `rgba(60, 51, 63, ${(0.24 + rise * 0.24) * smokeProgress})`);
      smoke.addColorStop(1, 'rgba(48, 41, 52, 0)');
      ctx.fillStyle = smoke;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawFireTongue(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  phase: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(phase) * 0.1);
  ctx.scale(scale * 0.72, scale * 1.16);
  const outerFlame = ctx.createLinearGradient(0, 8, 0, -58);
  outerFlame.addColorStop(0, '#ff3c24');
  outerFlame.addColorStop(0.58, '#ff7a28');
  outerFlame.addColorStop(1, '#ffd95a');
  ctx.fillStyle = outerFlame;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-17, -10, -10, -34, -3, -54);
  ctx.bezierCurveTo(2, -37, 17, -32, 14, -10);
  ctx.bezierCurveTo(12, 0, 7, 6, 0, 7);
  ctx.fill();
  const innerFlame = ctx.createLinearGradient(0, 5, 0, -34);
  innerFlame.addColorStop(0, '#fff6a0');
  innerFlame.addColorStop(1, '#ffca35');
  ctx.fillStyle = innerFlame;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-8, -7, -4, -20, 1, -31);
  ctx.bezierCurveTo(7, -19, 9, -8, 0, 5);
  ctx.fill();
  ctx.restore();
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
  if (ratio < festivalPreset.warningRatio || state.scene !== 'playing') return;
  const normalized = (ratio - festivalPreset.warningRatio) / (1 - festivalPreset.warningRatio);
  const size = 72 + normalized * 72 + Math.sin(state.animationFrame * 0.3) * 5;
  const x = 4 - normalized * 22;
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

  const previewState: FurnaceName = ratio >= festivalPreset.criticalRatio ? 'danger' : 'warm';
  if (furnace) drawFurnaceFrame(ctx, furnace, previewState, centerX - size * 0.33, centerY - size * 0.33, size * 0.66, size * 0.66);

  if (ratio >= festivalPreset.criticalRatio) {
    ctx.font = '1000 19px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, '快發爐了！', centerX, centerY + size * 0.58, '#fff56f', '#392675', 6, '#ff4d34', 2.5);
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
    const phase = getFlareAnimationPhase(state.reactionFramesRemaining);
    const pulse = 1 + Math.sin(state.animationFrame * 0.42) * 0.06;
    const title = phase === 'ignition'
      ? '糟了！火勢失控！'
      : phase === 'surge'
        ? '火焰猛衝上來！'
        : phase === 'inferno'
          ? '烈焰越竄越高！'
          : '濃煙不停冒出……';
    ctx.save();
    ctx.translate(200, 248);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#281447d9';
    ctx.strokeStyle = '#ffcb42';
    ctx.lineWidth = 3;
    roundedRect(ctx, -150, -20, 300, 42, 18);
    ctx.fill();
    ctx.stroke();
    ctx.font = '1000 22px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, title, 0, 1, '#fff56f', '#392675', 6, '#ff4d34', 2.2);
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
    ctx.fillText(state.failureReason === 'timeout' ? '時間到！' : '發爐了！', 200, 109);
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
