import test from "node:test";
import assert from "node:assert/strict";
import { bestComputerSelection, chooseComputerAction } from "../src/computer.js";
import { createComputerMatch, matchBank, matchRoll } from "../src/match.js";

const roller = (values) => { let i=0; return () => values[i++]; };
test("computer cannot bank below its opening threshold", () => {
  assert.equal(chooseComputerAction({opened:false,unbankedPoints:950,diceRemaining:1,totalScore:0,opponentScore:0}),"roll");
  assert.equal(chooseComputerAction({opened:false,unbankedPoints:1000,diceRemaining:1,totalScore:0,opponentScore:0}),"bank");
});
test("computer banking is primarily biased by dice remaining", () => {
  const common={opened:true,unbankedPoints:300,totalScore:2000,opponentScore:2000};
  assert.equal(chooseComputerAction({...common,diceRemaining:1}),"bank");
  assert.equal(chooseComputerAction({...common,diceRemaining:5}),"roll");
});
test("computer selection favors points per retained die", () => {
  assert.deepEqual(bestComputerSelection([2,2,2,1,5]),{indices:[3],score:100});
});
test("match alternates after a Crunch and preserves the roll", () => {
  let state=createComputerMatch();
  state=matchRoll(state,roller([2,3,4,6,2]));
  assert.equal(state.activePlayer,1);
  assert.equal(state.players[0].turns,1);
  assert.deepEqual(state.dice,[2,3,4,6,2]);
});
test("match bank updates player and passes the turn", () => {
  let state={...createComputerMatch(),turnScore:900,dice:[1],selected:[0]};
  state=matchBank(state);
  assert.equal(state.players[0].score,1000);
  assert.equal(state.activePlayer,1);
  assert.deepEqual(state.dice,[1]);
  assert.equal(state.awaitingNextTurn,true);
});
test("target waits for equal turns before completing", () => {
  let state={...createComputerMatch(),players:[{id:'human',name:'You',score:9900,opened:true,turns:3},{id:'computer',name:'Computer',score:9000,opened:true,turns:3}],totalScore:9900,opened:true,turnScore:0,dice:[1],selected:[0]};
  state=matchBank(state);
  assert.equal(state.status,'playing');
  assert.equal(state.activePlayer,1);
  state={...state,turnScore:0,dice:[1],selected:[0]};
  state=matchBank(state);
  assert.equal(state.status,'finished');
  assert.deepEqual(state.winners,['human']);
});
