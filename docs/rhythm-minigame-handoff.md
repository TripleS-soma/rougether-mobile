# 루틴 리듬 인계 (#1549)

`feat/routine-rhythm`는 `origin/dev`에서 직접 분기한 루게더 모바일 작업이다. 사용자의 이번 추가 요청을 적용했으며 배포/머지는 하지 않았다.

미니게임 목록의 **연습** 영역에서 `루틴 리듬`을 선택한다. Dev 갤러리의 `RoutineRhythmPreview`에서도 확인할 수 있다. 웹 미리보기: `/dev?entry=RoutineRhythmPreview&viewport=1`.

Suno에서 생성한 **작은 발걸음**을 실제 분석해 약70초·32문항으로 편집했다. 여섯 신호 뒤 일곱 번째 탭, 숨은 신호, 여섯 홀드, 네 빠른 예고 패턴을 포함한다. 4단계 문항 수는4→4→8→16,신호 속도는1배→1배→2배→4배로 올라간다. 숫자·원형·파형 가이드와 고양이의 주기적인 움직임을 제거해 소리로 판단하게 했다. 제목 위 브랜드 문구도 제거했다. 배경은 기존 앱의 고양이와 semantic theme 토큰을 쓰며, 병원/원작 자산은 가져오지 않았다.

## 타이밍

- 곡 파일의 최초 샘플을0초로 사용한다. 채보는 `rhythm-chart.json`의 실제 초 단위 `beats`를 읽는다. BPM은 표시/보조 값이며 `target=BPM*index`로 다시 계산하지 않는다.
- WebAudio graph clock은 앞으로 신호를 예약하는 용도로 쓴다. 화면과 입력은 `getOutputTimestamp`로 현재 출력 샘플을 읽고,지원하지 않는 기기는 `outputLatency+baseLatency`로 보정한다. 출력 지연을 두 번 빼지 않는다.
- 입력 이벤트의 `performance` timestamp를 사용한다. 추가 보정은 10회 탭의 초기2회를 제외한 중앙값,또는±250ms 수동 설정이다. 기기/이어폰별 차이는 실제 iOS·Android 기기에서 최종 확인해야 한다.
- 화면 이탈·앱 background는 자동 pause한다. 복귀해도 사용자가 계속하기를 눌러야 재개한다. 홀드는 재개 시 재입력하며 중복 점수는 생기지 않는다. WebView 종료 때 노드·타이머·AudioContext를 닫는다.

## 앱/서버 경계

네이티브 `rhythm-game.tsx`는 기존 WebView recovery/channel/lifecycle 규칙을,웹 `.web.tsx`는 sandbox iframe/source 확인을 따른다. 고정 게임 소스 문자열을 공유하므로 Hermes의 `Function.toString()` 제약에 의존하지 않는다.

현재는 연습 전용이다. 기존 `MinigameCode`,서버 rulesVersion3,러너의 `jumpTicks`로 리듬 결과를 가장하지 않는다. 순위/재화에는 요청을 보내지 않는다.

향후 랭킹 연동은 서버가 `routine-rhythm`을 별도 카탈로그로 등록하고,**곡·채보 hash 및 chartVersion,보정값,press/release millisecond events,전체 duration**을 검증하는 새 replay 계약을 먼저 확정해야 한다. 브라우저 result의 score를 서버에서 신뢰하지 말고 재계산해야 한다. 새 타입은 기존3종 replay union에 억지로 넣지 않는다.

## 검증/재현

`node scripts/build-rhythm-preview.cjs`로 독립HTML을 만든 뒤 `python3 -m http.server 5180 --directory output/rhythm`으로 실행한다. `node scripts/qa-rhythm.cjs`는 설치된 Chrome의 별도 headless 프로필을 사용한다.

실제 오디오에서 첫6문항 PERFECT(홀드 중 pause/resume 포함),전체32문항 자동 시뮬레이션 PERFECT,모바일 폭/반복/비활성 상태/console오류 없음 확인. 자동 입력은 사람 플레이나 iOS/Android 실기기 테스트를 의미하지 않는다. 증거는 로컬 `output/rhythm/`에 있다.

GitHub 이슈는 #1549이다. 프로젝트 보드 등록은 현재 gh토큰의 `read:project` scope 부족으로 완료하지 못했다. 권한을 확대하지 않았으며 코드 작업과 검증은 계속 진행했다.
