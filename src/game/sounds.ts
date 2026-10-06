export type SoundName =
  | 'launch'
  | 'bounce'
  | 'blockBreak'
  | 'hardHit'
  | 'itemPickup'
  | 'lifeLost'
  | 'stageClear'
  | 'gameOver'

/** 오실레이터 하나가 내는 소리. 주파수는 from에서 to로 지수적으로 변한다. */
export interface Tone {
  wave: OscillatorType
  /** 시작/끝 주파수(Hz) */
  from: number
  to: number
  /** 소리 시작 시점(초, 재생 요청 시점 기준)과 길이(초) */
  start: number
  duration: number
  /** 최대 음량 (0~1) */
  gain: number
}

/** 효과음 정의. 음원 파일 없이 오실레이터 조합으로만 합성한다. */
export const SOUNDS: Record<SoundName, Tone[]> = {
  // 위로 올라가는 짧은 스윕
  launch: [{ wave: 'sine', from: 300, to: 800, start: 0, duration: 0.16, gain: 0.5 }],
  // 짧고 가벼운 톡
  bounce: [{ wave: 'triangle', from: 520, to: 440, start: 0, duration: 0.06, gain: 0.45 }],
  // 내려가는 사각파 팝
  blockBreak: [{ wave: 'square', from: 700, to: 300, start: 0, duration: 0.12, gain: 0.3 }],
  // 둔탁한 금속성 타격: 낮은 톱니파 + 높은 사각파
  hardHit: [
    { wave: 'sawtooth', from: 180, to: 120, start: 0, duration: 0.1, gain: 0.35 },
    { wave: 'square', from: 1200, to: 900, start: 0, duration: 0.05, gain: 0.15 },
  ],
  // 올라가는 3음 아르페지오
  itemPickup: [
    { wave: 'sine', from: 523, to: 523, start: 0, duration: 0.08, gain: 0.45 },
    { wave: 'sine', from: 659, to: 659, start: 0.07, duration: 0.08, gain: 0.45 },
    { wave: 'sine', from: 784, to: 784, start: 0.14, duration: 0.12, gain: 0.45 },
  ],
  // 아래로 떨어지는 긴 톱니파
  lifeLost: [{ wave: 'sawtooth', from: 400, to: 90, start: 0, duration: 0.5, gain: 0.35 }],
  // 밝은 4음 팡파르
  stageClear: [
    { wave: 'square', from: 523, to: 523, start: 0, duration: 0.12, gain: 0.3 },
    { wave: 'square', from: 659, to: 659, start: 0.12, duration: 0.12, gain: 0.3 },
    { wave: 'square', from: 784, to: 784, start: 0.24, duration: 0.12, gain: 0.3 },
    { wave: 'square', from: 1047, to: 1047, start: 0.36, duration: 0.3, gain: 0.3 },
  ],
  // 천천히 내려가는 4음
  gameOver: [
    { wave: 'triangle', from: 392, to: 392, start: 0, duration: 0.28, gain: 0.5 },
    { wave: 'triangle', from: 330, to: 330, start: 0.28, duration: 0.28, gain: 0.5 },
    { wave: 'triangle', from: 262, to: 262, start: 0.56, duration: 0.28, gain: 0.5 },
    { wave: 'triangle', from: 196, to: 196, start: 0.84, duration: 0.6, gain: 0.5 },
  ],
}

/** 같은 효과음을 다시 재생할 수 있는 최소 간격(초). 연속 충돌 시 소리가 겹쳐 터지는 것을 막는다. */
export const SOUND_MIN_INTERVAL: Record<SoundName, number> = {
  launch: 0.1,
  bounce: 0.05,
  blockBreak: 0.04,
  hardHit: 0.05,
  itemPickup: 0.1,
  lifeLost: 0.3,
  stageClear: 0.5,
  gameOver: 1,
}
