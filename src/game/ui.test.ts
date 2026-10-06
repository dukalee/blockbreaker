import { describe, expect, it } from 'vitest'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants'
import {
  blinkAlpha,
  createStars,
  EXIT_BUTTON,
  hitTest,
  PAUSE_BUTTON,
  RESTART_BUTTON,
  STAR_COUNT,
  updateStars,
} from './ui'

describe('별 배경', () => {
  it('화면 안에 별을 생성한다', () => {
    const stars = createStars()
    expect(stars).toHaveLength(STAR_COUNT)
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(LOGICAL_WIDTH)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(LOGICAL_HEIGHT)
    }
  })

  it('별은 아래로 흐르고 화면 밖으로 나가면 위에서 다시 나타난다', () => {
    const stars = [{ x: 10, y: LOGICAL_HEIGHT - 1, size: 1, speed: 60, phase: 0 }]
    updateStars(stars, 0.5)
    expect(stars[0].y).toBeCloseTo(29)
  })
})

describe('blinkAlpha', () => {
  it('항상 0~1 범위에서 변하며 시간에 따라 값이 달라진다', () => {
    const values = Array.from({ length: 100 }, (_, i) => blinkAlpha(i * 0.05))
    for (const v of values) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5)
  })
})

describe('hitTest', () => {
  it('버튼 영역 안/밖을 판정한다', () => {
    expect(hitTest(PAUSE_BUTTON, PAUSE_BUTTON.x + 5, PAUSE_BUTTON.y + 5)).toBe(true)
    expect(hitTest(PAUSE_BUTTON, PAUSE_BUTTON.x - 1, PAUSE_BUTTON.y + 5)).toBe(false)
    expect(hitTest(RESTART_BUTTON, 640, RESTART_BUTTON.y + 30)).toBe(true)
    expect(hitTest(EXIT_BUTTON, 640, RESTART_BUTTON.y + 30)).toBe(false)
  })
})
