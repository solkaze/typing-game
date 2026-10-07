import { useEffect, useState } from 'react'
import { ghostKeys } from './ghost'

type Props = {
  kps: number
  // いまの文の1打鍵目の KeyboardEvent.timeStamp。まだ打っていなければ null
  origin: number | null
  // いまの文のローマ字 (打った分 + 残りのガイド)。上の行と同じ文字列にして位置を揃える
  line: string
  // いまの文で打った正打鍵の数
  correct: number
  // ガイドを隠す設定のときは、文字を出さず帯だけにする
  blind: boolean
}

// 自分の打鍵の行のすぐ下に、ゴーストが同じ文をどこまで打ったかを流す。
// 文ごとに仕切り直すので、Game は文が替わるたびに key を変えて作り直す。
// 毎フレーム位置を見るが、描き直すのは打鍵数が変わったときだけ。親 (Game) は巻き込まない
export default function Ghost({ kps, origin, line, correct, blind }: Props) {
  // 文の長さで頭打ちにする前の打鍵数
  const [keys, setKeys] = useState(0)

  useEffect(() => {
    if (origin === null) return
    let id = 0
    const tick = () => {
      setKeys(ghostKeys(performance.now() - origin, kps, Infinity))
      id = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(id)
  }, [origin, kps])

  // 途中で打ち方を変えると文の長さが変わるので、頭打ちは描くたびに取り直す
  const pos = origin === null ? 0 : Math.min(keys, line.length)
  const diff = correct - pos

  return (
    <>
      <p className={blind ? 'sentence-romaji ghost blind' : 'sentence-romaji ghost'} aria-hidden="true">
        <span className="ghost-done">{line.slice(0, pos)}</span>
        {/* 残りも場所は取り、上の行と同じ位置で折り返させる */}
        <span className="hidden">{line.slice(pos)}</span>
      </p>
      <p className="ghost-note">
        ゴースト {kps.toFixed(1)} 打/秒
        {origin !== null && (
          <span className={diff >= 0 ? 'ahead' : 'behind'}>
            {diff >= 0 ? `${diff} 打リード` : `${-diff} 打遅れ`}
          </span>
        )}
      </p>
    </>
  )
}
