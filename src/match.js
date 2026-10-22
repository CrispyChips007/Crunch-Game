import { GAME_CONFIG } from "./config.js";
import { bank, createGame, roll } from "./engine.js";
import { secureDie } from "./random.js";

export function rollForStarter(dieRoller = secureDie) {
  const rolls = [];
  do rolls.push([dieRoller(), dieRoller()]); while (rolls.at(-1)[0] === rolls.at(-1)[1]);
  return { rolls, startingPlayer: rolls.at(-1)[0] > rolls.at(-1)[1] ? 0 : 1 };
}

export function createComputerMatch(config = GAME_CONFIG, dieRoller = secureDie) {
  const openingRoll = rollForStarter(dieRoller);
  return {
    ...createGame(config), mode: "computer", round: 1, activePlayer: openingRoll.startingPlayer,
    startingPlayer: openingRoll.startingPlayer, openingRolls: openingRoll.rolls,
    openingRevealed: false,
    players: [
      { id: "human", name: "You", score: 0, opened: false, turns: 0, crunchStreak: 0 },
      { id: "computer", name: "Crunchy", score: 0, opened: false, turns: 0, crunchStreak: 0 },
    ],
    message: "Press Start game to roll for first turn.",
  };
}

function activeValues(state) {
  const player = state.players[state.activePlayer];
  return { ...state, totalScore: player.score, opened: player.opened, crunchStreak: player.crunchStreak ?? 0 };
}

function finishTurn(state) {
  const players = state.players.map((player, index) => index === state.activePlayer ? {
    ...player, score: state.totalScore, opened: state.opened,
    crunchStreak: state.crunchStreak ?? 0, turns: player.turns + 1,
  } : player);
  const reachedTarget = players.some((player) => player.score >= state.config.winningTarget);
  const equalTurns = players.every((player) => player.turns === players[0].turns);
  if (reachedTarget && equalTurns) {
    const best = Math.max(...players.map((player) => player.score));
    const winners = players.filter((player) => player.score === best).map((player) => player.id);
    const winner = players.find((player) => player.id === winners[0]);
    return { ...state, players, status: "finished", winners, draw: winners.length > 1, selected: [], turnScore: 0, retainedCount: 0, awaitingNextTurn: false, message: winners.length > 1 ? "It's a draw!" : winner.id === "human" ? "You win!" : `${winner.name} wins!` };
  }
  const activePlayer = state.activePlayer === 0 ? 1 : 0;
  const round = activePlayer === state.startingPlayer ? state.round + 1 : state.round;
  const next = players[activePlayer];
  const turnMessage = `${next.name === "You" ? "Your" : `${next.name}'s`} turn.`;
  return {
    ...state, players, activePlayer, round, totalScore: next.score, opened: next.opened,
    crunchStreak: next.crunchStreak ?? 0,
    turnScore: 0, retainedCount: 0, selected: [], awaitingNextTurn: true, status: "playing",
    message: state.lastEvent === "triple-crunch"
      ? `Oh no! ${players[state.activePlayer].name} crunched back to zero. ${turnMessage}`
      : turnMessage,
  };
}

export function matchRoll(state, dieRoller) {
  const before = activeValues(state);
  const after = roll({ ...before, awaitingNextTurn: state.awaitingNextTurn }, dieRoller);
  if (after.lastEvent === "crunch" || after.lastEvent === "triple-crunch") return finishTurn({ ...after, mode: state.mode, players: state.players, activePlayer: state.activePlayer, round: state.round });
  return { ...after, mode: state.mode, players: state.players, activePlayer: state.activePlayer, round: state.round };
}

export function matchBank(state) {
  const after = bank(activeValues(state));
  if (!after.lastBanked || after.totalScore === state.players[state.activePlayer].score) return { ...state, message: after.message };
  const next = finishTurn({ ...after, status: "playing", mode: state.mode, players: state.players, activePlayer: state.activePlayer, round: state.round });
  return next.status === "finished" ? next : { ...next, dice: state.dice, awaitingNextTurn: true };
}
