# Anchor System: Auto-Adjust Engine

## 1. Core Concept: The Study Triangle

```
Total Remaining = Days Remaining × Daily Velocity
```

Locking one variable (the "anchor") determines how the other two behave:

| Anchor | Locked Variable | Adjusts |
|---|---|---|
| **Velocity** (`pagesPerDay`) | Daily pace | End date shifts |
| **Deadline** (`endDate`) | End date | Daily pace adjusts |

---

## 2. Anchor Modes

### 2.1 Velocity Anchor

**Invariant:** `pagesPerDay` is locked. End date shifts.

```
consumed = sum(dailyLog.pagesRead for all past dates)
remaining = totalPages - consumed
pace = plan.pagesPerDay  // LOCKED

neededDays = ceil(remaining / pace)
endDate = nthStudyDay(today, neededDays, studyDays)
```

**Effects:**
- Log less than planned → end date shifts later
- Log more than planned → end date shifts earlier
- Skip a day → end date shifts later
- Edit pace → end date shifts accordingly

### 2.2 Deadline Anchor

**Invariant:** `targetEndDate` is locked. Pace adjusts.

```
consumed = sum(dailyLog.pagesRead for all past dates)
remaining = totalPages - consumed
endDate = plan.targetEndDate  // LOCKED

available = countStudyDays(today, endDate, studyDays)
pace = max(1, ceil(remaining / available))
```

**Effects:**
- Log less → pace increases (must read more per day)
- Log more → pace decreases (can ease up)
- Skip a day → pace increases (fewer days left)

---

## 3. Queue-Based Page Sequence

### 3.1 Page Sequence Builder

```typescript
function buildPageSequence(plan, orderedChapters):
  // Start from startingChapterId within the reordered list
  startIdx = orderedChapters.findIndex(ch => ch.id === plan.startingChapterId)
  activeChapters = orderedChapters.slice(startIdx)
  
  for each chapter in activeChapters:
    startPage = plan.chapterStartOverrides[ch.id] ?? 1
    for p from startPage to ch.pages:
      seq.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        unit: ch.unitId,
        unitName: ch.unitName,
        pageNum: p,
        color: ch.color,
        bookPageStart: ch.bookPageStart ? ch.bookPageStart + p - 1 : undefined
      })
  
  return seq  // Fixed queue — never modified after creation
```

### 3.2 Day Slicer with Queue Pointer

```
pageIdx = 0  // Global pointer into pageSequence

For each study day:
  // Determine slice sizes
  if day is past and has dailyLog entry:
    effectiveSliceSize = dailyLog[date].pagesRead
    plannedSliceSize = effectiveSliceSize
  else if day is past and no dailyLog:
    effectiveSliceSize = 0      // Pointer does NOT advance
    plannedSliceSize = resolvedPagesPerDay  // Display shows planned chapters
  else:  // future day
    effectiveSliceSize = resolvedPagesPerDay
    plannedSliceSize = effectiveSliceSize
  
  // Slice for display
  dayPages = pageSequence.slice(pageIdx, pageIdx + plannedSliceSize)
  
  // Advance pointer
  pageIdx += effectiveSliceSize
```

**Why `effectiveSliceSize = 0` for past unlogged days?**  
Prevents the schedule from jumping ahead when the user hasn't logged past days.
The calendar still shows what *would* have been planned for visual continuity.

---

## 4. Custom Unit Ordering

Each plan stores `unitOrder: number[]` — the sequence of unit IDs.

```typescript
function getOrderedChapters(course, unitOrder):
  orderedUnits = unitOrder.map(id => course.units.find(u => u.id === id))
  return orderedUnits.flatMap(u => u.chapters)
```

**Used everywhere:** `generateSchedule()`, `buildPageSequence()`, plan creation/edit forms.

**Known limitation:** Changing `unitOrder` mid-stream rebuilds the queue from scratch.
Past completed days retroactively display chapters from the new order (cosmetic only —
consumption math via `dailyLog.pagesRead` is always correct).

---

## 5. Book Page Display

Each queue position maps to a book page:
```
bookPageStart = ch.bookPageStart + pageNum - 1
```

**Known issue:** Some course JSONs (e.g. CISSP) lack `bookPageStart` on chapters.
The fallback `?? 1` causes the log window to show "Pages 1–1" instead of actual ranges.

---

## 6. Consumption Model

```
pagesConsumedBeforeToday(plan, today):
  for each date from plan.startDate to today:
    if date has dailyLog entry:
      consumed += dailyLog[date].pagesRead
    // No else — unlogged/skipped days contribute 0
  
  return consumed
```

**Key:** Only `dailyLog` entries count. No `completedDays` field exists.
No phantom consumption for unlogged days.

---

## 7. Edge Cases

| Scenario | Behavior |
|---|---|
| Deadline already passed | `isFeasible = false`, fallback to stored pace, warn user |
| Zero remaining pages | Schedule ends immediately (0 needed days) |
| 0-page logged day | `pagesRead = 0`, pointer stays (pages remain in queue) |
| Page value < scheduleStart | Clamped to 0, toast warning, 0 pages consumed |
| Page value > scheduleEnd | Allowed (ahead of schedule), schedule recalculates |
| All pages sequenced exhausted | Schedule stops generating new days |

---

## 8. Recomputation Triggers

| Trigger | Effect |
|---|---|
| Mark Done commits | consumed recalculates → pace or end date adjusts |
| Plan edited | Full recalculation from new parameters |
| Date changes (new day) | Consumed range extends, schedule may regenerate |
| Plan created/deleted | Full schedule rebuild |
