import { describe, expect, it } from 'vitest'
import {
  activeEffects,
  applyItem,
  ballSpeedMultiplier,
  createEffects,
  paddleWidth,
  resetBallSpeed,
  scoreMultiplier,
  updateEffects,
} from './effects'
import { ITEM_DURATION_SEC, PADDLE_WIDTH } from './constants'

describe('공 속도 상태 전이', () => {
  it('+를 먹으면 2배, 다시 먹어도 더 빨라지지 않는다', () => {
    const e = createEffects()
    applyItem(e, 'ballSpeedUp')
    expect(ballSpeedMultiplier(e)).toBe(2)
    applyItem(e, 'ballSpeedUp')
    expect(ballSpeedMultiplier(e)).toBe(2)
  })

  it('-를 먹으면 절반, 다시 먹어도 더 느려지지 않는다', () => {
    const e = createEffects()
    applyItem(e, 'ballSpeedDown')
    expect(ballSpeedMultiplier(e)).toBe(0.5)
    applyItem(e, 'ballSpeedDown')
    expect(ballSpeedMultiplier(e)).toBe(0.5)
  })

  it('반대 아이템을 먹으면 기본 속도로 돌아간다 (양방향)', () => {
    const e = createEffects()
    applyItem(e, 'ballSpeedUp')
    applyItem(e, 'ballSpeedDown')
    expect(ballSpeedMultiplier(e)).toBe(1)
    applyItem(e, 'ballSpeedDown')
    applyItem(e, 'ballSpeedUp')
    expect(ballSpeedMultiplier(e)).toBe(1)
  })

  it('지속 시간이 없어 시간이 지나도 유지되고, resetBallSpeed로만 초기화된다', () => {
    const e = createEffects()
    applyItem(e, 'ballSpeedUp')
    updateEffects(e, 100)
    expect(ballSpeedMultiplier(e)).toBe(2)
    resetBallSpeed(e)
    expect(ballSpeedMultiplier(e)).toBe(1)
  })
})

describe('막대 길이 상태 전이', () => {
  it('+는 2배, -는 절반이며 10초 지속된다', () => {
    const e = createEffects()
    applyItem(e, 'paddleLong')
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH * 2)
    expect(e.paddleRemaining).toBe(ITEM_DURATION_SEC)
    const f = createEffects()
    applyItem(f, 'paddleShort')
    expect(paddleWidth(f)).toBe(PADDLE_WIDTH / 2)
  })

  it('10초가 지나면 원래 길이로 돌아온다', () => {
    const e = createEffects()
    applyItem(e, 'paddleLong')
    updateEffects(e, 9.9)
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH * 2)
    updateEffects(e, 0.2)
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH)
    expect(e.paddleRemaining).toBe(0)
  })

  it('반대 아이템은 상쇄되어 기본 길이로 돌아간다 (양방향)', () => {
    const e = createEffects()
    applyItem(e, 'paddleLong')
    applyItem(e, 'paddleShort')
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH)
    expect(e.paddleRemaining).toBe(0)
    applyItem(e, 'paddleShort')
    applyItem(e, 'paddleLong')
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH)
  })

  it('상쇄 후 다시 먹으면 새로 10초 효과가 시작된다', () => {
    const e = createEffects()
    applyItem(e, 'paddleLong')
    applyItem(e, 'paddleShort')
    applyItem(e, 'paddleShort')
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH / 2)
    expect(e.paddleRemaining).toBe(ITEM_DURATION_SEC)
  })

  it('같은 아이템을 재습득하면 남은 시간이 10초로 갱신되고 길이는 누적되지 않는다', () => {
    const e = createEffects()
    applyItem(e, 'paddleLong')
    updateEffects(e, 6)
    expect(e.paddleRemaining).toBeCloseTo(4)
    applyItem(e, 'paddleLong')
    expect(e.paddleRemaining).toBe(ITEM_DURATION_SEC)
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH * 2)
  })
})

describe('점수 + 상태', () => {
  it('10초 동안 2배이고 만료되면 1배로 돌아온다', () => {
    const e = createEffects()
    expect(scoreMultiplier(e)).toBe(1)
    applyItem(e, 'scoreBonus')
    expect(scoreMultiplier(e)).toBe(2)
    updateEffects(e, 9.9)
    expect(scoreMultiplier(e)).toBe(2)
    updateEffects(e, 0.2)
    expect(scoreMultiplier(e)).toBe(1)
  })

  it('재습득하면 10초로 갱신된다', () => {
    const e = createEffects()
    applyItem(e, 'scoreBonus')
    updateEffects(e, 8)
    applyItem(e, 'scoreBonus')
    expect(e.scoreBonusRemaining).toBe(ITEM_DURATION_SEC)
  })
})

describe('독립성과 표시', () => {
  it('막대 길이, 점수 +, 공 속도 효과는 서로 영향을 주지 않는다', () => {
    const e = createEffects()
    applyItem(e, 'paddleLong')
    applyItem(e, 'scoreBonus')
    applyItem(e, 'ballSpeedUp')
    resetBallSpeed(e)
    expect(paddleWidth(e)).toBe(PADDLE_WIDTH * 2)
    expect(scoreMultiplier(e)).toBe(2)
  })

  it('activeEffects는 적용 중인 효과만 남은 시간과 함께 돌려준다', () => {
    const e = createEffects()
    expect(activeEffects(e)).toEqual([])
    applyItem(e, 'ballSpeedDown')
    applyItem(e, 'paddleShort')
    applyItem(e, 'scoreBonus')
    expect(activeEffects(e)).toEqual([
      { type: 'ballSpeedDown', remaining: null },
      { type: 'paddleShort', remaining: 10 },
      { type: 'scoreBonus', remaining: 10 },
    ])
  })

  it('multiBall은 효과 상태를 바꾸지 않는다', () => {
    const e = createEffects()
    applyItem(e, 'multiBall')
    expect(e).toEqual(createEffects())
  })
})
