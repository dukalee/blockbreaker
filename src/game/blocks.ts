import { enforceMinAngle, type Ball } from './ball'
import {
  BLOCK_AREA_LEFT,
  BLOCK_AREA_TOP,
  BLOCK_COLORS,
  BLOCK_HEIGHT,
  BLOCK_SCORE,
  BLOCK_WIDTH,
  FILL_RATIO_MAX,
  FILL_RATIO_MIN,
  GRID_COLS,
  GRID_ROWS,
} from './constants'

export type BlockType = 'normal' | 'reinforced' | 'metal'

export interface Block {
  col: number
  row: number
  /** 충돌 영역(셀 전체). 인접 블록 사이에 틈이 없다. */
  x: number
  y: number
  width: number
  height: number
  type: BlockType
  /** 남은 타격 횟수. 0이면 파괴된 것. 메탈은 줄지 않는다. */
  hp: number
  color: string
}

export interface StageOptions {
  /** 채워진 칸 중 메탈 블록 비율 (0~1) */
  metalRatio: number
  /** 채워진 칸 중 강화 블록 비율 (0~1) */
  reinforcedRatio: number
  /** 채움 비율(40~70%)에 곱하는 배율. 낮은 레벨에서 블록 수를 줄일 때 쓴다. 기본 1. */
  fillScale?: number
}

export type Rng = () => number

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/**
 * 12x8 그리드의 40~70%(fillScale을 곱한 비율)를 랜덤으로 채운 블록 배열을 만든다.
 * 파괴 가능한 블록(일반/강화)은 항상 최소 1개 있다.
 */
export function generateStage(options: StageOptions, rng: Rng = Math.random): Block[] {
  const total = GRID_COLS * GRID_ROWS
  const scale = options.fillScale ?? 1
  const minCount = Math.max(1, Math.ceil(total * FILL_RATIO_MIN * scale))
  const maxCount = Math.max(minCount, Math.floor(total * FILL_RATIO_MAX * scale))
  const count = minCount + Math.floor(rng() * (maxCount - minCount + 1))

  const cells = shuffle(
    Array.from({ length: total }, (_, i) => i),
    rng,
  ).slice(0, count)

  const metalCount = Math.min(Math.round(count * options.metalRatio), count - 1)
  const reinforcedCount = Math.min(Math.round(count * options.reinforcedRatio), count - metalCount)

  return cells.map((cell, i) => {
    const col = cell % GRID_COLS
    const row = Math.floor(cell / GRID_COLS)
    const type: BlockType = i < metalCount ? 'metal' : i < metalCount + reinforcedCount ? 'reinforced' : 'normal'
    return {
      col,
      row,
      x: BLOCK_AREA_LEFT + col * BLOCK_WIDTH,
      y: BLOCK_AREA_TOP + row * BLOCK_HEIGHT,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      type,
      hp: type === 'reinforced' ? 2 : 1,
      color: BLOCK_COLORS[Math.floor(rng() * BLOCK_COLORS.length)],
    }
  })
}

/** 블록에 타격을 적용한다. 완전히 깨졌을 때만 점수를 반환하고, 아니면 0. */
export function hitBlock(block: Block): number {
  if (block.type === 'metal' || block.hp <= 0) return 0
  block.hp -= 1
  return block.hp === 0 ? BLOCK_SCORE : 0
}

/** 깨야 하는 블록(메탈 제외)이 남아 있는지. */
export function hasBreakableBlocks(blocks: Block[]): boolean {
  return blocks.some((b) => b.type !== 'metal' && b.hp > 0)
}

function overlapsCircle(ball: Ball, b: Block): boolean {
  const cx = Math.max(b.x, Math.min(ball.x, b.x + b.width))
  const cy = Math.max(b.y, Math.min(ball.y, b.y + b.height))
  const dx = ball.x - cx
  const dy = ball.y - cy
  return dx * dx + dy * dy < ball.radius * ball.radius
}

/**
 * 공과 겹친 모든 블록에 타격을 주고 반사시킨다. 이번 호출에서 얻은 점수를 반환한다.
 * 블록마다 겹침이 더 적은 축으로 반사하며, 공이 블록 쪽으로 향할 때만 반사한다.
 * 블록이 완전히 깨질 때마다 onDestroy가, 공이 블록을 타격할 때마다 onHit(깨졌는지 여부 포함)이 호출된다.
 * 속도는 호출 시작 시점의 값으로 판단하므로 여러 블록에 동시에 닿아도 한 번만 뒤집힌다.
 */
export function collideBlocks(
  ball: Ball,
  blocks: Block[],
  onDestroy?: (block: Block) => void,
  onHit?: (block: Block, destroyed: boolean) => void,
): number {
  const { vx, vy } = ball
  let score = 0
  let reflected = false

  // 반사로 공 위치가 밀려나기 전에 닿은 블록을 모두 모은다.
  const touched = blocks.filter((b) => b.hp > 0 && overlapsCircle(ball, b))

  for (const b of touched) {

    const overlapX = Math.min(ball.x + ball.radius - b.x, b.x + b.width - (ball.x - ball.radius))
    const overlapY = Math.min(ball.y + ball.radius - b.y, b.y + b.height - (ball.y - ball.radius))
    const fromLeft = ball.x < b.x + b.width / 2
    const fromTop = ball.y < b.y + b.height / 2
    const movingIntoX = fromLeft ? vx > 0 : vx < 0
    const movingIntoY = fromTop ? vy > 0 : vy < 0

    let axis: 'x' | 'y' | null = overlapX < overlapY ? 'x' : 'y'
    if (axis === 'x' && !movingIntoX) axis = movingIntoY ? 'y' : null
    else if (axis === 'y' && !movingIntoY) axis = movingIntoX ? 'x' : null
    if (axis === null) continue

    if (axis === 'x') {
      ball.vx = fromLeft ? -Math.abs(vx) : Math.abs(vx)
      ball.x = fromLeft ? b.x - ball.radius : b.x + b.width + ball.radius
    } else {
      ball.vy = fromTop ? -Math.abs(vy) : Math.abs(vy)
      ball.y = fromTop ? b.y - ball.radius : b.y + b.height + ball.radius
    }
    reflected = true
    const gained = hitBlock(b)
    score += gained
    // 완전히 깨진 블록만 알린다. (메탈, 첫 타격만 받은 강화 블록은 제외)
    if (gained > 0) onDestroy?.(b)
    onHit?.(b, gained > 0)
  }

  if (reflected) enforceMinAngle(ball)
  return score
}
