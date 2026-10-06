import { describe, expect, it } from 'vitest'
import { createBall, updateBall, type Ball } from './ball'
import {
  collideBlocks,
  generateStage,
  hasBreakableBlocks,
  hitBlock,
  type Block,
  type BlockType,
} from './blocks'
import { BLOCK_COLORS, BLOCK_SCORE, GRID_COLS, GRID_ROWS } from './constants'
import { createPaddle } from './paddle'

// 시드 고정 난수 (mulberry32)
function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeBlock(type: BlockType, x = 400, y = 200): Block {
  return {
    col: 0,
    row: 0,
    x,
    y,
    width: 100,
    height: 32,
    type,
    hp: type === 'reinforced' ? 2 : 1,
    color: '#fff',
  }
}

function makeBall(x: number, y: number, vx: number, vy: number): Ball {
  const ball = createBall(createPaddle())
  ball.launched = true
  ball.x = x
  ball.y = y
  ball.vx = vx
  ball.vy = vy
  ball.speed = Math.hypot(vx, vy)
  return ball
}

describe('generateStage 배치', () => {
  it('96칸의 40~70%를 채우고 칸이 겹치지 않는다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const blocks = generateStage({ metalRatio: 0, reinforcedRatio: 0 }, seeded(seed))
      expect(blocks.length).toBeGreaterThanOrEqual(Math.ceil(GRID_COLS * GRID_ROWS * 0.4))
      expect(blocks.length).toBeLessThanOrEqual(Math.floor(GRID_COLS * GRID_ROWS * 0.7))
      expect(new Set(blocks.map((b) => `${b.col},${b.row}`)).size).toBe(blocks.length)
      for (const b of blocks) {
        expect(b.col).toBeGreaterThanOrEqual(0)
        expect(b.col).toBeLessThan(GRID_COLS)
        expect(b.row).toBeGreaterThanOrEqual(0)
        expect(b.row).toBeLessThan(GRID_ROWS)
      }
    }
  })

  it('입력한 비율대로 메탈·강화 블록을 만든다', () => {
    const blocks = generateStage({ metalRatio: 0.1, reinforcedRatio: 0.3 }, seeded(7))
    const n = blocks.length
    expect(blocks.filter((b) => b.type === 'metal').length).toBe(Math.round(n * 0.1))
    expect(blocks.filter((b) => b.type === 'reinforced').length).toBe(Math.round(n * 0.3))
  })

  it('비율이 0이면 일반 블록만 만든다', () => {
    const blocks = generateStage({ metalRatio: 0, reinforcedRatio: 0 }, seeded(3))
    expect(blocks.every((b) => b.type === 'normal')).toBe(true)
  })

  it('일반 블록은 여러 색을 사용한다', () => {
    const blocks = generateStage({ metalRatio: 0, reinforcedRatio: 0 }, seeded(5))
    const colors = new Set(blocks.map((b) => b.color))
    expect(colors.size).toBeGreaterThan(1)
    for (const c of colors) expect(BLOCK_COLORS).toContain(c)
  })

  it('비율이 극단적이어도 파괴 가능한 블록이 최소 1개 있다', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const blocks = generateStage({ metalRatio: 1, reinforcedRatio: 0 }, seeded(seed))
      expect(hasBreakableBlocks(blocks)).toBe(true)
    }
  })
})

describe('점수 계산', () => {
  it('일반 블록은 1타에 깨지고 100점', () => {
    const b = makeBlock('normal')
    expect(hitBlock(b)).toBe(BLOCK_SCORE)
    expect(b.hp).toBe(0)
  })

  it('강화 블록은 1타에 0점, 2타에 100점', () => {
    const b = makeBlock('reinforced')
    expect(hitBlock(b)).toBe(0)
    expect(b.hp).toBe(1)
    expect(hitBlock(b)).toBe(BLOCK_SCORE)
    expect(b.hp).toBe(0)
  })

  it('메탈 블록은 아무리 맞아도 깨지지 않고 점수도 없다', () => {
    const b = makeBlock('metal')
    for (let i = 0; i < 5; i++) expect(hitBlock(b)).toBe(0)
    expect(b.hp).toBe(1)
  })

  it('이미 깨진 블록은 점수를 주지 않는다', () => {
    const b = makeBlock('normal')
    hitBlock(b)
    expect(hitBlock(b)).toBe(0)
  })
})

describe('충돌 축 판정', () => {
  it('블록 아랫면에 맞으면 y축으로 반사되고 블록 밖으로 밀려난다', () => {
    const b = makeBlock('normal') // y 200~232
    const ball = makeBall(450, 232 + 5, 100, -300) // 반지름 10: 아래에서 5 파고듦
    const score = collideBlocks(ball, [b])
    expect(score).toBe(BLOCK_SCORE)
    expect(ball.vy).toBeGreaterThan(0)
    expect(ball.vx).toBeGreaterThan(0)
    expect(ball.y - ball.radius).toBeGreaterThanOrEqual(232)
  })

  it('블록 윗면에 맞으면 위로 반사된다', () => {
    const b = makeBlock('normal')
    const ball = makeBall(450, 200 - 5, 0, 300)
    collideBlocks(ball, [b])
    expect(ball.vy).toBeLessThan(0)
  })

  it('블록 옆면에 맞으면 x축으로 반사된다', () => {
    const b = makeBlock('normal') // x 400~500
    const ball = makeBall(400 - 5, 216, 300, -100)
    collideBlocks(ball, [b])
    expect(ball.vx).toBeLessThan(0)
    expect(ball.vy).toBeLessThan(0)
    expect(ball.x + ball.radius).toBeLessThanOrEqual(400)
  })

  it('모서리에 맞아도 겹침이 적은 축으로 반사된다', () => {
    const b = makeBlock('normal')
    // 왼쪽 아래 모서리 근처: y로 더 깊이, x로 덜 겹침 → x축 반사
    const ball = makeBall(400 - 4, 232 + 3, 200, -200)
    collideBlocks(ball, [b])
    expect(ball.vx).toBeLessThan(0)
    expect(ball.vy).toBeLessThan(0)
  })

  it('블록에서 멀어지는 방향이면 반사하지 않고 타격도 없다', () => {
    const b = makeBlock('normal')
    const ball = makeBall(450, 232 + 5, 0, 300) // 아래로 멀어지는 중
    expect(collideBlocks(ball, [b])).toBe(0)
    expect(b.hp).toBe(1)
    expect(ball.vy).toBe(300)
  })

  it('겹치지 않으면 아무 일도 없다', () => {
    const b = makeBlock('normal')
    const ball = makeBall(450, 300, 0, -300)
    expect(collideBlocks(ball, [b])).toBe(0)
    expect(b.hp).toBe(1)
  })

  it('반사 후 각도가 수평 기준 15도 이상이다', () => {
    const b = makeBlock('normal')
    const ball = makeBall(450, 232 + 5, 480, -5)
    collideBlocks(ball, [b])
    const angle = (Math.atan2(Math.abs(ball.vy), Math.abs(ball.vx)) * 180) / Math.PI
    expect(angle).toBeGreaterThanOrEqual(15 - 1e-9)
  })

  it('메탈 블록은 깨지지 않지만 공은 반사된다', () => {
    const b = makeBlock('metal')
    const ball = makeBall(450, 232 + 5, 0, -300)
    expect(collideBlocks(ball, [b])).toBe(0)
    expect(b.hp).toBe(1)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it('강화 블록은 두 번 맞아야 점수가 오른다', () => {
    const b = makeBlock('reinforced')
    const ball = makeBall(450, 232 + 5, 0, -300)
    expect(collideBlocks(ball, [b])).toBe(0)
    const ball2 = makeBall(450, 232 + 5, 0, -300)
    expect(collideBlocks(ball2, [b])).toBe(BLOCK_SCORE)
  })

  it('두 블록에 동시에 닿아도 한 번만 반사되고 둘 다 타격받는다', () => {
    const a = makeBlock('normal', 400, 200)
    const c = makeBlock('normal', 500, 200)
    const ball = makeBall(500, 232 + 5, 0, -300) // 두 블록의 이음새
    const score = collideBlocks(ball, [a, c])
    expect(score).toBe(BLOCK_SCORE * 2)
    expect(ball.vy).toBeGreaterThan(0)
  })
})

describe('통합: updateBall + 블록', () => {
  it('빠른 공도 블록을 통과하지 않는다', () => {
    const paddle = createPaddle()
    const b = makeBlock('metal', 600, 300)
    const ball = makeBall(650, 360, 0, -3000)
    updateBall(ball, paddle, 1 / 60, (bl) => collideBlocks(bl, [b]))
    expect(ball.vy).toBeGreaterThan(0)
    expect(ball.y - ball.radius).toBeGreaterThanOrEqual(332 - 1e-6)
  })

  it('공을 무작위로 많이 쏴도 블록 안에 끼어 있지 않다', () => {
    const rng = seeded(42)
    const blocks = generateStage({ metalRatio: 0.1, reinforcedRatio: 0.3 }, rng)
    const paddle = createPaddle()
    const ball = makeBall(640, 600, 300, -350)
    for (let i = 0; i < 20000; i++) {
      updateBall(ball, paddle, 1 / 60, (bl) => collideBlocks(bl, blocks))
      if (ball.y > 650) {
        ball.y = 600
        ball.vy = -Math.abs(ball.vy)
      }
      for (const bl of blocks) {
        if (bl.hp <= 0) continue
        const inside = ball.x > bl.x + 1 && ball.x < bl.x + bl.width - 1 && ball.y > bl.y + 1 && ball.y < bl.y + bl.height - 1
        expect(inside).toBe(false)
      }
    }
  })
})
