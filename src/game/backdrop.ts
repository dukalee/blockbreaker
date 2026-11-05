import type { Rng } from './blocks'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, WALL_THICKNESS } from './constants'

export const STAR_COUNT = 140

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

/** 픽셀 레트로 배경: 어두운 남색 격자 위로 네모난 별이 흐른다. */
export interface Backdrop {
  stars: Star[]
}

export function createBackdrop(rng: Rng = Math.random): Backdrop {
  return { stars: createStars(rng) }
}

export function updateBackdrop(backdrop: Backdrop, dt: number): void {
  updateStars(backdrop.stars, dt)
}

const BG = '#0d0f1e'
const GRID = '#151934'
const GRID_STEP = 40
const GRID_LINE = 4

export function renderBackdrop(ctx: CanvasRenderingContext2D, backdrop: Backdrop, time: number): void {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)

  // 픽셀 격자
  ctx.fillStyle = GRID
  for (let x = 0; x < LOGICAL_WIDTH; x += GRID_STEP) ctx.fillRect(x, 0, GRID_LINE, LOGICAL_HEIGHT)
  for (let y = 0; y < LOGICAL_HEIGHT; y += GRID_STEP) ctx.fillRect(0, y, LOGICAL_WIDTH, GRID_LINE)

  // 네모난 별: 반짝임은 부드러운 투명도 대신 켜고 끄는 방식으로 표현한다.
  ctx.fillStyle = '#c9d3ff'
  for (const s of backdrop.stars) {
    if (Math.sin(time * 2 + s.phase) < -0.2) continue
    const size = s.size > 2 ? 4 : 2
    ctx.fillRect(Math.round(s.x / 2) * 2, Math.round(s.y / 2) * 2, size, size)
  }
}

const WALL_LIGHT = '#c9d3ff'
const WALL_DARK = '#5b66b8'
const WALL_STEP = 8

/** 좌/우/상단 벽. 밝고 어두운 8px 조각이 번갈아 이어지는 벽돌 띠로 그린다. */
export function renderWalls(ctx: CanvasRenderingContext2D): void {
  const t = WALL_THICKNESS
  const w = LOGICAL_WIDTH
  const h = LOGICAL_HEIGHT

  for (let y = 0; y < h; y += WALL_STEP * 2) {
    ctx.fillStyle = WALL_LIGHT
    ctx.fillRect(0, y, t, WALL_STEP)
    ctx.fillRect(w - t, y, t, WALL_STEP)
    ctx.fillStyle = WALL_DARK
    ctx.fillRect(0, y + WALL_STEP, t, WALL_STEP)
    ctx.fillRect(w - t, y + WALL_STEP, t, WALL_STEP)
  }
  for (let x = t; x < w - t; x += WALL_STEP * 2) {
    ctx.fillStyle = WALL_LIGHT
    ctx.fillRect(x, 0, WALL_STEP, t)
    ctx.fillStyle = WALL_DARK
    ctx.fillRect(x + WALL_STEP, 0, WALL_STEP, t)
  }
}

/** 오래된 CRT 화면 같은 가로 스캔라인. 맨 마지막에 화면 전체에 덧씌운다. */
export function renderScanlines(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'
  for (let y = 2; y < LOGICAL_HEIGHT; y += 4) ctx.fillRect(0, y, LOGICAL_WIDTH, 2)
}
