import { describe, expect, it } from 'vitest'
import { createBall, launchBall, updateBall } from './ball'
import { createAsteroids, createBackdrop, updateAsteroids, updateBackdrop } from './backdrop'
import { shade } from './blockRender'
import {
  BLOCK_AREA_LEFT,
  BLOCK_WIDTH,
  GRID_COLS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PADDLE_WIDTH,
  PLAY_LEFT,
  PLAY_RIGHT,
  PLAY_TOP,
  WALL_THICKNESS,
} from './constants'
import { createPaddle } from './paddle'

describe('막대 기본 크기', () => {
  it('기존 160에서 양쪽 5px씩 줄어든 150이다', () => {
    expect(PADDLE_WIDTH).toBe(160 - 5 * 2)
    expect(createPaddle().width).toBe(150)
  })
})

describe('벽 경계', () => {
  it('벽은 화면 가장자리 안쪽에 두께를 가지고, 블록 영역은 벽 안쪽에 있다', () => {
    expect(PLAY_LEFT).toBe(WALL_THICKNESS)
    expect(PLAY_RIGHT).toBe(LOGICAL_WIDTH - WALL_THICKNESS)
    expect(PLAY_TOP).toBe(WALL_THICKNESS)
    expect(BLOCK_AREA_LEFT).toBeGreaterThanOrEqual(PLAY_LEFT)
    expect(BLOCK_AREA_LEFT + GRID_COLS * BLOCK_WIDTH).toBeLessThanOrEqual(PLAY_RIGHT)
  })

  it('공은 화면 가장자리가 아니라 보이는 벽 표면에서 튕긴다', () => {
    const paddle = createPaddle()
    const left = createBall(paddle)
    launchBall(left, -1)
    left.x = 100
    left.y = 400
    left.vx = -600
    left.vy = -300
    let minX = Infinity
    for (let i = 0; i < 60; i++) {
      updateBall(left, paddle, 1 / 60)
      minX = Math.min(minX, left.x - left.radius)
    }
    expect(minX).toBeGreaterThanOrEqual(PLAY_LEFT - 1e-6)
    expect(minX).toBeLessThan(PLAY_LEFT + 5)
    expect(left.vx).toBeGreaterThan(0)

    const right = createBall(paddle)
    launchBall(right, 1)
    right.x = 1200
    right.y = 400
    right.vx = 600
    right.vy = -300
    let maxX = -Infinity
    for (let i = 0; i < 60; i++) {
      updateBall(right, paddle, 1 / 60)
      maxX = Math.max(maxX, right.x + right.radius)
    }
    expect(maxX).toBeLessThanOrEqual(PLAY_RIGHT + 1e-6)
    expect(maxX).toBeGreaterThan(PLAY_RIGHT - 5)
  })

  it('공은 위쪽 벽 표면에서 튕긴다', () => {
    const paddle = createPaddle()
    const ball = createBall(paddle)
    launchBall(ball, 1)
    ball.x = 640
    ball.y = 60
    ball.vx = 100
    ball.vy = -700
    let minY = Infinity
    for (let i = 0; i < 30; i++) {
      updateBall(ball, paddle, 1 / 60)
      minY = Math.min(minY, ball.y - ball.radius)
    }
    expect(minY).toBeGreaterThanOrEqual(PLAY_TOP - 1e-6)
    expect(minY).toBeLessThan(PLAY_TOP + 5)
  })
})

describe('우주 소행성 배경', () => {
  it('소행성이 화면 안에 생성되고 모양과 분화구를 가진다', () => {
    const asteroids = createAsteroids()
    expect(asteroids.length).toBeGreaterThan(0)
    for (const a of asteroids) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.x).toBeLessThanOrEqual(LOGICAL_WIDTH)
      expect(a.y).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeLessThanOrEqual(LOGICAL_HEIGHT)
      expect(a.shape.length).toBeGreaterThanOrEqual(8)
      expect(a.craters.length).toBeGreaterThan(0)
    }
  })

  it('소행성은 천천히 움직이며 회전하고, 화면 밖으로 나가면 반대편에서 나타난다', () => {
    const a = createAsteroids(() => 0.7, 1)
    const { x, y, rotation } = a[0]
    updateAsteroids(a, 1)
    expect(a[0].x).not.toBe(x)
    expect(a[0].y).not.toBe(y)
    expect(a[0].rotation).not.toBe(rotation)

    a[0].x = -1000
    updateAsteroids(a, 0.01)
    expect(a[0].x).toBeGreaterThan(LOGICAL_WIDTH)
    a[0].y = LOGICAL_HEIGHT + 1000
    updateAsteroids(a, 0.01)
    expect(a[0].y).toBeLessThan(0)
  })

  it('배경은 별과 소행성을 함께 갱신한다', () => {
    const b = createBackdrop()
    const star = b.stars[0].y
    const rock = b.asteroids[0].x
    updateBackdrop(b, 0.5)
    expect(b.stars[0].y).not.toBe(star)
    expect(b.asteroids[0].x).not.toBe(rock)
  })
})

describe('색 보정 shade', () => {
  it('1보다 작으면 어둡게, 크면 흰색 쪽으로 밝게 만든다', () => {
    expect(shade('#ff8000', 0.5)).toBe('rgb(128, 64, 0)')
    expect(shade('#000000', 2)).toBe('rgb(255, 255, 255)')
    expect(shade('#808080', 1)).toBe('rgb(128, 128, 128)')
  })
})
