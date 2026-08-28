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
    let state = playing({ progress: 349, charge: 1, holding: true, elapsedMs: 9_876, bestTimeMs: 12_000 });
    state = applyGameEvent(state, { type: 'release' });
    expect(state.scene).toBe('clear');
    expect(state.progress).toBe(faithfulPreset.capacity);
    expect(state.finalTimeMs).toBe(9_876);
    expect(state.bestTimeMs).toBe(9_876);

    const frozen = stepSimulation(state);
    expect(frozen.elapsedMs).toBe(9_876);

    const worseAttempt = applyGameEvent(
      playing({ progress: 349, charge: 1, holding: true, elapsedMs: 14_000, bestTimeMs: 9_876 }),
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

  it('uses low risk below 16 charge and high risk at 16 charge', () => {
    const low = applyGameEvent(playing({ charge: 15.99, holding: true }), { type: 'release' });
    const high = applyGameEvent(playing({ charge: 16, holding: true }), { type: 'release' });
    const baseRisk = faithfulPreset.riskBase * (1 + faithfulPreset.riskGrowth);

    expect(low.risk).toBeCloseTo(baseRisk + 15.99 * faithfulPreset.riskChargeLow, 7);
    expect(high.risk).toBeCloseTo(baseRisk + 16 * faithfulPreset.riskChargeHigh, 7);
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
    [90, 12],
    [91, 11],
    [99, 11],
    [100, 10],
  ])('applies the correct timing bonus at animation frame %i', (animationFrame, expectedProgress) => {
    const state = applyGameEvent(
      playing({ animationFrame, charge: 10, holding: true }),
      { type: 'release' },
    );
    expect(state.progress).toBeCloseTo(expectedProgress, 7);
  });

  it('prioritizes clear when progress and risk cross limits together', () => {
    const state = applyGameEvent(
      playing({ progress: 349, risk: 159, charge: 1, holding: true }),
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
});
