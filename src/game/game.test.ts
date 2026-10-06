import { describe, expect, it, vi } from 'vitest'
import { createBall, launchBall } from './ball'
import type { Block } from './blocks'
import {
  BALL_BASE_SPEED,
  INITIAL_LIFE,
  LOGICAL_HEIGHT,
} from './constants'
import { createGame, difficultyForStage, loseLife, setPaused, togglePause, updateGame } from './game'
import { InputState } from './input'

function block(type: Block['type'], x = 100, y = 100): Block {
  return { col: 0, row: 0, x, y, width: 100, height: 32, type, hp: type === 'reinforced' ? 2 : 1, color: '#fff' }
}

function dropBall(state: ReturnType<typeof createGame>, index = 0) {
  const ball = state.balls[index]
  ball.launched = true
  ball.x = 600
  ball.y = LOGICAL_HEIGHT + 100
  ball.vx = 0
  ball.vy = 100
}

describe('difficultyForStage', () => {
  it('스테이지 1은 기본 속도이고 메탈·강화 블록이 0%이다', () => {
    const d = difficultyForStage(1)
    expect(d.ballSpeed).toBe(BALL_BASE_SPEED)
    expect(d.metalRatio).toBe(0)
    expect(d.reinforcedRatio).toBe(0)
  })

  it('스테이지마다 속도 +5%, 메탈·강화 +3%p씩 증가한다', () => {
    const d = difficultyForStage(2)
    expect(d.ballSpeed).toBeCloseTo(BALL_BASE_SPEED * 1.05)
    expect(d.metalRatio).toBeCloseTo(0.03)
    expect(d.reinforcedRatio).toBeCloseTo(0.03)
    const d5 = difficultyForStage(5)
    expect(d5.ballSpeed).toBeCloseTo(BALL_BASE_SPEED * 1.2)
    expect(d5.metalRatio).toBeCloseTo(0.1)
    expect(d5.reinforcedRatio).toBeCloseTo(0.12)
  })

  it('상한을 넘지 않는다 (속도 2배, 메탈 10%, 강화 30%)', () => {
    const d = difficultyForStage(100)
    expect(d.ballSpeed).toBeCloseTo(BALL_BASE_SPEED * 2)
    expect(d.metalRatio).toBeCloseTo(0.1)
    expect(d.reinforcedRatio).toBeCloseTo(0.3)
  })

  it('속도는 스테이지 21에서 2배에 도달한다', () => {
    expect(difficultyForStage(20).ballSpeed).toBeLessThan(BALL_BASE_SPEED * 2)
    expect(difficultyForStage(21).ballSpeed).toBeCloseTo(BALL_BASE_SPEED * 2)
  })
})

describe('새 게임', () => {
  it('점수 0, LIFE 3, 스테이지 1이고 막대 위에 대기 공이 있다', () => {
    const state = createGame()
    expect(state.score).toBe(0)
    expect(state.life).toBe(INITIAL_LIFE)
    expect(state.stage).toBe(1)
    expect(state.phase).toBe('playing')
    expect(state.balls).toHaveLength(1)
    expect(state.balls[0].launched).toBe(false)
    expect(state.blocks.every((b) => b.type === 'normal')).toBe(true)
  })
})

describe('LIFE 규칙', () => {
  it('공이 바닥으로 나가면 LIFE가 1 줄고 막대 위에 새 공이 놓인다', () => {
    const state = createGame()
    dropBall(state)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.life).toBe(INITIAL_LIFE - 1)
    expect(state.balls).toHaveLength(1)
    expect(state.balls[0].launched).toBe(false)
    expect(state.phase).toBe('playing')
  })

  it('공이 여러 개일 때 하나만 나가면 LIFE는 줄지 않는다', () => {
    const state = createGame()
    const extra = createBall(state.paddle)
    state.balls.push(extra)
    for (const b of state.balls) {
      launchBall(b, 1)
      b.x = 640
      b.y = 400
    }
    dropBall(state, 0)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.life).toBe(INITIAL_LIFE)
    expect(state.balls).toHaveLength(1)
  })

  it('모든 공이 나가야 LIFE가 1 줄어든다', () => {
    const state = createGame()
    state.balls.push(createBall(state.paddle))
    dropBall(state, 0)
    dropBall(state, 1)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.life).toBe(INITIAL_LIFE - 1)
    expect(state.balls).toHaveLength(1)
    expect(state.balls[0].launched).toBe(false)
  })

  it('LIFE가 0이 되면 게임 오버 상태가 되고 이후 update는 아무것도 바꾸지 않는다', () => {
    const state = createGame()
    for (let i = 0; i < INITIAL_LIFE; i++) {
      dropBall(state)
      updateGame(state, new InputState(), 1 / 60)
    }
    expect(state.life).toBe(0)
    expect(state.phase).toBe('gameover')
    updateGame(state, new InputState(), 1 / 60)
    expect(state.life).toBe(0)
  })

  it('LIFE 상실 시 점수는 유지되고 공 속도 초기화 훅이 호출된다', () => {
    const hook = vi.fn()
    const state = createGame({ onBallSpeedReset: hook })
    hook.mockClear()
    state.score = 500
    loseLife(state)
    expect(state.score).toBe(500)
    expect(hook).toHaveBeenCalledTimes(1)
  })
})

describe('스테이지 진행', () => {
  it('메탈 블록만 남기고 모두 깨면 다음 스테이지가 시작된다', () => {
    const state = createGame()
    state.score = 300
    state.blocks = [block('metal', 100, 100), block('normal', 700, 300)]
    const ball = state.balls[0]
    ball.launched = true
    ball.x = 750
    ball.y = 332 + 5
    ball.vx = 0
    ball.vy = -300
    updateGame(state, new InputState(), 1 / 60)
    expect(state.stage).toBe(2)
    expect(state.score).toBe(400)
    expect(state.balls).toHaveLength(1)
    expect(state.balls[0].launched).toBe(false)
    expect(state.balls[0].speed).toBeCloseTo(difficultyForStage(2).ballSpeed)
    expect(state.blocks.length).toBeGreaterThan(0)
  })

  it('강화 블록이 남아 있으면 스테이지가 끝나지 않는다', () => {
    const state = createGame()
    state.blocks = [block('metal'), block('reinforced', 700, 300)]
    updateGame(state, new InputState(), 1 / 60)
    expect(state.stage).toBe(1)
  })

  it('스테이지 2부터는 설정된 비율로 메탈·강화 블록이 생성된다', () => {
    const state = createGame({ rng: () => 0.5 })
    state.stage = 6
    state.blocks = []
    // 스테이지 클리어 조건(깰 블록 없음)을 만족시켜 다음 스테이지(7)를 생성한다.
    updateGame(state, new InputState(), 1 / 60)
    expect(state.stage).toBe(7)
    const n = state.blocks.length
    expect(state.blocks.filter((b) => b.type === 'metal').length).toBe(Math.round(n * 0.1))
    expect(state.blocks.filter((b) => b.type === 'reinforced').length).toBe(Math.round(n * 0.18))
  })
})

describe('pause', () => {
  it('pause 중에는 공과 막대가 움직이지 않고 재개하면 멈춘 위치에서 이어진다', () => {
    const state = createGame()
    const input = new InputState()
    launchBall(state.balls[0], 1)
    state.balls[0].x = 640
    state.balls[0].y = 500
    state.blocks = [block('normal', 100, 100)]
    updateGame(state, input, 1 / 60)
    const before = { x: state.balls[0].x, y: state.balls[0].y }

    togglePause(state)
    expect(state.paused).toBe(true)
    input.mouseMove(100)
    for (let i = 0; i < 60; i++) updateGame(state, input, 1 / 60)
    expect(state.balls[0].x).toBe(before.x)
    expect(state.balls[0].y).toBe(before.y)
    expect(state.paddle.x).toBe(640)

    togglePause(state)
    updateGame(state, input, 1 / 60)
    expect(state.balls[0].y).not.toBe(before.y)
  })

  it('pause 중 누른 space는 재개 후 발사로 이어지지 않는다', () => {
    const state = createGame()
    const input = new InputState()
    togglePause(state)
    input.keyDown(' ')
    updateGame(state, input, 1 / 60)
    expect(state.balls[0].launched).toBe(false)
    togglePause(state)
    updateGame(state, input, 1 / 60)
    expect(state.balls[0].launched).toBe(false)
  })

  it('setPaused(true)를 반복해도 pause 상태가 유지되고, 게임 오버 상태에서는 바뀌지 않는다', () => {
    const state = createGame()
    setPaused(state, true)
    setPaused(state, true)
    expect(state.paused).toBe(true)
    state.phase = 'gameover'
    setPaused(state, false)
    expect(state.paused).toBe(true)
  })

  it('restart(새 게임)는 점수 0, LIFE 3, 스테이지 1, pause 해제 상태로 시작한다', () => {
    const old = createGame()
    old.score = 900
    old.life = 1
    old.stage = 4
    old.paused = true
    const fresh = createGame()
    expect(fresh.score).toBe(0)
    expect(fresh.life).toBe(INITIAL_LIFE)
    expect(fresh.stage).toBe(1)
    expect(fresh.paused).toBe(false)
  })
})
