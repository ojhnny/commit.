import { describe, expect, it } from 'vitest'
import { elapsedMs, formatClock, formatMinutes, minutesInUnit, pauseTimer, resumeTimer, startTimer, suggestedMinutes, timerPhase } from './timer'

describe('habit timer', () => {
  it('counts across pause and resume without counting the paused gap', () => {
    let t = startTimer(0)
    expect(timerPhase(t)).toBe('running')
    expect(elapsedMs(t, 90_000)).toBe(90_000)
    t = pauseTimer(t, 90_000)
    expect(timerPhase(t)).toBe('paused')
    expect(elapsedMs(t, 500_000)).toBe(90_000)
    t = resumeTimer(t, 600_000)
    expect(elapsedMs(t, 630_000)).toBe(120_000)
    expect(timerPhase(undefined)).toBe('idle')
  })

  it('formats the clock and minutes', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(23 * 60_000 + 41_000)).toBe('23:41')
    expect(formatClock(3_725_000)).toBe('1:02:05')
    expect(formatMinutes(24)).toBe('24 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(65)).toBe('1 h 5 min')
  })

  it('suggests rounded minutes (at least one) and converts to the goal unit', () => {
    expect(suggestedMinutes(10_000)).toBe(1)
    expect(suggestedMinutes(23 * 60_000 + 41_000)).toBe(24)
    expect(minutesInUnit({ unit: 'minutes' }, 24)).toBe(24)
    expect(minutesInUnit({ unit: 'hours' }, 24)).toBe(0.4)
    expect(minutesInUnit({ unit: 'hours' }, 20)).toBe(0.33)
  })
})
