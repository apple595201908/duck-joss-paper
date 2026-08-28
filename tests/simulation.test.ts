import { describe, expect, it } from 'vitest';
import { faithfulPreset } from '../src/game/config';
import { createGameState, type GameState } from '../src/game/model';
import { applyGameEvent, stepSimulation } from '../src/game/simulation';

function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGameState(),
    scene: 'playing',
    ...overrides,
  };
}

function playCadence(holdFrames: number, restFrames: number, restAboveRatio?: number): GameState {
  let state = playing();
  for (let round = 0; round < 500 && state.scene === 'playing'; round += 1) {
    state = applyGameEvent(state, { type: 'press' });
    for (let frame = 0; frame < holdFrames && state.scene === 'playing'; frame += 1) {
      state = stepSimulation(state);
    }
    state = applyGameEvent(state, { type: 'release' });

    let rested = 0;
    while (state.scene === 'playing' && rested < restFrames) {
      state = stepSimulation(state);
      rested += 1;
    }
    while (
      state.scene === 'playing'
      && restAboveRatio !== undefined
      && state.risk / faithfulPreset.riskLimit > restAboveRatio
    ) {
      state = stepSimulation(state);
    }
  }
  return state;
}

describe('faithful duck milk simulation', () => {
  it('fails by timeout after 60 seconds without input', () => {
    let state = playing();
    for (let frame = 0; frame < 3_700 && state.scene === 'playing'; frame += 1) {
      state = stepSimulation(state);
    }
    expect(state.scene).toBe('fail');
    expect(state.failureReason).toBe('timeout');
    expect(state.elapsedMs).toBeGreaterThanOrEqual(faithfulPreset.timeLimitMs);
  });

  it('clears at capacity, freezes time, and keeps only the better record', () => {
    let state = playing({ progress: faithfulPreset.capacity - 1, charge: 2, holding: true, elapsedMs: 9_876, bestTimeMs: 12_000 });
    state = applyGameEvent(state, { type: 'release' });
    expect(state.scene).toBe('clear');
    expect(state.progress).toBe(faithfulPreset.capacity);
    expect(state.finalTimeMs).toBe(9_876);
    expect(state.bestTimeMs).toBe(9_876);

    const frozen = stepSimulation(state);
    expect(frozen.elapsedMs).toBe(9_876);

    const worseAttempt = applyGameEvent(
      playing({ progress: faithfulPreset.capacity - 1, charge: 2, holding: true, elapsedMs: 14_000, bestTimeMs: 9_876 }),
      { type: 'release' },
    );
    expect(worseAttempt.bestTimeMs).toBe(9_876);
  });

  it('fails with spew when risk reaches the limit', () => {
    const state = applyGameEvent(
      playing({ risk: 159, charge: 1, holding: true }),
      { type: 'release' },
    );
    expect(state.scene).toBe('fail');
    expect(state.failureReason).toBe('spew');
  });

  it('uses low risk below the charge boundary and high risk at the boundary', () => {
    const lowCharge = faithfulPreset.riskChargeBoundary - 0.01;
    const highCharge = faithfulPreset.riskChargeBoundary;
    const low = applyGameEvent(playing({ charge: lowCharge, holding: true }), { type: 'release' });
    const high = applyGameEvent(playing({ charge: highCharge, holding: true }), { type: 'release' });
    const baseRisk = faithfulPreset.riskBase * (1 + faithfulPreset.riskGrowth);

    expect(low.risk).toBeCloseTo(baseRisk + lowCharge * faithfulPreset.riskChargeLow, 7);
    expect(high.risk).toBeCloseTo(baseRisk + highCharge * faithfulPreset.riskChargeHigh, 7);
  });

  it.each([
    [2, 0],
    [3, 1],
    [4, 2],
  ])('maps %i settled sips to target speed %i per 40-frame window', (clicks, expected) => {
    const state = stepSimulation(playing({ rateWindowFrame: 39, clicksInWindow: clicks }));
    expect(state.targetSpeedLevel).toBe(expected);
  });

  it('relieves risk faster while idle than while held', () => {
    const idle = stepSimulation(playing({ risk: 100, holding: false }));
    const held = stepSimulation(playing({ risk: 100, holding: true }));
    expect(idle.risk).toBeCloseTo(100 - faithfulPreset.riskReliefIdlePerFrame, 7);
    expect(held.risk).toBeCloseTo(
      100 - faithfulPreset.riskReliefIdlePerFrame / faithfulPreset.riskReliefHeldDivisor,
      7,
    );
    expect(idle.risk).toBeLessThan(held.risk);
  });

  it.each([
    [90, 0.20],
    [91, 0.10],
    [99, 0.10],
    [100, 0],
  ])('applies the correct timing bonus at animation frame %i', (animationFrame, expectedBonus) => {
    const charge = 10;
    const efficiency = faithfulPreset.sipEfficiencyBase
      + faithfulPreset.sipEfficiencyChargeBonus * (charge / faithfulPreset.chargeCap);
    const state = applyGameEvent(
      playing({ animationFrame, charge, holding: true }),
      { type: 'release' },
    );
    expect(state.progress).toBeCloseTo(charge * efficiency * (1 + expectedBonus), 7);
  });

  it('prioritizes clear when progress and risk cross limits together', () => {
    const state = applyGameEvent(
      playing({ progress: faithfulPreset.capacity - 1, risk: faithfulPreset.riskLimit - 1, charge: 2, holding: true }),
      { type: 'release' },
    );
    expect(state.scene).toBe('clear');
    expect(state.failureReason).toBeNull();
  });

  it('cancel safely clears a pending hold without settling it', () => {
    const state = applyGameEvent(
      playing({ progress: 42, risk: 18, charge: 12, holding: true }),
      { type: 'cancel' },
    );
    expect(state.holding).toBe(false);
    expect(state.charge).toBe(0);
    expect(state.progress).toBe(42);
    expect(state.risk).toBe(18);
  });

  it('pause freezes elapsed time and clears holding state', () => {
    const paused = applyGameEvent(
      playing({ elapsedMs: 1_500, charge: 9, holding: true }),
      { type: 'pause' },
    );
    expect(paused.paused).toBe(true);
    expect(paused.holding).toBe(false);
    expect(paused.charge).toBe(0);
    expect(stepSimulation(paused).elapsedMs).toBe(1_500);
  });

  it('punishes reckless gulping before the bottle is finished', () => {
    const state = playCadence(10, 2);
    expect(state.scene).toBe('fail');
    expect(state.failureReason).toBe('spew');
    expect(state.progress).toBeLessThan(faithfulPreset.capacity * 0.75);
  });

  it('rewards a fast risk-managed rhythm without making the round instant', () => {
    const state = playCadence(10, 0, 0.75);
    expect(state.scene).toBe('clear');
    expect(state.finalTimeMs).toBeGreaterThan(22_000);
    expect(state.finalTimeMs).toBeLessThan(35_000);
  });

  it('lets a conservative rhythm finish safely within the time limit', () => {
    const state = playCadence(6, 10);
    expect(state.scene).toBe('clear');
    expect(state.finalTimeMs).toBeGreaterThan(18_000);
    expect(state.finalTimeMs).toBeLessThan(30_000);
    expect(state.risk).toBeLessThan(faithfulPreset.riskLimit * faithfulPreset.warningRatio);
  });
});
