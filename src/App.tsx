import { useCallback, useEffect, useState } from 'react'
import AnalysisView from './AnalysisView'
import Game from './Game'
import HistoryCharts from './HistoryCharts'
import type { Range } from './range'
import Result from './Result'
import { loadSettings, saveSettings, type Settings } from './settings'
import SettingsView from './SettingsView'
import { deleteSession, loadSessions, saveSession } from './storage'
import { pickSentences } from './texts/pick'
import type { Sentence } from './texts/sentences'
import type { Session } from './types'

type View =
  | { name: 'home' }
  | { name: 'play'; sentences: Sentence[]; run: number }
  | { name: 'result'; session: Session; saveError: string | null }
  | { name: 'analysis' }
  | { name: 'settings' }

const KANA_COUNTS = [100, 200, 400]
const COUNT_KEY = 'typing-game.kanaCount'

function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [kanaCount, setKanaCount] = useState(() => {
    const saved = Number(localStorage.getItem(COUNT_KEY))
    return KANA_COUNTS.includes(saved) ? saved : 200
  })

  const [settings, setSettings] = useState(loadSettings)
  // ホームの履歴グラフの表示範囲。null は全体
  const [range, setRange] = useState<Range | null>(null)

  useEffect(() => {
    loadSessions().then(setSessions, (e) => setLoadError(String(e)))
  }, [])

  const start = useCallback(() => {
    setView({ name: 'play', sentences: pickSentences(kanaCount), run: Date.now() })
  }, [kanaCount])

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
        sentences={view.sentences}
        countdownSec={settings.countdownSec}
        showSentenceKps={settings.sentenceKps}
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
    return <AnalysisView sessions={sessions} onBack={home} />
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
        <button className="primary" onClick={start}>
          スタート (Space / Enter)
        </button>
        <button onClick={() => setView({ name: 'analysis' })}>分析を見る</button>
      </section>

      {loadError && <p className="error">記録を読み込めませんでした: {loadError}</p>}

      {sessions.length === 0 ? (
        <p className="note">まだ記録がありません</p>
      ) : (
        <HistoryCharts
          sessions={sessions}
          range={range}
          onRange={setRange}
          onSelect={(s) => setView({ name: 'result', session: s, saveError: null })}
        />
      )}
    </main>
  )
}

export default App
