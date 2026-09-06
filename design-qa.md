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
npm test -- --runInBand --watchman=false
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
- 최신 통합본 전체 테스트: 183개 스위트 / 1,442개 테스트 통과. `--runInBand --watchman=false --detectOpenHandles` 결과 JSON에서 `success=true`, 실패 0개, `openHandles=[]`를 확인했습니다.
- `--maxWorkers=2 --watchman=false` 재실행도 183개 스위트 / 1,442개 테스트 통과, 31.136초, 프로세스 exit 0입니다. 워커 하나의 정리 지연·강제 종료 경고가 남았습니다. 단일 프로세스 실행은 결과 출력 이후 종료 지연이 재현되어 중단했으며, 신규 누수 원인은 확인되지 않았습니다.

## 화면 QA 범위와 남은 확인

- 이전 로컬 구현에서는 사용자 녹화의 재생 크기 문제를 확인하고 `VideoView`에 `width/height: '100%'`를 명시했습니다. 402×874 영상 제약 회귀 테스트를 유지합니다.
- 이전 브라우저 재생 확인 범위는 390×844·402×874·360×800의 기본 글자 크기입니다. 해당 기록을 이번 통합 브랜치의 새 시각 QA로 간주하지 않습니다.
- 이번 통합 이후의 폰 크기·큰 글자 설정 시각 확인과 실물 iOS·Android의 영상·진동·음원 청취는 별도 실행 확인이 필요합니다.
- 로컬 매니페스트 병합은 APK 설치·앱 실행의 증거가 아닙니다. EAS 빌드·기기 실행·운영 보상 풀·새 서버 배포 확인은 릴리스 담당 단계에서 수행합니다.
