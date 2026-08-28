export const faithfulPreset = {
  fixedHz: 60,
  timeLimitMs: 60_000,
  capacity: 350,
  progressBands: 3,

  rateWindowFrames: 40,
  slowClickThreshold: 2,
  fastClickThreshold: 4,
  downshiftDelayFrames: 20,

  chargePerFrame: 1.85,
  chargeLevelBonus: 0.20,
  aheadLevelMultiplier: 1.10,
  riskChargeBoundary: 16,
  chargeCap: 30,

  riskChargeLow: 0.22,
  riskChargeHigh: 0.52,
  riskBase: 1.35,
  riskGrowth: 0.07,
  riskReliefIdlePerFrame: 0.47,
  riskReliefHeldDivisor: 4,
  riskLimit: 160,
  warningRatio: 0.30,

  animationCycleFrames: 110,
} as const;

export const FIXED_STEP_MS = 1_000 / faithfulPreset.fixedHz;
export const MAX_CATCH_UP_STEPS = 5;
export const READY_FRAMES = 54;
export const GO_FRAMES = 42;
export const TOTAL_READY_FRAMES = READY_FRAMES + GO_FRAMES;
