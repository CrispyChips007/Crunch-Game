import test from "node:test";
import assert from "node:assert/strict";
import { rollDice } from "../src/random.js";

test("every rerolled die requests a fresh random value", () => {
  const values = [3, 5, 6, 3, 6];
  let calls = 0;
  const dieRoller = () => values[calls++];
  assert.deepEqual(rollDice(3, dieRoller), [3, 5, 6]);
  assert.deepEqual(rollDice(2, dieRoller), [3, 6]);
  assert.equal(calls, 5);
});
