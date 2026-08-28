export const faithfulPreset = {
  fixedHz: 60,
  timeLimitMs: 60_000,
  capacity: 550,
  progressBands: 3,

  rateWindowFrames: 40,
  slowClickThreshold: 2,
  fastClickThreshold: 4,
  downshiftDelayFrames: 20,

  tapMilkBase: 5.5,
  tapMilkSpeedBonus: 0.4,
  tapRiskBase: 3.0,
  tapRiskSpeedBonus: 1.0,
  riskGrowth: 0.032,
  riskReliefIdleBase: 0.14,
  riskReliefIdleBonus: 0.50,
  riskReliefCurvePower: 0.80,
  riskLimit: 100,
  warningRatio: 0.35,
  criticalRatio: 0.75,

  tapDrinkAnimationFrames: 14,

  animationCycleFrames: 110,
} as const;

export const FIXED_STEP_MS = 1_000 / faithfulPreset.fixedHz;
export const MAX_CATCH_UP_STEPS = 5;
export const READY_FRAMES = 54;
export const GO_FRAMES = 42;
export const TOTAL_READY_FRAMES = READY_FRAMES + GO_FRAMES;
export const CHOKE_REACTION_FRAMES = 54;
