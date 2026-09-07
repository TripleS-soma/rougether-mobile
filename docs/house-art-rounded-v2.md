# 라운드 집과 낮·밤 배경 적용

승인된 구름·버섯·산호 집을 `rounded-v2-20260907` 릴리스로 교체합니다. 집의 방 입구 모서리는 라운드 마감이며, 같은 화풍의 낮·밤 배경을 함께 사용합니다.

## 표시와 저장

- 프레임 9종: `house/{cloud-balloon|mushroom-forest|coral-lagoon}/frames/rounded-v2-20260907/house-{theme}-{2|4|6}p-frame.webp`
- 배경 6종: `house/{cloud-balloon|mushroom-forest|coral-aquarium}/backgrounds/rounded-v2-20260907/house-{theme}-background-{day|night}.webp`
- [CDN manifest](https://d1eazfl0tw7r0v.cloudfront.net/house/releases/rounded-v2-20260907/manifest.json)

기존 `coverImageKey`는 저장·생성·수정 API에서 그대로 사용합니다. 산호의 표시 프레임 slug는 `coral-lagoon`, 저장 커버와 배경의 canonical theme은 `coral-aquarium`입니다. 공개 선택지를 추가하거나 기존 집 데이터를 변경하지 않습니다.

숨김 테마 7종은 `stacked-v1-20260905`를 유지합니다. 천문대는 기존 프레임과 낮·밤 배경을 사용합니다. 새 릴리스에 없는 파일을 파생하지 않도록 프레임 전환 대상 세 테마를 명시했습니다.

## 비율과 마감

프레임 저장 크기와 방의 바깥 사각형 좌표는 이전과 같습니다. 원본 폭 1024, 캔버스 높이 872/1224/1576, 방 x=165/536, y=358+352×행, 크기 320×320입니다. 렌더러 v2가 프레임을 세로 1.2배 표시하므로 방은 320×384가 됩니다. 프레임만 `contentFit="fill"`로 표시하고 방의 가구·캐릭터 크기는 폭을 기준으로 유지합니다.

곡선은 각 모서리에서 가로 32px, 저장 세로 32/1.2px 구간의 2차 베지어입니다. 표시 후 양 축이 같은 32px 구간이 됩니다. 곡선 밖 네 모서리는 프레임이 불투명하게 덮으며 방 레이어는 그 뒤에 놓입니다. PNG 원본과 무손실 WebP의 알파가 같습니다.

배경은 941×1672 WebP이고 `cover`/`center`를 유지합니다. 집 전환·시스템 모드 전환 시 기존 `recyclingKey`에 새 asset key가 전달되어 이전 테마의 캐시와 구분됩니다.

## 게시·검증

2026-09-07에 이미지 15개와 manifest 1개를 새 버전 경로에 등록했습니다. AWS 계정·CDN origin·전체 key 충돌을 쓰기 전에 검사하고 `IfNoneMatch=*`로 덮어쓰기를 차단했습니다. 16개 모두 S3와 CDN에서 다시 내려받아 로컬 SHA-256 및 Content-Type 일치를 확인했습니다. 기존 canonical 커버 객체의 ETag/VersionId/크기는 등록 전후 동일합니다.

로컬 에셋 검사에서 프레임 9개·방 36개의 라운드 모서리, 투명 중심, 외곽 보존, PNG/WebP 알파를 확인했습니다. 2·4·6인과 낮·밤 조합도 합성 검수했습니다. 합성은 실제 앱 최초 진입 화면이 아니며 6인 구도는 바닥까지 스크롤한 상태입니다.

회귀 테스트는 새 프레임·배경 키 선택, canonical key 보존, 숨김 7테마 유지, 천문대와 비지원 정원 fallback, 집·앱 모드 전환의 source/캐시 키 변경을 검증합니다. 세로 비율과 가구 좌표 검증은 `room-renderer-v2.md`를 따릅니다.

## 복구

정식 반영과 실기기 OTA는 각각 적용된 커밋/런타임을 확인해야 합니다. 1.5.0(115)의 뽑기 후보에는 이 에셋 참조 변경 커밋만 통합하여 기존 네이티브 구성과 헤더·탭 변경을 보존합니다.

아트 교체를 되돌릴 때는 세 테마 프레임을 `stacked-v1-20260905`로, 배경을 종전 `background-v1.webp` / `background-dark-v1.webp`로 되돌립니다. 세로 방 렌더 계약은 유지할 수 있습니다. 새 CDN 객체를 삭제하거나 기존 객체를 덮어쓸 필요는 없습니다.
