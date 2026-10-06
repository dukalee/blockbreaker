import type { Rng } from './blocks'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, WALL_THICKNESS } from './constants'

export const STAR_COUNT = 140
export const ASTEROID_COUNT = 9

export interface Star {
  x: number
  y: number
  size: number
  /** 낙하 속도(px/s). 큰 별일수록 빠르다. */
  speed: number
  phase: number
}

export function createStars(rng: Rng = Math.random, count = STAR_COUNT): Star[] {
  return Array.from({ length: count }, () => {
    const depth = rng()
    return {
      x: rng() * LOGICAL_WIDTH,
      y: rng() * LOGICAL_HEIGHT,
      size: 1 + depth * 2,
      speed: 10 + depth * 50,
      phase: rng() * Math.PI * 2,
    }
  })
}

/** 별을 아래로 흘려보내고, 화면 아래로 나가면 위에서 다시 나타나게 한다. */
export function updateStars(stars: Star[], dt: number): void {
  for (const s of stars) {
    s.y += s.speed * dt
    if (s.y > LOGICAL_HEIGHT) s.y -= LOGICAL_HEIGHT
  }
}

export interface Crater {
  /** 소행성 중심 기준 상대 위치(반지름의 비율)와 크기(반지름의 비율) */
  dx: number
  dy: number
  size: number
}

export interface Asteroid {
  x: number
  y: number
  radius: number
  rotation: number
  /** 회전 속도(rad/s) */
  spin: number
  vx: number
  vy: number
  /** 꼭짓점별 반지름 배율. 울퉁불퉁한 바위 모양을 만든다. */
  shape: number[]
  craters: Crater[]
}

export function createAsteroids(rng: Rng = Math.random, count = ASTEROID_COUNT): Asteroid[] {
  return Array.from({ length: count }, () => {
    const radius = 16 + rng() * 44
    return {
      x: rng() * LOGICAL_WIDTH,
      y: rng() * LOGICAL_HEIGHT,
      radius,
      rotation: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 0.6,
      vx: -(6 + rng() * 14),
      vy: 8 + rng() * 16,
      shape: Array.from({ length: 11 }, () => 0.78 + rng() * 0.32),
      craters: Array.from({ length: 2 + Math.floor(rng() * 2) }, () => ({
        dx: (rng() - 0.5) * 0.9,
        dy: (rng() - 0.5) * 0.9,
        size: 0.12 + rng() * 0.16,
      })),
    }
  })
}

/** 소행성을 천천히 흘려보내며 회전시킨다. 화면 밖으로 나가면 반대쪽에서 다시 나타난다. */
export function updateAsteroids(asteroids: Asteroid[], dt: number): void {
  for (const a of asteroids) {
    a.x += a.vx * dt
    a.y += a.vy * dt
    a.rotation += a.spin * dt
    const m = a.radius * 1.3
    if (a.x < -m) a.x = LOGICAL_WIDTH + m
    if (a.y > LOGICAL_HEIGHT + m) a.y = -m
  }
}

/** 우주 배경: 별과 소행성(asteroid)이 흐르는 배경. */
export interface Backdrop {
  stars: Star[]
  asteroids: Asteroid[]
}

export function createBackdrop(rng: Rng = Math.random): Backdrop {
  return { stars: createStars(rng), asteroids: createAsteroids(rng) }
}

export function updateBackdrop(backdrop: Backdrop, dt: number): void {
  updateStars(backdrop.stars, dt)
  updateAsteroids(backdrop.asteroids, dt)
}

function renderNebula(ctx: CanvasRenderingContext2D): void {
  const blobs = [
    { x: 260, y: 200, r: 420, color: '120, 60, 200', a: 0.22 },
    { x: 1050, y: 520, r: 460, color: '40, 120, 210', a: 0.18 },
    { x: 720, y: 90, r: 320, color: '210, 60, 160', a: 0.1 },
  ]
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    g.addColorStop(0, `rgba(${b.color}, ${b.a})`)
    g.addColorStop(1, `rgba(${b.color}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  }
}

function renderAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid): void {
  ctx.save()
  ctx.translate(a.x, a.y)
  ctx.rotate(a.rotation)

  ctx.beginPath()
  a.shape.forEach((k, i) => {
    const ang = (i / a.shape.length) * Math.PI * 2
    const px = Math.cos(ang) * a.radius * k
    const py = Math.sin(ang) * a.radius * k
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  // 왼쪽 위에서 빛을 받는 바위 질감
  const rock = ctx.createLinearGradient(-a.radius, -a.radius, a.radius, a.radius)
  rock.addColorStop(0, '#75699a')
  rock.addColorStop(0.55, '#3b3556')
  rock.addColorStop(1, '#16132a')
  ctx.fillStyle = rock
  ctx.fill()
  ctx.strokeStyle = 'rgba(190, 175, 235, 0.35)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  for (const c of a.craters) {
    const cx = c.dx * a.radius
    const cy = c.dy * a.radius
    const cr = c.size * a.radius
    ctx.fillStyle = 'rgba(10, 8, 24, 0.45)'
    ctx.beginPath()
    ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(190, 175, 235, 0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx + cr * 0.15, cy + cr * 0.15, cr, Math.PI * 0.9, Math.PI * 1.9)
    ctx.stroke()
  }
  ctx.restore()
}

export function renderBackdrop(ctx: CanvasRenderingContext2D, backdrop: Backdrop, time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT)
  bg.addColorStop(0, '#04041a')
  bg.addColorStop(1, '#170a36')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  renderNebula(ctx)

  ctx.fillStyle = '#ffffff'
  for (const s of backdrop.stars) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 2 + s.phase)
    ctx.fillRect(s.x, s.y, s.size, s.size)
  }
  // 플레이 영역의 블록·공이 잘 보이도록 소행성은 살짝 어둡게 그린다.
  ctx.globalAlpha = 0.85
  for (const a of backdrop.asteroids) renderAsteroid(ctx, a)
  ctx.globalAlpha = 1
}

/** 좌/우/상단 벽. 안쪽 가장자리에 네온 선을 그려 공이 튕기는 경계를 분명히 보여준다. */
export function renderWalls(ctx: CanvasRenderingContext2D): void {
  const t = WALL_THICKNESS
  const w = LOGICAL_WIDTH
  const h = LOGICAL_HEIGHT

  // 벽 본체: 바깥쪽이 어둡고 안쪽이 밝은 금속 느낌
  const left = ctx.createLinearGradient(0, 0, t, 0)
  left.addColorStop(0, '#0d1230')
  left.addColorStop(1, '#3a4a7a')
  ctx.fillStyle = left
  ctx.fillRect(0, 0, t, h)

  const right = ctx.createLinearGradient(w, 0, w - t, 0)
  right.addColorStop(0, '#0d1230')
  right.addColorStop(1, '#3a4a7a')
  ctx.fillStyle = right
  ctx.fillRect(w - t, 0, t, h)

  const top = ctx.createLinearGradient(0, 0, 0, t)
  top.addColorStop(0, '#0d1230')
  top.addColorStop(1, '#3a4a7a')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, w, t)

  // 안쪽 가장자리의 네온 경계선
  ctx.save()
  ctx.strokeStyle = '#4de3ff'
  ctx.shadowColor = '#4de3ff'
  ctx.shadowBlur = 14
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(t, h)
  ctx.lineTo(t, t)
  ctx.lineTo(w - t, t)
  ctx.lineTo(w - t, h)
  ctx.stroke()
  ctx.restore()
}
