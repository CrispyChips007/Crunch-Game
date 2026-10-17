import { GAME_CONFIG } from "./config.js";
import { scoreSelection } from "./scoring.js";

export const COMPUTER_PLAYER_ID = "computer";

function scoringSelections(dice) {
  const choices = [];
  for (let mask = 1; mask < (1 << dice.length); mask += 1) {
    const indices = dice.map((_, i) => i).filter((i) => mask & (1 << i));
    const result = scoreSelection(indices.map((i) => dice[i]));
    if (result.valid) choices.push({ indices, score: result.score });
  }
  return choices;
}

export function bestComputerSelection(dice) {
  const choices = scoringSelections(dice);
  const allDice = choices.find((choice) => choice.indices.length === dice.length);
  if (allDice) return allDice;
  return choices.sort((a, b) => (b.score / b.indices.length) - (a.score / a.indices.length) || b.score - a.score || a.indices.length - b.indices.length)[0] || null;
}

export function maximumComputerSelection(dice) {
  return scoringSelections(dice).sort((a, b) => b.score - a.score || b.indices.length - a.indices.length)[0] || null;
}

export function chooseComputerSelection(dice, { opened, turnScore, openingRequirement = GAME_CONFIG.openingRequirement }) {
  const maximum = maximumComputerSelection(dice);
  if (!opened && maximum && turnScore + maximum.score >= openingRequirement) return maximum;
  return bestComputerSelection(dice);
}

export function chooseComputerAction(publicState, config = GAME_CONFIG) {
  const { opened, unbankedPoints, diceRemaining, totalScore, opponentScore } = publicState;
  if (!opened) return unbankedPoints >= config.openingRequirement ? "bank" : "roll";
  if (totalScore + unbankedPoints >= config.winningTarget) return "bank";
  const thresholds = { 1: 150, 2: 250, 3: 400, 4: 600, 5: 750 };
  let threshold = thresholds[diceRemaining] ?? 400;
  if (totalScore < opponentScore) threshold += Math.min(250, Math.floor((opponentScore - totalScore) / 10));
  if (totalScore >= config.winningTarget - 1500) threshold = Math.max(100, threshold - 150);
  return unbankedPoints >= threshold ? "bank" : "roll";
}
