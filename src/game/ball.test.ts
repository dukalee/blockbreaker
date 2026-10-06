import { describe, expect, it } from 'vitest'
import {
  attachToPaddle,
  createBall,
  enforceMinAngle,
  isBallOut,
  launchBall,
  reflectOffPaddle,
  setBallSpeed,
  updateBall,
  type Ball,
} from './ball'
import { BALL_BASE_SPEED, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants'
import { InputState } from './input'
import { createPaddle } from './paddle'

const deg = (rad: number) => (rad * 180) / Math.PI
const angleFromHorizontal = (b: Ball) => deg(Math.atan2(Math.abs(b.vy), Math.abs(b.vx)))

function launched(): { ball: Ball; paddle: ReturnType<typeof createPaddle> } {
  const paddle = createPaddle()
  const ball = createBall(paddle)
  launchBall(ball, 1)
  return { ball, paddle }
}

describe('대기와 발사', () => {
  it('공은 막대 위 중앙에서 시작하고 막대를 따라간다', () => {
    const paddle = createPaddle()
    const ball = createBall(paddle)
    expect(ball.launched).toBe(false)
    expect(ball.x).toBe(paddle.x)
    expect(ball.y + ball.radius).toBe(paddle.y)
    paddle.x = 300
    attachToPaddle(ball, paddle)
    expect(ball.x).toBe(300)
  })

  it('발사 전에는 updateBall이 공을 움직이지 않는다', () => {
    const paddle = createPaddle()
    const ball = createBall(paddle)
    const { x, y } = ball
    updateBall(ball, paddle, 1)
    expect(ball.x).toBe(x)
    expect(ball.y).toBe(y)
  })

  it('왼쪽/오른쪽 위로 45도, 기본 속력으로 발사된다', () => {
    const paddle = createPaddle()
    const right = createBall(paddle)
    launchBall(right, 1)
    expect(right.vx).toBeGreaterThan(0)
    expect(right.vy).toBeLessThan(0)
    expect(angleFromHorizontal(right)).toBeCloseTo(45)
    expect(Math.hypot(right.vx, right.vy)).toBeCloseTo(BALL_BASE_SPEED)
    const left = createBall(paddle)
    launchBall(left, -1)
    expect(left.vx).toBeLessThan(0)
    expect(angleFromHorizontal(left)).toBeCloseTo(45)
  })

  it('마우스 클릭 발사 요청도 한 번만 소비되고 막대 제어권을 바꾸지 않는다', () => {
    const input = new InputState()
    input.keyDown('ArrowLeft')
    input.requestLaunch()
    expect(input.consumeLaunch()).toBe(true)
    expect(input.consumeLaunch()).toBe(false)
    expect(input.source).toBe('keyboard')
  })

  it('space 입력은 한 번만 소비된다', () => {
    const input = new InputState()
    expect(input.consumeLaunch()).toBe(false)
    input.keyDown(' ')
    expect(input.consumeLaunch()).toBe(true)
    expect(input.consumeLaunch()).toBe(false)
    expect(input.source).toBeNull()
  })
})

describe('벽 반사', () => {
  it('좌/우/상 벽에서 반사된다', () => {
    const { ball, paddle } = launched()
    ball.x = 12
    ball.y = 300
    ball.vx = -300
    ball.vy = -300
    updateBall(ball, paddle, 0.05)
    expect(ball.vx).toBeGreaterThan(0)

    ball.x = LOGICAL_WIDTH - 12
    ball.vx = 300
    updateBall(ball, paddle, 0.05)
    expect(ball.vx).toBeLessThan(0)

    ball.x = 640
    ball.y = 12
    ball.vy = -300
    updateBall(ball, paddle, 0.05)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it('벽 반사 후 속력이 유지된다', () => {
    const { ball, paddle } = launched()
    ball.x = 12
    ball.y = 300
    ball.vx = -300
    ball.vy = -100
    const speed = Math.hypot(ball.vx, ball.vy)
    updateBall(ball, paddle, 0.05)
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(speed)
  })
})

describe('최소 각도 보정', () => {
  it('15도 미만이면 15도로 보정하고 속력·방향을 유지한다', () => {
    const { ball } = launched()
    ball.vx = -480
    ball.vy = -10
    const speed = Math.hypot(ball.vx, ball.vy)
    enforceMinAngle(ball)
    expect(angleFromHorizontal(ball)).toBeCloseTo(15)
    expect(ball.vx).toBeLessThan(0)
    expect(ball.vy).toBeLessThan(0)
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(speed)
  })

  it('완전히 수평인 경우에도 보정된다', () => {
    const { ball } = launched()
    ball.vx = 480
    ball.vy = 0
    enforceMinAngle(ball)
    expect(angleFromHorizontal(ball)).toBeCloseTo(15)
  })

  it('15도 이상이면 변경하지 않는다', () => {
    const { ball } = launched()
    const { vx, vy } = ball
    enforceMinAngle(ball)
    expect(ball.vx).toBe(vx)
    expect(ball.vy).toBe(vy)
  })

  it('벽에 거의 수평으로 부딪혀도 반사 후 15도 이상이다', () => {
    const { ball, paddle } = launched()
    ball.x = 12
    ball.y = 300
    ball.vx = -480
    ball.vy = -5
    updateBall(ball, paddle, 0.05)
    expect(angleFromHorizontal(ball)).toBeGreaterThanOrEqual(15 - 1e-9)
  })
})

describe('막대 반사', () => {
  it('가운데에 맞으면 수직에 가깝게 튕긴다', () => {
    const { ball, paddle } = launched()
    ball.x = paddle.x
    ball.vx = 100
    ball.vy = 400
    reflectOffPaddle(ball, paddle)
    expect(ball.vx).toBeCloseTo(0)
    expect(ball.vy).toBeLessThan(0)
  })

  it('가장자리에 맞으면 가운데보다 비스듬하게 튕긴다', () => {
    const { ball, paddle } = launched()
    ball.x = paddle.x
    ball.vx = 0
    ball.vy = 400
    reflectOffPaddle(ball, paddle)
    const center = angleFromHorizontal(ball)

    ball.x = paddle.x + paddle.width / 2
    ball.vx = 0
    ball.vy = 400
    reflectOffPaddle(ball, paddle)
    const edge = angleFromHorizontal(ball)
    expect(edge).toBeLessThan(center)
    expect(edge).toBeGreaterThanOrEqual(15)
    expect(ball.vx).toBeGreaterThan(0)
  })

  it('왼쪽 가장자리는 왼쪽으로, 오른쪽 가장자리는 오른쪽으로 튕긴다', () => {
    const { ball, paddle } = launched()
    ball.x = paddle.x - paddle.width / 2
    ball.vx = 0
    ball.vy = 400
    reflectOffPaddle(ball, paddle)
    expect(ball.vx).toBeLessThan(0)
  })

  it('반사 후 속력이 유지된다', () => {
    const { ball, paddle } = launched()
    ball.x = paddle.x + 30
    ball.vx = 200
    ball.vy = 300
    const speed = Math.hypot(ball.vx, ball.vy)
    reflectOffPaddle(ball, paddle)
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(speed)
  })

  it('낙하하는 공이 막대에 닿으면 위로 튕긴다', () => {
    const { ball, paddle } = launched()
    ball.x = paddle.x
    ball.y = paddle.y - ball.radius - 2
    ball.vx = 0
    ball.vy = 400
    const hit = updateBall(ball, paddle, 0.02)
    expect(hit).toBe(true)
    expect(ball.vy).toBeLessThan(0)
  })

  it('막대 옆을 지나 아래로 떨어지는 공은 튕기지 않는다', () => {
    const { ball, paddle } = launched()
    ball.x = 50
    ball.y = paddle.y - 5
    ball.vx = 0
    ball.vy = 400
    updateBall(ball, paddle, 0.1)
    expect(ball.vy).toBeGreaterThan(0)
  })
})

describe('터널링 방지', () => {
  it('속도를 크게 올려도 막대를 통과하지 않는다', () => {
    for (const speed of [2000, 6000, 20000]) {
      const { ball, paddle } = launched()
      setBallSpeed(ball, speed)
      ball.x = paddle.x
      ball.y = paddle.y - ball.radius - 20
      ball.vx = 0
      ball.vy = speed
      const hit = updateBall(ball, paddle, 1 / 60)
      expect(hit).toBe(true)
      expect(ball.vy).toBeLessThan(0)
    }
  })

  it('setBallSpeed는 방향을 유지하고 속력만 바꾼다', () => {
    const { ball } = launched()
    const angle = angleFromHorizontal(ball)
    setBallSpeed(ball, 960)
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(960)
    expect(angleFromHorizontal(ball)).toBeCloseTo(angle)
  })
})

describe('바닥 감지', () => {
  it('화면 바닥 아래로 완전히 나가면 true', () => {
    const { ball } = launched()
    ball.y = LOGICAL_HEIGHT - 1
    expect(isBallOut(ball)).toBe(false)
    ball.y = LOGICAL_HEIGHT + ball.radius + 1
    expect(isBallOut(ball)).toBe(true)
  })
})
