import { AD_CONFIG, GAME_CONFIG, RANKS, UI_TIMING } from "./config.js";
import { bank, canAct, createGame, roll, selectionResult, toggleSelection, toggleTriple } from "./engine.js";
import { bestComputerSelection, chooseComputerAction } from "./computer.js";
import { createComputerMatch, matchBank, matchRoll } from "./match.js";
import { renderAds } from "./ads.js";
import { clearGame, loadGame, loadPrefs, loadStats, recordBank, recordCrunch, recordWin, saveGame, savePrefs, saveStats } from "./storage.js";
import { scoringOptions } from "./scoring.js";

const $ = (selector) => document.querySelector(selector);
document.documentElement.style.setProperty("--crunch-animation-ms", `${UI_TIMING.crunchAnimationMs}ms`);
document.documentElement.style.setProperty("--turn-indicator-ms", `${UI_TIMING.turnIndicatorMs}ms`);
let state = loadGame() || createGame();
state.config = GAME_CONFIG;
// Repair games saved before the ended-turn flag was introduced.
if (state.message?.startsWith("Crunch!")) {
  state = { ...state, dice: state.dice?.length ? state.dice : (state.lastRoll || []), selected: [], awaitingNextTurn: true };
}
let stats = loadStats();
let prefs = loadPrefs();
let computerBusy = false;
const crunchHandoffDelay = UI_TIMING.crunchRevealMs + UI_TIMING.crunchAnimationMs;

function rankFor(completed) { return RANKS.find(([threshold]) => completed >= threshold)[1]; }
function dots(face) { return Array.from({ length: face }, () => "<i></i>").join(""); }
function miniDie(face) { return `<i class="mini-die face-${face}" aria-hidden="true">${dots(face)}</i>`; }

function render() {
  const isComputerMatch = state.mode === "computer";
  const humanScore = isComputerMatch ? state.players[0].score : state.totalScore;
  $("#total-score").textContent = humanScore.toLocaleString();
  $("#target-score").textContent = state.config.winningTarget.toLocaleString();
  $("#turn-label").textContent = isComputerMatch ? "Round" : "Turn";
  $("#turn-count").textContent = isComputerMatch ? state.round : state.turnCount;
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === (state.mode || "practice")));
  $("#players").hidden = !isComputerMatch;
  if (isComputerMatch) $("#players").innerHTML = state.players.map((player, index) => `<div class="player-chip${index === state.activePlayer ? " active" : ""}"><span>${player.name}</span><strong>${player.score.toLocaleString()}</strong><small>${player.opened ? "Open" : "Needs 1,000"}</small></div>`).join("");
  const result = selectionResult(state);
  const selectedScore = result.valid ? result.score : 0;
  $("#turn-score").textContent = (state.turnScore + selectedScore).toLocaleString();
  $("#selection-score").textContent = selectedScore ? `${selectedScore.toLocaleString()} from selected dice` : "No dice selected";
  $("#message").textContent = state.message;
  const scoring = new Set(scoringOptions(state.dice).flatMap((option) => option.indices));
  $("#dice").innerHTML = state.dice.map((face, index) => `<button class="die face-${face}${state.selected.includes(index) ? " selected" : ""}${prefs.scoringHelp && scoring.has(index) ? " hint" : ""}" data-die="${index}" aria-label="Die ${index + 1}: ${face}${state.selected.includes(index) ? ", selected" : ""}">${dots(face)}</button>`).join("");
  const triples = [1, 5].filter((face) => state.dice.filter((d) => d === face).length >= 3);
  $("#combo-actions").innerHTML = triples.map((face) => `<button data-triple="${face}">Select three ${face}s · ${face === 1 ? "1,000" : "500"}</button>`).join("");
  const actionable = canAct(state);
  const activeOpened = isComputerMatch ? state.players[state.activePlayer].opened : state.opened;
  const prospectiveBank = state.turnScore + selectedScore;
  const meetsOpeningRequirement = activeOpened || prospectiveBank >= state.config.openingRequirement;
  const bankable = actionable && meetsOpeningRequirement;
  $(".controls").classList.toggle("choice-ready", bankable);
  const humanTurn = !isComputerMatch || state.activePlayer === 0;
  $("#bank").disabled = !bankable || !humanTurn || computerBusy;
  $("#bank").title = actionable && !meetsOpeningRequirement ? `You need ${state.config.openingRequirement.toLocaleString()} points to open.` : "";
  $("#roll").disabled = !humanTurn || computerBusy || Boolean(state.dice.length && !actionable && !state.awaitingNextTurn);
  $("#roll").textContent = state.awaitingNextTurn ? "Roll dice" : (state.dice.length ? "Roll again" : (state.turnCount === 1 && state.totalScore === 0 ? "Start game" : "Roll dice"));
  if (state.status === "playing") saveGame(state);
}

function doRoll() {
  const beforeTurn = state.turnCount;
  const beforePlayer = state.activePlayer;
  state = state.mode === "computer" ? matchRoll(state) : roll(state);
  const crunched = state.message.startsWith("Crunch") || (state.mode === "computer" && state.activePlayer !== beforePlayer && state.dice.length > 0);
  if (crunched) { stats = recordCrunch(stats); saveStats(stats); }
  render();
  if (crunched) setTimeout(playCrunchEffect, UI_TIMING.crunchRevealMs);
  if (state.mode === "computer" && state.activePlayer !== beforePlayer && state.status === "playing") {
    if (crunched) setTimeout(showTurnIndicator, crunchHandoffDelay); else showTurnIndicator();
  }
  if (state.mode === "computer" && state.activePlayer === 1 && state.status === "playing") {
    if (crunched) setTimeout(scheduleComputerTurn, crunchHandoffDelay); else scheduleComputerTurn();
  }
}

function playCrunchEffect() {
  const card = $(".game-card");
  const effect = $("#crunch-effect");
  card.classList.remove("is-crunching");
  effect.classList.remove("active");
  void effect.offsetWidth;
  card.classList.add("is-crunching");
  effect.classList.add("active");
  effect.addEventListener("animationend", () => {
    card.classList.remove("is-crunching");
    effect.classList.remove("active");
  }, { once: true });
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

function doBank() {
  const previous = state;
  const beforePlayer = state.activePlayer;
  state = state.mode === "computer" ? matchBank(state) : bank(state);
  if (state.lastBanked && state.lastBanked !== previous.lastBanked) stats = recordBank(stats, state.lastBanked);
  if (state.status === "won" || state.status === "finished") {
    if (state.status === "finished") {
      const humanWon = state.winners.includes("human");
      stats.completed += 1;
      if (state.draw) { /* draws count as completed only */ }
      else if (humanWon) stats.won += 1;
      else stats.lost += 1;
    } else stats = recordWin(stats, state.turnCount);
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
  computerBusy = true; render(); await pause(UI_TIMING.computerTurnStartMs);
  while (state.mode === "computer" && state.activePlayer === 1 && state.status === "playing") {
    if (state.awaitingNextTurn || !state.dice.length) {
      state = matchRoll(state); render();
      if (state.activePlayer !== 1) {
        await pause(UI_TIMING.crunchRevealMs);
        playCrunchEffect();
        await pause(UI_TIMING.crunchAnimationMs);
        showTurnIndicator();
        break;
      }
      await pause(UI_TIMING.computerRollPauseMs);
    }
    const choice = bestComputerSelection(state.dice);
    if (!choice) break;
    state = { ...state, selected: choice.indices, message: `Crunchy selects ${choice.score.toLocaleString()} points.` };
    render(); await pause(UI_TIMING.computerSelectionPauseMs);
    const player = state.players[1];
    const action = chooseComputerAction({ opened: player.opened, unbankedPoints: state.turnScore + choice.score, diceRemaining: state.config.diceCount - state.retainedCount - choice.indices.length || state.config.diceCount, totalScore: player.score, opponentScore: state.players[0].score }, state.config);
    if (action === "bank") { state = matchBank(state); render(); showTurnIndicator(); break; }
    state = matchRoll(state); render();
    if (state.activePlayer !== 1) {
      await pause(UI_TIMING.crunchRevealMs);
      playCrunchEffect();
      await pause(UI_TIMING.crunchAnimationMs);
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

$("#dice").addEventListener("click", (event) => { const button = event.target.closest("[data-die]"); if (button && (!state.mode || state.mode === "practice" || state.activePlayer === 0)) { state = toggleSelection(state, Number(button.dataset.die)); render(); } });
$("#combo-actions").addEventListener("click", (event) => { const button = event.target.closest("[data-triple]"); if (button && (!state.mode || state.mode === "practice" || state.activePlayer === 0)) { state = toggleTriple(state, Number(button.dataset.triple)); render(); } });
$("#roll").addEventListener("click", doRoll);
$("#bank").addEventListener("click", doBank);
$("#restart").addEventListener("click", () => { if (confirm("Abandon this game and start again?")) { stats.abandoned += 1; saveStats(stats); state = state.mode === "computer" ? createComputerMatch() : { ...createGame(), mode: "practice" }; computerBusy = false; render(); } });
$("#new-game").addEventListener("click", () => { $("#win").close(); state = state.mode === "computer" ? createComputerMatch() : { ...createGame(), mode: "practice" }; render(); });
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.mode === (state.mode || "practice")) return;
  if ((state.dice.length || state.totalScore) && !confirm("Start a new game in this mode?")) return;
  state = button.dataset.mode === "computer" ? createComputerMatch() : { ...createGame(), mode: "practice" };
  computerBusy = false; render();
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
if (state.mode === "computer" && state.activePlayer === 1 && state.status === "playing") {
  showTurnIndicator();
  scheduleComputerTurn();
}
