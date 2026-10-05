// 標準運指で同じ指が受け持つキーの組 (左小指 → 右小指)
const FINGERS = ['qaz', 'wsx', 'edc', 'rfvtgb', 'yhnujm', 'ik,', 'ol.', 'p-/']

const FINGER_OF = new Map<string, number>()
FINGERS.forEach((keys, finger) => {
  for (const key of keys) FINGER_OF.set(key, finger)
})

// 隣り合う2打鍵のうち、同じ指で別のキーを続けて打つものの割合。
// これが高い文ほど、つづりや運指を変えないと打ちにくい。同じキーの連打は数えない
export function sameFingerRate(romaji: string): number {
  let same = 0
  for (let i = 1; i < romaji.length; i++) {
    const a = romaji[i - 1]
    const b = romaji[i]
    if (a !== b && FINGER_OF.has(a) && FINGER_OF.get(a) === FINGER_OF.get(b)) same++
  }
  return romaji.length > 1 ? same / (romaji.length - 1) : 0
}
