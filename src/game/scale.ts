import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants'

export interface Viewport {
  width: number
  height: number
  scale: number
}

// 캔버스의 화면상 위치/크기를 기준으로 마우스 clientX를 논리 x 좌표로 변환한다.
export function toLogicalX(clientX: number, canvasLeft: number, canvasWidth: number): number {
  return ((clientX - canvasLeft) / canvasWidth) * LOGICAL_WIDTH
}

// 캔버스의 화면상 위치/크기를 기준으로 마우스 clientY를 논리 y 좌표로 변환한다.
export function toLogicalY(clientY: number, canvasTop: number, canvasHeight: number): number {
  return ((clientY - canvasTop) / canvasHeight) * LOGICAL_HEIGHT
}

// 창 크기 안에 16:9 비율을 유지하며 들어가는 가장 큰 크기를 계산한다.
export function fitViewport(windowWidth: number, windowHeight: number): Viewport {
  const scale = Math.max(0, Math.min(windowWidth / LOGICAL_WIDTH, windowHeight / LOGICAL_HEIGHT))
  return { width: LOGICAL_WIDTH * scale, height: LOGICAL_HEIGHT * scale, scale }
}
