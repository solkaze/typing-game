import { useEffect, useReducer, useRef, useState } from 'react'
import { Typist } from './romaji/engine'
import type { Sentence } from './texts/sentences'
import type { Keystroke, Session } from './types'

type Props = {
  sentences: Sentence[]
  onFinish: (session: Session) => void
  onAbort: () => void
}

type Run = {
  typists: Typist[]
  index: number
  startedAt: string
  // 1打鍵目の KeyboardEvent.timeStamp
  origin: number | null
  keystrokes: Keystroke[]
  correct: number
  misses: number
  kanaDone: number
}

function newRun(sentences: Sentence[]): Run {
  return {
    typists: sentences.map((s) => new Typist(s.reading)),
    index: 0,
    startedAt: '',
    origin: null,
    keystrokes: [],
    correct: 0,
    misses: 0,
    kanaDone: 0,
  }
}

export default function Game({ sentences, onFinish, onAbort }: Props) {
  const run = useRef<Run>(null)
  if (run.current === null) run.current = newRun(sentences)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [elapsed, setElapsed] = useState(0)
  const [imeOn, setImeOn] = useState(false)
  const [missTick, setMissTick] = useState(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const r = run.current!
      if (e.key === 'Escape') {
        onAbort()
        return
      }
      if (e.isComposing || e.key === 'Process') {
        setImeOn(true)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.repeat) return
      e.preventDefault()
      setImeOn(false)

      if (r.origin === null) {
        r.origin = e.timeStamp
        r.startedAt = new Date().toISOString()
      }
      const t = e.timeStamp - r.origin
      const typist = r.typists[r.index]
      const expected = typist.guide[0]
      const kanaPos = typist.kanaPos
      const ok = typist.input(e.key)
      r.keystrokes.push({ t, key: e.key, code: e.code, ok, expected, sentence: r.index, kanaPos })

      if (!ok) {
        r.misses++
        setMissTick((n) => n + 1)
        return
      }
      r.correct++
      if (typist.done) {
        r.kanaDone += typist.kana.length
        r.index++
      }
      if (r.index === r.typists.length) {
        onFinish({
          startedAt: r.startedAt,
          kanaCount: r.kanaDone,
          durationMs: t,
          correct: r.correct,
          misses: r.misses,
          texts: sentences.map((s) => s.text),
          keystrokes: r.keystrokes,
        })
        return
      }
      redraw()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sentences, onFinish, onAbort])

  useEffect(() => {
    const id = setInterval(() => {
      const origin = run.current!.origin
      if (origin !== null) setElapsed(performance.now() - origin)
    }, 100)
    return () => clearInterval(id)
  }, [])

  const r = run.current
  const index = Math.min(r.index, sentences.length - 1)
  const typist = r.typists[index]
  const kanaTotal = r.typists.reduce((n, t) => n + t.kana.length, 0)
  const kanaNow = r.kanaDone + (typist.done ? 0 : typist.kanaPos)
  const next = sentences[index + 1]

  return (
    <main className="game">
      <header className="game-status">
        <span>
          {kanaNow} / {kanaTotal} かな
        </span>
        <span>{(elapsed / 1000).toFixed(1)} 秒</span>
        <span>ミス {r.misses}</span>
      </header>

      <progress value={kanaNow} max={kanaTotal} />

      <section className="sentence">
        <p className="sentence-text">{sentences[index].text}</p>
        <p className="sentence-kana">
          <span className="done">{typist.kana.slice(0, typist.kanaPos)}</span>
          {typist.kana.slice(typist.kanaPos)}
        </p>
        <p key={missTick} className={missTick > 0 ? 'sentence-romaji miss' : 'sentence-romaji'}>
          <span className="done">{typist.typed}</span>
          {typist.guide}
        </p>
      </section>

      <p className="sentence-next">{next ? next.text : ' '}</p>

      <footer className="hint">
        {imeOn ? (
          <strong>日本語入力 (IME) をオフにしてください</strong>
        ) : r.origin === null ? (
          '最初のキーを打つと計測が始まります　Esc: やめる'
        ) : (
          'Esc: やめる'
        )}
      </footer>
    </main>
  )
}
