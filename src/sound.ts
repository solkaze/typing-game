// 打鍵音とミス音。どちらも公開されている音声ファイル（assets/sounds、出典とライセンスは同じ場所の LICENSE-*）を鳴らす。
// 打鍵音は実機キーボードの録音（kbsim）、ミス音は効果音集（Kenney Interface Sounds）
export type KeySound = 'off' | 'mxbrown' | 'cream' | 'topre' | 'mxblue'
export type MissSound = 'off' | 'error' | 'bong' | 'drop'

type Kind = Exclude<KeySound | MissSound, 'off'>

export const KEY_SOUND_OPTIONS: { value: KeySound; label: string }[] = [
  { value: 'off', label: 'なし' },
  { value: 'mxbrown', label: '茶軸' },
  { value: 'cream', label: 'クリーム' },
  { value: 'topre', label: '静電容量' },
  { value: 'mxblue', label: '青軸' },
]

export const MISS_SOUND_OPTIONS: { value: MissSound; label: string }[] = [
  { value: 'off', label: 'なし' },
  { value: 'error', label: 'エラー' },
  { value: 'bong', label: '低音' },
  { value: 'drop', label: 'ドロップ' },
]

export const VOLUME_OPTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: '小' },
  { value: 0.5, label: '中' },
  { value: 1, label: '大' },
]

// 音声ごとに音量が大きく違うので、同じくらいに聞こえるよう揃える倍率。
// ミス音は打鍵音に埋もれないよう少しだけ大きくしてある
const GAIN: Record<Kind, number> = {
  mxbrown: 1.3,
  cream: 3,
  topre: 10,
  mxblue: 0.8,
  error: 0.5,
  bong: 0.5,
  drop: 0.5,
}

// パスは ./assets/sounds/<種類>/<番号>.mp3。打鍵音は 1 種類につき段ごとに録った 5 つ、ミス音は 1 つ
const FILES = import.meta.glob<string>('./assets/sounds/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})

let ctx: AudioContext | null = null
const samples = new Map<Kind, AudioBuffer[]>()
const loading = new Map<Kind, Promise<AudioBuffer[]>>()

// 最初に鳴らすときに作る。ブラウザは操作があるまで音を止めているので、毎回 resume を試す
function audio(): AudioContext | null {
  if (ctx === null) {
    if (typeof AudioContext === 'undefined') return null
    ctx = new AudioContext({ latencyHint: 'interactive' })
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// 音声を読み込んでデコードする。2 回目以降は同じ結果を返す
function load(ac: AudioContext, kind: Kind): Promise<AudioBuffer[]> {
  let p = loading.get(kind)
  if (!p) {
    const urls = Object.keys(FILES)
      .filter((path) => path.split('/').at(-2) === kind)
      .sort()
      .map((path) => FILES[path])
    p = Promise.all(
      urls.map(async (url) => ac.decodeAudioData(await (await fetch(url)).arrayBuffer())),
    ).then((buffers) => {
      samples.set(kind, buffers)
      return buffers
    })
    // 失敗したら次に鳴らすときにもう一度試す
    p.catch(() => loading.delete(kind))
    loading.set(kind, p)
  }
  return p
}

// vary は高さを揺らす幅。連打する打鍵音が機械的に聞こえないようにする
function sample(ac: AudioContext, kind: Kind, buffers: AudioBuffer[], volume: number, vary: number) {
  if (buffers.length === 0) return
  const src = ac.createBufferSource()
  src.buffer = buffers[Math.floor(Math.random() * buffers.length)]
  src.playbackRate.value = 1 + (Math.random() - 0.5) * vary
  const gain = ac.createGain()
  gain.gain.value = GAIN[kind] * volume
  src.connect(gain).connect(ac.destination)
  src.start()
}

function play(kind: KeySound | MissSound, volume: number, vary: number) {
  if (kind === 'off') return
  const ac = audio()
  if (!ac) return
  const ready = samples.get(kind)
  if (ready) sample(ac, kind, ready, volume, vary)
  else
    load(ac, kind).then(
      (buffers) => sample(ac, kind, buffers, volume, vary),
      () => {},
    )
}

// 最初の 1 打が遅れないよう、先に読み込んでおく
export function prepare(key: KeySound, miss: MissSound) {
  const ac = audio()
  if (!ac) return
  for (const kind of [key, miss]) {
    if (kind !== 'off') load(ac, kind).catch(() => {})
  }
}

export function playKey(kind: KeySound, volume: number) {
  play(kind, volume, 0.06)
}

export function playMiss(kind: MissSound, volume: number) {
  play(kind, volume, 0)
}
