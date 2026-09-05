# 집 다크모드 배경 연결

관련 이슈: #1086. 기존 네 집의 커버·방 배치·구매 정책은 변경하지 않는다.

## 표시 규칙

- `useResolvedScheme()`으로 앱 설정의 라이트·다크 또는 시스템 모드를 해석한다.
- 집 화면 렌더와 셸의 이미지 프리패치가 같은 `houseBackgroundKey(coverKey, scheme)`를 사용한다.
- 라이트 모드는 종전 `background-v1.webp`를 유지한다. 다크 모드는 아래 별도 파일을 사용한다.
- 테마·모드가 바뀌면 `source`와 `recyclingKey`가 같은 렌더에서 바뀐다.
- 알 수 없는 테마는 기존 `t.sky` 폴백을 유지한다. 커버 미지정 집은 기존 기본 구름 커버 규칙을 따른다.

## 업로드 manifest

모두 WebP, 941×1672. 경로는 `house/{theme}/backgrounds/house-{theme}-background-dark-v1.webp`다.

| theme             |  bytes | SHA-256                                                            |
| ----------------- | -----: | ------------------------------------------------------------------ |
| cloud-balloon     |  57046 | `23347838c3038ecffda488e923dec60dc7d8e372c2bd87b23280aa7d06d8099f` |
| coral-aquarium    |  78248 | `6d1963b9cdd2aa580389bb3c63a0041f4e5bed0be66e195fffc8fe085c8e1e73` |
| mushroom-forest   | 127710 | `a88f3eeaffd8d57fd14456d1552346d735b26e4079b9f0d3d451f930c302861f` |
| night-observatory |  75450 | `aea512e182802ee2b070e405578a0ab1401a252abd3bd0d0d7c590e1ab9a9dbb` |

원본 패키지: 서버 작업공간의 `output/imagegen/house-dark-mode-2026-09-05/`.
PNG는 편집용 원본이고 배포에는 WebP 4개만 사용한다. DB/API 수정은 없다.

## 병합·배포 전 게이트

2026-09-05 **WebP 4개 업로드와 CDN 검증 완료**. 사용자 승인 범위는 새 1.4.1의 TestFlight 빌드·업로드까지이며, production OTA와 App Store 심사 제출은 포함하지 않는다.

1. 기존 AWS SSO 세션을 갱신한다(`aws sso login --profile rougether-isb`). 계정 및 현재 CDN origin 버킷을 읽기 전용으로 재확인한다.
2. 정확히 위 네 key를 검사한다. 403은 파일 부재가 아니라 권한 오류이므로 중단한다. 기존 object가 있으면 체크섬을 대조하고, 다른 내용이면 덮어쓰지 않는다.
3. 신규 object만 조건부 업로드한다. `Content-Type: image/webp`, `Cache-Control: public,max-age=31536000,immutable`을 사용한다. 기존 라이트 배경·커버 파일은 건드리지 않는다.
4. 앱의 `src/config/shared-endpoints.json` assetBase에서 네 URL의 200, MIME, bytes, SHA-256을 대조한다.
5. 실제 앱에서 네 집을 라이트/다크/시스템 모드로 전환한다. 집 이동, 앱 재시작, 미지정 커버, 모르는 테마의 폴백을 확인한다. 기존 Remotion 합성 미리보기는 실기기 검증을 대신하지 않는다.
6. 위 게이트가 끝난 뒤 사용자와 배포 범위를 확인한다. dev 병합, production OTA, 새 네이티브 빌드는 서로 다른 단계다. `docs/release-ops.md`의 채널·런타임 검증을 따른다.

초기에는 asset MCP의 HeadObject가 403, `rougether-isb`의 STS 검사가 SSO 만료로 실패했다. 이후 사용자가 SSO 로그인을 갱신했고, 계정과 CDN origin을 재확인한 뒤 정상 업로드했다.

- 대상: `rougether-assets-isb-776158585524`, CDN `https://d1eazfl0tw7r0v.cloudfront.net`.
- 네 key의 404를 먼저 확인하고 `If-None-Match: *`로 신규 object만 업로드했다. 기존 라이트 배경·커버를 덮어쓰지 않았다.
- 실제 CDN GET 4/4가 200, `image/webp`, 위 bytes·SHA-256과 일치했다.
- TestFlight 배포 전 iOS Release 앱 첫 화면 실행을 확인한다. 로그인 후 실기기 네 테마 전환은 별도의 최종 수동 점검 항목이며, 자동 테스트나 웹 갤러리 결과를 실기기 결과로 기록하지 않는다.
  이 변경은 `app.json`, `package.json`, 네이티브 플러그인, `.gitignore`를 수정하지 않는다.

## 회귀 검증

- resource 테스트: 네 테마의 라이트/다크 key, 버전별 커버 파일, 미지정/알 수 없는 테마의 폴백.
- HouseScreen 테스트: 모드 변경, 다크 상태의 네 집 이동, OS 다크 설정, 앱의 명시적 라이트 우선, 폴백.
- AppShell 테스트: 집 목록이 바뀌지 않아도 모드 변경 때 다크 배경을 프리패치한다.
- 전체 Jest: 166 suites / 1,330 tests 통과. 배경 resolver 파일은 15개 테스트로 statements·branches·functions·lines 100%.
- typecheck, lint(오류 0, 기존 경고 2), format:check, diff --check 통과. iOS export와 prebuild 산출물의 필수 Info.plist 권한 키 6개 검사 통과.
