import { GAME_CONFIG } from "./config.js";
import { bank, createGame, roll } from "./engine.js";

export function createComputerMatch(config = GAME_CONFIG) {
  return {
    ...createGame(config), mode: "computer", round: 1, activePlayer: 0,
    players: [
      { id: "human", name: "You", score: 0, opened: false, turns: 0 },
      { id: "computer", name: "Crunchy", score: 0, opened: false, turns: 0 },
    ],
    message: "Your turn. Roll the dice.",
  };
}

function activeValues(state) {
  const player = state.players[state.activePlayer];
  return { ...state, totalScore: player.score, opened: player.opened };
}

function finishTurn(state, banked = 0) {
  const players = state.players.map((player, index) => index === state.activePlayer ? {
    ...player, score: banked ? state.totalScore : player.score,
    opened: banked ? state.opened : player.opened, turns: player.turns + 1,
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
  const round = activePlayer === 0 ? state.round + 1 : state.round;
  const next = players[activePlayer];
  return {
    ...state, players, activePlayer, round, totalScore: next.score, opened: next.opened,
    turnScore: 0, retainedCount: 0, selected: [], awaitingNextTurn: true, status: "playing",
    message: `${next.name === "You" ? "Your" : `${next.name}'s`} turn.`,
  };
}

export function matchRoll(state, dieRoller) {
  const before = activeValues(state);
  const after = roll({ ...before, awaitingNextTurn: state.awaitingNextTurn }, dieRoller);
  if (after.message.startsWith("Crunch!")) return finishTurn({ ...after, mode: state.mode, players: state.players, activePlayer: state.activePlayer, round: state.round });
  return { ...after, mode: state.mode, players: state.players, activePlayer: state.activePlayer, round: state.round };
}

export function matchBank(state) {
  const after = bank(activeValues(state));
  if (!after.lastBanked || after.totalScore === state.players[state.activePlayer].score) return { ...state, message: after.message };
  const next = finishTurn({ ...after, status: "playing", mode: state.mode, players: state.players, activePlayer: state.activePlayer, round: state.round }, after.lastBanked);
  return next.status === "finished" ? next : { ...next, dice: state.dice, awaitingNextTurn: true };
}
