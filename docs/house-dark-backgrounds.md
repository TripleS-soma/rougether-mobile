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

2026-09-05 현재 **업로드 및 실기기 검증 미완료**. 이 상태로 병합하거나 OTA를 발행하지 않는다.

1. 기존 AWS SSO 세션을 갱신한다(`aws sso login --profile rougether-isb`). 계정 및 현재 CDN origin 버킷을 읽기 전용으로 재확인한다.
2. 정확히 위 네 key를 검사한다. 403은 파일 부재가 아니라 권한 오류이므로 중단한다. 기존 object가 있으면 체크섬을 대조하고, 다른 내용이면 덮어쓰지 않는다.
3. 신규 object만 조건부 업로드한다. `Content-Type: image/webp`, `Cache-Control: public,max-age=31536000,immutable`을 사용한다. 기존 라이트 배경·커버 파일은 건드리지 않는다.
4. 앱의 `src/config/shared-endpoints.json` assetBase에서 네 URL의 200, MIME, bytes, SHA-256을 대조한다.
5. 실제 앱에서 네 집을 라이트/다크/시스템 모드로 전환한다. 집 이동, 앱 재시작, 미지정 커버, 모르는 테마의 폴백을 확인한다. 기존 Remotion 합성 미리보기는 실기기 검증을 대신하지 않는다.
6. 위 게이트가 끝난 뒤 사용자와 배포 범위를 확인한다. dev 병합, production OTA, 새 네이티브 빌드는 서로 다른 단계다. `docs/release-ops.md`의 채널·런타임 검증을 따른다.

업로드를 준비하며 asset MCP의 HeadObject는 403, `rougether-isb`의 STS 검사는 SSO 만료로 실패했다. 업로드 성공으로 간주하지 않는다.
이 변경은 `app.json`, `package.json`, 네이티브 플러그인, `.gitignore`를 수정하지 않는다.

## 회귀 검증

- resource 테스트: 네 테마의 라이트/다크 key, 버전별 커버 파일, 미지정/알 수 없는 테마의 폴백.
- HouseScreen 테스트: 모드 변경, 다크 상태의 네 집 이동, OS 다크 설정, 앱의 명시적 라이트 우선, 폴백.
- AppShell 테스트: 집 목록이 바뀌지 않아도 모드 변경 때 다크 배경을 프리패치한다.
