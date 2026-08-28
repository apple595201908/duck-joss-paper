import { FIXED_STEP_MS, GO_FRAMES, faithfulPreset } from './config';
import { createRoundState, type GameEvent, type GameState } from './model';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function finishClear(next: GameState): GameState {
  const finalTime = Math.min(next.elapsedMs, faithfulPreset.timeLimitMs);
  return {
    ...next,
    scene: 'clear',
    progress: faithfulPreset.capacity,
    charge: 0,
    holding: false,
    paused: false,
    failureReason: null,
    finalTimeMs: finalTime,
    bestTimeMs: next.bestTimeMs === null ? finalTime : Math.min(next.bestTimeMs, finalTime),
  };
}

function finishFail(next: GameState, reason: 'spew' | 'timeout'): GameState {
  return {
    ...next,
    scene: 'fail',
    charge: 0,
    holding: false,
    paused: false,
    failureReason: reason,
    finalTimeMs: null,
  };
}

function checkRoundEnd(next: GameState): GameState {
  // Faithful ordering: clearing the bottle wins even if this step also crosses the risk limit.
  if (next.progress >= faithfulPreset.capacity) return finishClear(next);
  if (next.risk >= faithfulPreset.riskLimit) return finishFail(next, 'spew');
  if (next.elapsedMs >= faithfulPreset.timeLimitMs) return finishFail(next, 'timeout');
  return next;
}

export function applyGameEvent(state: GameState, event: GameEvent): GameState {
  if (event.type === 'start' && state.scene === 'title') return createRoundState(state.bestTimeMs);
  if (event.type === 'retry' && (state.scene === 'clear' || state.scene === 'fail')) return createRoundState(state.bestTimeMs);

  if (event.type === 'pause') {
    if (state.scene !== 'playing') return state;
    return { ...state, paused: true, holding: false, charge: 0 };
  }

  if (event.type === 'resume') {
    if (state.scene !== 'playing') return state;
    return { ...state, paused: false };
  }

  if (event.type === 'togglePause') {
    if (state.scene !== 'playing') return state;
    return { ...state, paused: !state.paused, holding: false, charge: 0 };
  }

  if (event.type === 'cancel') {
    if (!state.holding && state.charge === 0) return state;
    return { ...state, holding: false, charge: 0 };
  }

  if (state.scene !== 'playing' || state.paused) return state;

  if (event.type === 'press') {
    if (state.holding) return state;
    return { ...state, holding: true, charge: 0 };
  }

  if (event.type !== 'release' || !state.holding) return state;

  const riskMultiplier = state.charge < faithfulPreset.riskChargeBoundary
    ? faithfulPreset.riskChargeLow
    : faithfulPreset.riskChargeHigh;
  const nextRisk = (state.risk + faithfulPreset.riskBase) * (1 + faithfulPreset.riskGrowth)
    + state.charge * riskMultiplier;

  const phase = (state.animationFrame + 20) % faithfulPreset.animationCycleFrames;
  const timingBonus = phase === 0 ? 0.20 : phase <= 9 ? 0.10 : 0;

  return checkRoundEnd({
    ...state,
    holding: false,
    risk: nextRisk,
    progress: state.progress + state.charge * (1 + timingBonus),
    charge: 0,
    clicksInWindow: state.clicksInWindow + 1,
  });
}

function updateSpeed(next: GameState): GameState {
  let rateWindowFrame = next.rateWindowFrame + 1;
  let clicksInWindow = next.clicksInWindow;
  let targetSpeedLevel = next.targetSpeedLevel;
  let speedLevel = next.speedLevel;
  let downshiftFrames = next.downshiftFrames;

  if (rateWindowFrame >= faithfulPreset.rateWindowFrames) {
    targetSpeedLevel = clicksInWindow <= faithfulPreset.slowClickThreshold
      ? 0
      : clicksInWindow < faithfulPreset.fastClickThreshold
        ? 1
        : 2;
    rateWindowFrame = 0;
    clicksInWindow = 0;

    if (targetSpeedLevel > speedLevel) {
      speedLevel = Math.min(2, speedLevel + 1) as 0 | 1 | 2;
      downshiftFrames = 0;
    }
  }

  if (targetSpeedLevel < speedLevel) {
    downshiftFrames += 1;
    if (downshiftFrames >= faithfulPreset.downshiftDelayFrames) {
      speedLevel = Math.max(targetSpeedLevel, speedLevel - 1) as 0 | 1 | 2;
      downshiftFrames = 0;
    }
  } else if (targetSpeedLevel >= speedLevel) {
    downshiftFrames = 0;
  }

  return { ...next, rateWindowFrame, clicksInWindow, targetSpeedLevel, speedLevel, downshiftFrames };
}

export function stepSimulation(state: GameState): GameState {
  if (state.paused || state.scene === 'title' || state.scene === 'clear' || state.scene === 'fail') return state;

  if (state.scene === 'ready') {
    const readyFramesRemaining = state.readyFramesRemaining - 1;
    if (readyFramesRemaining <= 0) {
      return { ...state, scene: 'playing', readyFramesRemaining: 0, elapsedMs: 0, animationFrame: 0 };
    }
    return { ...state, readyFramesRemaining };
  }

  const animationFrame = (state.animationFrame + 1) % faithfulPreset.animationCycleFrames;
  let charge = state.charge;
  let risk = state.risk;

  if (state.holding) {
    const band = clamp(
      Math.floor(state.progress / (faithfulPreset.capacity / faithfulPreset.progressBands)),
      0,
      faithfulPreset.progressBands - 1,
    );
    const delta = state.speedLevel - band;
    let base = faithfulPreset.chargePerFrame;
    if (delta === -1) base *= 0.15;
    else if (delta < -1) base *= 0.30;

    let gain = base + faithfulPreset.chargeLevelBonus * faithfulPreset.chargePerFrame * state.speedLevel;
    if (delta > 0) gain *= faithfulPreset.aheadLevelMultiplier * delta;

    charge = Math.min(
      charge + gain,
      faithfulPreset.chargeCap,
      faithfulPreset.capacity - state.progress,
    );
    risk = Math.max(0, risk - faithfulPreset.riskReliefIdlePerFrame / faithfulPreset.riskReliefHeldDivisor);
  } else {
    risk -= faithfulPreset.riskReliefIdlePerFrame;
    if ((animationFrame + 40) % faithfulPreset.animationCycleFrames === 0) risk -= 0.188;
    risk = Math.max(0, risk);
  }

  const advanced = updateSpeed({
    ...state,
    animationFrame,
    charge,
    risk,
    elapsedMs: state.elapsedMs + FIXED_STEP_MS,
  });

  return checkRoundEnd(advanced);
}

export const simulationInternals = {
  readyGoBoundary: GO_FRAMES,
};
