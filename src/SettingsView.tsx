import { useEffect } from 'react'
import { COUNTDOWN_OPTIONS, type Settings } from './settings'

type Props = {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
}

export default function SettingsView({ settings, onChange, onBack }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onBack])

  return (
    <main className="page">
      <header className="page-head">
        <h2>設定</h2>
        <button onClick={onBack}>ホーム (Esc)</button>
      </header>

      <section className="panel settings">
        <div className="setting">
          <div>
            <span className="setting-label">開始前のカウントダウン</span>
            <p className="note">カウントダウン中は入力を受け付けません。計測は最初の打鍵から始まります</p>
          </div>
          <div className="segmented">
            {COUNTDOWN_OPTIONS.map((n) => (
              <button
                key={n}
                className={n === settings.countdownSec ? 'on' : ''}
                onClick={() => onChange({ ...settings, countdownSec: n })}
              >
                {n === 0 ? 'なし' : `${n} 秒`}
              </button>
            ))}
          </div>
        </div>

        <label className="setting">
          <div>
            <span className="setting-label">文ごとの速度を表示</span>
            <p className="note">文を打ち終えるたびに、その文の速度 (打/秒) をプレイ画面に表示します</p>
          </div>
          <input
            type="checkbox"
            checked={settings.sentenceKps}
            onChange={(e) => onChange({ ...settings, sentenceKps: e.target.checked })}
          />
        </label>
      </section>
    </main>
  )
}
