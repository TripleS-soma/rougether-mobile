# 배포·릴리스 런북

**언제 읽나**: OTA를 발행하거나, `native-build` 라벨 PR을 머지하거나, `app.json`/네이티브 의존성을 건드리거나, 스토어에 제출하기 **전에.** 아래 절차들은 실측으로 얻은 것이라(각 항목의 날짜·이슈 참조) 어기면 대체로 쿼터 낭비·심사 리스크·수신자 0 중 하나로 갚게 됩니다.

일상 개발 규칙(브랜치·PR·이슈·코딩 컨벤션)은 [`AGENTS.md`](../AGENTS.md)에 있습니다.

- **`dev` 머지 = 자동 배포 트리거**: CI(`.github/workflows/eas-deploy.yml`)가 네이티브 지문을 비교해 JS-only면 preview 채널 OTA, 네이티브 변경이면 EAS 빌드(+iOS TestFlight 자동 제출)를 실행합니다.

- **`main` 승격 = 릴리스 후보 확정, 발행 아님** (2026-08-14 정립, #813): 승격 자체는 사용자에게 아무것도 보내지 않습니다. production 채널 OTA는 **`eas-release` 워크플로를 main에서 수동 실행**할 때만 나갑니다.
  - **왜 수동인가**: 심사 중인 빌드도 `channel=production`을 듣습니다. 자동 발행이면 승격이 곧 "심사자가 보는 코드를 바꾸는 일"이 되고, 제출본과 다른 코드가 심사대에 오르는 건 거부 사유가 될 수 있습니다.
  - **릴리스 리듬**: dev 개발 → 릴리스 후보 확정(dev→main 승격) → `store-build`(main)로 심사 제출 → **심사 통과·출시 후** `eas-release` 실행. 출시 뒤의 JS 핫픽스는 dev→main 승격 후 같은 워크플로를 다시 누릅니다.
  - **지문이 다르면 아무에게도 안 갑니다** — `eas-release`의 마지막 스텝이 현재 지문과 스토어 빌드의 런타임을 대조해 경고를 남깁니다. 그 경우 필요한 건 OTA가 아니라 새 빌드입니다.

- **`app.json` 변경은 네이티브 지문을 바꾼다**: runtimeVersion이 fingerprint 정책이라, JS만 바꿨어도 app config를 건드리면 지문이 바뀌어 **기존 설치 기기들의 OTA 수신이 그 시점부터 끊긴다**(새 빌드를 배포할 때까지). 이런 변경은 native-build 윈도우(재빌드 직전)에 몰아서 할 것.
  - **`.gitignore`는 지문 입력이 맞다 (2026-08-19 실측)**: `.sentryclirc` 한 줄을 더했더니 Android `1970fdf3…`→`20ac7a9b…`, iOS `cc9a0cdd…`→`4a18fcbc…`로 바뀌었다. 핫픽스 OTA 브랜치에서 건드리면 안 되는 이유가 이것이다.
  - **`eas.json`은 지문 입력이 아니다 (2026-08-13 실측)**: `build.*.env`·`submit.*` 를 바꿔도 iOS(`d91c40b…`)·Android(`cf2c0ef…`) 지문이 그대로였다(`npx expo-updates fingerprint:generate`로 변경 전후 대조). 종전 문서는 #554를 근거로 eas.json도 지문을 바꾼다고 적었지만 그건 사실이 아니다 — 그때의 OTA 단절은 다른 원인이었다. **제출·빌드 프로필 배선은 언제든 고쳐도 된다.**

- **스토어 제출은 `main`에서, `production` 프로필로** (2026-08-13 정립): Actions → **store-build** 워크플로를 **main 브랜치에서 수동 실행**한다(`platform` 선택, iOS는 `submit` 체크 시 ASC 자동 제출). main 외 브랜치에서 돌리면 워크플로가 스스로 거부한다.
  - **왜 main인가**: `production` 프로필 빌드는 `channel=production`이라 **main 승격이 발행하는 OTA(`eas-release.yml`)만** 받는다. dev 머지 OTA는 `preview` 채널이라 닿지 않는다 — 검증 안 된 dev 코드가 스토어 사용자에게 흘러가던 경로(빌드 38이 8/9~8/11 그렇게 받았다)를 이 조합이 끊는다.
  - **이행 주의**: 기존 스토어 설치본은 `preview` 채널을 듣고 있어서, 사용자가 **스토어에서 새 빌드로 업데이트하기 전까지는** 계속 dev 레인 OTA를 받는다. 채널은 바이너리에 박히므로 OTA로 옮길 수 없다.
  - **Play 제출은 아직 수동**: `submit.production.android`가 로컬 `./play-service-account.json`을 요구해 CI에 없다. 워크플로는 번들만 만들고, 콘솔 업로드는 사람이 한다.
  - **환경변수 — EAS 빌드는 커밋된 `.env`를 안 읽는다** (2026-08-19 정정): #874가 네 프로필 전부에 `environment`를 달면서, **빌드 값의 출처가 EAS 환경으로 옮겨갔다**(`environment`가 있으면 EAS가 `.env`를 무시한다). 종전 문서는 "`production` 프로필에 `environment`가 없어 `.env`가 인라인된다"고 적었지만 더는 사실이 아니다.
    - **값이 두 군데에 산다**: 로컬 `expo start`·`eas update`는 `.env`를, `eas build`는 EAS 환경을 읽는다. 2026-08-19 대조 시점엔 양쪽이 같았지만(`#738` 공용 주소), **한쪽만 고치면 OTA와 빌드가 서로 다른 서버를 보게 된다.** 주소를 바꿀 땐 `src/config/shared-endpoints.json` · `.env` · `npx eas-cli env:list --environment {preview,production}` 셋을 함께 갱신할 것.
  - **Sentry 토큰이 틀리면 안드로이드 빌드가 통째로 실패한다** (2026-08-19 실측, #807): `@sentry/react-native` 7.11.0의 `sentry.gradle`에는 iOS 스크립트에 있는 `SENTRY_ALLOW_FAILURE`가 **없다** — 업로드가 401이면 `:app:createBundleRelease…_SentryUpload_…` 태스크가 죽고 빌드 전체가 6분쯤 태운 뒤 실패한다. 끄는 스위치는 `SENTRY_DISABLE_AUTO_UPLOAD=true`뿐.
    - 토큰은 **EAS 환경**(`preview`·`production`)에 있어야 한다 — GitHub Secrets는 EAS 빌더가 못 본다. 형식은 org auth token(`sntrys_…`, 스코프 `project:releases`·`org:read`)이고, **32자리 hex는 DSN public key라 401이 난다.**
    - 넣는 법(값이 셸 히스토리에 안 남게 `--value` 없이): `npx eas-cli env:set --name SENTRY_AUTH_TOKEN --environment preview --environment production --visibility secret`

- **핫픽스 OTA는 조준 발행** (#815): 이미 나가 있는 설치본에 급히 JS 수정을 보내야 하면 Actions → **hotfix-ota** 를 **그 핫픽스 브랜치에서** 실행한다.
  - **OTA는 채널 + 런타임 지문이 둘 다 맞아야 도달한다.** 정규 경로(`eas-release`)는 "main의 현재 지문 → production"만 쏘므로, 구 스토어 빌드처럼 그 조합 밖에 있는 설치본에는 닿지 않는다.
  - 절차 — ① 목표 설치본이 빌드된 **그 커밋**에서 브랜치를 딴다 ② **JS만** 고친다(`app.json`·`package.json`·`plugins`·`targets`·`.gitignore` 금지 — 하나라도 건드리면 지문이 바뀌어 무용) ③ `hotfix-ota` 실행(채널·플랫폼·목표 런타임 입력) ④ **같은 수정을 dev에도 정식 PR로** 반영.
  - 목표 채널·런타임은 `eas build:list`의 `channel`·`runtimeVersion` 컬럼에서 확인한다. 워크플로가 지문을 대조해 **불일치면 발행 전에 실패**시킨다 — 그 경우 필요한 건 OTA가 아니라 새 빌드다.

- **네이티브 빌드 PR에는 `native-build` 라벨**: 네이티브 지문이 바뀌는 PR(새 네이티브 모듈, app.json 플러그인/네이티브 설정, google-services 류 파일 등)은 PR에도 `native-build` 라벨을 붙이세요. 머지 즉시 양 플랫폼 EAS 빌드가 소모되므로(빌드 쿼터·과금) 리뷰어가 머지 타이밍을 판단할 수 있게 하고, 가능하면 네이티브 변경 PR들을 몰아서 머지해 빌드 횟수를 아낍니다.

- **출시 뒤 첫 네이티브 윈도우는 버전 범프부터** (2026-09-03 실측): App Store에 출시된 버전(예: 1.3.0)과 같은 `app.json` version으로 만든 testflight 빌드는 ASC가 업로드를 거부한다 — "Invalid Pre-Release Train. The train version '1.3.0' is closed" / "CFBundleShortVersionString must contain a higher version than the previously approved version". 빌드 번호(autoIncrement)를 올려도 소용없고, **EAS 빌드는 성공하므로 쿼터만 사라진다**(RNFB 26 #1052 빌드 110이 그랬다). 그래서 `native-build` PR은 `native-prebuild-check`의 **iOS 버전 트레인 가드**(`scripts/check-version-train.js`)가 app.json version을 마지막 production 빌드 버전과 대조해 같거나 낮으면 실패시키고, `eas-deploy`도 같은 가드로 iOS 빌드를 스킵한다. 네이티브 변경을 모을 때 **버전 범프 커밋을 그 PR에 같이 넣을 것**(app.json version은 어차피 지문을 바꾼다).
- **native-build PR이 2개 이상 쌓이면 빌드는 한 번만**: 각 dev 머지가 배포 워크플로를 따로 트리거하므로, 따로따로 머지하면 그 수만큼 EAS 빌드가 돕니다(실패 빌드도 쿼터를 소모). 절차 — ① 대기 중인 native-build PR들을 시간 간격 없이 연속으로 머지한다. ② 마지막 머지를 제외한 앞선 머지들의 `eas-deploy` 런은 `eas build` 단계에 들어가기 전에 즉시 취소한다(`gh run list --workflow eas-deploy.yml` → `gh run cancel <run-id>`; 워크플로 셋업에 ~1분 걸리므로 그 안에 취소하면 빌드가 시작되지 않는다). ③ 빌드는 머지 커밋 시점의 dev 스냅샷 전체를 담으므로, 마지막 런 하나로 모든 네이티브 변경이 포함된 빌드가 나온다. 단, 앞선 PR의 변경이 빌드를 깨뜨릴 수 있는지(매니페스트·플러그인 충돌 등)는 마지막 PR 리뷰에서 함께 확인할 것 — 실패하면 어차피 재빌드로 쿼터를 더 쓴다.

- **빌드 성공은 실행 가능을 뜻하지 않는다 — 제출 전 실행 확인은 필수** (2026-08-20, #915): 1.2.0 빌드 47은 EAS 빌드 성공·`check` 통과(테스트 990개)·ASC 업로드 성공을 전부 거치고도 **스플래시에서 즉사**했다(#913). 통과한 신호들 중 어느 것도 "앱이 켜지는가"를 보지 않았다.
  - **`Sentry가 조용하다`를 안전 신호로 읽지 말 것.** 그 크래시는 JS Sentry 초기화 **전에** 나서 Sentry에 아예 안 올라왔다. 네이티브 크래시는 디스크에 적혔다가 **다음 실행**에 올라가는데, 시작에서 죽으면 그 다음 실행이 없다.
  - **산출물을 검증한다, 입력이 아니라.** `app.json`이 멀쩡해도 config plugin이 prebuild 때 키를 지울 수 있다 — #913이 정확히 그랬다. `scripts/check-ios-plist.mjs`가 prebuild 산출물의 Info.plist 필수 권한 키를 검사하고, `native-prebuild-check.yml`의 `ios-plist` 잡이 **라벨과 무관하게 모든 PR에서** 돌린다(#914가 라벨이 없어 검증을 건너뛴 게 사고의 한 축이었다).
  - **제출 전 실기기/시뮬레이터 실행 1회는 사람이 한다.** 로컬 iOS 빌드가 되므로(메모리의 Xcode 26 레시피 — RNFB 26.2.0 + `$RNFirebaseDisableSPM`) EAS 쿼터 없이 시뮬레이터에서 띄워볼 수 있다. 스토어 제출·TestFlight 배포 전에 **앱을 실제로 켜서 첫 화면까지 확인**할 것.

- **네이티브 설정 오류는 클라우드 빌드 전에 잡기**: `native-build` 라벨 PR은 CI(`native-prebuild-check.yml`)가 `expo prebuild` + Android 매니페스트 병합을 자동 검증한다(EAS 쿼터 소모 없음). 로컬에서도 머지 전 `npx expo prebuild --platform android --no-install`로 산출물을 확인할 것. 그리고 **네이티브 모듈 시행착오(FCM류 설정 반복)는 EAS release 빌드를 반복하지 말고** dev client 빌드 1회 위에서 반복하거나 `eas build --local`(월 10회 무료, JDK/SDK 필요)로 검증한다 — 7월 쿼터 소진의 실패 빌드 5회가 전부 이 비용이었다.
