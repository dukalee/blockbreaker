import { describe, expect, it, vi } from 'vitest'
import type { Block } from './blocks'
import { ITEM_DROP_CHANCE, ITEM_FALL_SPEED, ITEM_HEIGHT, LOGICAL_HEIGHT } from './constants'
import { createGame, loseLife, updateGame } from './game'
import { InputState } from './input'
import { createItem, ITEM_TYPES, rollItemDrop, updateItems, type Item } from './items'
import { createPaddle } from './paddle'

function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function block(type: Block['type'], x: number, y: number): Block {
  return { col: 0, row: 0, x, y, width: 100, height: 32, type, hp: type === 'reinforced' ? 2 : 1, color: '#fff' }
}

function item(x: number, y: number): Item {
  return { type: 'multiBall', x, y, width: 48, height: ITEM_HEIGHT }
}

describe('rollItemDrop', () => {
  it('드롭 확률 미만의 난수에서만 드롭하고, 난수로 종류를 고른다', () => {
    const seq = [ITEM_DROP_CHANCE - 0.001, 0]
    expect(rollItemDrop(() => seq.shift()!)).toBe(ITEM_TYPES[0])
    expect(rollItemDrop(() => ITEM_DROP_CHANCE)).toBeNull()
    expect(rollItemDrop(() => 0.99)).toBeNull()
    const last = [0, 0.999]
    expect(rollItemDrop(() => last.shift()!)).toBe(ITEM_TYPES[5])
  })

  it('약 20% 확률로 드롭하고 6종이 고르게 나온다', () => {
    const rng = seeded(2024)
    const n = 60000
    const counts = new Map<string, number>()
    let drops = 0
    for (let i = 0; i < n; i++) {
      const t = rollItemDrop(rng)
      if (t) {
        drops++
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    expect(drops / n).toBeGreaterThan(0.19)
    expect(drops / n).toBeLessThan(0.21)
    expect(counts.size).toBe(6)
    for (const c of counts.values()) {
      expect(c / drops).toBeGreaterThan(1 / 6 - 0.02)
      expect(c / drops).toBeLessThan(1 / 6 + 0.02)
    }
  })

  it('확률을 인자로 조정할 수 있다', () => {
    expect(rollItemDrop(() => 0.5, 1)).not.toBeNull()
    expect(rollItemDrop(() => 0, 0)).toBeNull()
  })
})

describe('updateItems', () => {
  it('블록 중심에서 시작해 일정한 속도로(가속 없이) 아래로 떨어진다', () => {
    const paddle = createPaddle()
    const it0 = createItem('scoreBonus', block('normal', 100, 100))
    expect(it0.x).toBe(150)
    expect(it0.y).toBe(116)
    let items = [it0]
    const steps: number[] = []
    for (let i = 0; i < 5; i++) {
      const before = items[0].y
      items = updateItems(items, paddle, 0.1, vi.fn())
      steps.push(items[0].y - before)
    }
    for (const step of steps) expect(step).toBeCloseTo(ITEM_FALL_SPEED * 0.1)
    // 시간이 지나도 프레임당 이동 거리가 변하지 않는다.
    expect(Math.max(...steps) - Math.min(...steps)).toBeCloseTo(0)
  })

  it('프레임 길이와 무관하게 같은 시간에는 같은 거리를 떨어진다', () => {
    const paddle = createPaddle()
    let a = [item(100, 100)]
    let b = [item(100, 100)]
    for (let i = 0; i < 60; i++) a = updateItems(a, paddle, 1 / 60, vi.fn())
    for (let i = 0; i < 30; i++) b = updateItems(b, paddle, 1 / 30, vi.fn())
    expect(a[0].y).toBeCloseTo(100 + ITEM_FALL_SPEED)
    expect(b[0].y).toBeCloseTo(a[0].y)
  })

  it('막대에 닿으면 습득 이벤트가 발생하고 사라진다', () => {
    const paddle = createPaddle()
    const onPickup = vi.fn()
    const items = updateItems([item(paddle.x, paddle.y - 5)], paddle, 1 / 60, onPickup)
    expect(onPickup).toHaveBeenCalledWith('multiBall')
    expect(items).toHaveLength(0)
  })

  it('막대 옆을 지나가면 습득되지 않고, 화면 아래로 나가면 제거된다', () => {
    const paddle = createPaddle()
    const onPickup = vi.fn()
    let items = [item(paddle.x + paddle.width / 2 + 100, paddle.y - 5)]
    items = updateItems(items, paddle, 1 / 60, onPickup)
    expect(items).toHaveLength(1)
    items[0].y = LOGICAL_HEIGHT + ITEM_HEIGHT
    items = updateItems(items, paddle, 1 / 60, onPickup)
    expect(items).toHaveLength(0)
    expect(onPickup).not.toHaveBeenCalled()
  })
})

// 공이 (x, y)의 블록 아랫면을 위로 치도록 배치한다.
function hitBlockFromBelow(state: ReturnType<typeof createGame>, b: Block) {
  const ball = state.balls[0]
  ball.launched = true
  ball.x = b.x + b.width / 2
  ball.y = b.y + b.height + 5
  ball.vx = 0
  ball.vy = -300
}

describe('블록 파괴 시 드롭', () => {
  it('일반 블록이 깨지면 드롭 확률에 따라 아이템이 생긴다', () => {
    const state = createGame({ rng: () => 0 })
    const target = block('normal', 700, 300)
    state.blocks = [target, block('normal', 100, 100)]
    hitBlockFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.items).toHaveLength(1)
    expect(state.items[0].type).toBe(ITEM_TYPES[0])
  })

  it('드롭 확률에 걸리지 않으면 아이템이 없다', () => {
    const state = createGame({ rng: () => 0.9 })
    const target = block('normal', 700, 300)
    state.blocks = [target, block('normal', 100, 100)]
    hitBlockFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.blocks).toHaveLength(1)
    expect(state.items).toHaveLength(0)
  })

  it('메탈 블록에서는 아이템이 나오지 않는다', () => {
    const state = createGame({ rng: () => 0 })
    const target = block('metal', 700, 300)
    state.blocks = [target, block('normal', 100, 100)]
    hitBlockFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.items).toHaveLength(0)
  })

  it('첫 타격만 받은 강화 블록에서는 아이템이 나오지 않고, 두 번째 타격에서 나온다', () => {
    const state = createGame({ rng: () => 0 })
    const target = block('reinforced', 700, 300)
    state.blocks = [target, block('normal', 100, 100)]
    hitBlockFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(target.hp).toBe(1)
    expect(state.items).toHaveLength(0)
    hitBlockFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(state.items).toHaveLength(1)
  })
})

describe('낙하 중인 아이템 유지와 습득 연결', () => {
  it('LIFE를 잃어도 낙하 중인 아이템은 계속 떨어진다', () => {
    const state = createGame()
    state.items = [item(100, 200)]
    loseLife(state)
    expect(state.items).toHaveLength(1)
    const y = state.items[0].y
    updateGame(state, new InputState(), 1 / 60)
    expect(state.items[0].y).toBeGreaterThan(y)
  })

  it('스테이지가 넘어가도 낙하 중인 아이템은 유지된다', () => {
    const state = createGame()
    state.items = [item(100, 200)]
    state.blocks = []
    updateGame(state, new InputState(), 1 / 60)
    expect(state.stage).toBe(2)
    expect(state.items).toHaveLength(1)
  })

  it('pause 중에는 아이템도 멈춘다', () => {
    const state = createGame()
    state.items = [item(100, 200)]
    state.paused = true
    updateGame(state, new InputState(), 1)
    expect(state.items[0].y).toBe(200)
  })

  it('막대로 아이템을 받으면 onItemPickup이 호출된다', () => {
    const onItemPickup = vi.fn()
    const state = createGame({ onItemPickup })
    state.items = [{ ...item(state.paddle.x, state.paddle.y - 5), type: 'paddleLong' }]
    updateGame(state, new InputState(), 1 / 60)
    expect(onItemPickup).toHaveBeenCalledWith('paddleLong')
    expect(state.items).toHaveLength(0)
  })
})
