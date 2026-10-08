# タイピング練習

すでに速く打てる人（秒間 6 打鍵前後〜）が、さらに速くなるためのローマ字入力タイピング練習アプリです。

1 回ごとの打鍵をすべて記録し、「どのキーの並びが遅いか」「どこで打ち間違えるか」を後から分析できます。Tauri 製のデスクトップアプリとして動くほか、ブラウザでもそのまま動きます。

## 特徴

- **IME と同じ打ち方をすべて受け付ける** — `shi` / `si`、`ji` / `zi`、`nn` / `n` など、MS-IME と Mozc の両方の既定で通る打ち方ならどれで打っても正解になります。
- **打鍵をすべて記録して分析** — キーごと・2 連・3 連の速度、打ち間違いの傾向、速度の推移を見られます。「練習すると一番効く並び」を損失の大きい順に出し、その並びが期間の前半から後半で速くなったかも分かります。ミスは「先走り・連打・隣のキー・左右の取り違え」に分け、1 回のミスで失う時間も出します。
- **1 回ごとのふり返り** — 打ち終えた直後に、文ごとの打鍵を「遅い・詰まった・ミス」で色分けして見直せます。
- **ゴースト** — 決めた速度（打/秒）で打つ相手を、自分のローマ字のすぐ下に流します。目標の速度がどれくらいかを、打ちながら体感できます。
- **打鍵音・ミス音** — 実機のキースイッチ（茶軸・クリーム・静電容量・青軸）を録音した音を鳴らせます。

## モード

| モード | 内容 |
| --- | --- |
| 通常 | 短い文を、決めたかな数（100 / 200 / 400）だけ打ちます。 |
| 最適化 | 同じ指が続く並びを詰め込んだ、打ちにくい文を打ちます。 |
| 長文 | ひと続きの文章（400〜800 かな）を最後まで打ち切ります。 |
| エンドレス | 決めた回数ミスするまで打ち続けます。打てたかな数が記録になります。 |
| 弱点 | これまでの記録から、遅い並び・打ち間違えやすい並びが多く入った文を選んで出します。 |

## 設定

- 開始前のカウントダウン（なし / 3 秒 / 5 秒）
- 文ごとの速度の表示（なし / 上に常時 / 下に一瞬）
- まだ打っていないローマ字ガイドを隠す
- ガイドを自分のふだんの打ち方（`shi` / `ji` / `nn` など）に合わせる
- ゴーストのオン・オフと速度（1〜30 打/秒）
- 打鍵音・ミス音の種類と音量

## 動かし方

### 必要なもの

- [Node.js](https://nodejs.org/)
- デスクトップアプリとして動かす場合は、[Rust](https://www.rust-lang.org/) と [Tauri v2 の前提パッケージ](https://v2.tauri.app/ja/start/prerequisites/)、および Tauri CLI（`cargo install tauri-cli`）

### ブラウザで動かす

```bash
npm install
npm run dev
```

<http://localhost:5173> を開きます。記録はブラウザの `localStorage` に保存されます。

### デスクトップアプリとして動かす

```bash
npm install
cargo tauri dev     # 開発用に起動
cargo tauri build   # 配布用にビルド
```

記録はアプリのデータフォルダにある SQLite（`sessions.db`）に保存されます。

Tauri CLI は npm ではなくシステムの `cargo-tauri` を使います。`npm run tauri` ではなく `cargo tauri ...` で実行してください。

### Linux での注意

- **画面が真っ白・真っ黒になる場合** — 環境変数 `WEBKIT_DISABLE_DMABUF_RENDERER=1` が必要です。リポジトリの `.envrc` に書いてあるので、[direnv](https://direnv.net/) を許可するか、起動前に手で export してください。
- **打鍵音が鳴らない場合** — 起動時に `GStreamer element autoaudiosink not found` と出るなら、GStreamer のプラグインが足りません。Arch Linux なら `sudo pacman -S gst-plugins-good` で入ります。

## 開発

```bash
npm test          # フロントエンドのテスト (Vitest)
npm run lint      # oxlint
npm run build     # 型チェック (tsc -b) とビルド
(cd src-tauri && cargo test)   # SQLite まわりのテスト
```

構成は次のとおりです。

- `src/` — React 19 + Vite のフロントエンド。ルーターや状態管理ライブラリは使っていません。
  - `romaji/` — かな → ローマ字の表と、入力を判定するエンジン
  - `texts/` — 出題する文（通常・最適化・長文）
  - `analysis.ts` / `misses.ts` / `review.ts` / `spelling.ts` / `drill.ts` — 記録から分析結果を出す純粋関数
- `src-tauri/` — Rust 側。記録の保存・読み込み・削除だけを受け持ちます。

モジュールごとの詳しい説明は [`CLAUDE.md`](CLAUDE.md) にあります（英語）。

## ライセンス

[MIT License](LICENSE) です。

同梱している打鍵音・ミス音は、それぞれ元のライセンスに従います。ライセンス全文は [`src/assets/sounds/`](src/assets/sounds/) にあります。

- 打鍵音 — [tplai/kbsim](https://github.com/tplai/kbsim)（MIT License, Copyright (c) Thomas Lai）
- ミス音 — [Kenney](https://www.kenney.nl/) Interface Sounds（CC0）
