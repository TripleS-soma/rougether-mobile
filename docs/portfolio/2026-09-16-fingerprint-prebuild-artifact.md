# prebuild 생성물이 런타임 지문을 갈라 iOS 빌드 실패

- 2026-09-16 / infra(EAS 빌드·OTA) / #1364(원인 유입), #1366(수정)
- 키워드: Expo fingerprint runtime policy, EAS Build, expo-updates, CNG(prebuild), @bacons/apple-targets, 재현 기반 디버깅

## 배경

앱은 `runtimeVersion: { policy: "fingerprint" }`를 쓴다. 네이티브에 영향을 주는 파일들의 해시가 곧 런타임 버전이고, OTA는 같은 지문의 바이너리에만 도달한다. CI(GitHub Actions)가 지문을 계산해 EAS 빌드를 올리면, EAS 워커가 prebuild 후 다시 계산해 둘을 비교한다.

iOS 홈 위젯 표정 기능(#1364)을 넣으면서 `@bacons/apple-targets`의 `images` 설정으로 위젯 익스텐션에 얼굴 이미지 6장을 번들했다.

## 문제 (증상)

1.5.3 네이티브 윈도우의 iOS 빌드 124가 `Configure expo-updates` 단계에서 실패했다. 같은 커밋의 Android 빌드는 정상 진행.

```
Runtime version mismatch:
- Runtime version calculated on local machine: 0ed984cc…
- Runtime version calculated on EAS: 8ae89c49…
```

실패 빌드도 EAS 쿼터를 소모한다.

## 원인 분석 (가설 → 검증 과정)

1. 과거 같은 에러는 "워크트리의 심링크 node_modules로 로컬 `eas build`" 또는 "`npm ci` 없이 로컬 빌드"가 원인이었다. 이번엔 CI 러너가 `npm ci` 후 계산했으므로 그 가설은 배제.
2. EAS 로그를 brotli 해제해 **지문 diff**를 읽었다. 차이는 두 소스뿐: `ios` 디렉터리 추가(이미 `.fingerprintignore`로 무시되는 정상 항목), 그리고 **`targets` 디렉터리 해시 변경**.
3. `fingerprint.config.js`가 `targets/` 전체를 extraSources로 넣고 있었다(과거에 위젯 Swift만 고치면 지문이 안 바뀌어 OTA만 나가던 함정을 막으려고 추가한 설정).
4. 가설: prebuild가 `targets/` 안에 파일을 생성한다. 로컬에서 `expo prebuild --platform ios` 실행 → `targets/widgets/Assets.xcassets/`가 생긴 것을 확인 → 그 상태로 지문을 찍자 **정확히 EAS 값 `8ae89c49`가 재현**됐다. 생성물을 지우면 러너 값 `0ed984cc`.

즉 CI 러너(prebuild 전)와 EAS 워커(prebuild 후)가 서로 다른 파일 집합을 해싱하고 있었다.

## 해결

`.fingerprintignore`에 생성물 경로 `targets/**/Assets.xcassets/**`만 추가했다. 원본 이미지 경로는 `expo-target.config.js`(지문 포함)에 있으므로, 위젯 이미지를 바꾸면 여전히 지문이 바뀐다 — 과거 함정을 다시 열지 않는다.

`.fingerprintignore` 자체는 지문 입력이 아니라서, 규칙 추가 후에도 iOS 지문은 생성물 유무와 무관하게 `0ed984cc`로 같고 Android `162a83fa`도 불변임을 확인한 뒤 머지했다. 재빌드는 워크플로의 중복 방지 가드(같은 지문의 ERRORED 빌드가 있으면 스킵)를 고려해 dev 커밋에서 수동으로 한 번만 올렸다(빌드 125 성공).

## 결과 (수치)

- 실패 1회(빌드 124) 이후 추가 낭비 없이 재빌드 1회로 성공(빌드 125, TestFlight 업로드)
- 지문: 러너 `0ed984cc` / EAS `8ae89c49` → 수정 후 양쪽 `0ed984cc`

## 배운 점 / 재발 방지

- "지문 불일치"는 하나의 에러 메시지에 여러 원인이 있다. 과거 원인에 끼워 맞추지 말고 **EAS 로그의 지문 diff를 먼저** 읽는다.
- 로컬에서 prebuild 전후로 지문을 찍어 보면 EAS 값을 그대로 재현할 수 있다 — 머지 없이 원인을 확정하는 싼 방법.
- 지문 입력으로 넣은 디렉터리 아래에 prebuild가 무언가를 쓰면 반드시 같은 사고가 난다. 생성물은 ignore, 원본만 해싱.
