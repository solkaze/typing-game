import { KANA_TABLE, MAX_CHUNK } from './table'

type Option = {
  // このローマ字で消費するかなの文字数
  len: number
  romaji: string
  // 「ん」を n 1打で済ませる打ち方。直後のキーが母音・y・n だと IME 上で別の字になる
  loneN?: boolean
}

type State = { pos: number; buf: string; afterN: boolean }

const N_BLOCKED = 'aiueoyn'
const DOUBLABLE = /^[bcdfghjklmpqrstvwxyz]/

export function normalizeKana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  )
}

// 読み (かな) に対して、IME で実際にその字になる打ち方をすべて受理する。
// 「n の次が n か別の字か」のような曖昧さがあるので、あり得る解釈を State の集合で持つ。
export class Typist {
  readonly kana: string
  typed = ''
  private states: State[] = [{ pos: 0, buf: '', afterN: false }]
  private cache = new Map<number, Option[]>()

  constructor(reading: string) {
    this.kana = normalizeKana(reading)
    for (let i = 0; i < this.kana.length; i++) this.options(i)
  }

  private options(pos: number): Option[] {
    const cached = this.cache.get(pos)
    if (cached) return cached
    const kana = this.kana
    const ch = kana[pos]
    const opts: Option[] = []
    const hasNext = pos + 1 < kana.length

    if (ch === 'ん') {
      const next = hasNext ? this.options(pos + 1) : []
      const usable = next.filter((o) => !N_BLOCKED.includes(o.romaji[0]))
      const lone: Option = { len: 1, romaji: 'n', loneN: true }
      const full = ['nn', 'xn', "n'"].map((romaji) => ({ len: 1, romaji }))
      // 次の字の既定の打ち方が n 1打と両立しないなら、ガイドは nn を優先する
      if (usable.length > 0 && usable[0] === next[0]) opts.push(lone, ...full)
      else if (usable.length > 0) opts.push(...full, lone)
      else opts.push(...full)
    } else {
      if (ch === 'っ' && hasNext) {
        for (const o of this.options(pos + 1)) {
          if (o.loneN || !DOUBLABLE.test(o.romaji)) continue
          opts.push({ len: o.len + 1, romaji: o.romaji[0] + o.romaji })
        }
      }
      for (let len = MAX_CHUNK; len >= 1; len--) {
        if (pos + len > kana.length) continue
        for (const romaji of KANA_TABLE.get(kana.slice(pos, pos + len)) ?? []) {
          opts.push({ len, romaji })
        }
      }
      if (opts.length === 0) {
        if (!/^[\x20-\x7e]$/.test(ch)) {
          throw new Error(`unsupported character in reading: ${ch}`)
        }
        opts.push({ len: 1, romaji: ch })
      }
    }
    this.cache.set(pos, opts)
    return opts
  }

  // 1打鍵を入力する。受理できなければ状態を変えずに false を返す。
  input(key: string): boolean {
    const next = new Map<string, State>()
    for (const s of this.states) {
      if (s.afterN && N_BLOCKED.includes(key)) continue
      const buf = s.buf + key
      for (const o of this.options(s.pos)) {
        if (!o.romaji.startsWith(buf)) continue
        const state =
          o.romaji.length === buf.length
            ? { pos: s.pos + o.len, buf: '', afterN: !!o.loneN }
            : { pos: s.pos, buf, afterN: false }
        next.set(`${state.pos}|${state.buf}|${state.afterN}`, state)
      }
    }
    if (next.size === 0) return false
    this.states = [...next.values()]
    this.typed += key
    return true
  }

  get done(): boolean {
    return this.states.some((s) => s.pos === this.kana.length && s.buf === '')
  }

  private complete(s: State): string {
    let { pos, buf, afterN } = s
    let out = ''
    while (pos < this.kana.length) {
      const o = this.options(pos).find(
        (o) =>
          o.romaji.length > buf.length &&
          o.romaji.startsWith(buf) &&
          !(afterN && buf === '' && N_BLOCKED.includes(o.romaji[0])),
      )
      // options() は続きが必ず存在する状態しか作らない
      if (!o) throw new Error('unreachable typing state')
      out += o.romaji.slice(buf.length)
      pos += o.len
      afterN = !!o.loneN
      buf = ''
    }
    return out
  }

  private best(): { state: State; rest: string } {
    let best: { state: State; rest: string } | undefined
    for (const state of this.states) {
      const rest = this.complete(state)
      if (!best || rest.length < best.rest.length) best = { state, rest }
    }
    return best!
  }

  // これまでの打鍵と矛盾しない、残りの最短のローマ字
  get guide(): string {
    return this.done ? '' : this.best().rest
  }

  // 打ち終えたかなの文字数
  get kanaPos(): number {
    return this.done ? this.kana.length : this.best().state.pos
  }
}

// 既定の打ち方でのローマ字全体
export function defaultRomaji(reading: string): string {
  return new Typist(reading).guide
}
