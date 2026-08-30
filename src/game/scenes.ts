import { GO_FRAMES } from './config';
import type { GameState } from './model';

export function getReadyCallout(state: GameState): 'READY!' | 'GO!' {
  return state.readyFramesRemaining > GO_FRAMES ? 'READY!' : 'GO!';
}

export function canStartFromScene(state: GameState): boolean {
  return state.scene === 'title' || state.scene === 'clear' || state.scene === 'fail';
}

export function sceneStatusText(state: GameState): string {
  if (state.scene === 'title') return '準備開始中元普渡連點挑戰';
  if (state.scene === 'ready') return getReadyCallout(state);
  if (state.scene === 'flaring') return '金爐發爐了';
  if (state.scene === 'clear') return `完成，成績 ${formatTime(state.finalTimeMs ?? 0)}`;
  if (state.scene === 'fail') return state.failureReason === 'timeout' ? '時間到，再試一次' : '丟太快發爐了，再試一次';
  if (state.paused) return '遊戲已暫停';
  if (state.throwAnimationFrames > 0) return '鴨鴨正在連續投入金紙';
  return '連點遊戲畫面讓鴨鴨把金紙投入金爐';
}

export function formatTime(milliseconds: number): string {
  return (Math.max(0, milliseconds) / 1_000).toFixed(2);
}
