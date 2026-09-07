# 세로형 방 렌더러 v2

내 방·꾸미기·친구 방·집 내부 방을 가로:세로 `1:1.2`로 통일합니다. 폭 360이면 높이 432이며, 벽 2 : 바닥 1 구역과 기존 1205×964 벽지·1205×482 바닥 에셋을 사용합니다.

정본은 `src/components/room/room-render-contract.v2.json`입니다. `coordinateSpace.type`은 `normalized-rect`이며 `x/y`는 여전히 각 축의 0~1 중심 좌표입니다. 서버의 `FREE_V1` 배치 형식, 저장된 좌표·배율·회전·반전·revision은 변경하지 않습니다. 세로 위치는 늘어난 높이에 대한 같은 상대 위치로 표시됩니다.

가구 크기는 방 폭 기준 28% × 배율입니다. 캐릭터도 폭 기준 42%와 정사각형 박스를 유지합니다. 가구의 세로 중심 보정과 드래그·크기 변경·새 배치의 세로 경계는 폭/높이 비율을 반영합니다. 꾸미기 오버레이는 실제 캔버스 높이를 측정하므로 표시·드래그·저장 후 재진입에서 같은 중심을 사용합니다.

집 안 방은 배포된 프레임의 투명 구멍 좌표를 유지하고 프레임 표시 높이를 조정합니다. `stacked-v1-20260905`의 320×320 구멍은 320×384로 표시됩니다. `contentFit="fill"`을 사용하는 프레임만 세로로 늘어나며, 그 뒤에 그리는 방의 가구·캐릭터는 늘어나지 않습니다. 기존형 fallback도 구멍의 가로/세로 비율에 맞춰 표시 높이를 계산합니다. 집 선택 썸네일은 원본 비율을 유지합니다. 승인된 구름·버섯·산호 집은 `rounded-v2-20260907`의 라운드 마감 프레임 9종과 낮·밤 배경 6종을 사용합니다. 기존 `coverImageKey` 저장 값은 유지하며 새 에셋은 표시용으로만 파생합니다. 숨김 테마 7종은 종전 릴리스를 사용합니다. 상세 키와 검증은 `docs/house-art-rounded-v2.md`에 정리합니다.

관리자 저장소에 복사된 v1 렌더 계약은 이 모바일 변경으로 자동 갱신되지 않습니다. 관리자 미리보기 동기화 시 v2 계약의 가구 중심 보정과 캐릭터 `aspectRatio`를 함께 반영해야 합니다.

검증 화면은 `/dev?entry=Room%20%C2%B7%20renderer%20contract%20v2%20reference`, `/dev?entry=MyRoomScreen`, `/dev?entry=RoomDecorScreen`, `/dev?entry=FriendRoomScreen`, `/dev?entry=StackedHouseFrames`입니다. 갤러리는 개발 빌드 전용이며 fixture 편집은 서버 데이터를 저장하지 않습니다.

검증 명령:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand --watchman=false
git diff --check
```

`--watchman=false`는 로컬 sandbox에서 사용자 Watchman 상태 디렉터리 접근을 피하기 위한 테스트 실행 옵션이며 앱 코드 설정을 변경하지 않습니다.
