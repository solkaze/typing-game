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
- `romaji/engine.ts` — `Typist` accepts every valid spelling by tracking a *set* of parse states (needed because `n` may be a whole ん or the start of `nn`/`na`). ん and doubled-consonant っ are context-dependent and handled here, not in the table. Change this test-first; `engine.test.ts` pins the IME rules.
- `texts/` — three pools of `{ text, reading }`: `sentences.ts` (standard mode), `optimize.ts` (optimize mode: sentences dense in same-finger sequences; a test requires `sameFingerRate` from `fingers.ts` ≥ 0.15 on the guide spelling) and `passages.ts` (long mode: titled passages of 400–800 kana, stored as sentence lists). `pick.ts` picks sentences whose readings sum to exactly the requested kana count, or one passage, or (`pickRound`, endless mode) one shuffled pass over the whole standard pool. `lookup.ts` maps a stored sentence text back to its reading, so texts must be unique across all pools. Tests check every reading is typeable.
- `types.ts` — `Session` / `Keystroke` / `Mode` (`standard` / `optimize` / `long` / `endless`). A session is stored as one JSON blob including the full keystroke log, so new analyses need no schema change. `Session.mode` is absent on records made before modes existed; always read it through `modeOf`. The home history, the analysis screen and the result's "recent average" only ever mix sessions of one mode. An endless session ends mid-sentence: `kanaCount` is the kana typed (its score), `completed` the sentences finished, and it is only compared with sessions of the same `missLimit`.
- `analysis.ts` — pure functions from sessions to per-key / bigram / trigram / confusion / flow stats. Intervals are only taken from keystrokes typed right first time, and n-grams never span sentences. "loss" = (median − overall median) × count is the ranking used for "what to practise".
- `review.ts` — pure function from **one** session to a per-sentence keystroke replay (each key marked ok / slow / stall / miss against that session's own median interval), a breakdown of time lost, and the slowest spots. Rendered by `SessionReview.tsx` inside `Result`, which is also opened from the home history list (詳細).
- `settings.ts` — user settings (countdown seconds, per-sentence KPS display) as one JSON blob in `localStorage`; `loadSettings` fills missing fields with defaults, so adding a setting means a field + default there and a row in `SettingsView.tsx`. `App` owns the state and passes values to `Game` as props.
- Charts follow the dataviz skill (single series, palette vars under `.viz-root` in `index.css`).

Wiring facts that span files:

- `src-tauri/tauri.conf.json` hardcodes `devUrl: http://localhost:5173` and `frontendDist: ../dist`; changing Vite's port or `build.outDir` means changing this file too.
- Tauri *plugin* permissions must be granted in `src-tauri/capabilities/default.json` (currently just `core:default`) or the IPC call fails at runtime. The app's own `#[tauri::command]`s only need registering in `generate_handler!`.
- `src-tauri/gen/` is generated and gitignored; regenerated by the Tauri build.
- TypeScript uses project references: `tsconfig.app.json` covers `src/` (DOM libs, `noEmit`, strict-ish flags including `noUnusedLocals`/`noUnusedParameters`/`erasableSyntaxOnly`), `tsconfig.node.json` covers `vite.config.ts` only. `tsconfig.json` itself compiles nothing.

## Conventions

- No semicolons, single quotes, 2-space indent (Rust is 2-space too). Code comments are written in Japanese.
- Oxlint config (`.oxlintrc.json`) enables the `react`, `typescript`, and `oxc` plugins; `react/rules-of-hooks` is an error. Type-aware rules are off — see `README.md` for how to turn them on with `oxlint-tsgolint`.
- `README.md` is the stock Vite template readme; treat it as tooling notes, not project docs.
