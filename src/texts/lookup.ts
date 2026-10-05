import { OPTIMIZE_SENTENCES } from './optimize'
import { PASSAGES } from './passages'
import { SENTENCES } from './sentences'

const READINGS = new Map(
  [...SENTENCES, ...OPTIMIZE_SENTENCES, ...PASSAGES.flatMap((p) => p.sentences)].map((s) => [s.text, s.reading]),
)

// 記録には文面しか残していないので、読みはどのモードの文かを問わず文面から引く
export const readingOf = (text: string): string | undefined => READINGS.get(text)
