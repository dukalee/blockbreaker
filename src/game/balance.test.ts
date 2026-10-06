import { describe, expect, it } from 'vitest'
import { generateStage } from './blocks'
import {
  BALL_BASE_SPEED,
  FILL_RATIO_MAX,
  FILL_RATIO_MIN,
  GRID_COLS,
  GRID_ROWS,
  LOW_LEVEL_MAX_STAGE,
} from './constants'
import { createGame, difficultyForStage } from './game'

const TOTAL = GRID_COLS * GRID_ROWS

function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('낮은 레벨의 블록 수', () => {
  it('스테이지 1~3은 채움 배율이 0.5이고 4부터는 1이다', () => {
    for (let s = 1; s <= LOW_LEVEL_MAX_STAGE; s++) expect(difficultyForStage(s).fillScale).toBe(0.5)
    expect(difficultyForStage(LOW_LEVEL_MAX_STAGE + 1).fillScale).toBe(1)
    expect(difficultyForStage(50).fillScale).toBe(1)
  })

  it('낮은 레벨은 96칸의 20~35%(기존 40~70%의 절반)를 채운다', () => {
    const min = Math.ceil(TOTAL * FILL_RATIO_MIN * 0.5)
    const max = Math.floor(TOTAL * FILL_RATIO_MAX * 0.5)
    expect(min).toBe(20)
    expect(max).toBe(33)
    for (let seed = 1; seed <= 300; seed++) {
      const n = generateStage({ metalRatio: 0, reinforcedRatio: 0, fillScale: 0.5 }, seeded(seed)).length
      expect(n).toBeGreaterThanOrEqual(min)
      expect(n).toBeLessThanOrEqual(max)
    }
  })

  it('낮은 레벨의 평균 블록 수가 높은 레벨의 약 절반이다', () => {
    const avg = (fillScale: number) => {
      let sum = 0
      for (let seed = 1; seed <= 300; seed++) {
        sum += generateStage({ metalRatio: 0, reinforcedRatio: 0, fillScale }, seeded(seed)).length
      }
      return sum / 300
    }
    const ratio = avg(0.5) / avg(1)
    expect(ratio).toBeGreaterThan(0.45)
    expect(ratio).toBeLessThan(0.55)
  })

  it('fillScale을 주지 않으면 기존대로 40~70%이다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const n = generateStage({ metalRatio: 0, reinforcedRatio: 0 }, seeded(seed)).length
      expect(n).toBeGreaterThanOrEqual(Math.ceil(TOTAL * FILL_RATIO_MIN))
      expect(n).toBeLessThanOrEqual(Math.floor(TOTAL * FILL_RATIO_MAX))
    }
  })

  it('실제 게임에서 스테이지 1은 20~33개, 스테이지 4는 39~67개로 시작한다', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const g = createGame({ rng: seeded(seed) })
      expect(g.blocks.length).toBeGreaterThanOrEqual(20)
      expect(g.blocks.length).toBeLessThanOrEqual(33)
    }
    const g = createGame({ rng: seeded(5) })
    g.stage = LOW_LEVEL_MAX_STAGE
    g.blocks = []
    // 스테이지 클리어로 4스테이지가 생성된다.
    // (updateGame을 거치지 않고 규칙만 확인: 난이도 계산이 높은 레벨 범위를 낸다.)
    const d = difficultyForStage(g.stage + 1)
    const n = generateStage(
      { metalRatio: d.metalRatio, reinforcedRatio: d.reinforcedRatio, fillScale: d.fillScale },
      seeded(5),
    ).length
    expect(n).toBeGreaterThanOrEqual(39)
    expect(n).toBeLessThanOrEqual(67)
  })

  it('낮은 레벨에서도 파괴 가능한 블록이 최소 1개 있다', () => {
    const blocks = generateStage({ metalRatio: 1, reinforcedRatio: 0, fillScale: 0.5 }, seeded(9))
    expect(blocks.some((b) => b.type !== 'metal')).toBe(true)
  })
})

describe('공 기본 속도', () => {
  it('기존 480의 1.25배인 600px/s이다', () => {
    expect(BALL_BASE_SPEED).toBe(480 * 1.25)
    expect(BALL_BASE_SPEED).toBe(600)
  })

  it('스테이지 1은 600, 이후 스테이지당 +5%이고 최대 기본 속도의 2배(1200)이다', () => {
    expect(difficultyForStage(1).ballSpeed).toBe(600)
    expect(difficultyForStage(2).ballSpeed).toBeCloseTo(630)
    expect(difficultyForStage(100).ballSpeed).toBeCloseTo(1200)
  })

  it('새 게임의 공은 600px/s로 발사 준비된다', () => {
    expect(createGame().balls[0].speed).toBe(600)
  })
})
