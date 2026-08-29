import { describe, expect, it } from 'vitest';
import { CHOKE_REACTION_FRAMES, faithfulPreset } from '../src/game/config';
import {
  getDisplayedElapsedMs,
  getMilkRemainingPercent,
  getRiskReliefPerFrame,
  getTapMilkAmount,
} from '../src/game/metrics';
import { createGameState, type GameState } from '../src/game/model';
import { applyGameEvent, stepSimulation } from '../src/game/simulation';

function playing(overrides: Partial<GameState> = {}): GameState {
  return { ...createGameState(), scene: 'playing', ...overrides };
}

function playTapCadence(intervalFrames: number, restAboveRatio?: number): GameState {
  let state = playing();
  for (let tap = 0; tap < 500 && state.scene === 'playing'; tap += 1) {
    state = applyGameEvent(state, { type: 'press' });
    for (let frame = 0; frame < intervalFrames && state.scene === 'playing'; frame += 1) {
      state = stepSimulation(state);
    }
    while (
      state.scene === 'playing'
      && restAboveRatio !== undefined
      && state.risk / faithfulPreset.riskLimit > restAboveRatio
    ) {
      state = stepSimulation(state);
    }
  }
  while (state.scene === 'choking') state = stepSimulation(state);
  return state;
}

describe('duck milk tap simulation', () => {
  it('fails by timeout after 60 seconds without input', () => {
    let state = playing();
    for (let frame = 0; frame < 3_700 && state.scene === 'playing'; frame += 1) {
      state = stepSimulation(state);
    }
    expect(state.scene).toBe('fail');
    expect(state.failureReason).toBe('timeout');
    expect(state.elapsedMs).toBeGreaterThanOrEqual(faithfulPreset.timeLimitMs);
  });

  it('drinks one discrete sip on press and ignores release', () => {
    const initial = playing();
    const tapped = applyGameEvent(initial, { type: 'press' });
    expect(tapped.progress).toBeCloseTo(getTapMilkAmount(0), 7);
    expect(tapped.drinkAnimationFrames).toBe(faithfulPreset.tapDrinkAnimationFrames);
    expect(applyGameEvent(tapped, { type: 'release' })).toEqual(tapped);
  });

  it('clears at capacity, freezes time, and keeps only the better record', () => {
    let state = applyGameEvent(
      playing({ progress: faithfulPreset.capacity - 1, elapsedMs: 9_876, bestTimeMs: 12_000 }),
      { type: 'press' },
    );
    expect(state.scene).toBe('clear');
    expect(state.progress).toBe(faithfulPreset.capacity);
    expect(state.finalTimeMs).toBe(9_876);
    expect(state.bestTimeMs).toBe(9_876);
    expect(stepSimulation(state).elapsedMs).toBe(9_876);

    state = applyGameEvent(
      playing({ progress: faithfulPreset.capacity - 1, elapsedMs: 14_000, bestTimeMs: 9_876 }),
      { type: 'press' },
    );
    expect(state.bestTimeMs).toBe(9_876);
  });

  it.each([
    [2, 0],
    [3, 1],
    [4, 2],
  ])('maps %i taps to target speed %i per 40-frame window', (clicks, expected) => {
    const state = stepSimulation(playing({ rateWindowFrame: 39, clicksInWindow: clicks }));
    expect(state.targetSpeedLevel).toBe(expected);
  });

  it('gives faster established rhythms a small milk reward and a larger risk cost', () => {
    const slow = applyGameEvent(playing({ speedLevel: 0 }), { type: 'press' });
    const fast = applyGameEvent(playing({ speedLevel: 2 }), { type: 'press' });
    expect(fast.progress).toBeGreaterThan(slow.progress);
    expect(fast.risk).toBeGreaterThan(slow.risk);
    expect(fast.progress - slow.progress).toBeCloseTo(faithfulPreset.tapMilkSpeedBonus * 2, 7);
  });

  it('rewards skilled taps that stay near the visual danger zone', () => {
    const safeAmount = getTapMilkAmount(2, faithfulPreset.riskLimit * 0.2);
    const warningAmount = getTapMilkAmount(2, faithfulPreset.riskLimit * 0.6);
    const criticalAmount = getTapMilkAmount(2, faithfulPreset.riskLimit * 0.8);
    expect(warningAmount).toBeGreaterThan(safeAmount);
    expect(criticalAmount - safeAmount).toBeCloseTo(faithfulPreset.riskMilkMaxBonus, 7);
  });

  it('recovers risk faster when danger is already high', () => {
    expect(getRiskReliefPerFrame(90)).toBeGreaterThan(getRiskReliefPerFrame(20));
    const state = stepSimulation(playing({ risk: 90 }));
    expect(state.risk).toBeCloseTo(90 - getRiskReliefPerFrame(90), 7);
  });

  it('keeps the drink pose alive across rapid taps', () => {
    let state = applyGameEvent(playing(), { type: 'press' });
    for (let frame = 0; frame < 8; frame += 1) state = stepSimulation(state);
    expect(state.drinkAnimationFrames).toBeGreaterThan(0);
    state = applyGameEvent(state, { type: 'press' });
    expect(state.drinkAnimationFrames).toBe(faithfulPreset.tapDrinkAnimationFrames);
  });

  it('shows the choke reaction before the fail scene', () => {
    let state = applyGameEvent(
      playing({ risk: faithfulPreset.riskLimit - 1, elapsedMs: 8_000 }),
      { type: 'press' },
    );
    expect(state.scene).toBe('choking');
    expect(state.reactionFramesRemaining).toBe(CHOKE_REACTION_FRAMES);
    expect(state.elapsedMs).toBe(8_000);

    for (let frame = 1; frame < CHOKE_REACTION_FRAMES; frame += 1) state = stepSimulation(state);
    expect(state.scene).toBe('choking');
    state = stepSimulation(state);
    expect(state.scene).toBe('fail');
    expect(state.failureReason).toBe('spew');
  });

  it('prioritizes finishing the bottle when milk and risk cross together', () => {
    const state = applyGameEvent(
      playing({ progress: faithfulPreset.capacity - 1, risk: faithfulPreset.riskLimit - 1 }),
      { type: 'press' },
    );
    expect(state.scene).toBe('clear');
    expect(state.failureReason).toBeNull();
  });

  it('pause freezes elapsed time', () => {
    const paused = applyGameEvent(playing({ elapsedMs: 1_500 }), { type: 'pause' });
    expect(paused.paused).toBe(true);
    expect(stepSimulation(paused).elapsedMs).toBe(1_500);
  });

  it('punishes reckless tapping before half the bottle is finished', () => {
    const state = playTapCadence(7);
    expect(state.scene).toBe('fail');
    expect(state.failureReason).toBe('spew');
    expect(state.progress).toBeLessThan(faithfulPreset.capacity * 0.5);
  });

  it('lets a normal tapping rhythm finish in about 20 seconds', () => {
    const state = playTapCadence(13);
    expect(state.scene).toBe('clear');
    expect(state.finalTimeMs).toBeGreaterThan(19_000);
    expect(state.finalTimeMs).toBeLessThan(22_000);
    expect(state.risk).toBeGreaterThan(faithfulPreset.riskLimit * faithfulPreset.warningRatio);
    expect(state.risk).toBeLessThan(faithfulPreset.riskLimit * faithfulPreset.criticalRatio);
  });

  it('lets a relaxed tapping rhythm finish safely in roughly half a minute', () => {
    const state = playTapCadence(20);
    expect(state.scene).toBe('clear');
    expect(state.finalTimeMs).toBeGreaterThan(30_000);
    expect(state.finalTimeMs).toBeLessThan(40_000);
    expect(state.risk).toBeLessThan(faithfulPreset.riskLimit * faithfulPreset.warningRatio);
  });

  it('allows an expert to ride high risk without making the round instant', () => {
    const state = playTapCadence(8, 0.75);
    expect(state.scene).toBe('clear');
    expect(state.finalTimeMs).toBeGreaterThan(15_000);
    expect(state.finalTimeMs).toBeLessThan(17_000);
    expect(state.risk).toBeGreaterThan(faithfulPreset.riskLimit * 0.70);
  });

  it('creates a meaningful finish-time gap between expert and novice play', () => {
    const expert = playTapCadence(8, 0.75);
    const novice = playTapCadence(20);
    expect(expert.scene).toBe('clear');
    expect(novice.scene).toBe('clear');
    expect((novice.finalTimeMs ?? 0) - (expert.finalTimeMs ?? 0)).toBeGreaterThan(18_000);
  });

  it('shows elapsed time from zero and caps it at the round limit', () => {
    expect(getDisplayedElapsedMs(createGameState())).toBe(0);
    expect(getDisplayedElapsedMs(playing({ elapsedMs: 12_345 }))).toBe(12_345);
    expect(getDisplayedElapsedMs(playing({ elapsedMs: 75_000 }))).toBe(faithfulPreset.timeLimitMs);
  });

  it('keeps the bottle percentage bounded and updates it from the same progress value', () => {
    expect(getMilkRemainingPercent(playing())).toBe(100);
    const tapped = applyGameEvent(playing({ progress: 110 }), { type: 'press' });
    const expected = Math.round((1 - tapped.progress / faithfulPreset.capacity) * 100);
    expect(getMilkRemainingPercent(tapped)).toBe(expected);
    expect(getMilkRemainingPercent(playing({ progress: faithfulPreset.capacity + 20 }))).toBe(0);
  });
});
