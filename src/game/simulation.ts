import { FLARE_REACTION_FRAMES, FIXED_STEP_MS, GO_FRAMES, festivalPreset } from './config';
import { getPaperThrowAmount, getRiskReliefPerFrame } from './metrics';
import { createRoundState, type GameEvent, type GameState } from './model';

function finishClear(next: GameState): GameState {
  const finalTime = Math.min(next.elapsedMs, festivalPreset.timeLimitMs);
  return {
    ...next,
    scene: 'clear',
    progress: festivalPreset.capacity,
    charge: 0,
    holding: false,
    paused: false,
    failureReason: null,
    finalTimeMs: finalTime,
    bestTimeMs: next.bestTimeMs === null ? finalTime : Math.min(next.bestTimeMs, finalTime),
    reactionFramesRemaining: 0,
    throwAnimationFrames: 0,
  };
}

function finishFail(next: GameState, reason: 'flare' | 'timeout'): GameState {
  return {
    ...next,
    scene: 'fail',
    charge: 0,
    holding: false,
    paused: false,
    failureReason: reason,
    finalTimeMs: null,
    reactionFramesRemaining: 0,
    throwAnimationFrames: 0,
  };
}

function beginFlareReaction(next: GameState): GameState {
  return {
    ...next,
    scene: 'flaring',
    failureReason: 'flare',
    charge: 0,
    holding: false,
    paused: false,
    reactionFramesRemaining: FLARE_REACTION_FRAMES,
    throwAnimationFrames: 0,
  };
}

function checkRoundEnd(next: GameState): GameState {
  // Finishing the paper stack wins even if the same tap also crosses the flare limit.
  if (next.progress >= festivalPreset.capacity) return finishClear(next);
  if (next.risk >= festivalPreset.riskLimit) return beginFlareReaction(next);
  if (next.elapsedMs >= festivalPreset.timeLimitMs) return finishFail(next, 'timeout');
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
    return state;
  }

  if (state.scene !== 'playing' || state.paused) return state;

  if (event.type === 'press') {
    const paperAmount = getPaperThrowAmount(state.speedLevel, state.risk);
    const tapRisk = festivalPreset.tapRiskBase + state.speedLevel * festivalPreset.tapRiskSpeedBonus;
    return checkRoundEnd({
      ...state,
      holding: false,
      charge: 0,
      progress: state.progress + paperAmount,
      risk: (state.risk + tapRisk) * (1 + festivalPreset.riskGrowth),
      clicksInWindow: state.clicksInWindow + 1,
      throwAnimationFrames: festivalPreset.tapThrowAnimationFrames,
    });
  }

  return state;
}

function updateSpeed(next: GameState): GameState {
  let rateWindowFrame = next.rateWindowFrame + 1;
  let clicksInWindow = next.clicksInWindow;
  let targetSpeedLevel = next.targetSpeedLevel;
  let speedLevel = next.speedLevel;
  let downshiftFrames = next.downshiftFrames;

  if (rateWindowFrame >= festivalPreset.rateWindowFrames) {
    targetSpeedLevel = clicksInWindow <= festivalPreset.slowClickThreshold
      ? 0
      : clicksInWindow < festivalPreset.fastClickThreshold
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
    if (downshiftFrames >= festivalPreset.downshiftDelayFrames) {
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

  if (state.scene === 'flaring') {
    const reactionFramesRemaining = state.reactionFramesRemaining - 1;
    if (reactionFramesRemaining <= 0) {
      return finishFail({ ...state, reactionFramesRemaining: 0 }, 'flare');
    }
    return {
      ...state,
      reactionFramesRemaining,
      animationFrame: (state.animationFrame + 1) % festivalPreset.animationCycleFrames,
    };
  }

  if (state.scene === 'ready') {
    const readyFramesRemaining = state.readyFramesRemaining - 1;
    if (readyFramesRemaining <= 0) {
      return { ...state, scene: 'playing', readyFramesRemaining: 0, elapsedMs: 0, animationFrame: 0 };
    }
    return { ...state, readyFramesRemaining };
  }

  const animationFrame = (state.animationFrame + 1) % festivalPreset.animationCycleFrames;
  let risk = state.risk;
  const riskRelief = getRiskReliefPerFrame(risk);
  risk -= riskRelief;
  if ((animationFrame + 40) % festivalPreset.animationCycleFrames === 0) risk -= 0.188;
  risk = Math.max(0, risk);

  const advanced = updateSpeed({
    ...state,
    animationFrame,
    risk,
    throwAnimationFrames: Math.max(0, state.throwAnimationFrames - 1),
    elapsedMs: state.elapsedMs + FIXED_STEP_MS,
  });

  return checkRoundEnd(advanced);
}

export const simulationInternals = {
  readyGoBoundary: GO_FRAMES,
};
