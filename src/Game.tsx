import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import Ghost from './Ghost'
import { Typist } from './romaji/engine'
import type { SentenceKps } from './settings'
import { playKey, playMiss, prepare, type KeySound, type MissSound } from './sound'
import type { Sentence } from './texts/sentences'
import type { Keystroke, Mode, Session } from './types'

type Props = {
  mode: Mode
  // 長文モードの文章の題
  title?: string
  sentences: Sentence[]
  // エンドレスモード: この回数ミスしたら終わり
  missLimit?: number
  // エンドレスモード: 文が尽きる前に呼んで続きをもらう。last は今ある最後の文
  more?: (last: Sentence) => Sentence[]
  // 開始前のカウントダウン秒数。0 ならすぐ打てる
  countdownSec: number
  sentenceKps: SentenceKps
  // まだ打っていないローマ字を隠す
  hideGuide: boolean
  // ゴーストの速度 (打/秒)。無ければゴーストを出さない
  ghostKps?: number
  // かな -> ガイドで優先する打ち方
  prefer?: ReadonlyMap<string, string>
  keySound: KeySound
  missSound: MissSound
  volume: number
  onFinish: (session: Session) => void
  onAbort: () => void
}

type Run = {
  // エンドレスでは打ち進むにつれて継ぎ足す
  sentences: Sentence[]
  typists: Typist[]
  index: number
  startedAt: string
  // 打鍵の時刻の起点 (カウントダウンが終わって最初の文を出した時刻)。performance.now() と同じ時計
  origin: number | null
  keystrokes: Keystroke[]
  correct: number
  misses: number
  kanaDone: number
  // 打ち終えた文の、1打鍵目から打ち終えるまでの時間の合計。経過時間の表示に使う
  typedMs: number
  // いまの文の計測の起点 (その文の1打鍵目の時刻。まだ打っていなければ null) と、正打鍵の数
  sentenceOrigin: number | null
  sentenceCorrect: number
  // sentenceCorrect のうち、起点ちょうどに打ったので時間を測れない打鍵の数 (文の1打鍵目が正打なら 1)
  sentenceUntimed: number
  // 直前に打ち終えた文の速度 (打/秒)。review.ts・全体の速度と同じく、その文の1打鍵目から測る
  lastKps: number | null
}

function newRun(sentences: Sentence[], prefer?: ReadonlyMap<string, string>): Run {
  return {
    sentences: [...sentences],
    typists: sentences.map((s) => new Typist(s.reading, prefer)),
    index: 0,
    startedAt: '',
    origin: null,
    keystrokes: [],
    correct: 0,
    misses: 0,
    kanaDone: 0,
    typedMs: 0,
    sentenceOrigin: null,
    sentenceCorrect: 0,
    sentenceUntimed: 0,
    lastKps: null,
  }
}

export default function Game({
  mode,
  title,
  sentences: initial,
  missLimit,
  more,
  countdownSec,
  sentenceKps,
  hideGuide,
  ghostKps,
  prefer,
  keySound,
  missSound,
  volume,
  onFinish,
  onAbort,
}: Props) {
  const run = useRef<Run>(null)
  if (run.current === null) run.current = newRun(initial, prefer)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [elapsed, setElapsed] = useState(0)
  const [imeOn, setImeOn] = useState(false)
  const [missTick, setMissTick] = useState(0)
  const [count, setCount] = useState(countdownSec)

  // カウントダウンの間に音を読み込んでおく
  useEffect(() => prepare(keySound, missSound), [keySound, missSound])

  // 打鍵の時刻はカウントダウンが終わって文を出した時から記録する (1文目を読む時間も残すため)。
  // 速度とタイムは文ごとに、その文の1打鍵目から測る。
  // 打鍵を受ける effect より先に置き、カウントダウン明けの最初の打鍵より前に起点が決まるようにする
  useEffect(() => {
    if (count > 0) {
      const id = setTimeout(() => setCount((n) => n - 1), 1000)
      return () => clearTimeout(id)
    }
    const r = run.current!
    if (r.origin !== null) return
    r.origin = performance.now()
    r.startedAt = new Date().toISOString()
  }, [count])

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
      // カウントダウン中の打鍵は記録にも残さない
      if (count > 0) return

      const t = e.timeStamp - r.origin!
      const typist = r.typists[r.index]
      const expected = typist.guide[0]
      const kanaPos = typist.kanaPos
      const ok = typist.input(e.key)
      if (ok) playKey(keySound, volume)
      else playMiss(missSound, volume)
      r.keystrokes.push({ t, key: e.key, code: e.code, ok, expected, sentence: r.index, kanaPos })
      if (r.sentenceOrigin === null) {
        // この文はここから測り始める。正打ならこの打鍵自体は時間を測れないので速度に数えない
        r.sentenceOrigin = t
        r.sentenceUntimed = ok ? 1 : 0
      }

      const finish = () =>
        onFinish({
          mode,
          title,
          missLimit,
          completed: missLimit === undefined ? undefined : r.index,
          startedAt: r.startedAt,
          // エンドレスは文の途中で終わるので、そこまでに打てたかなも数える
          kanaCount: r.kanaDone + (typist.done ? 0 : typist.kanaPos),
          durationMs: t,
          correct: r.correct,
          misses: r.misses,
          // 継ぎ足して先読みしただけの文は残さない
          texts: r.sentences.slice(0, r.index + 1).map((s) => s.text),
          keystrokes: r.keystrokes,
        })

      if (!ok) {
        r.misses++
        if (missLimit !== undefined && r.misses >= missLimit) {
          finish()
          return
        }
        setMissTick((n) => n + 1)
        return
      }
      r.correct++
      r.sentenceCorrect++
      if (typist.done) {
        const span = t - r.sentenceOrigin!
        r.lastKps = span > 0 ? ((r.sentenceCorrect - r.sentenceUntimed) / span) * 1000 : null
        r.typedMs += span
        r.sentenceOrigin = null
        r.sentenceCorrect = 0
        r.sentenceUntimed = 0
        r.kanaDone += typist.kana.length
        r.index++
        // 次の文の予告まで出せるよう、1文先まで用意しておく
        if (more && r.index + 1 >= r.sentences.length) {
          const added = more(r.sentences[r.sentences.length - 1])
          r.sentences.push(...added)
          r.typists.push(...added.map((s) => new Typist(s.reading, prefer)))
        }
      }
      if (r.index === r.typists.length) {
        finish()
        return
      }
      redraw()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, title, missLimit, more, prefer, count, keySound, missSound, volume, onFinish, onAbort])

  useEffect(() => {
    const id = setInterval(() => {
      // 速度と同じく、文ごとに1打鍵目から打ち終えるまでの時間だけを足していく (文を読む間は止まる)
      const { origin, typedMs, sentenceOrigin } = run.current!
      if (origin === null) return
      setElapsed(typedMs + (sentenceOrigin === null ? 0 : performance.now() - origin - sentenceOrigin))
    }, 100)
    return () => clearInterval(id)
  }, [])

  const r = run.current
  const sentences = r.sentences
  const index = Math.min(r.index, sentences.length - 1)
  const typist = r.typists[index]
  const kanaTotal = r.typists.reduce((n, t) => n + t.kana.length, 0)
  const kanaNow = r.kanaDone + (typist.done ? 0 : typist.kanaPos)
  const next = sentences[index + 1]
  const long = mode === 'long'
  const endless = missLimit !== undefined

  // 長文では、いま打っている文が枠の中ほどに来るよう送る。行が上下で切れないよう行の高さ単位で止める
  const passage = useRef<HTMLElement>(null)
  const current = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = passage.current
    const now = current.current
    if (!box || !now) return
    const line = parseFloat(getComputedStyle(box).lineHeight)
    const top = now.offsetTop - (box.clientHeight - now.offsetHeight) / 2
    box.scrollTop = Math.round(top / line) * line
  }, [index])

  return (
    <main className={long ? 'game long' : 'game'}>
      <header className="game-status">
        <span>{endless ? `${kanaNow} かな・${r.index} 文` : `${kanaNow} / ${kanaTotal} かな`}</span>
        <span>{(elapsed / 1000).toFixed(1)} 秒</span>
        <span>{endless ? `ミス ${r.misses} / ${missLimit}` : `ミス ${r.misses}`}</span>
      </header>

      {/* エンドレスには終わりの位置が無いので、残りのミス回数を出す */}
      {endless ? (
        <progress value={missLimit - r.misses} max={missLimit} />
      ) : (
        <progress value={kanaNow} max={kanaTotal} />
      )}

      <p className="game-banner">
        {count > 0 ? (
          <strong key={count} className="countdown">
            {count}
          </strong>
        ) : (
          ' '
        )}
      </p>

      {long && (
        <section ref={passage} className={count > 0 ? 'passage waiting' : 'passage'}>
          {sentences.map((s, i) => (
            <span
              key={i}
              ref={i === index ? current : undefined}
              className={i < index ? 'done' : i === index ? 'now' : undefined}
            >
              {s.text}
            </span>
          ))}
        </section>
      )}

      <section className={count > 0 ? 'sentence waiting' : 'sentence'}>
        {!long && <p className="sentence-text">{sentences[index].text}</p>}
        <p className="sentence-kana">
          <span className="done">{typist.kana.slice(0, typist.kanaPos)}</span>
          {typist.kana.slice(typist.kanaPos)}
        </p>
        <p key={missTick} className={`sentence-romaji${hideGuide ? ' blind' : ''}${missTick > 0 ? ' miss' : ''}`}>
          <span className="done">{typist.typed}</span>
          {/* 隠すときも場所は取っておき、打った文字の位置がずれないようにする */}
          {hideGuide ? <span className="hidden">{typist.guide}</span> : typist.guide}
        </p>
        {ghostKps !== undefined && (
          <Ghost
            // 上のローマ字の行の key (ミスの回数) と同じ数になると取り違えられるので、数だけにしない
            key={`ghost-${index}`}
            kps={ghostKps}
            // 文の1打鍵目と同時に走り出す。その打鍵が正打なら (時間を測れない1打) ゴーストにも
            // 1打先に打たせておき、並ぶ位置を揃える
            origin={
              r.origin !== null && r.sentenceOrigin !== null
                ? r.origin + r.sentenceOrigin - (r.sentenceUntimed * 1000) / ghostKps
                : null
            }
            line={typist.typed + typist.guide}
            correct={r.sentenceCorrect}
            blind={hideGuide}
          />
        )}
      </section>

      {/* 文が替わるたびに作り直して、出て消える動きをやり直す。出し入れで下が動かないよう場所は常に取る */}
      {sentenceKps !== 'off' && (
        <p className="sentence-pop">
          {r.lastKps !== null &&
            (sentenceKps === 'kpm' ? (
              // 単位を取り違えないよう、打/分は色を変える
              <strong key={r.index} className="kpm">
                {Math.round(r.lastKps * 60)}
                <small> 打/分</small>
              </strong>
            ) : (
              <strong key={r.index}>
                {r.lastKps.toFixed(2)}
                <small> 打/秒</small>
              </strong>
            ))}
        </p>
      )}

      {!long && <p className="sentence-next">{next && count <= 0 ? next.text : ' '}</p>}

      <footer className="hint">
        {imeOn ? (
          <strong>日本語入力 (IME) をオフにしてください</strong>
        ) : count > 0 ? (
          'まもなく始まります　Esc: やめる'
        ) : r.keystrokes.length === 0 ? (
          '最初のキーを打つと計測が始まります　Esc: やめる'
        ) : (
          'Esc: やめる'
        )}
      </footer>
    </main>
  )
}
