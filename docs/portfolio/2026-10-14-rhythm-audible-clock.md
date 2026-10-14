# 음악이 들리는 박자와 게임 판정이 어긋나는 문제

- 날짜:2026-10-14 / room / #1549
- 키워드: WebAudio,오디오 출력 시계,채보,WebView lifecycle,Hermes

## 배경

사용자가 포트폴리오 리듬 게임의 박자가 어긋난다고 피드백하고,루게더 미니게임으로 옮기도록 요청했다. 기존 채보는 자동 추정이었고 판정은 AudioContext.currentTime을 그대로 사용했다.

## 문제 (증상)

곡의 BPM을 추정하거나 생성 프롬프트에 적은 값만으로 채보를 만들면 실제 음악과 달라질 수 있다. 오디오 그래프가 처리 중인 샘플과 스피커에서 출력 중인 샘플도 같다고 볼 수 없다. 기존 시제품에서 어느 요인이 체감 차이의 대부분을 만들었는지는 사용자 실기기로 분리 측정하지 않았다.

## 원인 분석 (가설 → 검증 과정)

Suno에120BPM으로 요청해 받은 새 곡의 안정 구간을 실제 신호로 측정하니 약116.097BPM이었다. 도입부를 제외한 구간에서 quarter-note comb를 맞추고,가장 가까운 트랜지언트를 선택했다. 더 큰 syncopated offbeat를 단순히 선택하면100ms가 넘는 차이가 생기는 지점이 있었다.최초16개 판정 지점은 분명한 트랜지언트를 갖도록 시작 위상을 선택했다. 난이도 조정 후에는32개로 늘리고,일부 타격음이 비는 곳은 검증한박자격자를 유지했다.

WebView HTML을 처음 만들 때는 TypeScript 함수의 toString을 썼는데,실제 번들에서 `__name` helper가 포함돼 ReferenceError가 났다. 저장소 기존 엔진의 고정 source-string 패턴으로 바꾸고,테스트와WebView가 동일한 소스를 실행하도록 했다. Hermes도 함수 소스 보존에 의존할 수 없다.

## 해결

음원 편집 시작 샘플과 실제 초 단위 채보를 고정했다. 예약은 graph clock으로,화면/입력은 출력 timestamp를 performance 시간과 연결해 판단하도록 분리했다. 출력 timestamp가 없는 경우 latency fallback을 쓰며,기기별 사용자 입력 차이는10회 탭의 중앙값으로 보정한다. [출력 timestamp API 문서](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp)를 확인했다.

앱 화면 전환에서 이전 게임이 잠깐 남아도 active session context가 바뀌면 즉시 pause하게 했다. 연습 세션에도 고유 번호를 부여해 재진입한 새 게임이 이전 게임을 활성화하지 않도록 했다. 새 게임은 기존 서버 replay를 가장하지 않고 연습으로 분리했다.

## 결과 (수치)

실제 Chromium AudioContext에서 첫6문항 PERFECT,홀드 중 pause/resume 성공. 전체32문항은 자동 시간 시뮬레이션으로 PERFECT/32000점을 확인했다.60ms 지연 입력을 주는 보정 테스트에서는65ms가 산출됐다. 브라우저에서 MP3를 디코딩한 길이는70.3189167초,편집/채보 길이는70.318946초였다.

이 수치는 자동 입력/브라우저 검증이며 사람 플레이 또는 iOS/Android 실기기 검증이 아니다. 신호 분석 보고서와 실제 재생 trace는 각각 `analysis/rhythm/alignment-report.json`,로컬 `output/rhythm/browser-report.json`에 있다.

## 배운 점 / 재발 방지

요청한 BPM,분석한 pulse,실제 downbeat,오디오 graph 시간,출력 시간,사용자 입력 시간은 서로 구분해야 한다. 자동 플레이에서 점수가 잘 나온다는 것만으로 음악과의 정렬이 입증되지는 않는다. 서버 랭킹을 붙일 때에도 음원/채보 hash와 실제 event replay를 검증해야 한다.
