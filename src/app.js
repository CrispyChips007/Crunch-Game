import { AD_CONFIG, GAME_CONFIG, RANKS, UI_TIMING } from "./config.js";
import { bank, canAct, createGame, roll, selectionResult, toggleSelection, toggleTriple } from "./engine.js";
import { chooseComputerAction, chooseComputerSelection, maximumComputerSelection } from "./computer.js";
import { createComputerMatch, matchBank, matchRoll } from "./match.js";
import { renderAds } from "./ads.js";
import { betterBestRun, clearGame, loadBestRun, loadGame, loadPrefs, loadStats, recordBank, recordCrunch, recordWin, saveBestRun, saveGame, savePrefs, saveStats } from "./storage.js";
import { scoringOptions } from "./scoring.js";

const $ = (selector) => document.querySelector(selector);
document.documentElement.style.setProperty("--crunch-animation-ms", `${UI_TIMING.crunchAnimationMs}ms`);
document.documentElement.style.setProperty("--turn-indicator-ms", `${UI_TIMING.turnIndicatorMs}ms`);
document.documentElement.style.setProperty("--opening-roll-ms", `${UI_TIMING.openingRollRevealMs}ms`);
function hasGameProgress(game) {
  if (!game) return false;
  if (game.openingRolls?.length) return true;
  if (game.dice?.length || game.totalScore || game.turnScore || game.retainedCount || game.turnCount > 1) return true;
  return Boolean(game.players?.some((player) => player.score || player.turns));
}

const savedGame = loadGame();
let state = hasGameProgress(savedGame) ? savedGame : createComputerMatch();
state.config = GAME_CONFIG;
if (state.mode === "computer" && state.openingRevealed === undefined) {
  state.openingRevealed = Boolean(state.players?.some((player) => player.turns) || state.dice?.length);
}
let stats = loadStats();
let prefs = loadPrefs();
let bestRun = loadBestRun();
let computerBusy = false;
let crunchMeterOverride = null;
let pendingCrunchStreak = null;
let pendingCrunchMessage = "";
let crunchMarkSlam = false;
const crunchHandoffDelay = UI_TIMING.crunchRevealMs + UI_TIMING.crunchAnimationMs + UI_TIMING.crunchSettleMs;

function rankFor(completed) { return RANKS.find(([threshold]) => completed >= threshold)[1]; }
function dots(face) { return Array.from({ length: face }, () => "<i></i>").join(""); }
function miniDie(face) { return `<i class="mini-die face-${face}" aria-hidden="true">${dots(face)}</i>`; }

function render() {
  const isComputerMatch = state.mode === "computer";
  const humanScore = isComputerMatch ? state.players[0].score : state.totalScore;
  $("#score-label").textContent = isComputerMatch ? "Target" : "Total score";
  $("#score-value").textContent = (isComputerMatch ? state.config.winningTarget : humanScore).toLocaleString();
  const activeCrunchStreak = crunchMeterOverride ?? (isComputerMatch ? (state.players[state.activePlayer].crunchStreak ?? 0) : (state.crunchStreak ?? 0));
  $("#crunch-count").innerHTML = Array.from({ length: activeCrunchStreak }, (_, index) => `<i class="crunch-mark${crunchMarkSlam && index === activeCrunchStreak - 1 ? " slam-in" : ""}"><b>CR</b>UNCH</i>`).join("");
  $(".crunch-meter").setAttribute("aria-label", `${activeCrunchStreak} consecutive ${activeCrunchStreak === 1 ? "Crunch" : "Crunches"}`);
  $("#turn-label").textContent = isComputerMatch ? "Round" : "Turn";
  $("#turn-count").textContent = isComputerMatch ? state.round : state.turnCount;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === (state.mode || "practice"));
    button.disabled = computerBusy;
  });
  $("#players").hidden = false;
  if (isComputerMatch) {
    $("#players").innerHTML = state.players.map((player, index) => `<div class="player-chip${state.openingRevealed && index === state.activePlayer ? " active" : ""}"><span>${player.name}</span><strong>${player.score.toLocaleString()}</strong><small>${player.opened ? "Bank any score" : "Needs 1,000"}</small></div>`).join("");
  } else {
    const completedTurns = state.scoreHistory?.length ?? 0;
    const ghostScore = bestRun ? (bestRun.scores[completedTurns - 1] ?? (completedTurns >= bestRun.turns ? bestRun.finalScore : 0)) : null;
    $("#players").innerHTML = `<div class="player-chip active"><span>You</span><strong>${humanScore.toLocaleString()}</strong><small>Current run</small></div><div class="player-chip ghost"><span>Best Run</span><strong>${ghostScore === null ? "—" : ghostScore.toLocaleString()}</strong><small>${bestRun ? `${bestRun.turns} turns to beat` : "Complete a game to set"}</small></div>`;
  }
  const result = selectionResult(state);
  const selectedScore = result.valid ? result.score : 0;
  $("#turn-score").textContent = (state.turnScore + selectedScore).toLocaleString();
  $("#selection-score").textContent = selectedScore ? `${selectedScore.toLocaleString()} from selected dice` : "No dice selected";
  $("#message").textContent = state.message;
  const scoring = new Set(scoringOptions(state.dice).flatMap((option) => option.indices));
  const canSelectDice = state.status === "playing" && !state.awaitingNextTurn && (!isComputerMatch || state.activePlayer === 0) && !computerBusy;
  const diceOwner = isComputerMatch && state.dice.length
    ? (state.awaitingNextTurn ? (state.activePlayer === 0 ? 1 : 0) : state.activePlayer)
    : 0;
  $("#dice").classList.toggle("crunchy-dice", diceOwner === 1);
  $("#dice").setAttribute("aria-label", diceOwner === 1 ? "Crunchy's dice" : "Dice");
  $("#dice").innerHTML = state.dice.map((face, index) => `<button class="die face-${face}${state.selected.includes(index) ? " selected" : ""}${prefs.scoringHelp && scoring.has(index) ? " hint" : ""}" data-die="${index}" aria-label="Die ${index + 1}: ${face}${state.selected.includes(index) ? ", selected" : ""}"${canSelectDice ? "" : " disabled"}>${dots(face)}</button>`).join("");
  const triples = canSelectDice ? [1, 5].filter((face) => state.dice.filter((d) => d === face).length >= 3) : [];
  $("#combo-actions").innerHTML = triples.map((face) => `<button data-triple="${face}">Select three ${face}s · ${face === 1 ? "1,000" : "500"}</button>`).join("");
  const actionable = canAct(state);
  const activeOpened = isComputerMatch ? state.players[state.activePlayer].opened : state.opened;
  const prospectiveBank = state.turnScore + selectedScore;
  const meetsOpeningRequirement = activeOpened || prospectiveBank >= state.config.openingRequirement;
  const bankable = actionable && meetsOpeningRequirement;
  $(".controls").classList.toggle("choice-ready", bankable);
  const waitingToStart = isComputerMatch && !state.openingRevealed;
  const humanTurn = !isComputerMatch || state.activePlayer === 0 || waitingToStart;
  $("#bank").disabled = !bankable || !humanTurn || computerBusy;
  $("#bank").title = actionable && !meetsOpeningRequirement ? `You need ${state.config.openingRequirement.toLocaleString()} points to open.` : "";
  $("#roll").disabled = !humanTurn || computerBusy || Boolean(state.dice.length && !actionable && !state.awaitingNextTurn);
  $("#roll").textContent = waitingToStart ? "Start game" : (state.awaitingNextTurn ? "Roll dice" : (state.dice.length ? "Roll again" : "Roll dice"));
  if (state.status === "playing" && hasGameProgress(state)) saveGame(state);
  else if (state.status === "playing") clearGame();
}

function doRoll() {
  if (state.mode === "computer" && !state.openingRevealed) {
    showOpeningRollSequence();
    return;
  }
  const beforePlayer = state.activePlayer;
  const previousCrunchStreak = state.mode === "computer" ? (state.players[beforePlayer].crunchStreak ?? 0) : (state.crunchStreak ?? 0);
  state = state.mode === "computer" ? matchRoll(state) : roll(state);
  const crunched = state.lastEvent === "crunch" || state.lastEvent === "triple-crunch";
  if (crunched) prepareCrunchMeter(
    previousCrunchStreak,
    state.lastEvent === "triple-crunch" ? 3 : (state.mode === "computer" ? state.players[beforePlayer].crunchStreak : state.crunchStreak),
    state.lastEvent === "triple-crunch" ? `${state.mode === "computer" ? state.players[beforePlayer].name.toUpperCase() : "YOU"} CRUNCHED BACK TO ZERO` : "",
  );
  if (state.mode === "practice" && crunched) state = { ...state, scoreHistory: [...(state.scoreHistory ?? []), state.totalScore] };
  if (crunched) { stats = recordCrunch(stats); saveStats(stats); }
  render();
  if (crunched) setTimeout(playCrunchEffect, UI_TIMING.crunchRevealMs);
  if (state.mode === "computer" && state.activePlayer !== beforePlayer && state.status === "playing") {
    if (crunched) setTimeout(() => { clearCrunchMeterOverride(); showTurnIndicator(); }, crunchHandoffDelay); else showTurnIndicator();
  }
  if (state.mode === "computer" && state.activePlayer === 1 && state.status === "playing") {
    if (crunched) setTimeout(scheduleComputerTurn, crunchHandoffDelay); else scheduleComputerTurn();
  }
  if (state.mode === "practice" && crunched) setTimeout(clearCrunchMeterOverride, crunchHandoffDelay);
}

function playCrunchEffect() {
  if (pendingCrunchStreak !== null) {
    crunchMeterOverride = pendingCrunchStreak;
    crunchMarkSlam = true;
    render();
  }
  const card = $(".game-card");
  const effect = $("#crunch-effect");
  const effectText = effect.querySelector("strong");
  $("#crunch-message").textContent = pendingCrunchMessage;
  const targetMark = $("#crunch-count .crunch-mark:last-child");
  card.classList.remove("is-crunching");
  effect.classList.remove("active");
  effect.classList.remove("to-meter");
  if (targetMark) {
    const sourceRect = effectText.getBoundingClientRect();
    const targetRect = targetMark.getBoundingClientRect();
    effect.style.setProperty("--crunch-target-x", `${targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)}px`);
    effect.style.setProperty("--crunch-target-y", `${targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)}px`);
    effect.style.setProperty("--crunch-target-scale", Math.max(.08, targetRect.height / sourceRect.width));
    effect.classList.add("to-meter");
  }
  void effect.offsetWidth;
  card.classList.add("is-crunching");
  effect.classList.add("active");
  effect.addEventListener("animationend", () => {
    card.classList.remove("is-crunching");
    effect.classList.remove("active");
    effect.classList.remove("to-meter");
  }, { once: true });
}

function prepareCrunchMeter(previousStreak, nextStreak, message = "") {
  crunchMeterOverride = previousStreak;
  pendingCrunchStreak = nextStreak;
  pendingCrunchMessage = message;
  crunchMarkSlam = false;
}

function clearCrunchMeterOverride() {
  crunchMeterOverride = null;
  pendingCrunchStreak = null;
  pendingCrunchMessage = "";
  crunchMarkSlam = false;
  render();
}

function showTurnIndicator() {
  const indicator = $("#turn-indicator");
  const player = state.players?.[state.activePlayer];
  if (!player) return;
  indicator.querySelector("strong").textContent = player.id === "human" ? "YOUR TURN" : `${player.name.toUpperCase()}'S\nTURN`;
  indicator.classList.remove("active");
  void indicator.offsetWidth;
  indicator.classList.add("active");
  indicator.addEventListener("animationend", () => indicator.classList.remove("active"), { once: true });
}

async function showOpeningRollSequence() {
  if (computerBusy || state.mode !== "computer" || state.openingRevealed || !state.openingRolls?.length) return;
  const indicator = $("#opening-indicator");
  computerBusy = true;
  render();
  for (const [index, [humanRoll, computerRoll]] of state.openingRolls.entries()) {
    const result = humanRoll === computerRoll ? "Tie — roll again" : (state.startingPlayer === 0 ? "You start" : "Crunchy starts");
    indicator.innerHTML = `<div class="opening-roll-stage"><span>You${miniDie(humanRoll)}<b class="sr-only">rolled ${humanRoll}</b></span><strong class="opening-roll-result"></strong><span>Crunchy${miniDie(computerRoll)}<b class="sr-only">rolled ${computerRoll}</b></span></div>`;
    indicator.setAttribute("aria-hidden", "false");
    indicator.classList.remove("active");
    void indicator.offsetWidth;
    indicator.classList.add("active");
    await pause(UI_TIMING.openingResultDelayMs);
    const resultElement = indicator.querySelector(".opening-roll-result");
    resultElement.textContent = result;
    resultElement.classList.add("show");
    await pause(UI_TIMING.openingRollRevealMs - UI_TIMING.openingResultDelayMs);
    if (index < state.openingRolls.length - 1) await pause(400);
  }
  indicator.classList.remove("active");
  indicator.setAttribute("aria-hidden", "true");
  state = { ...state, openingRevealed: true, message: state.startingPlayer === 0 ? "Your turn." : "Crunchy's turn." };
  computerBusy = false;
  render();
  if (state.activePlayer === 1) scheduleComputerTurn();
}

function doBank() {
  const previous = state;
  const beforePlayer = state.activePlayer;
  state = state.mode === "computer" ? matchBank(state) : bank(state);
  if (state.mode === "practice" && state.lastEvent === "bank") state = { ...state, scoreHistory: [...(state.scoreHistory ?? []), state.totalScore] };
  if (state.lastBanked && state.lastBanked !== previous.lastBanked) stats = recordBank(stats, state.lastBanked);
  if (state.status === "won" || state.status === "finished") {
    if (state.status === "finished") {
      const humanWon = state.winners.includes("human");
      stats.completed += 1;
      if (state.draw) { /* draws count as completed only */ }
      else if (humanWon) stats.won += 1;
      else stats.lost += 1;
    } else {
      stats = recordWin(stats, state.turnCount);
      bestRun = betterBestRun(bestRun, state.scoreHistory);
      saveBestRun(bestRun);
    }
    saveStats(stats); clearGame();
    if (state.status === "finished") renderMatchResult();
    else {
      $("#win-title").textContent = "You crunched it!";
      $("#win-copy").textContent = `${state.totalScore.toLocaleString()} points in ${state.turnCount} turns. Rank: ${rankFor(stats.completed)}.`;
    }
    $("#win").showModal();
  } else saveStats(stats);
  render();
  if (state.mode === "computer" && state.activePlayer !== beforePlayer && state.status === "playing") showTurnIndicator();
  if (state.mode === "computer" && state.activePlayer === 1) scheduleComputerTurn();
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function scheduleComputerTurn() {
  if (computerBusy || state.mode !== "computer" || state.activePlayer !== 1 || state.status !== "playing") return;
  const openingDelay = UI_TIMING.computerTurnStartMs;
  computerBusy = true; render(); await pause(openingDelay);
  while (state.mode === "computer" && state.activePlayer === 1 && state.status === "playing") {
    if (state.awaitingNextTurn || !state.dice.length) {
      const previousCrunchStreak = state.players[1].crunchStreak ?? 0;
      state = matchRoll(state); render();
      if (state.activePlayer !== 1) {
        prepareCrunchMeter(previousCrunchStreak, state.lastEvent === "triple-crunch" ? 3 : state.players[1].crunchStreak, state.lastEvent === "triple-crunch" ? "CRUNCHY CRUNCHED BACK TO ZERO" : "");
        render();
        await pause(UI_TIMING.crunchRevealMs);
        playCrunchEffect();
        await pause(UI_TIMING.crunchAnimationMs + UI_TIMING.crunchSettleMs);
        clearCrunchMeterOverride();
        showTurnIndicator();
        break;
      }
      await pause(UI_TIMING.computerRollPauseMs);
    }
    const currentComputer = state.players[1];
    const choice = chooseComputerSelection(state.dice, { opened: currentComputer.opened, turnScore: state.turnScore, openingRequirement: state.config.openingRequirement });
    if (!choice) break;
    state = { ...state, selected: choice.indices, message: `Crunchy selects ${choice.score.toLocaleString()} points.` };
    render(); await pause(UI_TIMING.computerSelectionPauseMs);
    const player = state.players[1];
    const action = chooseComputerAction({ opened: player.opened, unbankedPoints: state.turnScore + choice.score, diceRemaining: state.config.diceCount - state.retainedCount - choice.indices.length || state.config.diceCount, totalScore: player.score, opponentScore: state.players[0].score, crunchStreak: player.crunchStreak ?? 0 }, state.config);
    if (action === "bank") {
      const bankSelection = maximumComputerSelection(state.dice);
      if (bankSelection && bankSelection.indices.join(",") !== state.selected.join(",")) {
        state = { ...state, selected: bankSelection.indices, message: `Crunchy banks every available point: ${bankSelection.score.toLocaleString()}.` };
        render();
        await pause(UI_TIMING.computerSelectionPauseMs);
      }
      state = matchBank(state); render(); showTurnIndicator(); break;
    }
    const previousCrunchStreak = state.players[1].crunchStreak ?? 0;
    state = matchRoll(state); render();
    if (state.activePlayer !== 1) {
      prepareCrunchMeter(previousCrunchStreak, state.lastEvent === "triple-crunch" ? 3 : state.players[1].crunchStreak, state.lastEvent === "triple-crunch" ? "CRUNCHY CRUNCHED BACK TO ZERO" : "");
      render();
      await pause(UI_TIMING.crunchRevealMs);
      playCrunchEffect();
      await pause(UI_TIMING.crunchAnimationMs + UI_TIMING.crunchSettleMs);
      clearCrunchMeterOverride();
      showTurnIndicator();
      break;
    }
    await pause(UI_TIMING.computerRollPauseMs);
  }
  computerBusy = false; render();
  if (state.status === "finished") showMatchResult();
}

function showMatchResult() {
  stats.completed += 1;
  if (!state.draw) state.winners.includes("human") ? stats.won += 1 : stats.lost += 1;
  saveStats(stats); clearGame();
  renderMatchResult();
  $("#win").showModal();
}

function renderMatchResult() {
  $("#win-title").textContent = state.draw ? "It's a draw!" : state.winners.includes("human") ? "You win!" : "Crunchy wins!";
  $("#win-copy").innerHTML = `<p class="result-label">Final score</p><div class="result-scores">${state.players.map((player) => `<div class="${state.winners.includes(player.id) ? "winner" : ""}"><span>${player.name}</span><strong>${player.score.toLocaleString()}</strong></div>`).join("")}</div>`;
}

function beginComputerTurnIfNeeded() {
  if (state.mode === "computer" && state.openingRevealed && state.activePlayer === 1 && state.status === "playing") scheduleComputerTurn();
}

$("#dice").addEventListener("click", (event) => { const button = event.target.closest("[data-die]"); if (button && (!state.mode || state.mode === "practice" || state.activePlayer === 0)) { state = toggleSelection(state, Number(button.dataset.die)); render(); } });
$("#combo-actions").addEventListener("click", (event) => { const button = event.target.closest("[data-triple]"); if (button && (!state.mode || state.mode === "practice" || state.activePlayer === 0)) { state = toggleTriple(state, Number(button.dataset.triple)); render(); } });
$("#roll").addEventListener("click", doRoll);
$("#bank").addEventListener("click", doBank);
$("#restart").addEventListener("click", () => { if (confirm("Abandon this game and start again?")) { stats.abandoned += 1; saveStats(stats); state = state.mode === "computer" ? createComputerMatch() : { ...createGame(), mode: "practice" }; computerBusy = false; render(); beginComputerTurnIfNeeded(); } });
$("#new-game").addEventListener("click", () => { $("#win").close(); state = state.mode === "computer" ? createComputerMatch() : { ...createGame(), mode: "practice" }; render(); beginComputerTurnIfNeeded(); });
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.mode === (state.mode || "practice")) return;
  if ((state.dice.length || state.totalScore) && !confirm("Start a new game in this mode?")) return;
  state = button.dataset.mode === "computer" ? createComputerMatch() : { ...createGame(), mode: "practice" };
  computerBusy = false; render(); beginComputerTurnIfNeeded();
}));
document.addEventListener("click", (event) => { if (event.target.dataset.open) { if (event.target.dataset.open === "stats") renderStats(); $(`#${event.target.dataset.open}`).showModal(); } if (event.target.dataset.close) $(`#${event.target.dataset.close}`).close(); });
$("#scoring-help").addEventListener("change", (event) => { prefs.scoringHelp = event.target.checked; savePrefs(prefs); render(); });

function renderStats() {
  const values = [["Experience rank", rankFor(stats.completed)], ["Games completed", stats.completed], ["Fewest turns", stats.fewestTurns ?? "—"], ["Highest bank", stats.highestBank.toLocaleString()], ["Total Crunches", stats.crunches], ["Games abandoned", stats.abandoned]];
  $("#stats-content").innerHTML = values.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

renderAds(AD_CONFIG);
document.querySelectorAll("[data-faces]").forEach((example) => { example.innerHTML = [...example.dataset.faces].map((face) => miniDie(Number(face))).join(""); });
addEventListener("resize", () => renderAds(AD_CONFIG));
$("#scoring-help").checked = prefs.scoringHelp;
render();
if (!prefs.introSeen) { $("#intro").showModal(); prefs.introSeen = true; savePrefs(prefs); }
if (state.mode === "computer" && state.openingRevealed && state.activePlayer === 1 && state.status === "playing") {
  if (state.players.some((player) => player.turns) || state.dice.length) showTurnIndicator();
  scheduleComputerTurn();
}
