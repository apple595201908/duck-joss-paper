import { festivalPreset } from './config';
import type { GameState } from './model';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getDisplayedElapsedMs(state: GameState): number {
  if (state.scene === 'title' || state.scene === 'ready') return 0;
  return clamp(state.elapsedMs, 0, festivalPreset.timeLimitMs);
}

export function getPaperThrowAmount(speedLevel: GameState['speedLevel'], risk = 0): number {
  const riskRatio = clamp(risk / festivalPreset.riskLimit, 0, 1);
  const riskBonusProgress = clamp(
    (riskRatio - festivalPreset.riskPaperBonusStartRatio)
      / (festivalPreset.riskPaperBonusFullRatio - festivalPreset.riskPaperBonusStartRatio),
    0,
    1,
  );
  return festivalPreset.tapPaperBase
    + speedLevel * festivalPreset.tapPaperSpeedBonus
    + riskBonusProgress * festivalPreset.riskPaperMaxBonus;
}

export function getPaperBurned(state: GameState): number {
  return clamp(state.progress, 0, festivalPreset.capacity);
}

export function getPaperRemainingRatio(state: GameState): number {
  return 1 - getPaperBurned(state) / festivalPreset.capacity;
}

export function getPaperRemainingPercent(state: GameState): number {
  return Math.round(getPaperRemainingRatio(state) * 100);
}

export function getRiskReliefPerFrame(risk: number): number {
  const riskRatio = clamp(risk / festivalPreset.riskLimit, 0, 1);
  return festivalPreset.riskReliefIdleBase
    + festivalPreset.riskReliefIdleBonus * Math.pow(riskRatio, festivalPreset.riskReliefCurvePower);
}
