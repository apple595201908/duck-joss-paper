import { faithfulPreset } from './config';
import type { GameState } from './model';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getDisplayedElapsedMs(state: GameState): number {
  if (state.scene === 'title' || state.scene === 'ready') return 0;
  return clamp(state.elapsedMs, 0, faithfulPreset.timeLimitMs);
}

export function getTapMilkAmount(speedLevel: GameState['speedLevel']): number {
  return faithfulPreset.tapMilkBase + speedLevel * faithfulPreset.tapMilkSpeedBonus;
}

export function getMilkConsumed(state: GameState): number {
  return clamp(state.progress, 0, faithfulPreset.capacity);
}

export function getMilkRemainingRatio(state: GameState): number {
  return 1 - getMilkConsumed(state) / faithfulPreset.capacity;
}

export function getMilkRemainingPercent(state: GameState): number {
  return Math.round(getMilkRemainingRatio(state) * 100);
}

export function getRiskReliefPerFrame(risk: number): number {
  const riskRatio = clamp(risk / faithfulPreset.riskLimit, 0, 1);
  return faithfulPreset.riskReliefIdleBase
    + faithfulPreset.riskReliefIdleBonus * Math.pow(riskRatio, faithfulPreset.riskReliefCurvePower);
}
