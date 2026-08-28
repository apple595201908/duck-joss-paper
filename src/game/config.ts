export const faithfulPreset = {
  fixedHz: 60,
  timeLimitMs: 60_000,
  capacity: 460,
  progressBands: 3,

  rateWindowFrames: 40,
  slowClickThreshold: 2,
  fastClickThreshold: 4,
  downshiftDelayFrames: 20,

  chargePerFrame: 1.55,
  chargeLevelBonus: 0.20,
  aheadLevelMultiplier: 1.10,
  riskChargeBoundary: 14,
  chargeCap: 27,

  sipEfficiencyBase: 0.86,
  sipEfficiencyChargeBonus: 0.36,

  riskChargeLow: 0.24,
  riskChargeHigh: 0.57,
  riskBase: 1.48,
  riskGrowth: 0.073,
  riskReliefIdlePerFrame: 0.70,
  riskReliefHeldDivisor: 4,
  riskLimit: 165,
  warningRatio: 0.32,
  criticalRatio: 0.74,

  animationCycleFrames: 110,
} as const;

export const FIXED_STEP_MS = 1_000 / faithfulPreset.fixedHz;
export const MAX_CATCH_UP_STEPS = 5;
export const READY_FRAMES = 54;
export const GO_FRAMES = 42;
export const TOTAL_READY_FRAMES = READY_FRAMES + GO_FRAMES;
