import { describe, expect, it } from 'vitest'
import { launchBall } from './ball'
import type { Block } from './blocks'
import { BALL_BASE_SPEED, ITEM_DURATION_SEC, MAX_BALLS, PADDLE_WIDTH } from './constants'
import { createGame, loseLife, togglePause, updateGame, type GameState } from './game'
import { InputState } from './input'
import type { Item, ItemType } from './items'

function dropOnPaddle(state: GameState, type: ItemType): void {
  const item: Item = {
    type,
    x: state.paddle.x,
    y: state.paddle.y - 5,
    width: 48,
    height: 24,
  }
  state.items.push(item)
}

/** 아이템을 막대로 받는 한 프레임을 진행한다. */
function pickup(state: GameState, type: ItemType): void {
  dropOnPaddle(state, type)
  updateGame(state, new InputState(), 1 / 60)
}

function launchedState(): GameState {
  const state = createGame({ rng: () => 0.9 })
  // 스테이지가 넘어가지 않도록 멀리 있는 블록을 둔다.
  state.blocks = [block(100, 100)]
  launchBall(state.balls[0], 1)
  state.balls[0].x = 640
  state.balls[0].y = 400
  return state
}

function block(x: number, y: number): Block {
  return { col: 0, row: 0, x, y, width: 100, height: 32, type: 'normal', hp: 1, color: '#fff' }
}

const speedOf = (b: { vx: number; vy: number }) => Math.hypot(b.vx, b.vy)

describe('공 분산', () => {
  it('공 1개가 3개가 되고 방향이 서로 다르며 속력은 같다', () => {
    const state = launchedState()
    pickup(state, 'multiBall')
    expect(state.balls).toHaveLength(3)
    const dirs = new Set(state.balls.map((b) => Math.round(Math.atan2(b.vy, b.vx) * 100)))
    expect(dirs.size).toBe(3)
    for (const b of state.balls) expect(speedOf(b)).toBeCloseTo(BALL_BASE_SPEED)
  })

  it('3개였다면 9개가 아니라 최대 6개까지만 늘어난다', () => {
    const state = launchedState()
    pickup(state, 'multiBall')
    pickup(state, 'multiBall')
    expect(state.balls).toHaveLength(MAX_BALLS)
    pickup(state, 'multiBall')
    expect(state.balls).toHaveLength(MAX_BALLS)
  })

  it('이미 5개여도 6개를 넘지 않는다', () => {
    const state = launchedState()
    for (let i = 0; i < 4; i++) {
      const copy = { ...state.balls[0] }
      state.balls.push(copy)
    }
    expect(state.balls).toHaveLength(5)
    pickup(state, 'multiBall')
    expect(state.balls).toHaveLength(MAX_BALLS)
  })

  it('분산된 공도 모두 수평 기준 15도 이상이다', () => {
    const state = launchedState()
    state.balls[0].vx = 480
    state.balls[0].vy = -130 // 약 15도
    pickup(state, 'multiBall')
    for (const b of state.balls) {
      const angle = (Math.atan2(Math.abs(b.vy), Math.abs(b.vx)) * 180) / Math.PI
      expect(angle).toBeGreaterThanOrEqual(15 - 1e-6)
    }
  })

  it('발사 전 대기 중인 공은 분산되지 않는다', () => {
    const state = createGame()
    pickup(state, 'multiBall')
    expect(state.balls).toHaveLength(1)
  })
})

describe('공 속도 아이템', () => {
  it('+를 먹으면 2배, 다시 먹어도 그대로이고, -를 먹으면 기본 속도로 돌아간다', () => {
    const state = launchedState()
    pickup(state, 'ballSpeedUp')
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED * 2)
    pickup(state, 'ballSpeedUp')
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED * 2)
    pickup(state, 'ballSpeedDown')
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED)
  })

  it('-를 먹으면 절반, 이후 +를 먹으면 기본 속도로 돌아간다', () => {
    const state = launchedState()
    pickup(state, 'ballSpeedDown')
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED / 2)
    pickup(state, 'ballSpeedUp')
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED)
  })

  it('분산된 공 모두에 속도가 적용된다', () => {
    const state = launchedState()
    pickup(state, 'multiBall')
    pickup(state, 'ballSpeedUp')
    for (const b of state.balls) expect(speedOf(b)).toBeCloseTo(BALL_BASE_SPEED * 2)
  })

  it('LIFE를 잃으면 기본 속도로 초기화된다', () => {
    const state = launchedState()
    pickup(state, 'ballSpeedUp')
    loseLife(state)
    expect(state.effects.ballSpeed).toBe('normal')
    expect(state.balls[0].speed).toBeCloseTo(BALL_BASE_SPEED)
    launchBall(state.balls[0], 1)
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED)
  })

  it('스테이지를 클리어하면 공 속도는 해당 스테이지 기본 속도로 초기화된다', () => {
    const state = launchedState()
    pickup(state, 'ballSpeedDown')
    state.blocks = []
    updateGame(state, new InputState(), 1 / 60)
    expect(state.stage).toBe(2)
    expect(state.effects.ballSpeed).toBe('normal')
    expect(state.balls[0].speed).toBeCloseTo(BALL_BASE_SPEED * 1.05)
  })

  it('발사 전 대기 중에 먹은 속도 효과도 발사 속도에 반영된다', () => {
    const state = createGame()
    pickup(state, 'ballSpeedUp')
    launchBall(state.balls[0], 1)
    expect(speedOf(state.balls[0])).toBeCloseTo(BALL_BASE_SPEED * 2)
  })
})

describe('막대 길이 아이템', () => {
  it('+를 먹으면 막대가 2배가 되고 10초 후 원래 길이로 돌아온다', () => {
    const state = launchedState()
    pickup(state, 'paddleLong')
    expect(state.paddle.width).toBe(PADDLE_WIDTH * 2)
    const input = new InputState()
    for (let i = 0; i < 60 * ITEM_DURATION_SEC - 5; i++) updateGame(state, input, 1 / 60)
    expect(state.paddle.width).toBe(PADDLE_WIDTH * 2)
    for (let i = 0; i < 10; i++) updateGame(state, input, 1 / 60)
    expect(state.paddle.width).toBe(PADDLE_WIDTH)
  })

  it('반대 아이템은 상쇄되어 기본 길이로 돌아간다', () => {
    const state = launchedState()
    pickup(state, 'paddleShort')
    expect(state.paddle.width).toBe(PADDLE_WIDTH / 2)
    pickup(state, 'paddleLong')
    expect(state.paddle.width).toBe(PADDLE_WIDTH)
  })

  it('긴 막대도 좌우 벽 밖으로 나가지 않는다', () => {
    const state = launchedState()
    pickup(state, 'paddleLong')
    const input = new InputState()
    input.mouseMove(-1000)
    updateGame(state, input, 1 / 60)
    expect(state.paddle.x - state.paddle.width / 2).toBeGreaterThanOrEqual(0)
    input.mouseMove(5000)
    updateGame(state, input, 1 / 60)
    expect(state.paddle.x + state.paddle.width / 2).toBeLessThanOrEqual(1280)
  })

  it('벽에 붙은 상태에서 막대가 길어져도 벽 안쪽으로 보정된다', () => {
    const state = launchedState()
    const input = new InputState()
    input.mouseMove(0)
    updateGame(state, input, 1 / 60)
    pickup(state, 'paddleLong')
    expect(state.paddle.x - state.paddle.width / 2).toBeGreaterThanOrEqual(0)
  })

  it('LIFE를 잃어도 막대 길이 효과는 남은 시간 동안 유지된다', () => {
    const state = launchedState()
    pickup(state, 'paddleLong')
    loseLife(state)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.paddle.width).toBe(PADDLE_WIDTH * 2)
    expect(state.effects.paddleRemaining).toBeGreaterThan(9)
  })
})

describe('점수 + 아이템', () => {
  function hitBlockFromBelow(state: GameState): void {
    const target = block(700, 300)
    state.blocks.push(target)
    const ball = state.balls[0]
    ball.launched = true
    ball.x = 750
    ball.y = 332 + 5
    ball.vx = 0
    ball.vy = -300
  }

  it('블록당 점수가 100에서 200이 된다', () => {
    const state = launchedState()
    hitBlockFromBelow(state)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.score).toBe(100)

    const bonus = launchedState()
    pickup(bonus, 'scoreBonus')
    hitBlockFromBelow(bonus)
    updateGame(bonus, new InputState(), 1 / 60)
    expect(bonus.score).toBe(200)
  })

  it('10초 뒤에는 다시 100점이 된다', () => {
    const state = launchedState()
    pickup(state, 'scoreBonus')
    const input = new InputState()
    for (let i = 0; i < 60 * ITEM_DURATION_SEC + 5; i++) {
      // 공이 바닥으로 떨어져 LIFE가 줄지 않도록 계속 위치를 고정한다.
      state.balls[0].x = 640
      state.balls[0].y = 400
      state.balls[0].vx = 0
      state.balls[0].vy = 0
      updateGame(state, input, 1 / 60)
    }
    expect(state.effects.scoreBonusRemaining).toBe(0)
    hitBlockFromBelow(state)
    updateGame(state, input, 1 / 60)
    expect(state.score).toBe(100)
  })

  it('LIFE를 잃어도 점수 + 효과는 남은 시간 동안 유지된다', () => {
    const state = launchedState()
    pickup(state, 'scoreBonus')
    loseLife(state)
    expect(state.effects.scoreBonusRemaining).toBeGreaterThan(9)
  })
})

describe('pause와 효과 시간', () => {
  it('pause 중에는 효과 남은 시간이 줄지 않는다', () => {
    const state = launchedState()
    pickup(state, 'paddleLong')
    pickup(state, 'scoreBonus')
    const before = {
      paddle: state.effects.paddleRemaining,
      score: state.effects.scoreBonusRemaining,
    }
    togglePause(state)
    for (let i = 0; i < 600; i++) updateGame(state, new InputState(), 1 / 60)
    expect(state.effects.paddleRemaining).toBe(before.paddle)
    expect(state.effects.scoreBonusRemaining).toBe(before.score)
    togglePause(state)
    updateGame(state, new InputState(), 1)
    expect(state.effects.paddleRemaining).toBeLessThan(before.paddle)
  })

  it('새 게임(restart)은 모든 효과가 초기화된 상태로 시작한다', () => {
    const state = launchedState()
    pickup(state, 'paddleLong')
    pickup(state, 'scoreBonus')
    pickup(state, 'ballSpeedUp')
    const fresh = createGame()
    expect(fresh.effects).toEqual({
      ballSpeed: 'normal',
      paddleSize: 'normal',
      paddleRemaining: 0,
      scoreBonusRemaining: 0,
    })
    expect(fresh.paddle.width).toBe(PADDLE_WIDTH)
  })
})
