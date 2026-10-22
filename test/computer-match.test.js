import test from "node:test";
import assert from "node:assert/strict";
import { bestComputerSelection, chooseComputerAction, chooseComputerSelection, maximumComputerSelection } from "../src/computer.js";
import { createComputerMatch, matchBank, matchRoll, rollForStarter } from "../src/match.js";

const roller = (values) => { let i=0; return () => values[i++]; };
const humanStartsMatch = () => createComputerMatch(undefined, roller([6,1]));
test("opening high roll chooses the starter and rerolls ties", () => {
  const result=rollForStarter(roller([3,3,2,5]));
  assert.deepEqual(result.rolls,[[3,3],[2,5]]);
  assert.equal(result.startingPlayer,1);
  const state=createComputerMatch(undefined,roller([2,6]));
  assert.equal(state.activePlayer,1);
  assert.equal(state.openingRevealed,false);
  assert.match(state.message,/Start game/);
});
test("round numbering follows the opening-roll winner", () => {
  let state=createComputerMatch(undefined,roller([1,6]));
  state=matchRoll(state,roller([2,3,4,6,2]));
  assert.equal(state.activePlayer,0);
  assert.equal(state.round,1);
  state=matchRoll(state,roller([2,3,4,6,2]));
  assert.equal(state.activePlayer,1);
  assert.equal(state.round,2);
});
test("computer cannot bank below its opening threshold", () => {
  assert.equal(chooseComputerAction({opened:false,unbankedPoints:950,diceRemaining:1,totalScore:0,opponentScore:0}),"roll");
  assert.equal(chooseComputerAction({opened:false,unbankedPoints:1000,diceRemaining:1,totalScore:0,opponentScore:0}),"bank");
});
test("computer stays open after falling below 1,000 and does not chase a new opening score", () => {
  assert.equal(chooseComputerAction({opened:true,unbankedPoints:400,diceRemaining:1,totalScore:0,opponentScore:2000,crunchStreak:0}),"bank");
});
test("computer banking is primarily biased by dice remaining", () => {
  const common={opened:true,unbankedPoints:300,totalScore:2000,opponentScore:2000};
  assert.equal(chooseComputerAction({...common,diceRemaining:1}),"bank");
  assert.equal(chooseComputerAction({...common,diceRemaining:5}),"roll");
});
test("computer becomes cautious as consecutive Crunches increase", () => {
  const common={opened:true,unbankedPoints:50,diceRemaining:5,totalScore:2000,opponentScore:2000};
  assert.equal(chooseComputerAction({...common,crunchStreak:0}),"roll");
  assert.equal(chooseComputerAction({...common,crunchStreak:1}),"roll");
  assert.equal(chooseComputerAction({...common,crunchStreak:2}),"bank");
  assert.equal(chooseComputerAction({...common,unbankedPoints:150,diceRemaining:2,crunchStreak:1}),"bank");
});
test("computer selection favors points per retained die", () => {
  assert.deepEqual(bestComputerSelection([2,2,2,1,4]),{indices:[3],score:100});
});
test("computer takes every die when all remaining dice score", () => {
  assert.deepEqual(bestComputerSelection([1,5]),{indices:[0,1],score:150});
  assert.deepEqual(bestComputerSelection([2,2,2,1,5]),{indices:[0,1,2,3,4],score:350});
});
test("computer banks every available scoring point", () => {
  assert.deepEqual(maximumComputerSelection([1,1,1,1]),{indices:[0,1,2,3],score:1100});
  assert.deepEqual(maximumComputerSelection([1,5,2,3]),{indices:[0,1],score:150});
});
test("computer takes all points that satisfy its opening requirement", () => {
  assert.deepEqual(chooseComputerSelection([1,5], { opened:false, turnScore:850 }), {indices:[0,1],score:150});
  assert.deepEqual(chooseComputerSelection([1,5,3], { opened:false, turnScore:850 }), {indices:[0,1],score:150});
});
test("match alternates after a Crunch and preserves the roll", () => {
  let state=humanStartsMatch();
  state=matchRoll(state,roller([2,3,4,6,2]));
  assert.equal(state.activePlayer,1);
  assert.equal(state.players[0].turns,1);
  assert.deepEqual(state.dice,[2,3,4,6,2]);
});
test("match tracks each player's Crunch streak and resets only that player's score", () => {
  let state={...humanStartsMatch(),players:[{id:'human',name:'You',score:2400,opened:true,turns:2,crunchStreak:2},{id:'computer',name:'Crunchy',score:1800,opened:true,turns:2,crunchStreak:1}],totalScore:2400,opened:true,crunchStreak:2};
  state=matchRoll(state,roller([2,3,4,6,2]));
  assert.equal(state.players[0].score,0);
  assert.equal(state.players[0].crunchStreak,0);
  assert.equal(state.players[0].opened,true);
  assert.equal(state.players[1].score,1800);
  assert.equal(state.players[1].crunchStreak,1);
  assert.match(state.message,/You crunched back to zero/i);
});
test("match bank updates player and passes the turn", () => {
  let state={...humanStartsMatch(),turnScore:900,dice:[1],selected:[0]};
  state=matchBank(state);
  assert.equal(state.players[0].score,1000);
  assert.equal(state.activePlayer,1);
  assert.deepEqual(state.dice,[1]);
  assert.equal(state.awaitingNextTurn,true);
});
test("target waits for equal turns before completing", () => {
  let state={...humanStartsMatch(),players:[{id:'human',name:'You',score:9900,opened:true,turns:3},{id:'computer',name:'Computer',score:9000,opened:true,turns:3}],totalScore:9900,opened:true,turnScore:0,dice:[1],selected:[0]};
  state=matchBank(state);
  assert.equal(state.status,'playing');
  assert.equal(state.activePlayer,1);
  state={...state,turnScore:0,dice:[1],selected:[0]};
  state=matchBank(state);
  assert.equal(state.status,'finished');
  assert.deepEqual(state.winners,['human']);
});
