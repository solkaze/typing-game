// 打鍵音とミス音。音声ファイルは持たず、Web Audio でその場で合成する
export type KeySound = 'off' | 'click' | 'mech' | 'soft' | 'pop'
export type MissSound = 'off' | 'buzz' | 'beep' | 'thud'

export const KEY_SOUND_OPTIONS: { value: KeySound; label: string }[] = [
  { value: 'off', label: 'なし' },
  { value: 'click', label: 'クリック' },
  { value: 'mech', label: 'メカニカル' },
  { value: 'soft', label: '静音' },
  { value: 'pop', label: 'ポップ' },
]

export const MISS_SOUND_OPTIONS: { value: MissSound; label: string }[] = [
  { value: 'off', label: 'なし' },
  { value: 'buzz', label: 'ブザー' },
  { value: 'beep', label: 'ビープ' },
  { value: 'thud', label: '低音' },
]

export const VOLUME_OPTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: '小' },
  { value: 0.5, label: '中' },
  { value: 1, label: '大' },
]

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

// 最初に鳴らすときに作る。ブラウザは操作があるまで音を止めているので、毎回 resume を試す
function audio(): AudioContext | null {
  if (ctx === null) {
    if (typeof AudioContext === 'undefined') return null
    ctx = new AudioContext({ latencyHint: 'interactive' })
    noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// すぐ立ち上がって dur 秒で消える音量の山を作り、出力につなぐ
function envelope(ac: AudioContext, gain: number, dur: number): GainNode {
  const t = ac.currentTime
  const node = ac.createGain()
  node.gain.setValueAtTime(0, t)
  node.gain.linearRampToValueAtTime(gain, t + 0.002)
  node.gain.exponentialRampToValueAtTime(0.001, t + dur)
  node.connect(ac.destination)
  return node
}

// フィルターを通した雑音。キーが当たる「カチッ」の成分
function burst(ac: AudioContext, type: BiquadFilterType, freq: number, dur: number, gain: number) {
  const t = ac.currentTime
  const src = ac.createBufferSource()
  src.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  src.connect(filter).connect(envelope(ac, gain, dur))
  // 毎回同じ波形にならないよう、雑音の途中から鳴らす
  src.start(t, Math.random() * 0.4, dur + 0.01)
}

// from から to へ高さが動く音
function tone(ac: AudioContext, type: OscillatorType, from: number, to: number, dur: number, gain: number) {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  osc.connect(envelope(ac, gain, dur))
  osc.start(t)
  osc.stop(t + dur + 0.01)
}

export function playKey(kind: KeySound, volume: number) {
  if (kind === 'off') return
  const ac = audio()
  if (!ac) return
  // 連打しても機械的に聞こえないよう、高さを少しだけ揺らす
  const v = 0.95 + Math.random() * 0.1
  if (kind === 'click') {
    burst(ac, 'highpass', 3000 * v, 0.02, 0.5 * volume)
  } else if (kind === 'mech') {
    burst(ac, 'bandpass', 2400 * v, 0.03, 0.6 * volume)
    tone(ac, 'sine', 190 * v, 90, 0.06, 0.5 * volume)
  } else if (kind === 'soft') {
    burst(ac, 'lowpass', 900 * v, 0.045, 0.45 * volume)
  } else {
    tone(ac, 'sine', 720 * v, 480, 0.06, 0.4 * volume)
  }
}

export function playMiss(kind: MissSound, volume: number) {
  if (kind === 'off') return
  const ac = audio()
  if (!ac) return
  if (kind === 'buzz') {
    tone(ac, 'sawtooth', 150, 130, 0.16, 0.3 * volume)
  } else if (kind === 'beep') {
    tone(ac, 'triangle', 520, 260, 0.14, 0.5 * volume)
  } else {
    tone(ac, 'sine', 130, 50, 0.18, 0.8 * volume)
    burst(ac, 'lowpass', 400, 0.06, 0.5 * volume)
  }
}
