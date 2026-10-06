# Task 7: Pause와 탭 비활성 처리

## 참조
- FR-24 (pause 버튼, restart, EXIT), FR-25, FR-30

## 선행 task
- Task 6

## 구현 기능 목록
- pause 상태와 게임 루프 연동: pause 중에는 공, 아이템, 아이템 타이머 등 모든 update 정지 (시간 기반 값은 게임 시간 기준으로 관리)
- 우측 상단 pause 버튼과 pause 메뉴(restart, EXIT)
- ESC 키로 pause 토글
- restart: 1스테이지부터 점수 0, LIFE 3, 모든 효과 초기화
- EXIT: title로 이동
- 브라우저 탭이 비활성화되면 자동 pause (visibilitychange)
- 볼륨 슬라이더 자리는 Task 11에서 추가

## 완성 조건
- [ ] pause 버튼 또는 ESC로 게임이 멈추고 메뉴가 열리며, 다시 누르면 이어서 진행된다.
- [ ] pause 중에는 공이 움직이지 않고, 재개하면 멈춘 위치에서 이어진다.
- [ ] restart를 누르면 1스테이지부터 점수 0, LIFE 3 상태로 새로 시작한다.
- [ ] EXIT를 누르면 title 화면으로 간다.
- [ ] 다른 탭으로 이동했다가 돌아오면 pause 상태이다.
- [ ] pause 중 입력(막대 이동, space 발사)이 게임에 영향을 주지 않는다.
