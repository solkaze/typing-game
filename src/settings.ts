// 画面の挙動に関する設定。記録とは別に localStorage に置く (Tauri の webview でも残る)
const KEY = 'typing-game.settings'

// 文ごとの速度の出し方。banner: 上に出したままにする / pop: 文の下に一瞬出して消す
export type SentenceKps = 'off' | 'banner' | 'pop'

export const SENTENCE_KPS_OPTIONS: { value: SentenceKps; label: string }[] = [
  { value: 'off', label: 'なし' },
  { value: 'banner', label: '上に常時' },
  { value: 'pop', label: '下に一瞬' },
]

export type Settings = {
  // 開始前のカウントダウン秒数。0 ならカウントダウンなし
  countdownSec: number
  // 文を打ち終えるたびに、その文の速度を表示する
  sentenceKps: SentenceKps
  // まだ打っていないローマ字のガイドを隠し、打った分だけ表示する
  hideGuide: boolean
}

export const COUNTDOWN_OPTIONS = [0, 3, 5]

export const DEFAULT_SETTINGS: Settings = {
  countdownSec: 3,
  sentenceKps: 'banner',
  hideGuide: false,
}

// 項目が増えても古い保存データを読めるよう、項目ごとに既定値で補う
export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      countdownSec: COUNTDOWN_OPTIONS.includes(saved.countdownSec)
        ? saved.countdownSec
        : DEFAULT_SETTINGS.countdownSec,
      sentenceKps: readSentenceKps(saved.sentenceKps),
      hideGuide: typeof saved.hideGuide === 'boolean' ? saved.hideGuide : DEFAULT_SETTINGS.hideGuide,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// 以前は表示する / しないの真偽値だったので、その保存データも読む
function readSentenceKps(saved: unknown): SentenceKps {
  if (typeof saved === 'boolean') return saved ? 'banner' : 'off'
  return SENTENCE_KPS_OPTIONS.find((o) => o.value === saved)?.value ?? DEFAULT_SETTINGS.sentenceKps
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
