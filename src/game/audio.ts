import { BGM_TRACKS, midiToHz, stepSeconds, trackLength, type BgmName } from './bgm'
import { SOUNDS, SOUND_MIN_INTERVAL, type SoundName } from './sounds'

/** 동시에 울릴 수 있는 오실레이터 최대 개수. 넘으면 새 소리는 건너뛴다. */
export const MAX_VOICES = 24
export const DEFAULT_VOLUME = 0.6
/** 효과음 전체 음량 (마스터 앞단). 마스터 볼륨과 별개로 BGM과의 균형을 맞추는 값. */
const SFX_LEVEL = 0.6
const BGM_LEVEL = 0.5
/** BGM 스케줄러가 현재 시각보다 얼마나 앞까지 노트를 예약할지(초). pause 시 남는 소리를 짧게 하려고 작게 둔다. */
export const BGM_LOOKAHEAD = 0.2
/** 곡 시작/재개 시 첫 노트를 예약하는 지연(초) */
const BGM_START_DELAY = 0.05

// 테스트에서 가짜 구현을 끼울 수 있도록 필요한 부분만 정의한다.
export interface AudioParamLike {
  value: number
  setValueAtTime(value: number, time: number): unknown
  exponentialRampToValueAtTime(value: number, time: number): unknown
}
export interface AudioNodeLike {
  connect(destination: unknown): unknown
}
export interface OscillatorLike extends AudioNodeLike {
  type: OscillatorType
  frequency: AudioParamLike
  onended: (() => void) | null
  start(when: number): void
  stop(when: number): void
}
export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike
}
export interface AudioContextLike {
  readonly state: string
  readonly currentTime: number
  readonly destination: unknown
  resume(): Promise<void> | void
  createOscillator(): OscillatorLike
  createGain(): GainLike
  createDynamicsCompressor(): AudioNodeLike
}

export class AudioEngine {
  private ctx: AudioContextLike | null = null
  private master: GainLike | null = null
  private sfxBus: GainLike | null = null
  private bgmBus: GainLike | null = null
  private volume = DEFAULT_VOLUME
  private muted = false
  private voices = 0
  private lastPlayed = new Map<SoundName, number>()
  private bgm: BgmName | null = null
  private bgmPaused = false
  private nextStepTime = 0
  private stepIndex = 0
  private timerStarted = false

  constructor(
    private readonly createContext: () => AudioContextLike = defaultContext,
    /** BGM 스케줄러를 주기적으로 돌리는 함수. 테스트에서는 아무것도 하지 않는 함수를 넣는다. */
    private readonly startTimer: (tick: () => void) => void = (tick) => {
      setInterval(tick, 50)
    },
  ) {}

  /**
   * 첫 사용자 입력(키 입력, 클릭) 시 호출한다. AudioContext를 만들고 시작한다.
   * 브라우저 자동 재생 정책 때문에 입력 전에는 만들지 않으며, 그동안 play는 무음이다.
   */
  unlock(): void {
    try {
      if (!this.ctx) this.build(this.createContext())
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
      if (this.ctx && !this.timerStarted) {
        this.timerStarted = true
        this.startTimer(() => this.tick())
      }
    } catch {
      // 오디오를 지원하지 않는 환경: 소리 없이 동작한다.
      this.ctx = null
    }
  }

  private build(ctx: AudioContextLike): void {
    // 효과음 → 컴프레서(동시 재생 시 클리핑 방지) → 마스터 게인(볼륨 제어 지점) → 출력
    const master = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()
    const sfx = ctx.createGain()
    sfx.gain.value = SFX_LEVEL
    const bgm = ctx.createGain()
    bgm.gain.value = BGM_LEVEL
    sfx.connect(compressor)
    bgm.connect(compressor)
    compressor.connect(master)
    master.connect(ctx.destination)
    this.ctx = ctx
    this.master = master
    this.sfxBus = sfx
    this.bgmBus = bgm
    this.applyMaster()
  }

  /** 마스터 게인에 볼륨과 음소거를 반영한다. 효과음과 BGM이 모두 이 게인을 거친다. */
  private applyMaster(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume
  }

  /** 마스터 볼륨(0~1). 효과음과 BGM에 함께 적용된다. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    this.applyMaster()
  }

  getVolume(): number {
    return this.volume
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyMaster()
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  get isMuted(): boolean {
    return this.muted
  }

  /** 재생할 BGM을 정한다. 이미 같은 곡이 재생 중이면 이어서 재생한다. unlock 전이면 unlock 후 시작된다. */
  playBgm(name: BgmName): void {
    if (this.bgm === name) return
    this.bgm = name
    this.stepIndex = 0
    this.nextStepTime = 0
  }

  stopBgm(): void {
    this.bgm = null
  }

  /** pause 중에는 BGM 진행을 멈추고, 재개하면 멈춘 위치에서 이어서 재생한다. */
  setBgmPaused(paused: boolean): void {
    if (this.bgmPaused === paused) return
    this.bgmPaused = paused
    // 멈춰 있던 시간만큼 한꺼번에 몰아서 재생하지 않도록 다음 스텝 시각을 다시 잡는다.
    this.nextStepTime = 0
  }

  get currentBgm(): BgmName | null {
    return this.bgm
  }

  /**
   * BGM 스케줄러. 현재 시각 + BGM_LOOKAHEAD 안에 들어오는 스텝의 노트를 예약한다.
   * 주기적으로(타이머) 호출된다.
   */
  tick(): void {
    const ctx = this.ctx
    const bus = this.bgmBus
    if (!ctx || !bus || ctx.state !== 'running' || !this.bgm || this.bgmPaused) return
    const track = BGM_TRACKS[this.bgm]
    const now = ctx.currentTime
    // 처음 시작, 재개, 탭 스로틀링 등으로 예약 시각이 이미 지났으면 지금부터 다시 시작한다.
    if (this.nextStepTime < now) this.nextStepTime = now + BGM_START_DELAY
    const length = trackLength(track)
    const stepSec = stepSeconds(track)
    while (this.nextStepTime < now + BGM_LOOKAHEAD) {
      for (const voice of track.voices) {
        const note = voice.notes[this.stepIndex]
        if (note > 0) this.scheduleNote(ctx, bus, voice.wave, midiToHz(note), this.nextStepTime, voice.hold * stepSec, voice.gain)
      }
      this.nextStepTime += stepSec
      this.stepIndex = (this.stepIndex + 1) % length
    }
  }

  private scheduleNote(
    ctx: AudioContextLike,
    bus: GainLike,
    wave: OscillatorType,
    hz: number,
    when: number,
    duration: number,
    gain: number,
  ): void {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(hz, when)
    env.gain.setValueAtTime(0.0001, when)
    env.gain.exponentialRampToValueAtTime(gain, when + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    osc.connect(env)
    env.connect(bus)
    osc.start(when)
    osc.stop(when + duration + 0.02)
  }

  get isRunning(): boolean {
    return this.ctx?.state === 'running'
  }

  play(name: SoundName): void {
    const ctx = this.ctx
    const bus = this.sfxBus
    if (!ctx || !bus || ctx.state !== 'running') return

    const now = ctx.currentTime
    const last = this.lastPlayed.get(name)
    if (last !== undefined && now - last < SOUND_MIN_INTERVAL[name]) return

    const tones = SOUNDS[name]
    if (this.voices + tones.length > MAX_VOICES) return
    this.lastPlayed.set(name, now)

    for (const tone of tones) {
      const t0 = now + tone.start
      const t1 = t0 + tone.duration
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = tone.wave
      osc.frequency.setValueAtTime(tone.from, t0)
      osc.frequency.exponentialRampToValueAtTime(tone.to, t1)
      // 짧은 어택과 지수 감쇠로 클릭 노이즈를 막는다.
      env.gain.setValueAtTime(0.0001, t0)
      env.gain.exponentialRampToValueAtTime(tone.gain, t0 + 0.005)
      env.gain.exponentialRampToValueAtTime(0.0001, t1)
      osc.connect(env)
      env.connect(bus)
      this.voices++
      osc.onended = () => {
        this.voices--
      }
      osc.start(t0)
      osc.stop(t1 + 0.02)
    }
  }
}

function defaultContext(): AudioContextLike {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API is not supported')
  return new Ctor() as unknown as AudioContextLike
}

/** 앱 전체에서 공유하는 오디오 엔진. 화면이 바뀌어도 유지된다. */
export const audio = new AudioEngine()
