import { getTips, type PersonalityMode } from "./personality"

export function createTipPicker(initialMode: PersonalityMode = "standard") {
  let mode = initialMode
  let tips = [...getTips(mode)]
  let current = 0

  function shuffle(arr: string[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // Re-shuffle on first use
  tips = shuffle(tips)

  return {
    next(): string {
      if (tips.length === 0) {
        tips = shuffle([...getTips(mode)])
        current = 0
      }
      const tip = tips.pop()!
      current++
      return tip
    },
    get currentIndex(): number {
      return current
    },
    get total(): number {
      return getTips(mode).length
    },
    /** Update mode and re-seed the tip pool */
    setMode(newMode: PersonalityMode) {
      mode = newMode
      tips = shuffle([...getTips(mode)])
      current = 0
    },
  }
}
