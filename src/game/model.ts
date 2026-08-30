import { TOTAL_READY_FRAMES } from './config';

export type GameScene = 'title' | 'ready' | 'playing' | 'flaring' | 'clear' | 'fail';
export type FailureReason = 'flare' | 'timeout' | null;

export interface GameState {
  scene: GameScene;
  failureReason: FailureReason;
  progress: number;
  charge: number;
  risk: number;
  speedLevel: 0 | 1 | 2;
  targetSpeedLevel: 0 | 1 | 2;
  holding: boolean;
  paused: boolean;
  elapsedMs: number;
  finalTimeMs: number | null;
  bestTimeMs: number | null;
  animationFrame: number;
  rateWindowFrame: number;
  clicksInWindow: number;
  downshiftFrames: number;
  readyFramesRemaining: number;
  reactionFramesRemaining: number;
  throwAnimationFrames: number;
}

export type GameEvent =
  | { type: 'start' }
  | { type: 'press' }
  | { type: 'release' }
  | { type: 'cancel' }
  | { type: 'retry' }
  | { type: 'togglePause' }
  | { type: 'pause' }
  | { type: 'resume' };

export function createGameState(bestTimeMs: number | null = null): GameState {
  return {
    scene: 'title',
    failureReason: null,
    progress: 0,
    charge: 0,
    risk: 0,
    speedLevel: 0,
    targetSpeedLevel: 0,
    holding: false,
    paused: false,
    elapsedMs: 0,
    finalTimeMs: null,
    bestTimeMs,
    animationFrame: 0,
    rateWindowFrame: 0,
    clicksInWindow: 0,
    downshiftFrames: 0,
    readyFramesRemaining: TOTAL_READY_FRAMES,
    reactionFramesRemaining: 0,
    throwAnimationFrames: 0,
  };
}

export function createRoundState(bestTimeMs: number | null = null): GameState {
  return {
    ...createGameState(bestTimeMs),
    scene: 'ready',
  };
}
