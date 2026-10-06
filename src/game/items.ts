import type { Block, Rng } from './blocks'
import {
  ITEM_DROP_CHANCE,
  ITEM_HEIGHT,
  ITEM_FALL_SPEED,
  ITEM_WIDTH,
  LOGICAL_HEIGHT,
} from './constants'
import { drawItemBadge } from './itemIcons'
import type { Paddle } from './paddle'

export type ItemType =
  | 'multiBall'
  | 'ballSpeedUp'
  | 'ballSpeedDown'
  | 'paddleLong'
  | 'paddleShort'
  | 'scoreBonus'

export const ITEM_TYPES: readonly ItemType[] = [
  'multiBall',
  'ballSpeedUp',
  'ballSpeedDown',
  'paddleLong',
  'paddleShort',
  'scoreBonus',
]

export interface Item {
  type: ItemType
  /** 중심 좌표 */
  x: number
  y: number
  width: number
  height: number
}

/** 블록이 깨졌을 때 아이템을 드롭할지, 드롭한다면 어떤 종류인지 정한다. 6종은 동일 확률. */
export function rollItemDrop(rng: Rng, chance = ITEM_DROP_CHANCE): ItemType | null {
  if (rng() >= chance) return null
  return ITEM_TYPES[Math.floor(rng() * ITEM_TYPES.length)]
}

export function createItem(type: ItemType, block: Block): Item {
  return {
    type,
    x: block.x + block.width / 2,
    y: block.y + block.height / 2,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
  }
}

function touchesPaddle(item: Item, paddle: Paddle): boolean {
  return (
    Math.abs(item.x - paddle.x) < (item.width + paddle.width) / 2 &&
    item.y + item.height / 2 > paddle.y &&
    item.y - item.height / 2 < paddle.y + paddle.height
  )
}

/**
 * 아이템을 일정한 속도로 낙하시킨다. 막대에 닿으면 onPickup을 호출하고 제거하며,
 * 화면 아래로 나가면 제거한다. 남은 아이템을 반환한다.
 */
export function updateItems(
  items: Item[],
  paddle: Paddle,
  dt: number,
  onPickup: (type: ItemType) => void,
): Item[] {
  const remaining: Item[] = []
  for (const item of items) {
    item.y += ITEM_FALL_SPEED * dt
    if (touchesPaddle(item, paddle)) {
      onPickup(item.type)
    } else if (item.y - item.height / 2 <= LOGICAL_HEIGHT) {
      remaining.push(item)
    }
  }
  return remaining
}

const ITEM_COLOR: Record<ItemType, string> = {
  multiBall: '#ff5d73',
  ballSpeedUp: '#ff9f43',
  ballSpeedDown: '#4dd2ff',
  paddleLong: '#6bd96b',
  paddleShort: '#8c7bff',
  scoreBonus: '#ffd93d',
}

/** 아이템 종류별 대표 색. HUD 효과 표시에서도 사용한다. */
export function itemColor(type: ItemType): string {
  return ITEM_COLOR[type]
}

/** 낙하 중인 아이템을 아이콘 배지로 그린다. */
export function renderItems(ctx: CanvasRenderingContext2D, items: Item[]): void {
  for (const item of items) {
    drawItemBadge(ctx, item.type, ITEM_COLOR[item.type], item.x, item.y, item.width)
  }
}
