import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AnalysisView from './AnalysisView'
import { pickDrill, plan } from './drill'
import Game from './Game'
import HistoryCharts from './HistoryCharts'
import type { Range } from './range'
import Result from './Result'
import { loadSettings, saveSettings, type Settings } from './settings'
import { preferred, spellings } from './spelling'
import SettingsView from './SettingsView'
import { deleteSession, loadSessions, saveSession } from './storage'
import { OPTIMIZE_SENTENCES } from './texts/optimize'
import { PASSAGES } from './texts/passages'
import { pickPassage, pickRound, pickSentences } from './texts/pick'
import { SENTENCES, type Sentence } from './texts/sentences'
import { MODES, modeLabel, modeOf, type Mode, type Session } from './types'

type View =
  | { name: 'home' }
  | { name: 'play'; mode: Mode; title?: string; missLimit?: number; sentences: Sentence[]; run: number }
  | { name: 'result'; session: Session; saveError: string | null }
  | { name: 'analysis' }
  | { name: 'settings' }

const KANA_COUNTS = [100, 200, 400]
const COUNT_KEY = 'typing-game.kanaCount'
const MODE_KEY = 'typing-game.mode'
const PASSAGE_KEY = 'typing-game.passage'
// エンドレスモードで、終わりにするミスの回数
const MISS_LIMITS = [3, 5, 10, 20]
const MISS_KEY = 'typing-game.missLimit'
// 弱点とふだんの打ち方を調べるのに使う直近の記録の数。古い癖を引きずらないよう絞る
const RECENT_SESSIONS = 30
// ホームに出す狙いの2連の数
const DRILL_SHOWN = 8

const MODE_NOTES: Record<Mode, string> = {
  standard: '短い文を、決めたかな数だけ打ちます。',
  optimize: '同じ指が続く並びを詰め込んだ文です。ガイド以外のつづり (ca / fu / ji など) も受け付けます。',
  long: 'ひと続きの文章を最後まで打ち切ります。',
  endless: '決めた回数ミスするまで、短い文を打ち続けます。打てたかな数が記録になります。',
  weak: 'これまでの記録で遅い並び・打ち間違えやすい並びが多く入った文を選んで出します。',
}

function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [kanaCount, setKanaCount] = useState(() => {
    const saved = Number(localStorage.getItem(COUNT_KEY))
    return KANA_COUNTS.includes(saved) ? saved : 200
  })

  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem(MODE_KEY)
    return MODES.find((m) => m.id === saved)?.id ?? 'standard'
  })
  // 長文モードで打つ文章の題。null はおまかせ
  const [passage, setPassage] = useState<string | null>(() => {
    const saved = localStorage.getItem(PASSAGE_KEY)
    return PASSAGES.some((p) => p.title === saved) ? saved : null
  })
  const [missLimit, setMissLimit] = useState(() => {
    const saved = Number(localStorage.getItem(MISS_KEY))
    return MISS_LIMITS.includes(saved) ? saved : 10
  })
  // おまかせで同じ文章が続かないよう、直前に出した題を覚えておく
  const lastPassage = useRef<string | null>(null)

  const [settings, setSettings] = useState(loadSettings)
  // ホームの履歴グラフの表示範囲。null は全体
  const [range, setRange] = useState<Range | null>(null)

  // 速度の水準がモードで違うので、推移も分析も選んでいるモードの記録だけで見る。
  // エンドレスは打てるかな数がミスの上限で変わるので、上限も揃える
  const shown = useMemo(
    () => sessions.filter((s) => modeOf(s) === mode && (mode !== 'endless' || s.missLimit === missLimit)),
    [sessions, mode, missLimit],
  )

  // 弱点はモードを問わず直近の記録から拾う。弱点モード自身の記録も入るので、直れば狙いが移る
  const recent = useMemo(() => sessions.slice(-RECENT_SESSIONS), [sessions])
  const drill = useMemo(() => plan(recent), [recent])
  // ふだんの打ち方も、モードを問わず直近の記録から
  const habits = useMemo(() => preferred(spellings(recent)), [recent])

  const shownLabel = mode === 'endless' ? `${modeLabel(mode)} (ミス ${missLimit} 回まで)` : modeLabel(mode)

  useEffect(() => {
    loadSessions().then(setSessions, (e) => setLoadError(String(e)))
  }, [])

  const start = useCallback(() => {
    const run = Date.now()
    if (mode === 'long') {
      const { title, sentences } = pickPassage(passage, lastPassage.current)
      lastPassage.current = title
      setView({ name: 'play', mode, title, sentences, run })
      return
    }
    if (mode === 'endless') {
      setView({ name: 'play', mode, missLimit, sentences: pickRound(), run })
      return
    }
    if (mode === 'weak') {
      setView({ name: 'play', mode, sentences: pickDrill(kanaCount, drill), run })
      return
    }
    const pool = mode === 'optimize' ? OPTIMIZE_SENTENCES : SENTENCES
    setView({ name: 'play', mode, sentences: pickSentences(kanaCount, Math.random, pool), run })
  }, [mode, kanaCount, passage, missLimit, drill])

  const home = useCallback(() => setView({ name: 'home' }), [])

  const finish = useCallback(async (session: Session) => {
    let saveError: string | null = null
    try {
      session = { ...session, id: await saveSession(session) }
      setSessions((prev) => [...prev, session])
      // 直近を見ていたなら、増えた1回ぶん右へずらして最新を含めたままにする
      setRange((r) => r && { from: r.from + 1, to: r.to + 1 })
    } catch (e) {
      saveError = String(e)
    }
    setView({ name: 'result', session, saveError })
  }, [])

  const changeSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const remove = async (id: number) => {
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    home()
  }

  useEffect(() => {
    if (view.name !== 'home') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Enter') start()
      // ホームポジションのまま始められるように Space でも開始する。
      // フォーカス中のボタンが Space で押されないよう既定動作は止める
      if (e.key === ' ') {
        e.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view.name, start])

  if (view.name === 'play') {
    return (
      <Game
        key={view.run}
        mode={view.mode}
        title={view.title}
        sentences={view.sentences}
        missLimit={view.missLimit}
        more={view.mode === 'endless' ? pickRound : undefined}
        countdownSec={settings.countdownSec}
        sentenceKps={settings.sentenceKps}
        hideGuide={settings.hideGuide}
        ghostKps={settings.ghost ? settings.ghostKps : undefined}
        prefer={settings.ownSpelling ? habits : undefined}
        keySound={settings.keySound}
        missSound={settings.missSound}
        volume={settings.volume}
        onFinish={finish}
        onAbort={home}
      />
    )
  }
  if (view.name === 'result') {
    return (
      <Result
        session={view.session}
        sessions={sessions}
        saveError={view.saveError}
        onRetry={start}
        onHome={home}
        onDelete={view.session.id === undefined ? undefined : () => remove(view.session.id!)}
        onAnalysis={() => setView({ name: 'analysis' })}
      />
    )
  }
  if (view.name === 'analysis') {
    return <AnalysisView sessions={shown} label={shownLabel} onBack={home} />
  }
  if (view.name === 'settings') {
    return <SettingsView settings={settings} onChange={changeSettings} onBack={home} />
  }

  return (
    <main className="page">
      <header className="page-head">
        <h1>タイピング練習</h1>
        <button onClick={() => setView({ name: 'settings' })}>設定</button>
      </header>

      <section className="start">
        <div className="mode-tabs">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={m.id === mode ? 'on' : ''}
              onClick={() => {
                setMode(m.id)
                localStorage.setItem(MODE_KEY, m.id)
                // 表示範囲は回の番号で持っているので、記録の並びが変わったら全体に戻す
                setRange(null)
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {/* 選んだモードにぶら下がる項目。モードの下に続けて置く */}
        <div className="mode-body">
          <p className="note">{MODE_NOTES[mode]}</p>
          {mode === 'long' ? (
            // 文章は増えていくので、横に並べずに選ばせる
            <select
              value={passage ?? ''}
              onChange={(e) => {
                const title = e.target.value || null
                setPassage(title)
                localStorage.setItem(PASSAGE_KEY, title ?? '')
                // 選んだあと Space / Enter でそのまま始められるよう、フォーカスを外す
                e.target.blur()
              }}
            >
              <option value="">おまかせ</option>
              {PASSAGES.map((p) => (
                <option key={p.title} value={p.title}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : mode === 'endless' ? (
            <div className="segmented">
              {MISS_LIMITS.map((n) => (
                <button
                  key={n}
                  className={n === missLimit ? 'on' : ''}
                  onClick={() => {
                    setMissLimit(n)
                    localStorage.setItem(MISS_KEY, String(n))
                    setRange(null)
                  }}
                >
                  ミス {n} 回まで
                </button>
              ))}
            </div>
          ) : (
            <div className="segmented">
              {KANA_COUNTS.map((n) => (
                <button
                  key={n}
                  className={n === kanaCount ? 'on' : ''}
                  onClick={() => {
                    setKanaCount(n)
                    localStorage.setItem(COUNT_KEY, String(n))
                  }}
                >
                  {n} かな
                </button>
              ))}
            </div>
          )}
          {mode === 'weak' && (
            <p className="note">
              {drill.targets.length > 0
                ? `いまの狙い: ${drill.targets.slice(0, DRILL_SHOWN).map((t) => t.label).join('　')}`
                : '記録がまだ少ないので、狙いが決まるまでは文を無作為に出します。'}
            </p>
          )}
        </div>
        <div className="launch">
          <button className="primary" onClick={start}>
            スタート
            <small>Space / Enter</small>
          </button>
          <button className="analysis" onClick={() => setView({ name: 'analysis' })}>
            分析を見る
            <small>{shownLabel}</small>
          </button>
        </div>
      </section>

      {loadError && <p className="error">記録を読み込めませんでした: {loadError}</p>}

      {shown.length === 0 ? (
        <p className="note">{sessions.length === 0 ? 'まだ記録がありません' : 'この条件の記録はまだありません'}</p>
      ) : (
        <HistoryCharts
          sessions={shown}
          mode={mode}
          range={range}
          onRange={setRange}
          onSelect={(s) => setView({ name: 'result', session: s, saveError: null })}
        />
      )}
    </main>
  )
}

export default App
