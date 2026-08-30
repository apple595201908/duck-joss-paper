import { FLARE_REACTION_FRAMES, GO_FRAMES } from './config';
import type { GameState } from './model';

export type FlareAnimationPhase = 'ignition' | 'burst' | 'inferno' | 'smoke';

export function getFlareAnimationProgress(reactionFramesRemaining: number): number {
  return Math.min(1, Math.max(0, 1 - reactionFramesRemaining / FLARE_REACTION_FRAMES));
}

export function getFlareAnimationPhase(reactionFramesRemaining: number): FlareAnimationPhase {
  const progress = getFlareAnimationProgress(reactionFramesRemaining);
  if (progress < 0.18) return 'ignition';
  if (progress < 0.48) return 'burst';
  if (progress < 0.78) return 'inferno';
  return 'smoke';
}

export function getReadyCallout(state: GameState): 'READY!' | 'GO!' {
  return state.readyFramesRemaining > GO_FRAMES ? 'READY!' : 'GO!';
}

export function canStartFromScene(state: GameState): boolean {
  return state.scene === 'title' || state.scene === 'clear' || state.scene === 'fail';
}

export function sceneStatusText(state: GameState): string {
  if (state.scene === 'title') return '準備開始中元普渡連點挑戰';
  if (state.scene === 'ready') return getReadyCallout(state);
  if (state.scene === 'flaring') {
    const phase = getFlareAnimationPhase(state.reactionFramesRemaining);
    if (phase === 'ignition') return '金爐火勢失控';
    if (phase === 'burst') return '金爐發爐爆燃';
    if (phase === 'inferno') return '金爐猛烈燃燒中';
    return '發爐火勢轉為黑煙，即將顯示結果';
  }
  if (state.scene === 'clear') return `完成，成績 ${formatTime(state.finalTimeMs ?? 0)}`;
  if (state.scene === 'fail') return state.failureReason === 'timeout' ? '時間到，再試一次' : '丟太快發爐了，再試一次';
  if (state.paused) return '遊戲已暫停';
  if (state.throwAnimationFrames > 0) return '鴨鴨正在連續投入金紙';
  return '連點遊戲畫面讓鴨鴨把金紙投入金爐';
}

export function formatTime(milliseconds: number): string {
  return (Math.max(0, milliseconds) / 1_000).toFixed(2);
}
