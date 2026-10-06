export type BgmName = 'title' | 'game'

/** 한 파트(악기). notes는 스텝마다 MIDI 노트 번호이며 0은 쉼표. */
export interface BgmVoice {
  wave: OscillatorType
  gain: number
  /** 노트가 울리는 길이(스텝 단위). 1보다 작으면 끊어서(스타카토) 연주한다. */
  hold: number
  notes: number[]
}

export interface BgmTrack {
  bpm: number
  /** 한 스텝은 8분음표. 모든 파트의 notes 길이는 같고, 이 길이마다 곡이 반복된다. */
  voices: BgmVoice[]
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** 마디(8스텝)별 루트음을 4스텝/1스텝 간격 패턴으로 펼친다. */
function bassLine(roots: number[], everyStep: boolean): number[] {
  return roots.flatMap((r) =>
    everyStep ? Array<number>(8).fill(r) : [r, 0, 0, 0, r, 0, 0, 0],
  )
}

export const BGM_TRACKS: Record<BgmName, BgmTrack> = {
  // 차분한 우주 느낌의 느린 아르페지오 (Am - F - C - G)
  title: {
    bpm: 96,
    voices: [
      {
        wave: 'triangle',
        gain: 0.14,
        hold: 1.6,
        notes: [
          69, 72, 76, 72, 69, 72, 76, 81, //
          65, 69, 72, 69, 65, 69, 72, 77,
          67, 72, 76, 72, 67, 72, 76, 79,
          67, 71, 74, 71, 67, 71, 74, 79,
        ],
      },
      { wave: 'sine', gain: 0.2, hold: 3.5, notes: bassLine([45, 41, 48, 43], false) },
    ],
  },
  // 빠르고 긴장감 있는 곡 (Dm - Bb - C - A), 8분음표 베이스가 달린다.
  game: {
    bpm: 140,
    voices: [
      {
        wave: 'square',
        gain: 0.07,
        hold: 1.2,
        notes: [
          74, 0, 77, 0, 81, 0, 77, 0, //
          70, 0, 74, 0, 77, 0, 74, 0,
          72, 0, 76, 0, 79, 0, 76, 0,
          69, 0, 73, 0, 76, 0, 81, 0,
        ],
      },
      { wave: 'sawtooth', gain: 0.09, hold: 0.8, notes: bassLine([38, 34, 36, 33], true) },
    ],
  },
}

export function trackLength(track: BgmTrack): number {
  return track.voices[0].notes.length
}

export function stepSeconds(track: BgmTrack): number {
  return 60 / track.bpm / 2
}
