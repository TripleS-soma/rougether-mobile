# 하단바 드래그 선택 및 본문 스와이프 점검

관련 이슈: #1079. 집 프레임 점진 적용(#1078)과 분리한 변경입니다.

## 하단바 동작

- 하단 알약 안에서 가로로 8px를 넘겨 끌면 선택 표시가 손가락을 따라갑니다.
- 드래그 중에는 페이지를 바꾸지 않고, 정상적으로 손을 놓을 때 마지막 위치의 탭으로 한 번만 이동합니다. 현재 활성 탭이면 재전환하지 않습니다.
- 실제 탭 너비와 중심을 측정하므로 글꼴/화면 폭이 달라도 동일한 좌표를 가정하지 않습니다.
- 좌우 끝을 넘으면 첫/마지막 탭으로 제한합니다. 위아래로 바에서 24px 이상 벗어나 놓거나 시스템이 제스처를 취소하면 전환하지 않습니다.
- 탭 터치는 RNGH Pressable이 드래그의 실패를 기다리도록 연결했습니다. 드래그 취소 후 시작 탭의 터치가 뒤늦게 실행되는 문제를 방지합니다.
- 기존 onChange 콜백, 선택 접근성 상태, 키보드 Enter, 코치마크, 안전 영역, GlassSurface 재질은 유지합니다. 집 미가입자의 집 탐색 이동도 기존 AppShell 콜백을 그대로 사용합니다.
- 본문 TabPager 바깥의 알약만 제스처 영역입니다. 집 확대/자리 이동으로 본문이 잠겨도 하단바로 이동할 수 있습니다.

## 로컬 검증

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test -- --watchman=false --runInBand --forceExit --silent
npx expo start --web --port 8096
```

개발 빌드의 `/dev-navigation`은 실제 BottomNav, TabPager, PawRefreshScroll, usePagerLock을 연결한 로컬 fixture입니다. API 쓰기나 로그인이 필요하지 않습니다. `/dev`에도 등록되어 있고, 운영 빌드는 홈으로 리다이렉트하며 fixture를 정적으로 import하지 않습니다.

2026-09-05 검증 결과:

- TypeScript, 포맷, 전체 162 suites / 1,272 tests 통과. lint 오류 0, 기존 경고 2개(AppShell fromGachaRef, CreateHouseScreen Icon).
- 전체 Jest는 기존 비동기 핸들 때문에 `--forceExit`를 사용했습니다. 변경 관련 3 suites / 15 tests는 강제 종료 없이 통과했습니다.
- Chromium 430px/1024px: 마우스 드래그, 역방향 두 탭 건너뛰기, 가로 끝 이탈, 비활성 탭에서 시작 후 세로 이탈 취소, 일반 클릭, 키보드 Enter 확인.
- Chromium CDP 터치: 드래그 중 전환 없음 → 정상 릴리즈 시 1회, touchCancel 시 0회, 집 잠금 중 본문 전환 0회 및 하단바 전환 1회 확인.
- 실제 iOS 글래스/VoiceOver와 Android TalkBack·시스템 제스처는 실기기 확인이 남아 있습니다. 웹 검증은 네이티브 검증을 대체하지 않습니다.

## 본문 스와이프 진단 — 이번 변경에서 수정하지 않음

### 재현된 취소 처리 버그

기존 `TabPager`는 `onEnd`의 두 번째 인자인 `success`를 확인하지 않습니다. RNGH는 활성 제스처가 CANCELLED/FAILED로 끝나도 `onEnd(event, false)`를 호출합니다.

`/dev-navigation`에서 설정 탭을 열고 본문을 오른쪽으로 240px 이동한 뒤 정상 touchEnd 대신 touchCancel을 전달했을 때, 취소됐는데도 설정 → 집으로 전환되는 것을 Chromium 실제 터치 입력으로 재현했습니다. 손을 놓은 정상 스와이프와 시스템 취소를 구분하고, 취소 때 현재 페이지 위치로 복원해야 합니다. 별도 수정 승인 전에는 기존 본문 동작을 변경하지 않습니다.

### 의도된 잠금 및 실기기 확인 항목

- 집이 확대되었거나 자리 이동 중일 때 본문 스와이프가 막히는 것은 기존 계약입니다. 하단바 이동은 가능합니다.
- 본문은 수평 24px 활성화, 수직 36px 이탈 실패, 폭의 30% 또는 500px/s 이상에서 전환합니다. 짧고 느린 드래그는 원위치로 돌아갑니다.
- iOS `edgeBackPan`은 탭 루트에서도 recognizer 자체가 켜져 있고, JS 스레드의 `onTouchesDown`에서 실패시킵니다. UI 스레드의 16px 활성화가 JS보다 빠르면 24px 임계의 본문 페이저와 경쟁할 가능성이 있습니다. 잘못된 뒤로가기 방지 가드는 있지만 제스처 선점 자체를 예방하지는 않습니다. 실기기 JS 부하 상황에서 확인이 필요합니다.
- 네이티브 pull-to-refresh는 수직 12px에서 활성화하고 수평 12px에서 실패합니다. 사선 터치의 우선순위도 기기에서 확인해야 합니다. 웹은 해당 네이티브 새로고침 제스처를 사용하지 않으므로 이번 웹 검사만으로 문제 유무를 확정하지 않습니다.
