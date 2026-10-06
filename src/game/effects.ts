import {
  BALL_SPEED_BOOST_MULTIPLIER,
  BALL_SPEED_SLOW_MULTIPLIER,
  ITEM_DURATION_SEC,
  PADDLE_LONG_MULTIPLIER,
  PADDLE_SHORT_MULTIPLIER,
  PADDLE_WIDTH,
  SCORE_BONUS_MULTIPLIER,
} from './constants'
import type { ItemType } from './items'

export type BallSpeedState = 'normal' | 'fast' | 'slow'
export type PaddleSizeState = 'normal' | 'long' | 'short'

/** 아이템 효과 상태 (순수 데이터). 타이머는 게임 시간(dt) 기준이라 pause 중에는 흐르지 않는다. */
export interface Effects {
  /** 지속 시간 없음. LIFE 상실, 스테이지 클리어 시 normal로 초기화된다. */
  ballSpeed: BallSpeedState
  paddleSize: PaddleSizeState
  /** 막대 길이 효과 남은 시간(초). paddleSize가 normal이면 0. */
  paddleRemaining: number
  /** 점수 + 효과 남은 시간(초). 0이면 비활성. */
  scoreBonusRemaining: number
}

export function createEffects(): Effects {
  return { ballSpeed: 'normal', paddleSize: 'normal', paddleRemaining: 0, scoreBonusRemaining: 0 }
}

/**
 * 아이템 효과를 적용한다. 공 분산(multiBall)은 공 목록이 필요해 여기서 다루지 않는다.
 * - 공 속도: 누적되지 않고, 반대 아이템을 먹으면 기본 속도로 돌아간다.
 * - 막대 길이: 반대 아이템과 상쇄되고, 같은 아이템 재습득 시 10초로 갱신된다.
 * - 점수 +: 재습득 시 10초로 갱신된다.
 */
export function applyItem(effects: Effects, type: ItemType): void {
  switch (type) {
    case 'ballSpeedUp':
      effects.ballSpeed = effects.ballSpeed === 'slow' ? 'normal' : 'fast'
      break
    case 'ballSpeedDown':
      effects.ballSpeed = effects.ballSpeed === 'fast' ? 'normal' : 'slow'
      break
    case 'paddleLong':
      applyPaddle(effects, 'long', 'short')
      break
    case 'paddleShort':
      applyPaddle(effects, 'short', 'long')
      break
    case 'scoreBonus':
      effects.scoreBonusRemaining = ITEM_DURATION_SEC
      break
    case 'multiBall':
      break
  }
}

function applyPaddle(effects: Effects, kind: PaddleSizeState, opposite: PaddleSizeState): void {
  if (effects.paddleSize === opposite) {
    effects.paddleSize = 'normal'
    effects.paddleRemaining = 0
  } else {
    effects.paddleSize = kind
    effects.paddleRemaining = ITEM_DURATION_SEC
  }
}

/** 남은 시간을 줄이고, 만료된 효과를 원상태로 되돌린다. */
export function updateEffects(effects: Effects, dt: number): void {
  if (effects.paddleSize !== 'normal') {
    effects.paddleRemaining -= dt
    if (effects.paddleRemaining <= 0) {
      effects.paddleSize = 'normal'
      effects.paddleRemaining = 0
    }
  }
  if (effects.scoreBonusRemaining > 0) {
    effects.scoreBonusRemaining = Math.max(0, effects.scoreBonusRemaining - dt)
  }
}

/** LIFE 상실, 스테이지 클리어 시 공 속도만 기본으로 되돌린다. */
export function resetBallSpeed(effects: Effects): void {
  effects.ballSpeed = 'normal'
}

export function ballSpeedMultiplier(effects: Effects): number {
  return effects.ballSpeed === 'fast'
    ? BALL_SPEED_BOOST_MULTIPLIER
    : effects.ballSpeed === 'slow'
      ? BALL_SPEED_SLOW_MULTIPLIER
      : 1
}

export function paddleWidth(effects: Effects): number {
  return (
    PADDLE_WIDTH *
    (effects.paddleSize === 'long'
      ? PADDLE_LONG_MULTIPLIER
      : effects.paddleSize === 'short'
        ? PADDLE_SHORT_MULTIPLIER
        : 1)
  )
}

export function scoreMultiplier(effects: Effects): number {
  return effects.scoreBonusRemaining > 0 ? SCORE_BONUS_MULTIPLIER : 1
}

export interface ActiveEffect {
  type: ItemType
  /** 남은 시간(초). 지속 시간이 없는 공 속도 효과는 null. */
  remaining: number | null
}

/** HUD 표시용: 현재 적용 중인 효과 목록. */
export function activeEffects(effects: Effects): ActiveEffect[] {
  const list: ActiveEffect[] = []
  if (effects.ballSpeed === 'fast') list.push({ type: 'ballSpeedUp', remaining: null })
  if (effects.ballSpeed === 'slow') list.push({ type: 'ballSpeedDown', remaining: null })
  if (effects.paddleSize === 'long') list.push({ type: 'paddleLong', remaining: effects.paddleRemaining })
  if (effects.paddleSize === 'short') list.push({ type: 'paddleShort', remaining: effects.paddleRemaining })
  if (effects.scoreBonusRemaining > 0) list.push({ type: 'scoreBonus', remaining: effects.scoreBonusRemaining })
  return list
}
