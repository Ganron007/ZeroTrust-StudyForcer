const TIPS = [
  "Click any study day on the calendar to expand it. Enter the book page number you stopped at, then click Log. Use Skip to defer. Once logged, tap Mark Done to commit. The schedule adjusts automatically.",
  "You can reorder units in plan settings to follow a custom study sequence (e.g., CISSP domain reordering).",
  "Mark Done is the only action that saves to disk. Log and Skip are temporary — they reset on refresh.",
  "Reading ahead? Enter a page number past the day's range — the schedule adjusts automatically.",
  "Skipping a day keeps those pages in the queue for future days. Nothing is lost.",
  "Unlogged past days won't advance your schedule — your place in the queue stays put.",
  "Use the Schedule tab to browse all study days in a compact list view.",
  "Adjust your pages-per-day in plan settings to accelerate or slow down your pace.",
  "The Progress tab shows your overall completion stats and pace trends.",
  "You can create multiple plans for different courses — each has its own queue and pace.",
]

export function createTipPicker() {
  let remaining = [...TIPS]
  let current = 0

  function shuffle(arr: string[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  return {
    next(): string {
      if (remaining.length === 0) {
        remaining = shuffle([...TIPS])
      }
      const tip = remaining.pop()!
      current++
      return tip
    },
    get currentIndex(): number {
      return current
    },
    get total(): number {
      return TIPS.length
    },
  }
}
