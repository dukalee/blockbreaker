import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PADDLE_BOTTOM_MARGIN,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  PLAY_LEFT,
  PLAY_RIGHT,
} from './constants'
import type { InputState } from './input'

export interface Paddle {
  /** 막대 중심 x */
  x: number
  /** 막대 상단 y */
  y: number
  width: number
  height: number
}

export function createPaddle(): Paddle {
  return {
    x: LOGICAL_WIDTH / 2,
    y: LOGICAL_HEIGHT - PADDLE_BOTTOM_MARGIN - PADDLE_HEIGHT,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  }
}

export function clampPaddleX(paddle: Paddle, x: number): number {
  const half = paddle.width / 2
  return Math.min(PLAY_RIGHT - half, Math.max(PLAY_LEFT + half, x))
}

// 마지막 입력 장치가 막대를 제어한다. 이동 범위는 좌우 벽 안쪽으로 제한한다.
export function updatePaddle(paddle: Paddle, input: InputState, dt: number): void {
  if (input.source === 'mouse') {
    paddle.x = clampPaddleX(paddle, input.mouseX)
  } else if (input.source === 'keyboard') {
    paddle.x = clampPaddleX(paddle, paddle.x + input.direction * PADDLE_SPEED * dt)
  }
}

/** 각진 픽셀 막대: 단색 면 + 윗면 하이라이트 + 아랫면 그림자 + 오른쪽 아래로 떨어지는 단단한 그림자. */
export function renderPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle): void {
  const x = Math.round(paddle.x - paddle.width / 2)
  const y = Math.round(paddle.y)
  const w = Math.round(paddle.width)
  const h = paddle.height

  ctx.fillStyle = '#05060f'
  ctx.fillRect(x + 4, y + 4, w, h)
  ctx.fillStyle = '#4dc3ff'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#a9e6ff'
  ctx.fillRect(x, y, w, 6)
  ctx.fillStyle = '#1f6fa6'
  ctx.fillRect(x, y + h - 6, w, 6)
}
