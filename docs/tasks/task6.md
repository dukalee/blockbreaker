# Task 6: 화면 구성 (title, 게임 HUD, GAME OVER)

## 참조
- FR-18 (GAME OVER 화면과 title 복귀), FR-22, FR-23

## 선행 task
- Task 5

## 구현 기능 목록
- 화면 전환 구조: title / playing / gameOver (App 수준 상태)
- title 화면: 우주 배경(별 애니메이션), 아케이드풍 타이틀, "press space to start" 깜빡임, space로 새 게임 시작
- 게임 HUD: 좌측 상단에 Stage 번호와 그 아래 score, LIFE 표시
- GAME OVER 화면: 최종 점수 표시, space로 title 복귀 (최고 점수 저장 없음)
- 화면 전환 시 입력과 게임 상태 정리

## 완성 조건
- [ ] 앱을 열면 title 화면이 보이고 "press space to start"가 반짝인다.
- [ ] space를 누르면 1스테이지가 시작된다.
- [ ] 게임 화면 좌측 상단에 Stage 번호와 score가 표시되고 값이 실시간으로 바뀐다.
- [ ] LIFE 3개가 모두 소진되면 GAME OVER 화면에 최종 점수가 표시되고, space를 누르면 title로 돌아간다.
- [ ] title로 돌아간 뒤 다시 시작하면 점수 0, LIFE 3, 스테이지 1에서 시작한다.
