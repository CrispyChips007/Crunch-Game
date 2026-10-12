import test from "node:test";
import assert from "node:assert/strict";
import { isCrunch, scoreSelection, scoringOptions } from "../src/scoring.js";

const valid = (dice, score) => assert.deepEqual(scoreSelection(dice), { valid: true, score });
test("scores singles and triples", () => { valid([1],100); valid([5],50); valid([1,1,1],1000); for(let face=2;face<=6;face++) valid([face,face,face],face*100); });
test("caps triples and scores only extra ones and fives", () => { valid([2,2,2],200); assert.equal(scoreSelection([2,2,2,2]).valid,false); valid([1,1,1,1,1],1200); valid([5,5,5,5,5],600); });
test("allows partial scoring choices", () => { valid([1,5],150); valid([1,1],200); assert.equal(scoreSelection([2]).valid,false); assert.equal(scoreSelection([]).valid,false); });
test("detects crunches", () => { assert.equal(isCrunch([2,3,3,4,6]),true); assert.equal(isCrunch([2,2,2,3,4]),false); assert.equal(isCrunch([2,3,4,5,6]),false); });
test("returns triple selection options", () => { const options=scoringOptions([2,2,2,2,1]); assert.deepEqual(options.find(o=>o.type==='triple').indices,[0,1,2]); });
