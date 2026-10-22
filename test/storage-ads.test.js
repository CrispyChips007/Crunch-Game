import test from "node:test";
import assert from "node:assert/strict";
import { adVisibility } from "../src/ads.js";
import { betterBestRun, checksum, decode, DEFAULT_STATS, encode, recordBank, recordCrunch, recordWin } from "../src/storage.js";

test("encoded persistence validates checksum", () => { const value={completed:3}; assert.equal(decode(encode(value),DEFAULT_STATS).completed,3); const bad=JSON.stringify({payload:'{}',checksum:checksum('changed')}); assert.deepEqual(decode(bad,DEFAULT_STATS),DEFAULT_STATS); });
test("missing saved game decodes to null", () => { assert.equal(decode(null, null), null); });
test("statistics updates", () => { let s={...DEFAULT_STATS}; s=recordCrunch(s); s=recordBank(s,1200); s=recordWin(s,12); assert.equal(s.crunches,1); assert.equal(s.highestBank,1200); assert.equal(s.completed,1); assert.equal(s.fewestTurns,12); });
test("best run prefers fewer turns and then the higher finishing score", () => {
  const first=betterBestRun(null,[1000,3000,7000,10100]);
  assert.deepEqual(betterBestRun(first,[1200,4000,8000,10050]),first);
  assert.equal(betterBestRun(first,[2000,6000,10200]).turns,3);
  assert.equal(betterBestRun(first,[1500,4000,8000,10400]).finalScore,10400);
});
test("ads disappear when disabled or unconfigured", () => { const base={adsEnabled:true,showHeaderAd:true,showSidebarAd:true,showBelowGameAd:true,hideHeaderAdOnSmallScreens:true,adPlaceholderMode:true,provider:null}; assert.deepEqual(adVisibility({...base,adsEnabled:false},1200),{header:false,sidebar:false,below:false}); assert.equal(adVisibility(base,1200).sidebar,true); assert.equal(adVisibility(base,500).sidebar,false); assert.deepEqual(adVisibility({...base,adPlaceholderMode:false},1200),{header:false,sidebar:false,below:false}); });
