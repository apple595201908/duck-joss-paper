export const festivalPreset = {
  fixedHz: 60,
  timeLimitMs: 60_000,
  capacity: 590,
  progressBands: 3,

  rateWindowFrames: 40,
  slowClickThreshold: 2,
  fastClickThreshold: 4,
  downshiftDelayFrames: 20,

  tapPaperBase: 5.5,
  tapPaperSpeedBonus: 0.6,
  riskPaperMaxBonus: 1.35,
  riskPaperBonusStartRatio: 0.55,
  riskPaperBonusFullRatio: 0.86,
  tapRiskBase: 2.9,
  tapRiskSpeedBonus: 1.15,
  riskGrowth: 0.031,
  riskReliefIdleBase: 0.10,
  riskReliefIdleBonus: 0.58,
  riskReliefCurvePower: 1.05,
  riskLimit: 100,
  warningRatio: 0.35,
  criticalRatio: 0.78,

  tapThrowAnimationFrames: 14,

  animationCycleFrames: 110,
} as const;

export const FIXED_STEP_MS = 1_000 / festivalPreset.fixedHz;
export const MAX_CATCH_UP_STEPS = 5;
export const READY_FRAMES = 54;
export const GO_FRAMES = 42;
export const TOTAL_READY_FRAMES = READY_FRAMES + GO_FRAMES;
// 2.2 seconds at 60 Hz: ignition, blast, sustained fire, then smoke before failure UI.
export const FLARE_REACTION_FRAMES = 132;
