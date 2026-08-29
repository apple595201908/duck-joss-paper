import { CHOKE_REACTION_FRAMES, FIXED_STEP_MS, GO_FRAMES, faithfulPreset } from './config';
import { getRiskReliefPerFrame, getTapMilkAmount } from './metrics';
import { createRoundState, type GameEvent, type GameState } from './model';

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
    reactionFramesRemaining: 0,
    drinkAnimationFrames: 0,
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
    reactionFramesRemaining: 0,
    drinkAnimationFrames: 0,
  };
}

function beginChokeReaction(next: GameState): GameState {
  return {
    ...next,
    scene: 'choking',
    failureReason: 'spew',
    charge: 0,
    holding: false,
    paused: false,
    reactionFramesRemaining: CHOKE_REACTION_FRAMES,
    drinkAnimationFrames: 0,
  };
}

function checkRoundEnd(next: GameState): GameState {
  // Faithful ordering: clearing the bottle wins even if this step also crosses the risk limit.
  if (next.progress >= faithfulPreset.capacity) return finishClear(next);
  if (next.risk >= faithfulPreset.riskLimit) return beginChokeReaction(next);
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
    return state;
  }

  if (state.scene !== 'playing' || state.paused) return state;

  if (event.type === 'press') {
    const tapMilk = getTapMilkAmount(state.speedLevel, state.risk);
    const tapRisk = faithfulPreset.tapRiskBase + state.speedLevel * faithfulPreset.tapRiskSpeedBonus;
    return checkRoundEnd({
      ...state,
      holding: false,
      charge: 0,
      progress: state.progress + tapMilk,
      risk: (state.risk + tapRisk) * (1 + faithfulPreset.riskGrowth),
      clicksInWindow: state.clicksInWindow + 1,
      drinkAnimationFrames: faithfulPreset.tapDrinkAnimationFrames,
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

  if (state.scene === 'choking') {
    const reactionFramesRemaining = state.reactionFramesRemaining - 1;
    if (reactionFramesRemaining <= 0) {
      return finishFail({ ...state, reactionFramesRemaining: 0 }, 'spew');
    }
    return {
      ...state,
      reactionFramesRemaining,
      animationFrame: (state.animationFrame + 1) % faithfulPreset.animationCycleFrames,
    };
  }

  if (state.scene === 'ready') {
    const readyFramesRemaining = state.readyFramesRemaining - 1;
    if (readyFramesRemaining <= 0) {
      return { ...state, scene: 'playing', readyFramesRemaining: 0, elapsedMs: 0, animationFrame: 0 };
    }
    return { ...state, readyFramesRemaining };
  }

  const animationFrame = (state.animationFrame + 1) % faithfulPreset.animationCycleFrames;
  let risk = state.risk;
  const riskRelief = getRiskReliefPerFrame(risk);
  risk -= riskRelief;
  if ((animationFrame + 40) % faithfulPreset.animationCycleFrames === 0) risk -= 0.188;
  risk = Math.max(0, risk);

  const advanced = updateSpeed({
    ...state,
    animationFrame,
    risk,
    drinkAnimationFrames: Math.max(0, state.drinkAnimationFrames - 1),
    elapsedMs: state.elapsedMs + FIXED_STEP_MS,
  });

  return checkRoundEnd(advanced);
}

export const simulationInternals = {
  readyGoBoundary: GO_FRAMES,
};
