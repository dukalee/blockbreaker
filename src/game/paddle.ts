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

/** 네온 빛이 나는 입체감 있는 막대: 위쪽이 밝고 아래쪽이 어두운 그라데이션, 윗면 하이라이트, 외곽 글로우. */
export function renderPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle): void {
  const x = paddle.x - paddle.width / 2
  const { y, width: w, height: h } = paddle
  const r = 6

  ctx.save()
  ctx.shadowColor = '#4de3ff'
  ctx.shadowBlur = 18
  const body = ctx.createLinearGradient(0, y, 0, y + h)
  body.addColorStop(0, '#b8f7ff')
  body.addColorStop(0.45, '#35cfff')
  body.addColorStop(1, '#0a5f86')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.clip()
  // 윗면 하이라이트와 아랫면 그림자로 입체감을 준다.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fillRect(x, y, w, h * 0.35)
  ctx.fillStyle = 'rgba(0, 20, 40, 0.35)'
  ctx.fillRect(x, y + h * 0.78, w, h * 0.22)
  ctx.restore()

  ctx.strokeStyle = '#d8fbff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r)
  ctx.stroke()
}
