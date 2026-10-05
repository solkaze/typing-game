import { PASSAGES, type Passage } from './passages'
import { SENTENCES, type Sentence } from './sentences'

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function fill(pool: Sentence[], target: number): Sentence[] {
  const picked: Sentence[] = []
  let rest = target
  for (const s of pool) {
    if (s.reading.length <= rest) {
      picked.push(s)
      rest -= s.reading.length
    }
  }
  return picked
}

const total = (picked: Sentence[]) =>
  picked.reduce((sum, s) => sum + s.reading.length, 0)

// 読みの合計がちょうど kanaCount になる文の組を無作為に選ぶ。
// 記録どうしを比べられるよう、長さは打鍵数ではなくかな文字数で揃える。
// ちょうどにならなかった場合は、届く範囲で最も近い組を返す。
export function pickSentences(
  kanaCount: number,
  random: () => number = Math.random,
  pool: readonly Sentence[] = SENTENCES,
): Sentence[] {
  let best: Sentence[] = []
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked = fill(shuffled(pool, random), kanaCount)
    if (total(picked) > total(best)) best = picked
    if (total(best) === kanaCount) break
  }
  return shuffled(best, random)
}

// 長文を1本選ぶ。title を指定すればその文章、無ければ avoid 以外から無作為に選ぶ
export function pickPassage(
  title: string | null,
  avoid: string | null = null,
  random: () => number = Math.random,
  pool: readonly Passage[] = PASSAGES,
): Passage {
  const chosen = pool.find((p) => p.title === title)
  if (chosen) return chosen
  const rest = pool.filter((p) => p.title !== avoid)
  const from = rest.length > 0 ? rest : pool
  return from[Math.floor(random() * from.length)]
}
