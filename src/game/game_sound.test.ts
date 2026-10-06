import { describe, expect, it } from 'vitest'
import { launchBall } from './ball'
import type { Block } from './blocks'
import { createGame, drainEvents, loseLife, updateGame, type GameState } from './game'
import { InputState } from './input'
import type { Item } from './items'

function block(type: Block['type'], x: number, y: number): Block {
  return { col: 0, row: 0, x, y, width: 100, height: 32, type, hp: type === 'reinforced' ? 2 : 1, color: '#fff' }
}

function hitFromBelow(state: GameState, b: Block): void {
  const ball = state.balls[0]
  ball.launched = true
  ball.x = b.x + b.width / 2
  ball.y = b.y + b.height + 5
  ball.vx = 0
  ball.vy = -300
}

function playing(): GameState {
  const state = createGame({ rng: () => 0.9 })
  state.blocks = [block('normal', 100, 100)]
  drainEvents(state)
  return state
}

describe('게임 이벤트 → 효과음', () => {
  it('space로 발사하면 launch', () => {
    const state = playing()
    const input = new InputState()
    input.keyDown(' ')
    updateGame(state, input, 1 / 60)
    expect(drainEvents(state)).toEqual(['launch'])
  })

  it('벽에 부딪히면 bounce', () => {
    const state = playing()
    launchBall(state.balls[0], 1)
    state.balls[0].x = 1275
    state.balls[0].y = 400
    state.balls[0].vx = 300
    state.balls[0].vy = -300
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toContain('bounce')
  })

  it('막대에 부딪히면 bounce', () => {
    const state = playing()
    const ball = state.balls[0]
    launchBall(ball, 1)
    ball.x = state.paddle.x
    ball.y = state.paddle.y - ball.radius - 2
    ball.vx = 0
    ball.vy = 400
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toContain('bounce')
  })

  it('일반 블록을 깨면 blockBreak', () => {
    const state = playing()
    const target = block('normal', 700, 300)
    state.blocks.push(target)
    hitFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toEqual(['blockBreak'])
  })

  it('메탈 블록을 치면 hardHit', () => {
    const state = playing()
    const target = block('metal', 700, 300)
    state.blocks.push(target)
    hitFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toEqual(['hardHit'])
  })

  it('강화 블록은 첫 타격에 hardHit, 두 번째에 blockBreak', () => {
    const state = playing()
    const target = block('reinforced', 700, 300)
    state.blocks.push(target)
    hitFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toEqual(['hardHit'])
    hitFromBelow(state, target)
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toEqual(['blockBreak'])
  })

  it('아이템을 받으면 itemPickup', () => {
    const state = playing()
    const item: Item = { type: 'scoreBonus', x: state.paddle.x, y: state.paddle.y - 5, width: 48, height: 24 }
    state.items.push(item)
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toEqual(['itemPickup'])
  })

  it('LIFE를 잃으면 lifeLost, 마지막 LIFE를 잃으면 gameOver', () => {
    const state = playing()
    loseLife(state)
    expect(drainEvents(state)).toEqual(['lifeLost'])
    loseLife(state)
    drainEvents(state)
    loseLife(state)
    expect(drainEvents(state)).toEqual(['gameOver'])
  })

  it('스테이지를 클리어하면 stageClear', () => {
    const state = playing()
    state.blocks = []
    updateGame(state, new InputState(), 1 / 60)
    expect(drainEvents(state)).toEqual(['stageClear'])
  })

  it('drainEvents는 이벤트를 비운다', () => {
    const state = playing()
    loseLife(state)
    expect(drainEvents(state)).toHaveLength(1)
    expect(drainEvents(state)).toHaveLength(0)
  })

  it('pause 중에는 이벤트가 생기지 않는다', () => {
    const state = playing()
    state.paused = true
    const input = new InputState()
    input.keyDown(' ')
    updateGame(state, input, 1 / 60)
    expect(drainEvents(state)).toEqual([])
  })
})
