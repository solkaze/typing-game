// 画面の挙動に関する設定。記録とは別に localStorage に置く (Tauri の webview でも残る)
const KEY = 'typing-game.settings'

export type Settings = {
  // 開始前のカウントダウン秒数。0 ならカウントダウンなし
  countdownSec: number
  // 文を打ち終えるたびに、その文の速度を表示する
  sentenceKps: boolean
}

export const COUNTDOWN_OPTIONS = [0, 3, 5]

export const DEFAULT_SETTINGS: Settings = {
  countdownSec: 3,
  sentenceKps: true,
}

// 項目が増えても古い保存データを読めるよう、項目ごとに既定値で補う
export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      countdownSec: COUNTDOWN_OPTIONS.includes(saved.countdownSec)
        ? saved.countdownSec
        : DEFAULT_SETTINGS.countdownSec,
      sentenceKps: typeof saved.sentenceKps === 'boolean' ? saved.sentenceKps : DEFAULT_SETTINGS.sentenceKps,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
