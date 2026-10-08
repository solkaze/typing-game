# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Tauri v2 desktop app with a React 19 + Vite frontend: a Japanese romaji typing trainer aimed at an already-fast typist (about 6 keys/s). A run is a fixed number of kana, timed; every keystroke is logged and stored so the analysis screens can be recomputed from raw data. The UI is in Japanese.

## Commands

```bash
npm run dev        # Vite dev server only (browser, http://localhost:5173)
npm run build      # tsc -b (typecheck, project references) + vite build -> dist/
npm run lint       # oxlint
npm test           # vitest run (src/**/*.test.ts)
npm run preview    # serve the built dist/

cargo tauri dev    # run the actual desktop app (spawns `npm run dev` first)
cargo tauri build  # bundle the desktop app (spawns `npm run build` first)
(cd src-tauri && cargo test)   # Rust tests (db.rs)
```

The Tauri CLI is **not** an npm devDependency here — it is the system `cargo-tauri` binary, so use `cargo tauri ...` from the repo root, not `npm run tauri`.

Tests are Vitest for the frontend logic (engine, sentence picking, analysis) and `cargo test` for the SQLite layer. There are no component tests; UI is checked by running the app. `npm run build` is the typecheck (`tsc -b` over both tsconfig projects).

`.envrc` (direnv) exports `WEBKIT_DISABLE_DMABUF_RENDERER=1` — required on Linux or the WebKit webview renders a blank/black window. Allow direnv, or export it manually before `cargo tauri dev`.

## Architecture

Two halves that meet at an IPC boundary:

- **Frontend** (`src/`, `index.html`, `vite.config.ts`) — plain React SPA, no router or state library. `App.tsx` switches between home / `Game` / `Result` / `AnalysisView` / `SettingsView` with a local `view` state. The mode (and kana count, passage or miss limit) is picked on the home screen and kept in `localStorage`; `Game` renders long mode as a scrolling passage box instead of one sentence at a time, and in endless mode keeps appending sentences (`more` prop) until `missLimit` misses end the run. Runs equally in a browser (`npm run dev`) or in the Tauri webview: `storage.ts` is the only Tauri-aware module and falls back to `localStorage` outside Tauri.
- **Rust host** (`src-tauri/`) — `src/main.rs` is a thin shim calling `app_lib::run()` in `src/lib.rs`, which holds the `tauri::Builder` and the three commands (`save_session`, `load_sessions`, `delete_session`). `src/db.rs` is the SQLite layer (rusqlite, bundled); the DB is `sessions.db` in the app data dir.

Frontend modules worth knowing before editing:

- `romaji/table.ts` — kana → romaji spellings. Only spellings accepted by **both** MS-IME and Mozc defaults; the first entry of each list is what the guide shows.
- `romaji/engine.ts` — `Typist` accepts every valid spelling by tracking a *set* of parse states (needed because `n` may be a whole ん or the start of `nn`/`na`). Each state carries its path, so `segments` gives the kana → spelling split of what was typed; an optional `prefer` map (kana → romaji) only reorders the guide, never what is accepted. ん and doubled-consonant っ are context-dependent and handled here, not in the table. Change this test-first; `engine.test.ts` pins the IME rules.
- `texts/` — three pools of `{ text, reading }`: `sentences.ts` (standard mode), `optimize.ts` (optimize mode: sentences dense in same-finger sequences; a test requires `sameFingerRate` from `fingers.ts` ≥ 0.15 on the guide spelling) and `passages.ts` (long mode: titled passages of 400–800 kana, stored as sentence lists). `pick.ts` picks sentences whose readings sum to exactly the requested kana count, or one passage, or (`pickRound`, endless mode) one shuffled pass over the whole standard pool. `lookup.ts` maps a stored sentence text back to its reading, so texts must be unique across all pools. Tests check every reading is typeable.
- `types.ts` — `Session` / `Keystroke` / `Mode` (`standard` / `optimize` / `long` / `endless` / `weak`). A session is stored as one JSON blob including the full keystroke log, so new analyses need no schema change. `Session.mode` is absent on records made before modes existed; always read it through `modeOf`. The home history, the analysis screen and the result's "recent average" only ever mix sessions of one mode. An endless session ends mid-sentence: `kanaCount` is the kana typed (its score), `completed` the sentences finished, and it is only compared with sessions of the same `missLimit`.
- `analysis.ts` — pure functions from sessions to per-key / bigram / trigram / confusion / flow stats. Intervals are only taken from keystrokes typed right first time, and n-grams never span sentences. "loss" = (median − overall median) × count is the ranking used for "what to practise". `changes` joins the rows of two `analyze` results; `AnalysisView` splits the selected sessions into a first and second half by count to show whether each n-gram got faster (the 前半比 column and the 速くなった / 遅くなった tables).
- `misses.ts` — pure function from sessions to miss kinds and miss cost. A run of misses at one position is one event, classified by its first key against the surrounding correct keys (`ahead` = typed the key after the intended one, `repeat`, `adjacent` by QWERTY geometry, `mirror` = same finger of the other hand, else `other`; first match wins). Cost is measured against `analyze`'s `medianInterval`: delay until the right key plus the slowdown of the next `AFTER_MISS_WINDOW` keys, cut at the next miss or sentence end. Shown by `MissPanel.tsx`.
- `drill.ts` — weak mode (`弱点`). `plan` turns the most recent sessions (all modes) into weighted bigram targets (excess over the median interval + miss rate, as ms per occurrence) and remembers how each sentence was last spelled; `pickDrill` ranks the standard + optimize pools by target density and fills the kana count from the densest share, widening it until the count is exact.
- `spelling.ts` — pure function from sessions to per-kana spelling usage (replays stored keys through `Typist.segments`, so it needs `readingOf`): counts and median time per spelling, plus `shorter` / `faster` hints. Shown by `SpellingTable.tsx` in the analysis screen. `preferred` turns it into the `prefer` map `App` hands to `Game` when the `ownSpelling` setting is on.
- `review.ts` — pure function from **one** session to a per-sentence keystroke replay (each key marked ok / slow / stall / miss against that session's own median interval), a breakdown of time lost, and the slowest spots. Rendered by `SessionReview.tsx` inside `Result`, which is also opened from the home history list (詳細).
- `settings.ts` — user settings (countdown seconds, per-sentence KPS display) as one JSON blob in `localStorage`; `loadSettings` fills missing fields with defaults, so adding a setting means a field + default there and a row in `SettingsView.tsx`. `App` owns the state and passes values to `Game` as props.
- `ghost.ts` — the ghost (pacer): an opponent typing at a fixed `ghostKps` setting. It restarts on every sentence, at the player's first correct keystroke of that sentence, so each sentence is a separate race. `ghostKeys` counts its keystrokes in the sentence (it also hits key 1 at t=0, matching the per-sentence `lastKps` in `Game.tsx`, so finishing a sentence ahead of it ⇔ that sentence's kps beat the target) and stops at the sentence end. `Ghost.tsx` draws it as a second romaji row under the player's own (same string, so positions line up; a bar instead of letters when `hideGuide` is on) with the lead / lag in keystrokes within the sentence, and runs its own `requestAnimationFrame` loop so `Game` is not re-rendered. It is display only — nothing about it is stored in the session.
- `sound.ts` — key and miss sounds are published audio files in `src/assets/sounds/<kind>/<n>.mp3`, no synthesis: key sounds are recorded switch samples (tplai/kbsim, MIT; 5 per pack, one picked at random), miss sounds are effects from Kenney's Interface Sounds (CC0; one each); the `LICENSE-*` files sit beside them. They are loaded via `import.meta.glob` and played through the Web Audio API with a per-kind gain (`GAIN`) because the files differ a lot in level; adding a sound means a folder, a `KeySound` / `MissSound` value, an option and a gain. `keepAwake` feeds a constant inaudible signal (-100 dB) to the output for as long as the context lives: WebKitGTK hands GStreamer empty GAP buffers while silent and can then drop the first few ms of the next sound, which clips the attack of a key click — do not remove it as dead code. The sound kinds and volume are settings; `Game` calls `playKey` / `playMiss` per keystroke and `SettingsView` plays a preview on selection.
- Charts follow the dataviz skill (single series, palette vars under `.viz-root` in `index.css`).

Wiring facts that span files:

- `src-tauri/tauri.conf.json` hardcodes `devUrl: http://localhost:5173` and `frontendDist: ../dist`; changing Vite's port or `build.outDir` means changing this file too.
- Tauri *plugin* permissions must be granted in `src-tauri/capabilities/default.json` (currently just `core:default`) or the IPC call fails at runtime. The app's own `#[tauri::command]`s only need registering in `generate_handler!`.
- `src-tauri/gen/` is generated and gitignored; regenerated by the Tauri build.
- TypeScript uses project references: `tsconfig.app.json` covers `src/` (DOM libs, `noEmit`, strict-ish flags including `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`), `tsconfig.node.json` covers `vite.config.ts` only. `tsconfig.json` itself compiles nothing.

## Conventions

- No semicolons, single quotes, 2-space indent (Rust is 2-space too). Code comments are written in Japanese.
- Oxlint config (`.oxlintrc.json`) enables the `react`, `typescript`, and `oxc` plugins; `react/rules-of-hooks` is an error. Type-aware rules are off; turning them on means installing `oxlint-tsgolint` and setting `"options": { "typeAware": true }` in `.oxlintrc.json`.
- `README.md` is the user-facing readme for the GitHub page, written in Japanese (features, modes, how to run). Keep it in step when a mode, a setting or a setup step changes.
