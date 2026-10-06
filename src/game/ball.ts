import {
  BALL_BASE_SPEED,
  BALL_LAUNCH_ANGLE_DEG,
  BALL_RADIUS,
  LOGICAL_HEIGHT,
  MIN_BOUNCE_ANGLE_DEG,
  PADDLE_MAX_BOUNCE_ANGLE_DEG,
  PLAY_LEFT,
  PLAY_RIGHT,
  PLAY_TOP,
} from './constants'
import type { Paddle } from './paddle'

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  /** 속력(px/s). vx, vy의 크기와 항상 일치한다. */
  speed: number
  launched: boolean
}

const toRad = (deg: number) => (deg * Math.PI) / 180

export function createBall(paddle: Paddle, speed = BALL_BASE_SPEED): Ball {
  const ball: Ball = {
    x: paddle.x,
    y: 0,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    speed,
    launched: false,
  }
  attachToPaddle(ball, paddle)
  return ball
}

/** 발사 전: 공을 막대 위 중앙에 올려둔다. */
export function attachToPaddle(ball: Ball, paddle: Paddle): void {
  ball.x = paddle.x
  ball.y = paddle.y - ball.radius
}

/** 왼쪽(-1) 또는 오른쪽(1) 위로 45도 발사한다. */
export function launchBall(ball: Ball, direction: -1 | 1): void {
  const a = toRad(BALL_LAUNCH_ANGLE_DEG)
  ball.vx = direction * ball.speed * Math.cos(a)
  ball.vy = -ball.speed * Math.sin(a)
  ball.launched = true
}

/** 속도 방향을 유지한 채 속력을 바꾼다. */
export function setBallSpeed(ball: Ball, speed: number): void {
  const current = Math.hypot(ball.vx, ball.vy)
  if (current > 0) {
    ball.vx = (ball.vx / current) * speed
    ball.vy = (ball.vy / current) * speed
  }
  ball.speed = speed
}

/** 같은 위치·속력에서 진행 방향만 angleDeg 만큼 회전한 새 공을 만든다. (공 분산용) */
export function splitBall(ball: Ball, angleDeg: number): Ball {
  const a = toRad(angleDeg)
  const copy: Ball = {
    ...ball,
    vx: ball.vx * Math.cos(a) - ball.vy * Math.sin(a),
    vy: ball.vx * Math.sin(a) + ball.vy * Math.cos(a),
  }
  enforceMinAngle(copy)
  return copy
}

/**
 * 수평 기준 각도가 최소 각도(15도) 미만이면 보정한다. 속력과 진행 방향(부호)은 유지한다.
 * 벽·막대·블록 반사에서 공통으로 사용한다.
 */
export function enforceMinAngle(ball: Ball, minDeg = MIN_BOUNCE_ANGLE_DEG): void {
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed === 0) return
  const min = toRad(minDeg)
  if (Math.atan2(Math.abs(ball.vy), Math.abs(ball.vx)) >= min) return
  const signX = ball.vx < 0 ? -1 : 1
  const signY = ball.vy > 0 ? 1 : -1
  ball.vx = signX * speed * Math.cos(min)
  ball.vy = signY * speed * Math.sin(min)
}

/** 막대에 맞은 위치(가운데 0, 가장자리 ±1)에 따라 반사 벡터를 정한다. 속력은 유지한다. */
export function reflectOffPaddle(ball: Ball, paddle: Paddle): void {
  const t = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.width / 2)))
  const angleFromVertical = t * toRad(PADDLE_MAX_BOUNCE_ANGLE_DEG)
  const speed = Math.hypot(ball.vx, ball.vy)
  ball.vx = speed * Math.sin(angleFromVertical)
  ball.vy = -speed * Math.cos(angleFromVertical)
  enforceMinAngle(ball)
}

/** 공이 막대 아래(화면 바닥)로 완전히 나갔는지. 제거 처리는 호출하는 쪽에서 한다. */
export function isBallOut(ball: Ball): boolean {
  return ball.y - ball.radius > LOGICAL_HEIGHT
}

/** 벽에 부딪혀 반사됐으면 true. */
function collideWalls(ball: Ball): boolean {
  let bounced = false
  if (ball.x - ball.radius < PLAY_LEFT) {
    ball.x = PLAY_LEFT + ball.radius
    ball.vx = Math.abs(ball.vx)
    bounced = true
  } else if (ball.x + ball.radius > PLAY_RIGHT) {
    ball.x = PLAY_RIGHT - ball.radius
    ball.vx = -Math.abs(ball.vx)
    bounced = true
  }
  if (ball.y - ball.radius < PLAY_TOP) {
    ball.y = PLAY_TOP + ball.radius
    ball.vy = Math.abs(ball.vy)
    bounced = true
  }
  if (bounced) enforceMinAngle(ball)
  return bounced
}

function collidePaddle(ball: Ball, paddle: Paddle, prevBottom: number): boolean {
  if (ball.vy <= 0) return false
  const bottom = ball.y + ball.radius
  // 이전 위치가 막대 윗면 위에 있었고, 이번에 윗면을 넘어섰을 때만 맞은 것으로 본다.
  if (prevBottom > paddle.y || bottom < paddle.y) return false
  const half = paddle.width / 2
  if (ball.x < paddle.x - half - ball.radius || ball.x > paddle.x + half + ball.radius) return false
  ball.y = paddle.y - ball.radius
  reflectOffPaddle(ball, paddle)
  return true
}

/**
 * 발사된 공을 이동시키고 벽·막대 충돌을 처리한다.
 * 한 번에 이동하는 거리를 반지름의 절반 이하로 나눠 빠른 공도 막대를 뚫지 않게 한다.
 * onMove는 나뉜 이동 단계마다 벽·막대 처리 뒤에 호출된다. (블록 충돌 등에 사용)
 * onBounce는 벽 또는 막대에 부딪힐 때마다 호출된다. (효과음용)
 * 막대에 맞았으면 true를 반환한다.
 */
export function updateBall(
  ball: Ball,
  paddle: Paddle,
  dt: number,
  onMove?: (ball: Ball) => void,
  onBounce?: () => void,
): boolean {
  if (!ball.launched) return false
  const distance = Math.hypot(ball.vx, ball.vy) * dt
  const steps = Math.max(1, Math.ceil(distance / (ball.radius / 2)))
  const subDt = dt / steps
  let hitPaddle = false
  for (let i = 0; i < steps; i++) {
    const prevBottom = ball.y + ball.radius
    ball.x += ball.vx * subDt
    ball.y += ball.vy * subDt
    if (collideWalls(ball)) onBounce?.()
    if (collidePaddle(ball, paddle, prevBottom)) {
      hitPaddle = true
      onBounce?.()
    }
    onMove?.(ball)
  }
  return hitPaddle
}

export function renderBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
  ctx.fill()
}
