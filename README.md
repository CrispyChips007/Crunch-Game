# Crunch

Crunch is a lightweight, mobile-first five-dice score challenge inspired by Farkle. **Vs Crunchy** is the default experience, while the solo score challenge remains available as **Practice mode**. It has no accounts, build step, external assets, or runtime dependencies and is ready for static hosting.

## Play locally

Serve the repository root with any static server (ES modules do not work reliably from `file://`):

```sh
python -m http.server 8080
```

Then open `http://localhost:8080`. Run the automated suite with:

```sh
npm test
```

Node.js 20 or later is recommended. The game itself needs only a modern browser.

## Rules

Roll five dice and select at least one scoring die or triple. Single 1s score 100 and single 5s score 50. Three 1s score 1,000; triples of 2–6 score face value × 100. A scoring triple uses exactly three dice: fourth and fifth 2s, 3s, 4s, or 6s cannot be retained, while extra 1s and 5s score as singles.

Bank to add the turn score to your total, or roll the remaining dice. When all five dice have legitimately scored, all five return (“hot dice”). A roll with no score is a Crunch and loses the unbanked turn score. After opening, three consecutive Crunches reset that player's total to zero; banking clears the streak, and an opened player remains open after the reset. The first bank must reach 1,000. Reach 10,000 to win.

Assumptions made for ambiguous details:

- The consecutive-Crunch rules update starts a fresh in-progress game; existing statistics and preferences are preserved.
- A Crunch completes the current turn and the next roll begins the next turn.
- Turn count starts at one and counts the winning turn.
- Games abandoned through Restart are tracked; closing a tab is not considered an abandonment.
- Solo games are recorded as wins on completion. Losses remain reserved for multiplayer.

## Architecture

- `src/scoring.js` — pure scoring, valid option discovery, and Crunch detection.
- `src/engine.js` — immutable-style game transitions and future round-completion logic.
- `src/random.js` — unbiased Web Crypto die rolls with injectable deterministic rolls.
- `src/storage.js` — versioned game/preferences/statistics persistence with FNV-1a checksums.
- `src/ads.js` — all advertising visibility and future provider integration.
- `src/app.js` — DOM rendering and browser event wiring.
- `src/config.js` — internal game, advertising, and experience-rank settings.
- `test/` — Node's dependency-free test runner suites.

The engine has no browser dependency. Future multiplayer can place the same transition and scoring rules on a server, replace the injected roller with server-authoritative results, and synchronize serializable game states. Guest identity, rooms, reconnection, and transport should live outside the engine. `multiplayerRoundResult` establishes the pure-logic boundary for equal-turn final-round completion; a server can extend it with “cannot win or draw” notifications without coupling networking to the UI.

### First multiplayer phase: computer opponent

Practice mode remains available as the current one-player score challenge. The first multiplayer mode will be one human against one computer player so the complete multiplayer interface and rules can be tested without another available player.

The computer must choose whether to bank or roll before any future dice are generated. It receives only the same public state visible to the human; future rolls are never pre-generated, inspected, or supplied to its decision function. Its risk model is driven primarily by the number of dice remaining: rolling one or two dice is substantially riskier than rolling four or five. Current unbanked points, score difference, opening status, proximity to the target, and final-round state are secondary inputs. Random rolls use the same unbiased Web Crypto source regardless of player; the game does not fall back to `Math.random()`.

Before opening, the computer must continue rolling until its current turn reaches the 1,000-point opening requirement or it Crunches. It cannot voluntarily stop below the threshold. Once it reaches or exceeds 1,000, its default action is to bank and open; only an explicitly tested exceptional strategy may justify risking another roll.

## Internal configuration

Edit `src/config.js` to change the opening requirement, winning target, rank thresholds, and each advertising placement. `adsEnabled` removes all ad space globally. Each `show…Ad` switch controls one slot. `adPlaceholderMode: false` hides slots unless a provider is configured.

For a real ad integration, implement a provider with `mount(slotElement, placementName)` in `src/ads.js`. Keep provider scripts and consent handling there; gameplay never depends on ad loading. No advertising scripts or credentials are included.

## GitHub Pages

The site uses only relative URLs, so it works at a repository subpath without modification.

1. Push these files to a GitHub repository.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select the branch (usually `main`) and `/ (root)`, then save.
4. Open the URL GitHub reports after deployment finishes.

No build workflow is required. If a CI check is desired, run `npm test` with Node 20 before deployment.
