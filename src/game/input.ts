export type InputSource = 'keyboard' | 'mouse'

// 키보드/마우스 입력 상태. 마지막으로 입력된 장치가 막대를 제어한다.
export class InputState {
  private leftDown = false
  private rightDown = false
  /** 마지막 입력 장치. 아직 입력이 없으면 null. */
  source: InputSource | null = null
  /** 마지막 마우스 x 좌표 (논리 좌표). */
  mouseX = 0

  private launchPending = false

  /** space가 눌렸다면 true를 반환하고 요청을 소비한다. */
  consumeLaunch(): boolean {
    const pending = this.launchPending
    this.launchPending = false
    return pending
  }

  /** 마우스 클릭 등 space 외의 발사 입력. */
  requestLaunch(): void {
    this.launchPending = true
  }

  keyDown(key: string): void {
    if (key === ' ') {
      this.launchPending = true
      return
    }
    if (key === 'ArrowLeft') this.leftDown = true
    else if (key === 'ArrowRight') this.rightDown = true
    else return
    this.source = 'keyboard'
  }

  keyUp(key: string): void {
    if (key === 'ArrowLeft') this.leftDown = false
    else if (key === 'ArrowRight') this.rightDown = false
  }

  mouseMove(logicalX: number): void {
    this.mouseX = logicalX
    this.source = 'mouse'
  }

  /** 포커스를 잃었을 때 눌린 키 상태를 비운다. */
  releaseAllKeys(): void {
    this.leftDown = false
    this.rightDown = false
  }

  /** 키보드 이동 방향: 왼쪽 -1, 오른쪽 1, 없음/동시 입력 0. */
  get direction(): -1 | 0 | 1 {
    return this.leftDown === this.rightDown ? 0 : this.leftDown ? -1 : 1
  }
}
