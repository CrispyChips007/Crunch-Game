import test from "node:test";
import assert from "node:assert/strict";
import { bank, createGame, multiplayerRoundResult, roll, toggleSelection, toggleTriple } from "../src/engine.js";

const roller = (values) => { let i=0; return () => values[i++]; };
test("injects deterministic rolls and accumulates turn score", () => { let s=roll(createGame(),roller([1,2,3,4,6])); s=toggleSelection(s,0); s=roll(s,roller([5,2,3,4])); assert.equal(s.turnScore,100); assert.equal(s.retainedCount,1); assert.deepEqual(s.dice,[5,2,3,4]); });
test("Crunch remains visible, advances turn, and allows a fresh roll", () => { let s={...createGame(),turnScore:500,dice:[1],selected:[0],retainedCount:2}; s=roll(s,roller([2,3])); assert.equal(s.turnScore,0); assert.equal(s.turnCount,2); assert.deepEqual(s.dice,[2,3]); assert.equal(s.awaitingNextTurn,true); s=roll(s,roller([1,2,3,4,6])); assert.equal(s.dice.length,5); assert.equal(s.awaitingNextTurn,false); });
test("only post-opening consecutive Crunches count and the third resets score without closing", () => {
  let s={...createGame(),dice:[],opened:false};
  s=roll(s,roller([2,3,4,6,2]));
  assert.equal(s.crunchStreak,0);
  s={...s,opened:true,totalScore:2400,awaitingNextTurn:true};
  s=roll(s,roller([2,3,4,6,2]));
  assert.equal(s.crunchStreak,1);
  s=roll(s,roller([2,3,4,6,2]));
  assert.equal(s.crunchStreak,2);
  s=roll(s,roller([2,3,4,6,2]));
  assert.equal(s.totalScore,0);
  assert.equal(s.crunchStreak,0);
  assert.equal(s.opened,true);
  assert.equal(s.lastEvent,"triple-crunch");
  assert.match(s.message,/crunched back to zero/i);
});
test("banking clears the consecutive Crunch count", () => { let s={...createGame(),opened:true,totalScore:1000,crunchStreak:2,dice:[5],selected:[0]}; s=bank(s); assert.equal(s.totalScore,1050); assert.equal(s.crunchStreak,0); });
test("opening requirement blocks small banks", () => { let s={...createGame(),dice:[1],selected:[0]}; s=bank(s); assert.equal(s.totalScore,0); assert.match(s.message,/1,000/); });
test("banking, opening and winning work", () => { let s={...createGame(),turnScore:900,dice:[1],selected:[0]}; s=bank(s); assert.equal(s.totalScore,1000); assert.equal(s.opened,true); s={...s,totalScore:9900,dice:[1],selected:[0]}; s=bank(s); assert.equal(s.status,'won'); });
test("five retained dice reset to five", () => { let s={...createGame(),dice:[1,1,1,5,5],selected:[0,1,2,3,4]}; s=roll(s,roller([1,2,3,4,5])); assert.equal(s.dice.length,5); assert.equal(s.retainedCount,0); assert.equal(s.turnScore,1100); });
test("smart selection toggles triples", () => { let s={...createGame(),dice:[2,2,2,1,5]}; s=toggleSelection(s,0); assert.deepEqual(s.selected,[0,1,2]); s=toggleSelection(s,2); assert.deepEqual(s.selected,[]); s=toggleTriple({...s,dice:[1,1,1,2,3]},1); assert.deepEqual(s.selected,[0,1,2]); });
test("multiplayer round logic identifies wins and draws", () => { assert.equal(multiplayerRoundResult([{id:'a',score:10000,turns:5},{id:'b',score:9000,turns:4}],true).complete,false); const r=multiplayerRoundResult([{id:'a',score:10000,turns:5},{id:'b',score:10000,turns:5}],true); assert.equal(r.draw,true); assert.deepEqual(r.winners,['a','b']); });
