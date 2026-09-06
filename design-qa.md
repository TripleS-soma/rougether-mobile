# 뽑기 개편 통합 검증 기록

2026-09-06 기준. 벽지·바닥·가구 세 상자와 등급별 공용 영상, 투명 보상 아트, 짧은 음원·햅틱을 연결합니다. 서버의 실제 머신 ID·가격·보상 풀을 사용하며 가구별 영상을 만들지 않습니다.

## 통합 범위

- 최신 dev `3111b51`와 기존 PR #1124의 `7b8ee79` 이력을 함께 보존했습니다. 집 아트·iOS 뒤로가기·바텀시트 스크롤 제외·앱 아이콘 기능을 유지합니다.
- 앱 버전은 최신 dev의 `1.5.0`을 유지합니다. 임시 검증 버전 `1.4.3`으로 낮추지 않습니다. `expo-video` 때문에 기존 설치본에 JS OTA만으로 적용할 수 없습니다.
- 새 앱은 `GET /gacha?catalog=category`로 세 카테고리를 요청합니다. 구버전의 매개변수 없는 목록·기존 머신의 실행을 유지하는 서버와 함께 배포합니다.
- PR #1124의 한 번에 열기·공개 개수 표시·중복 공개 방지를 새 6개 카드 흐름에 통합했습니다.
- 기존 숲속 아트는 `/dev?entry=GachaStorybookArchive`에서 비교할 수 있는 개발 전용 무대로 보존합니다. 실제 유료 뽑기는 시네마틱 화면만 사용합니다.

## 재실행 명령

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run lint
npm run format:check
npm test -- --maxWorkers=2 --watchman=false
CI=1 EXPO_OFFLINE=1 SENTRY_DISABLE_AUTO_UPLOAD=true node_modules/.bin/expo prebuild --platform android --no-install
node scripts/check-android-manifest.mjs --source
```

Android SDK·JDK 17 환경에서 `android/gradlew :app:processReleaseMainManifest`를 실행한 뒤
루트에서 `node scripts/check-android-manifest.mjs --merged`로 최종 병합 권한을 검사합니다.

## 검증 결과

- PR #1147 반영 전 통합 스냅샷의 Android prebuild 통과: `versionName "1.4.3"`. 아래 네이티브 결과는 해당 스냅샷의 결과이며 최종 `1.5.0` 네이티브 검증과 구분합니다.
- Android 소스 매니페스트: 금지 권한 9종 없음·필수 4종 존재.
- Android Release 매니페스트 병합: 157개 태스크, BUILD SUCCESSFUL. 실제 Metro 번들 2,624개 모듈·81개 에셋 생성; 공용 MP4 세 개가 네이티브 리소스에 포함됩니다.
- Android 최종 매니페스트: 금지 권한 9종 없음·필수 5종 존재. 카메라·마이크 권한 없음.
- 최신 dev #1147 병합 후 `1.5.0` Android prebuild·소스 매니페스트 검사·앱 아이콘 검사를 재실행해 통과했습니다. 런처 6개 중 기본 런처만 활성이고 딥링크 Activity는 활성입니다. 최종 `1.5.0` Gradle 병합·Kotlin 검증은 PR CI에서 수행합니다.
- TypeScript·Prettier 통과. ESLint 오류 없음; 기존 `app-shell.tsx`의 `fromGachaRef` 의존성 경고 1개는 유지합니다.
- 형제 테스트 추가 전 `aacb3b5` 스냅샷은 183개 스위트 / 1,442개 테스트 통과했습니다. `--runInBand --watchman=false --detectOpenHandles` 결과 JSON에서 `success=true`, 실패 0개, `openHandles=[]`를 확인했습니다.
- `GachaLobby` 직접 테스트 7개와 `RewardArtwork` 직접 테스트 11개를 추가했습니다. 두 파일 집중 테스트 18개, TypeScript·대상 ESLint·Prettier 모두 통과했습니다. 운영 코드는 변경하지 않았습니다.
- 최신 `7dfd49d` 전체 테스트를 `--maxWorkers=2 --watchman=false`로 1회 실행해 185개 스위트 / 1,460개 테스트 통과, 47.036초, 프로세스 exit 0을 확인했습니다. 결과 JSON은 `success=true`, 실패 0개입니다. 기존 워커 하나의 정리 지연·강제 종료 경고는 남습니다. 이전 단일 프로세스 실행은 결과 출력 이후 종료 지연이 재현되어 중단했으며, 신규 누수 원인은 확인되지 않았습니다.
- 릴리스 재개 시 `803ad8a` + 아래 smoke 보강 변경에서 TypeScript·전체 ESLint·전체 Prettier·185개 스위트 / 1,460개 테스트를 다시 통과했습니다(27.854초, exit 0). 기존 ESLint 경고 1개·Jest 워커 종료 경고는 동일합니다. 새 결과는 로컬 `output/gacha-release-final-tests.json`에 보관하며 커밋하지 않습니다. 워크플로 YAML 파싱·각 실행 스크립트의 Bash 문법도 검사했습니다.

## iOS Release smoke 재개

- `aacb3b5`의 [실행 34036410005](https://github.com/TripleS-soma/rougether-mobile/actions/runs/34036410005)은 50분 잡 제한 초과로 취소됐습니다. 아티팩트의 `build.log`에는 약 11분 37초 만에 `BUILD SUCCEEDED`가 남았습니다. 앱·`expo-video` 컴파일 실패는 아닙니다.
- 빌드 후 약 36분의 시뮬레이터 명령 대기가 확인됩니다. 명령별 추적 로그가 없어 `simctl list`, `boot`, `bootstatus` 초기 연결 중 어느 호출인지 확정하지 않습니다. 실행 PID·`first-screen.png`가 없어 이 실행을 앱 시작 통과로 취급하지 않습니다.
- 이전 성공 실행 `34025336246`과 macOS·Xcode·러너 이미지가 같습니다. 타임아웃을 늘리는 대신 선택·부팅·빌드·설치/실행·화면 확인을 분리하고 단계별 제한 시간과 진단 로그를 추가했습니다. 시뮬레이터를 빌드 전에 준비해 대기 오류를 일찍 검출합니다.
- 최종 PR head의 새 실행에서 실제 첫 화면과 생존 PID를 확인한 뒤 결과를 갱신합니다. 서버의 새 3종 목록 준비 전에는 앱 PR 머지·EAS 배포를 진행하지 않습니다.

## 화면 QA 범위와 남은 확인

- 이전 로컬 구현에서는 사용자 녹화의 재생 크기 문제를 확인하고 `VideoView`에 `width/height: '100%'`를 명시했습니다. 402×874 영상 제약 회귀 테스트를 유지합니다.
- 최종 통합 런타임 `aacb3b5`에서 390×844 가구/전설, 360×800 바닥/희귀, 402×874 벽지/일반을 실제 브라우저로 재검증했습니다. 재생 1.92/1.61/1.41초의 영상 경계가 각각 뷰포트와 정확히 일치하며 `object-fit: cover`를 확인했습니다. 로비·결과 확인 버튼 모두 하단 안전 영역 34px 위에 들어옵니다.
- 360×800에서 5+1회 연출과 한 번에 열기, 6개 보상 앞면·등급·중복 환급·확인 버튼을 확인했습니다. 공개 콜백은 뒤집기 시작 시 실행되므로 캡처는 애니메이션이 끝난 뒤의 앞면까지 별도로 검사했습니다. 로비/재생/결과 화면 증거는 로컬 `output/playwright/`에 보관하며 배포 번들에는 포함하지 않습니다.
- 위 시각 검증은 기본 글자 크기·개발 전용 픽스처입니다. 콘솔 오류 0개, 기존 경고 4개, 유료 draw POST 0회를 확인했습니다. 큰 글자 설정과 실물 iOS·Android의 영상·진동·음원 청취는 별도 확인이 필요합니다.
- 로컬 매니페스트 병합은 APK 설치·앱 실행의 증거가 아닙니다. EAS 빌드·기기 실행·운영 보상 풀·새 서버 배포 확인은 릴리스 담당 단계에서 수행합니다.
