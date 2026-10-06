import {
  attachToPaddle,
  createBall,
  isBallOut,
  launchBall,
  setBallSpeed,
  splitBall,
  updateBall,
  type Ball,
} from './ball'
import { collideBlocks, generateStage, hasBreakableBlocks, type Block, type Rng } from './blocks'
import {
  BALL_BASE_SPEED,
  BALL_SPEED_MAX_MULTIPLIER,
  BALL_SPEED_STAGE_RATE,
  INITIAL_LIFE,
  LOW_LEVEL_FILL_SCALE,
  LOW_LEVEL_MAX_STAGE,
  MAX_BALLS,
  METAL_RATIO_MAX,
  MULTI_BALL_SPREAD_DEG,
  METAL_RATIO_STAGE_STEP,
  REINFORCED_RATIO_MAX,
  REINFORCED_RATIO_STAGE_STEP,
} from './constants'
import {
  applyItem,
  ballSpeedMultiplier,
  createEffects,
  paddleWidth,
  resetBallSpeed,
  scoreMultiplier,
  updateEffects,
  type Effects,
} from './effects'
import type { InputState } from './input'
import { createItem, rollItemDrop, updateItems, type Item, type ItemType } from './items'
import { clampPaddleX, createPaddle, updatePaddle, type Paddle } from './paddle'
import type { SoundName } from './sounds'

export interface Difficulty {
  /** 해당 스테이지의 공 기본 속력(px/s) */
  ballSpeed: number
  metalRatio: number
  reinforcedRatio: number
  /** 블록 채움 비율 배율. 낮은 레벨(스테이지 1~3)은 절반. */
  fillScale: number
}

/** 스테이지 번호(1부터)에 따른 난이도. 스테이지 1은 메탈·강화 0%, 기본 속도. */
export function difficultyForStage(stage: number): Difficulty {
  const steps = Math.max(0, stage - 1)
  return {
    ballSpeed: BALL_BASE_SPEED * Math.min(BALL_SPEED_MAX_MULTIPLIER, 1 + BALL_SPEED_STAGE_RATE * steps),
    metalRatio: Math.min(METAL_RATIO_MAX, METAL_RATIO_STAGE_STEP * steps),
    reinforcedRatio: Math.min(REINFORCED_RATIO_MAX, REINFORCED_RATIO_STAGE_STEP * steps),
    fillScale: stage <= LOW_LEVEL_MAX_STAGE ? LOW_LEVEL_FILL_SCALE : 1,
  }
}

export type GamePhase = 'playing' | 'gameover'

export interface GameState {
  phase: GamePhase
  /** pause 중에는 updateGame이 아무것도 갱신하지 않는다. */
  paused: boolean
  stage: number
  score: number
  life: number
  paddle: Paddle
  /** 발사 전 대기 중이면 막대 위의 공 1개(launched=false). */
  balls: Ball[]
  blocks: Block[]
  /** 낙하 중인 아이템. LIFE 상실이나 스테이지 전환으로 사라지지 않는다. */
  items: Item[]
  /** 아이템 효과 상태. 공 속도만 LIFE 상실/스테이지 클리어 시 초기화된다. */
  effects: Effects
  /** 아직 재생하지 않은 효과음 이벤트. drainEvents로 꺼내 재생한다. */
  events: SoundName[]
  rng: Rng
  /** LIFE를 잃거나 스테이지를 클리어해 공 속도를 기본으로 되돌릴 때 호출된다. (Task 9에서 연결) */
  onBallSpeedReset?: () => void
  /** 막대로 아이템을 습득했을 때 호출된다. 실제 효과 적용은 Task 9에서 연결한다. */
  onItemPickup?: (type: ItemType) => void
}

export interface GameOptions {
  rng?: Rng
  onBallSpeedReset?: () => void
  onItemPickup?: (type: ItemType) => void
}

/** 현재 스테이지 기본 속도에 공 속도 효과를 반영한 공 속력. */
function currentBallSpeed(state: GameState): number {
  return difficultyForStage(state.stage).ballSpeed * ballSpeedMultiplier(state.effects)
}

/**
 * 막대 위에 새 공을 놓고 대기 상태로 만든다.
 * LIFE 상실과 스테이지 클리어에서 호출되므로 공 속도 효과도 여기서 초기화한다.
 * (막대 길이와 점수 + 효과, 낙하 중인 아이템은 유지된다.)
 */
function placeWaitingBall(state: GameState): void {
  resetBallSpeed(state.effects)
  state.balls = [createBall(state.paddle, currentBallSpeed(state))]
  state.onBallSpeedReset?.()
}

/** 발사된 공마다 방향이 다른 공 2개를 추가해 3배로 만든다. 전체 최대 MAX_BALLS개. */
function multiplyBalls(state: GameState): void {
  const parents = state.balls.filter((b) => b.launched)
  for (const parent of parents) {
    for (const angle of [MULTI_BALL_SPREAD_DEG, -MULTI_BALL_SPREAD_DEG]) {
      if (state.balls.length >= MAX_BALLS) return
      state.balls.push(splitBall(parent, angle))
    }
  }
}

/** 막대 길이 효과를 막대에 반영하고, 좌우 벽 밖으로 나가지 않게 보정한다. */
function syncPaddleWidth(state: GameState): void {
  state.paddle.width = paddleWidth(state.effects)
  state.paddle.x = clampPaddleX(state.paddle, state.paddle.x)
}

function applyPickup(state: GameState, type: ItemType): void {
  if (type === 'multiBall') {
    multiplyBalls(state)
  } else {
    applyItem(state.effects, type)
    if (type === 'ballSpeedUp' || type === 'ballSpeedDown') {
      const speed = currentBallSpeed(state)
      for (const ball of state.balls) setBallSpeed(ball, speed)
    }
    syncPaddleWidth(state)
  }
  state.events.push('itemPickup')
  state.onItemPickup?.(type)
}

function startStage(state: GameState): void {
  const { metalRatio, reinforcedRatio, fillScale } = difficultyForStage(state.stage)
  state.blocks = generateStage({ metalRatio, reinforcedRatio, fillScale }, state.rng)
  placeWaitingBall(state)
}

/** 새 게임: 점수 0, LIFE 3, 스테이지 1. title 시작과 restart에서 사용한다. */
export function createGame(options: GameOptions = {}): GameState {
  const state: GameState = {
    phase: 'playing',
    paused: false,
    stage: 1,
    score: 0,
    life: INITIAL_LIFE,
    paddle: createPaddle(),
    balls: [],
    blocks: [],
    items: [],
    effects: createEffects(),
    events: [],
    rng: options.rng ?? Math.random,
    onBallSpeedReset: options.onBallSpeedReset,
    onItemPickup: options.onItemPickup,
  }
  startStage(state)
  return state
}

/** 모든 공이 바닥으로 나갔을 때 호출한다. LIFE를 1 줄이고, 0이 되면 게임 오버. */
export function loseLife(state: GameState): void {
  state.life -= 1
  if (state.life <= 0) {
    state.life = 0
    state.phase = 'gameover'
    state.balls = []
    state.events.push('gameOver')
    return
  }
  placeWaitingBall(state)
  state.events.push('lifeLost')
}

/** 이번 update에서 발생한 효과음 이벤트를 꺼내고 비운다. */
export function drainEvents(state: GameState): SoundName[] {
  return state.events.splice(0)
}

export function setPaused(state: GameState, paused: boolean): void {
  if (state.phase === 'playing') state.paused = paused
}

export function togglePause(state: GameState): void {
  setPaused(state, !state.paused)
}

export function updateGame(state: GameState, input: InputState, dt: number): void {
  if (state.phase !== 'playing') return
  if (state.paused) {
    // pause 중에 눌린 space가 재개 후 발사로 이어지지 않도록 버린다.
    input.consumeLaunch()
    return
  }

  updateEffects(state.effects, dt)
  syncPaddleWidth(state)
  updatePaddle(state.paddle, input, dt)
  state.items = updateItems(state.items, state.paddle, dt, (type) => applyPickup(state, type))

  const launchRequested = input.consumeLaunch()
  for (const ball of state.balls) {
    if (!ball.launched) {
      attachToPaddle(ball, state.paddle)
      if (launchRequested) {
        launchBall(ball, state.rng() < 0.5 ? -1 : 1)
        state.events.push('launch')
      }
    } else {
      updateBall(
        ball,
        state.paddle,
        dt,
        (b) => {
          const base = collideBlocks(
            b,
            state.blocks,
            (block) => {
              const type = rollItemDrop(state.rng)
              if (type) state.items.push(createItem(type, block))
            },
            (_block, destroyed) => state.events.push(destroyed ? 'blockBreak' : 'hardHit'),
          )
          state.score += base * scoreMultiplier(state.effects)
        },
        () => state.events.push('bounce'),
      )
    }
  }

  state.blocks = state.blocks.filter((b) => b.hp > 0)

  if (!hasBreakableBlocks(state.blocks)) {
    state.stage += 1
    startStage(state)
    state.events.push('stageClear')
    return
  }

  // 발사된 공 중 바닥으로 나간 공은 제거한다. 모두 사라지면 LIFE 1 감소.
  state.balls = state.balls.filter((b) => !(b.launched && isBallOut(b)))
  if (state.balls.length === 0) loseLife(state)
}
