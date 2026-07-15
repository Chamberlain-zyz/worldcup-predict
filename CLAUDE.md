# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Football Arena** is a zero-dependency, zero-build static HTML + Canvas 2D football simulation game covering: 2026 World Cup knockout bracket, 2025/26 UEFA Champions League (Swiss-stage 36 teams + knockout), and the Big-5 European leagues (Premier League / LaLiga / Serie A / Bundesliga / Ligue 1) with 5 recent seasons of standings-based match selection.

## Running & Verifying

There is **no build, no lint, no test runner**. Pages open directly with `file://` in a browser:

```bash
start cups/worldcup.html                     # Windows (macOS: open, Linux: xdg-open)
start "cups/ucl.html"
start "leagues/league.html?c=spain"          # or england | italy | germany | france
```

For iterating on JS/CSS or if you ever externalize data to `data/*.json` (currently inlined in HTML because `file://` blocks `fetch`):

```bash
python -m http.server 8765
# then visit http://localhost:8765/leagues/league.html?c=england
```

**Syntax-check any JS file before committing** (the only "test" this project has):

```bash
node --check js/engine.js
```

Verification checklist for non-trivial physics/timer/point-of-goal changes is in `.github/pull_request_template.md` — real testing is manual in-browser observation.

## Architecture: TEAM Adapter Pattern (Critical)

The engine `js/engine.js` is **shared across all pages** (World Cup / UCL / 5 leagues). It knows nothing about specific teams — pages provide a **TEAM adapter** implementing this interface:

```js
initEngine(TEAM, opts)
// TEAM = { all, name(t), titleName(t), badge(t,size,cls), bigBadge(t),
//          pensMark(t), drawOnCanvas(ctx,ball,R), rating?(t) }
// opts = { onClearSelection, resetOverlay, allowExtra, allowPens }
```

Three adapter flavors exist:

| Page | Adapter source | Team ID | Visual identity |
|---|---|---|---|
| `cups/worldcup.html` | `js/bracket.js` inline | `[EN, ISO, emoji]` array | flagcdn.com SVG flags |
| `cups/ucl.html` | `Badge.makeBadgeTeamAdapter` in `js/ucl.js` | `CLUBS[code]` object | badge PNG (5-league teams) / letter block fallback |
| `leagues/league.html` | `Badge.makeBadgeTeamAdapter` in `js/standings.js` | `CLUBS[code]` object | badge PNG from `img/badges/<code>/<team>.png` |

**Adding a new page = build one adapter**. Do not fork `engine.js`.

## Badge System (`js/badge.js`)

- `badgeDomHTML(team, size, cls)` — DOM badges (scoreboard / standings / result card / penalty bar / bracket rows). Emits `<img class="badge-img">` if `team.logo` is set, else falls back to a color-block span with the team's `abbr` letters.
- `drawBadgeToCanvas(ctx, team, size)` — Ball surface. Fills `team.c1` then draws the logo image with `cover` scaling (image extends past the ball's clip circle so nothing shows a colored border). Falls back to abbreviation letters if the image isn't loaded yet — subsequent frames auto-upgrade to the image once `Image.complete` becomes true (all `Image` objects cached in `_imgCache` by URL).
- `bindLogos(CLUBS, logoBase)` — Attaches `.logo = "<base>/<code>.png"` to each club. Applies `FILENAME_OVERRIDE = { aux: "auxe" }` because **Windows reserves `aux` as a DOS device name and git refuses to index `aux.png`** (Auxerre in Ligue 1). Any future codes that are Windows-reserved names (`con`, `prn`, `nul`, `com1-9`, `lpt1-9`) must be added to this override.
- `makeBadgeTeamAdapter(CLUBS, rating, logoBase)` — Builds a TEAM adapter and calls `bindLogos` in one step. `rating` is optional; omitting it makes the engine fall back to 50/50 (World Cup mode).

`window.BADGE_BASE` is set by `js/league-page.js` per `?c=` param and consumed by `js/standings.js`. `js/ucl.js` uses a hand-maintained `UCL_LOGO_LEAGUE` map (`code → league_directory`) because Champions League teams span multiple leagues; teams not in the map (Sporting, Club Brugge, Galatasaray, etc.) intentionally fall back to letter blocks.

## Team Strength Model (`computeStrength` in `engine.js`)

Not just cosmetic — strength drives outcome via **speed diff + steering assist**, not by fudging goal detection:

1. Read `TEAM.rating(tA)` / `rating(tB)` → season points + `(gf-ga)*0.1` (leagues rebuild on season change; UCL builds once from Swiss-stage table).
2. Elo logistic maps rating gap to strong-team goal share `sA`; `UPSET` lerps it toward 0.5 to preserve upsets.
3. Asymmetry `|sA-0.5|*2` scales `[BASE-SPREAD, BASE+SPREAD]` speeds and `[0, STEER_MAX]` steering gain. **Only the stronger team gets steering** — giving the weaker team steering makes it "aim at goal" and defeats the design.
4. Missing/equal ratings ⇒ both balls `sp = BASE`, both `gain = 0` (identical to original 50/50 engine).

The knobs (`RATING_D`, `UPSET`, `SPREAD`, `STEER_MAX`, `PEN_RATING_AMP`, `BASE`, `TARGET_SP`) live at the top of `js/engine.js` in one config block. See README.md for the tuning cheat-sheet. `FORCE_EXTRA` / `FORCE_PENS` are source-only debug flags (not exposed via `opts`).

## Page Assembly

**Leagues share one HTML template.** `leagues/league.html` is parametric — `js/league-page.js` reads `?c=<code>`, injects text (title, subtitle, seat name), sets `window.BADGE_BASE`, and dynamically loads scripts in dependency order:

```
season-util.js → data/<code>-data.js → badge.js → engine.js → league-nav.js → standings.js
```

Adding a new league = drop one `data/<code>-data.js` and add an entry to `LEAGUES` in `league-page.js` + `league-nav.js`. No new HTML.

**World Cup and UCL each have their own HTML** (`cups/*.html`) with inline data `<script>` blocks (because `file://` forbids fetch). The bracket rendering is deduplicated into `js/bracket-render.js`, invoked by both `js/bracket.js` (World Cup, flag adapter) and `js/ucl.js` (UCL, badge adapter) via a shared `BracketRender.create(opts)` factory.

## Data Files (`data/*.js`)

Each league data file defines two globals: `CLUBS` (metadata map keyed by short code) and `SEASONS` (array of `{label, clubs:[{code,pld,w,d,l,gf,ga,pts}, ...]}`). The current/new season uses `emptySeason(codes)` from `js/season-util.js` to avoid hand-writing 20 rows of zeros. Position in each season's `clubs` array = ranking.

`ZONE = { ucl:<N>, uel:<M> }` at the bottom sets zone-coloring cutoffs; last 3 are always relegation.

## Conventions

- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `style:`) — one concern per commit. See `.github/pull_request_template.md` self-review checklist.
- **`innerHTML` injection**: Never inject untrusted data. All rendered strings are code-controlled (team names, scores). Adapters return HTML strings which `engine.js` writes with `innerHTML` — keep that trust boundary in mind.
- **rAF / timers**: The engine uses `requestAnimationFrame` + `setTimeout`. Any new async work must be cleaned up when the match resets (grep for `cancelAnimationFrame` and `clearTimeout` sites).
- **State mutations**: `state` (in `engine.js`) is touched by `newMatch`, `step`, `render`, `applyUI`, kickoff/penalty flow. When adding fields, verify the full chain. Divisions must guard against 0; angles must go through `normAngle`.
- **Magic numbers**: Extract to named constants in the config block at the top of `engine.js` with a comment explaining the range and its visual effect.
