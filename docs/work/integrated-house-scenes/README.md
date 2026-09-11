# 집 통합 장면 구현

추적 이슈: [#1296](https://github.com/TripleS-soma/rougether-mobile/issues/1296)

집·마당·배경이 들어 있는 opaque WebP 한 장 위에 기존 `Room`을 입구별로 올립니다. 좌석 방문·자리 교환·확대 카메라는 원래 `HouseScreen` / `SeatTile` 경로를 사용합니다. 서버의 canonical `coverImageKey`, `membershipId`, 개인 가구 배치와 캐릭터 코드는 변경하지 않습니다.

## 구성

- `src/resources/house-scenes/manifest.json`: 원본 width/height, themeId, capacity, roomRects. 배열 순서는 화면 위부터 왼쪽→오른쪽입니다. 실제 가입/좌석 순서는 기존 `houseWindowSeats`를 사용합니다.
- `src/resources/house-scenes/sources.ts`: 정적으로 require한 로컬 WebP. 카탈로그 저장 키는 원래 서버 key를 유지합니다. 산호의 표시 ID `coral-lagoon`은 canonical `coral-aquarium`과 기존 매핑을 공유합니다.
- `HouseFrameArtwork`: 통합 그림은 방 아래, 레거시 투명 프레임은 방 위에 렌더합니다. 다크 모드는 같은 통합 그림 위에만 16% 밤색 음영을 더하며 방 색은 그대로입니다. 별도 밤 그림은 아직 생성하지 않았습니다.
- `HouseRoomAperture`: 원본 입구 rect와 같은 비율로 이동·크기를 계산하고 안쪽 음영을 넣습니다. 5:6 Room을 uniform center-cover해 캐릭터·가구의 종횡비를 보존합니다. 현재 패키지의 최종 roomRects는 5:6 내접 영역을 기준으로 사용하여 저장된 가구 좌표가 잘리지 않도록 합니다.
- 초기 화면은 원본 전체 폭을 화면 폭에 맞춥니다. 세로를 채우는 자동 확대는 지붕·외벽·정원을 잘라내므로 사용하지 않습니다. 방과 그림은 같은 비율을 유지하며, 사용자가 직접 핀치할 때만 카메라가 확대됩니다.
- 세로로 남는 영역은 장면 하단에서 추출한 바닥색으로 채우고 그림 끝의 짧은 페이드로 연결합니다. 다크 모드는 그림과 바닥색에 같은 음영을 적용합니다.

## 확인

최종 패키지는 네 테마 × 2/4/6인 정원인 12장(2,175,948 bytes), 방 48개입니다. 모든 방 rect는 정확한 5:6이며 같은 집 안에서는 크기가 같습니다. [검증 기록](verification.md)에 전체 검사와 실제 RN Web 확인 범위를 남겼습니다.

```bash
node scripts/import-house-scenes.cjs /path/to/integrated-house-scenes-package
npm start -- --web --port 8099
```

로컬 [Dev 갤러리](http://localhost:8099/dev?entry=IntegratedHouseScenes)에서 네 테마·2/4/6인·탐색 미리보기/실제 집 화면·빈자리·기존 프레임을 바꿀 수 있습니다. 실제 화면의 `멤버 N`을 누르면 `N번 ... 방문`이 표시됩니다. 갤러리는 공개 에셋과 고정된 검증 데이터를 사용하며 개인 API를 호출하지 않습니다.

`EXPO_PUBLIC_INTEGRATED_HOUSES=0`은 새 장면을 끄는 번들 옵션입니다. 실시간 원격 스위치는 아닙니다. 파일 로드 실패는 scene→기존 stacked frame→legacy frame 순으로 그림과 좌표를 함께 바꿉니다. 미지원 테마·7인 이상은 기존 경로를 사용하고 넘친 구성원을 숨기지 않습니다.

## 범위와 운영 상태

- 작업 기준: 원격 `dev`의 `f5b956de32a56d3fce6f1ed7a1d095fab075a4c9`.
- 이번 작업에서 이미지 업로드, merge, OTA, 네이티브 빌드, 스토어 제출은 실행하지 않았습니다.
- 조직 프로젝트 보드 등록은 토큰에 `read:project` 권한이 없어 실패했습니다. 이슈 생성은 완료했습니다. 계정 권한을 변경하지 않았습니다.
- 웹 렌더 검증은 네이티브 실기기 검증을 대체하지 않습니다. 핀치 줌·롱프레스 자리 이동과 기기별 SVG 음영은 실제 설치본에서 추가 확인이 필요합니다.

Expo SDK 55의 [Image 문서](https://docs.expo.dev/versions/v55.0.0/sdk/image/)에 맞춰 정적 source, `contentFit`, `onError`, `cachePolicy`, `recyclingKey`를 사용합니다. 새로운 네이티브 모듈과 app config 변경은 없습니다.
