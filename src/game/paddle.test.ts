import { describe, expect, it } from 'vitest'
import { LOGICAL_WIDTH, PADDLE_SPEED, PADDLE_WIDTH, PLAY_LEFT, PLAY_RIGHT } from './constants'
import { InputState } from './input'
import { createPaddle, updatePaddle } from './paddle'
import { toLogicalX } from './scale'

describe('InputState 우선순위', () => {
  it('입력이 없으면 source는 null이다', () => {
    expect(new InputState().source).toBeNull()
  })

  it('마지막 입력 장치가 source가 된다 (마우스 → 키보드 → 마우스)', () => {
    const input = new InputState()
    input.mouseMove(100)
    expect(input.source).toBe('mouse')
    input.keyDown('ArrowLeft')
    expect(input.source).toBe('keyboard')
    input.mouseMove(200)
    expect(input.source).toBe('mouse')
  })

  it('방향키가 아닌 키는 source를 바꾸지 않는다', () => {
    const input = new InputState()
    input.mouseMove(100)
    input.keyDown('a')
    expect(input.source).toBe('mouse')
  })

  it('좌우 동시 입력은 방향 0이고, 키를 떼면 0이 된다', () => {
    const input = new InputState()
    input.keyDown('ArrowLeft')
    expect(input.direction).toBe(-1)
    input.keyDown('ArrowRight')
    expect(input.direction).toBe(0)
    input.keyUp('ArrowLeft')
    expect(input.direction).toBe(1)
    input.keyUp('ArrowRight')
    expect(input.direction).toBe(0)
  })
})

describe('updatePaddle', () => {
  it('방향키를 누르는 동안 연속 이동하고 떼면 멈춘다', () => {
    const paddle = createPaddle()
    const input = new InputState()
    const start = paddle.x
    input.keyDown('ArrowRight')
    updatePaddle(paddle, input, 0.1)
    updatePaddle(paddle, input, 0.1)
    expect(paddle.x).toBeCloseTo(start + PADDLE_SPEED * 0.2)
    input.keyUp('ArrowRight')
    const stopped = paddle.x
    updatePaddle(paddle, input, 0.1)
    expect(paddle.x).toBe(stopped)
  })

  it('마우스 입력이면 막대 중심이 마우스 x를 따라간다', () => {
    const paddle = createPaddle()
    const input = new InputState()
    input.mouseMove(300)
    updatePaddle(paddle, input, 1 / 60)
    expect(paddle.x).toBe(300)
  })

  it('마우스 이동 후 방향키를 누르면 키보드가, 다시 마우스를 움직이면 마우스가 제어한다', () => {
    const paddle = createPaddle()
    const input = new InputState()
    input.mouseMove(300)
    updatePaddle(paddle, input, 0.1)
    input.keyDown('ArrowRight')
    updatePaddle(paddle, input, 0.1)
    expect(paddle.x).toBeCloseTo(300 + PADDLE_SPEED * 0.1)
    input.mouseMove(500)
    updatePaddle(paddle, input, 0.1)
    expect(paddle.x).toBe(500)
  })

  it('막대가 좌우 벽 밖으로 나가지 않는다', () => {
    const paddle = createPaddle()
    const input = new InputState()
    input.mouseMove(-500)
    updatePaddle(paddle, input, 0.1)
    expect(paddle.x).toBe(PLAY_LEFT + PADDLE_WIDTH / 2)
    input.mouseMove(LOGICAL_WIDTH + 500)
    updatePaddle(paddle, input, 0.1)
    expect(paddle.x).toBe(PLAY_RIGHT - PADDLE_WIDTH / 2)
    input.keyDown('ArrowLeft')
    input.keyUp('ArrowLeft')
    input.keyDown('ArrowRight')
    updatePaddle(paddle, input, 1)
    expect(paddle.x).toBe(PLAY_RIGHT - PADDLE_WIDTH / 2)
  })
})

describe('toLogicalX', () => {
  it('캔버스 크기가 달라져도 논리 좌표가 일치한다', () => {
    expect(toLogicalX(740, 100, 640)).toBeCloseTo(1280)
    expect(toLogicalX(420, 100, 640)).toBeCloseTo(640)
    expect(toLogicalX(100, 100, 640)).toBeCloseTo(0)
  })
})
