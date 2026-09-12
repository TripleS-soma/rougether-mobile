Original prompt: 미니게임 도입하려고 해 랭킹은 전체 유저 랭킹으로 가면 될 것 같음 일단 크롬 공룡게임같은거 만들어보자 게임 입장하는곳은 메인 "방"에서 오른쪽에 리퀴드 아이콘으로 넣고 게임 여러개 만들면 될 것 같아 토스 인앱 게임 랭킹 높은 게임들 베껴와봐

- 2026-09-12: 서버와 rulesVersion=1, 60Hz, LCG, 장애물 생성/점프/충돌 순서 합의. 엔진 정본은 고정 JS 문자열이며 Canvas와 TypeScript 테스트가 같은 소스를 실행한다.
- 게임 래퍼: RunnerGame(seed, active, practice, onFinish, onPauseChange). 부모 key 변경으로 재시작. 백그라운드 및 화면 이탈 일시정지 후 명시 계속.
- 수동 시간 조작은 개발 연습 화면에서만 허용. 전체 랭킹 플레이에는 시간 조작 hook을 노출하지 않는다.
- 완료: Canvas 렌더링, 결정적 fixture, 플랫폼 래퍼 및 브라우저 검증.
- 2026-09-12 완료: 기존 루게더 cat-3/2 WebP 원본을 무변형 data URI로 포함. 달리기 bob과 점프 pose, 원본 불투명 발 기준선, Canvas/버튼/화분/배경, 테마 palette 연결. 신규 생성 후보는 외형 보존 기준을 통과하지 못해 사용하지 않음.
- 엔진/브리지 Jest 23개와 플랫폼 래퍼 Jest 4개 통과. seed 1 무점프=188틱/31점, jumpTicks=[180]=301틱/50점. seed 42 완주=18000틱/3000점 exact fixture를 Java 작업자에게 전달.
- 원본 develop-web-game Playwright client로 점프 장면 실행·캡처·시각 검토. /tmp/rougether-minigame-qa/engine-jump-v2/shot-0.png.
- 추가 Chromium 11개 흐름 통과: 시작, 점프, 일시정지 시간 동결, 외부 활성 상태 복귀 후 명시 재개, 종료 transcript, 완료 콜백 1회, 재시작, visibility 일시정지, destroy 루프 정리, 랭킹 시간 hook 미노출, 실제 시간 랭킹 종료. 콘솔 오류 없음.
- 준비/점프/일시정지/결과 화면 직접 시각 확인. /tmp/rougether-minigame-qa/engine-{ready,paused,finished}.png 및 engine-runtime-report.json.
- 루트 검증: 실제 로컬 서버와 Expo Web에서 방 진입 → 플레이 → 48점 저장 → 전체 랭킹 표시 확인. 캡처와 실행 결과는 output/minigame-qa/. 네이티브 실기기 WebView 화면 검증은 별도 필요.
- 키보드 리뷰 반영: 버튼 포커스의 Space/Enter 기본 클릭 동작을 보존하고 P/Escape 반복 keydown은 무시한다. Chromium 추가 8개 키보드 흐름 통과, Canvas 점프 회귀 및 원본 skill client 캡처 재검토 완료. /tmp/rougether-minigame-qa/runner-keyboard-report.json.
