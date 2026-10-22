export const GAME_CONFIG = Object.freeze({
  diceCount: 5,
  openingRequirement: 1000,
  winningTarget: 10000,
});

export const AD_CONFIG = Object.freeze({
  adsEnabled: true,
  showHeaderAd: true,
  showSidebarAd: true,
  showBelowGameAd: true,
  hideHeaderAdOnSmallScreens: true,
  adPlaceholderMode: true,
  provider: null,
});

export const UI_TIMING = Object.freeze({
  crunchRevealMs: 1300,
  crunchAnimationMs: 900,
  crunchSettleMs: 1100,
  crunchResetMessageMs: 2400,
  turnIndicatorMs: 1150,
  openingRollRevealMs: 2600,
  openingResultDelayMs: 1100,
  computerTurnStartMs: 1100,
  computerRollPauseMs: 1050,
  computerSelectionPauseMs: 1000,
});

export const RANKS = Object.freeze([
  [500, "Legend"], [200, "Master"], [100, "Veteran"], [60, "High Roller"],
  [30, "Risk Taker"], [15, "Roller"], [5, "Beginner"], [0, "Noob"],
]);
