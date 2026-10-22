import { GAME_CONFIG } from "./config.js";
import { isCrunch, scoreSelection } from "./scoring.js";
import { rollDice } from "./random.js";

export function createGame(config = GAME_CONFIG) {
  return {
    version: 2, totalScore: 0, turnScore: 0, retainedCount: 0,
    dice: [], selected: [], turnCount: 1, opened: false, crunchStreak: 0,
    status: "playing", message: "Roll the dice to begin.", config,
  };
}

export function selectionResult(state) {
  return scoreSelection(state.selected.map((i) => state.dice[i]));
}

export function roll(state, dieRoller) {
  if (state.status !== "playing") return state;
  if (state.dice.length && state.selected.length === 0 && !state.awaitingNextTurn) return { ...state, message: "Select scoring dice first." };
  let turnScore = state.turnScore;
  let retainedCount = state.retainedCount;
  if (state.selected.length && !state.awaitingNextTurn) {
    const result = selectionResult(state);
    if (!result.valid) return { ...state, message: result.reason };
    turnScore += result.score;
    retainedCount += state.selected.length;
  }
  const hotDice = retainedCount === state.config.diceCount;
  const count = hotDice ? state.config.diceCount : state.config.diceCount - retainedCount;
  const dice = rollDice(count, dieRoller);
  if (isCrunch(dice)) {
    const crunchStreak = state.opened ? (state.crunchStreak ?? 0) + 1 : 0;
    const crunchedBackToZero = crunchStreak >= 3;
    return {
      ...state, dice, selected: [], turnScore: 0, retainedCount: 0, awaitingNextTurn: true,
      totalScore: crunchedBackToZero ? 0 : state.totalScore,
      crunchStreak: crunchedBackToZero ? 0 : crunchStreak,
      lastEvent: crunchedBackToZero ? "triple-crunch" : "crunch",
      turnCount: state.turnCount + 1,
      message: crunchedBackToZero
        ? "Oh no! You crunched back to zero. Roll to start the next turn."
        : "Crunch! Turn points lost. Roll to start the next turn.",
    };
  }
  return {
    ...state, dice, selected: [], turnScore, awaitingNextTurn: false,
    retainedCount: hotDice ? 0 : retainedCount,
    lastEvent: null,
    message: hotDice ? "Hot dice! All five dice are back." : "Choose scoring dice.",
  };
}

export function bank(state) {
  if (state.status !== "playing" || state.selected.length === 0) return { ...state, message: "Select scoring dice first." };
  const result = selectionResult(state);
  if (!result.valid) return { ...state, message: result.reason };
  const banked = state.turnScore + result.score;
  if (!state.opened && banked < state.config.openingRequirement) {
    return { ...state, message: `You need ${state.config.openingRequirement.toLocaleString()} points to open.` };
  }
  const totalScore = state.totalScore + banked;
  const won = totalScore >= state.config.winningTarget;
  return {
    ...state, totalScore, turnScore: 0, retainedCount: 0, dice: [], selected: [], opened: true,
    crunchStreak: 0, lastEvent: "bank",
    status: won ? "won" : "playing", turnCount: won ? state.turnCount : state.turnCount + 1,
    message: won ? `You reached ${totalScore.toLocaleString()}!` : `Banked ${banked.toLocaleString()}. Roll for the next turn.`,
    lastBanked: banked,
  };
}

export function toggleSelection(state, index) {
  if (!state.dice[index] || state.status !== "playing" || state.awaitingNextTurn) return state;
  const face = state.dice[index];
  const same = state.dice.map((d, i) => d === face ? i : -1).filter((i) => i >= 0);
  let selected = [...state.selected];
  if (![1, 5].includes(face)) {
    if (same.length < 3) return { ...state, message: `${face}s need a triple.` };
    const group = same.slice(0, 3);
    const allSelected = group.every((i) => selected.includes(i));
    selected = allSelected ? selected.filter((i) => !group.includes(i)) : [...new Set([...selected, ...group])];
  } else {
    selected = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index];
  }
  const result = scoreSelection(selected.map((i) => state.dice[i]));
  return { ...state, selected, message: result.valid ? `Selection: ${result.score.toLocaleString()} points.` : "Choose scoring dice." };
}

export function toggleTriple(state, face) {
  const group = state.dice.map((d, i) => d === face ? i : -1).filter((i) => i >= 0).slice(0, 3);
  if (group.length < 3) return state;
  const allSelected = group.every((i) => state.selected.includes(i));
  const selected = allSelected ? state.selected.filter((i) => !group.includes(i)) : [...new Set([...state.selected, ...group])];
  return { ...state, selected };
}

export function canAct(state) { return state.selected.length > 0 && selectionResult(state).valid; }

export function multiplayerRoundResult(players, starterReachedTarget, target = 10000) {
  const maxTurns = Math.max(...players.map((p) => p.turns));
  const complete = players.every((p) => p.turns === maxTurns);
  if (!starterReachedTarget || !complete) return { complete: false, winners: [] };
  const best = Math.max(...players.map((p) => p.score));
  return { complete: true, winners: players.filter((p) => p.score === best).map((p) => p.id), draw: players.filter((p) => p.score === best).length > 1, target };
}
