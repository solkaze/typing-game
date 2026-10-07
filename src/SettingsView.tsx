import { useEffect } from 'react'
import { GHOST_KPS_MAX, GHOST_KPS_MIN, GHOST_KPS_STEP } from './ghost'
import { COUNTDOWN_OPTIONS, SENTENCE_KPS_OPTIONS, type Settings } from './settings'
import { KEY_SOUND_OPTIONS, MISS_SOUND_OPTIONS, VOLUME_OPTIONS, playKey, playMiss } from './sound'

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
    <main className="page narrow">
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

        <div className="setting">
          <div>
            <span className="setting-label">文ごとの速度を表示</span>
            <p className="note">
              文を打ち終えるたびに、その文の速度 (打/秒) を表示します。「下に一瞬」は文のすぐ下に大きく出て消えます
            </p>
          </div>
          <div className="segmented">
            {SENTENCE_KPS_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={o.value === settings.sentenceKps ? 'on' : ''}
                onClick={() => onChange({ ...settings, sentenceKps: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <label className="setting">
          <div>
            <span className="setting-label">ローマ字ガイドを隠す</span>
            <p className="note">まだ打っていないローマ字を表示せず、打った文字だけを表示します</p>
          </div>
          <input
            type="checkbox"
            checked={settings.hideGuide}
            onChange={(e) => onChange({ ...settings, hideGuide: e.target.checked })}
          />
        </label>

        <label className="setting">
          <div>
            <span className="setting-label">ガイドを自分の打ち方に合わせる</span>
            <p className="note">
              直近の記録でよく使っている打ち方 (shi / ji / nn など) をガイドに出します。どの打ち方でも入力は受け付けます
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.ownSpelling}
            onChange={(e) => onChange({ ...settings, ownSpelling: e.target.checked })}
          />
        </label>
      </section>

      <section className="panel settings">
        <div className="setting">
          <div>
            <span className="setting-label">ゴースト</span>
            <p className="note">
              決めた速度で打つ相手を、自分のローマ字のすぐ下に流します。文ごとに、最初の1打と同時に打ち始めます。文を打ち終えたときに前にいれば、その文の速度が目標を上回っています
            </p>
          </div>
          <div className="ghost-setting">
            <label>
              {/* 打っている途中の値 (空や範囲の外) は保存せず、フォーカスが外れたら保存済みの値に戻す */}
              <input
                type="number"
                min={GHOST_KPS_MIN}
                max={GHOST_KPS_MAX}
                step={GHOST_KPS_STEP}
                defaultValue={settings.ghostKps}
                onChange={(e) => {
                  const n = e.target.valueAsNumber
                  if (n >= GHOST_KPS_MIN && n <= GHOST_KPS_MAX) onChange({ ...settings, ghostKps: n })
                }}
                onBlur={(e) => {
                  e.target.value = String(settings.ghostKps)
                }}
              />
              打/秒
            </label>
            <input
              type="checkbox"
              aria-label="ゴーストを出す"
              checked={settings.ghost}
              onChange={(e) => onChange({ ...settings, ghost: e.target.checked })}
            />
          </div>
        </div>
      </section>

      <section className="panel settings">
        <div className="setting">
          <div>
            <span className="setting-label">打鍵音</span>
            <p className="note">正しく打てたときに鳴らします。選ぶと試聴できます</p>
          </div>
          <div className="segmented">
            {KEY_SOUND_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={o.value === settings.keySound ? 'on' : ''}
                onClick={() => {
                  onChange({ ...settings, keySound: o.value })
                  playKey(o.value, settings.volume)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div>
            <span className="setting-label">ミス音</span>
            <p className="note">打ち間違えたときに鳴らします</p>
          </div>
          <div className="segmented">
            {MISS_SOUND_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={o.value === settings.missSound ? 'on' : ''}
                onClick={() => {
                  onChange({ ...settings, missSound: o.value })
                  playMiss(o.value, settings.volume)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting-label">音量</span>
          <div className="segmented">
            {VOLUME_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={o.value === settings.volume ? 'on' : ''}
                onClick={() => {
                  onChange({ ...settings, volume: o.value })
                  // 打鍵音が「なし」ならミス音で確かめられるようにする
                  if (settings.keySound !== 'off') playKey(settings.keySound, o.value)
                  else playMiss(settings.missSound, o.value)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
