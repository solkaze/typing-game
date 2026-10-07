import { readGhostKps } from './ghost'
import {
  KEY_SOUND_OPTIONS,
  MISS_SOUND_OPTIONS,
  VOLUME_OPTIONS,
  type KeySound,
  type MissSound,
} from './sound'

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
  // ガイドのローマ字を、記録から分かるふだんの打ち方 (shi / ji / nn など) に合わせる
  ownSpelling: boolean
  // 決めた速度で打ち続けるゴーストを、自分の打鍵の下に出す
  ghost: boolean
  // ゴーストの速度 (打/秒)
  ghostKps: number
  // 正しく打てたときの打鍵音と、ミスしたときの音
  keySound: KeySound
  missSound: MissSound
  // 音量 (0〜1)
  volume: number
}

export const COUNTDOWN_OPTIONS = [0, 3, 5]

export const DEFAULT_SETTINGS: Settings = {
  countdownSec: 3,
  sentenceKps: 'banner',
  hideGuide: false,
  ownSpelling: false,
  ghost: false,
  ghostKps: 8,
  keySound: 'off',
  missSound: 'off',
  volume: 0.5,
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
      ownSpelling: typeof saved.ownSpelling === 'boolean' ? saved.ownSpelling : DEFAULT_SETTINGS.ownSpelling,
      ghost: typeof saved.ghost === 'boolean' ? saved.ghost : DEFAULT_SETTINGS.ghost,
      ghostKps: readGhostKps(saved.ghostKps, DEFAULT_SETTINGS.ghostKps),
      keySound: KEY_SOUND_OPTIONS.find((o) => o.value === saved.keySound)?.value ?? DEFAULT_SETTINGS.keySound,
      missSound:
        MISS_SOUND_OPTIONS.find((o) => o.value === saved.missSound)?.value ?? DEFAULT_SETTINGS.missSound,
      volume: VOLUME_OPTIONS.find((o) => o.value === saved.volume)?.value ?? DEFAULT_SETTINGS.volume,
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
