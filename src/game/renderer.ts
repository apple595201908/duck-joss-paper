import atlasMetadata from '../assets/duck-atlas.json';
import poseMetadata from '../assets/duck-poses-v2.json';
import { faithfulPreset } from './config';
import { getDisplayedElapsedMs, getMilkRemainingPercent, getMilkRemainingRatio } from './metrics';
import type { GameState } from './model';
import { formatTime, getReadyCallout } from './scenes';

type FrameName = keyof typeof atlasMetadata.frames;
type PoseName = keyof typeof poseMetadata.frames;

export interface GameRenderer {
  render: (state: GameState) => void;
  destroy: () => void;
}

export function createGameRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is not supported');

  const atlas = new Image();
  const background = new Image();
  const poses = new Image();
  let atlasReady = false;
  let backgroundReady = false;
  let posesReady = false;
  atlas.onload = () => { atlasReady = true; };
  background.onload = () => { backgroundReady = true; };
  poses.onload = () => { posesReady = true; };
  atlas.src = atlasMetadata.image;
  background.src = '/assets/game-background-v2.png';
  poses.src = poseMetadata.image;

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

    const warningProgress = Math.max(0, state.risk / faithfulPreset.riskLimit - faithfulPreset.warningRatio);
    const shakeAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shakeStrength = shakeAllowed && state.scene === 'choking'
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
    drawCharacter(context, state, posesReady ? poses : null, atlasReady ? atlas : null);
    drawBottle(context, state);
    drawWarning(context, state, posesReady ? poses : null, atlasReady ? atlas : null);
    drawHud(context, state);
    drawSceneOverlay(context, state);
    context.restore();
  };

  return {
    render,
    destroy: () => {
      atlas.onload = null;
      background.onload = null;
      poses.onload = null;
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
  const urgent = elapsedTime >= faithfulPreset.timeLimitMs - 10_000 && state.scene === 'playing';
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

  ctx.fillStyle = '#30266f';
  ctx.font = '1000 9px ui-rounded, system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('節奏速度', 18, 176);
  const speedColors = ['#d7d8ee', '#65e0be', '#ffb52f'];
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i <= state.speedLevel ? speedColors[state.speedLevel] : '#ffffff80';
    ctx.strokeStyle = '#30266f';
    ctx.lineWidth = 2;
    roundedRect(ctx, 18 + i * 20, 184 - i * 4, 15, 13 + i * 4, 5);
    ctx.fill();
    ctx.stroke();
  }

  const riskRatio = Math.min(1, state.risk / faithfulPreset.riskLimit);
  if (riskRatio >= faithfulPreset.warningRatio) {
    ctx.fillStyle = '#fff8dff2';
    ctx.strokeStyle = '#30266f';
    ctx.lineWidth = 2;
    roundedRect(ctx, 15, 215, 90, 15, 8);
    ctx.fill();
    ctx.stroke();
    const riskGradient = ctx.createLinearGradient(18, 0, 101, 0);
    riskGradient.addColorStop(0, '#f3c94d');
    riskGradient.addColorStop(0.62, '#f28a3d');
    riskGradient.addColorStop(1, '#da3e39');
    ctx.fillStyle = riskGradient;
    roundedRect(ctx, 19, 219, 82 * riskRatio, 7, 4);
    ctx.fill();
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  poses: HTMLImageElement | null,
  atlas: HTMLImageElement | null,
) {
  const band = Math.min(2, Math.floor(state.progress / (faithfulPreset.capacity / 3)));
  const riskRatio = state.risk / faithfulPreset.riskLimit;
  const isDrinking = state.scene === 'playing' && state.drinkAnimationFrames > 0;
  const frame: FrameName = state.scene === 'title' || state.scene === 'ready'
    ? 'duck_ready'
    : state.scene === 'clear'
      ? 'duck_success'
      : state.scene === 'fail' && state.failureReason === 'spew'
        ? (`band${band}_spew` as FrameName)
        : isDrinking
          ? (`band${band}_drink` as FrameName)
          : (`band${band}_idle` as FrameName);

  const bob = state.scene === 'playing' ? Math.sin(state.animationFrame / (9 - state.speedLevel * 2)) * (2 + state.speedLevel) : 0;
  if (poses) {
    const pose: PoseName = state.scene === 'clear'
      ? 'success'
      : state.scene === 'fail' && state.failureReason === 'spew'
        ? 'spew'
        : riskRatio >= faithfulPreset.criticalRatio
          ? 'nearChoke'
          : isDrinking && state.speedLevel >= 2
            ? 'fastDrink'
            : isDrinking
              ? 'drink'
              : 'ready';
    const target = pose === 'fastDrink'
      ? { x: 107, y: 75 + bob, w: 194, h: 177 }
      : pose === 'spew'
        ? { x: 76, y: 88 + bob, w: 252, h: 166 }
        : pose === 'nearChoke'
          ? { x: 117, y: 77 + bob, w: 174, h: 182 }
          : { x: 129, y: 70 + bob, w: 155, h: 190 };
    ctx.save();
    if (isDrinking && state.speedLevel >= 2) ctx.rotate(Math.sin(state.animationFrame * 0.42) * 0.008);
    drawPoseFrame(ctx, poses, pose, target.x, target.y, target.w, target.h);
    ctx.restore();
    return;
  }

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
  ctx.ellipse(-6, -6, 24, state.drinkAnimationFrames > 0 ? 9 : 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBottle(ctx: CanvasRenderingContext2D, state: GameState) {
  const milkRatio = getMilkRemainingRatio(state);
  const milkPercent = getMilkRemainingPercent(state);
  ctx.save();
  ctx.translate(322, 88);
  ctx.shadowColor = '#2b267d55';
  ctx.shadowBlur = 7;
  ctx.fillStyle = '#dffaffeb';
  ctx.strokeStyle = '#30266f';
  ctx.lineWidth = 5;
  roundedRect(ctx, -2, 27, 56, 116, 15);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#55d8d1';
  ctx.strokeStyle = '#30266f';
  ctx.lineWidth = 4;
  roundedRect(ctx, 8, 5, 36, 31, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fffef1';
  const fillHeight = 91 * milkRatio;
  const fillTop = 134 - fillHeight;
  roundedRect(ctx, 5, fillTop, 42, fillHeight, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffffcf';
  roundedRect(ctx, 8, fillTop + 4, 5, Math.max(0, fillHeight - 10), 3);
  ctx.fill();
  ctx.strokeStyle = '#66cfe0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(7, fillTop + 1 + Math.sin(state.animationFrame * 0.16) * 2);
  ctx.quadraticCurveTo(26, fillTop - 2, 47, fillTop + 1 - Math.sin(state.animationFrame * 0.16) * 2);
  ctx.stroke();
  ctx.fillStyle = '#30266f';
  ctx.font = '1000 11px ui-rounded, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('MILK', 26, -3);
  ctx.font = '1000 13px ui-rounded, system-ui';
  drawOutlinedText(ctx, `${milkPercent}%`, 26, 159, '#fff6be', '#30266f', 4);
  ctx.restore();

}

function drawWarning(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  poses: HTMLImageElement | null,
  atlas: HTMLImageElement | null,
) {
  const ratio = state.risk / faithfulPreset.riskLimit;
  if (ratio < faithfulPreset.warningRatio || state.scene === 'title') return;
  const normalized = (ratio - faithfulPreset.warningRatio) / (1 - faithfulPreset.warningRatio);
  const size = 55 + normalized * 55 + Math.sin(state.animationFrame * 0.3) * 4;
  const name: FrameName = ratio >= faithfulPreset.criticalRatio ? 'danger_red' : 'warning_yellow';
  const x = 13 - normalized * 7;
  const y = 61 - normalized * 8;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  ctx.save();
  ctx.globalAlpha = 0.42 + normalized * 0.38;
  ctx.strokeStyle = ratio >= faithfulPreset.criticalRatio ? '#ff496a' : '#ffd84e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * (0.48 + Math.sin(state.animationFrame * 0.22) * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawStar(ctx, centerX, centerY, size / 2, ratio >= faithfulPreset.criticalRatio ? '#ff4a5d' : '#ffda3f');
  if (ratio >= faithfulPreset.criticalRatio) {
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

  if (poses) {
    const previewPose: PoseName = state.scene === 'fail' ? 'spew' : 'nearChoke';
    drawPoseFrame(ctx, poses, previewPose, centerX - size * 0.30, centerY - size * 0.31, size * 0.60, size * 0.62);
  } else if (atlas) {
    drawFrame(ctx, atlas, name, x, y, size, size);
  }

  if (ratio >= faithfulPreset.criticalRatio && (state.scene === 'playing' || state.scene === 'choking')) {
    ctx.font = '1000 13px ui-rounded, system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, '快嗆到了！', 14, 252, '#fff56f', '#392675', 5, '#ff4d64', 2);
  }
  ctx.restore();
}

function drawDangerVignette(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.scene !== 'playing' && state.scene !== 'choking') return;
  const ratio = state.risk / faithfulPreset.riskLimit;
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

  if (state.scene === 'choking') {
    const pulse = 1 + Math.sin(state.animationFrame * 0.42) * 0.06;
    ctx.save();
    ctx.translate(200, 248);
    ctx.scale(pulse, pulse);
    ctx.font = '1000 25px ui-rounded, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, '咳、咳！嗆到了！', 0, 0, '#fff56f', '#392675', 7, '#ff4d64', 2.5);
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
    drawOutlinedText(ctx, '鴨鴨喝牛奶', 200, 247, '#fff27d', '#2f2376', 7, '#ff7654', 2.5);
    ctx.font = '900 11px ui-rounded, system-ui';
    drawOutlinedText(ctx, '快速連點・保持節奏別嗆到', 200, 274, '#ffffff', '#2f2376', 4);
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
