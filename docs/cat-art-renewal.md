# 고양이 원화 통일

관련 이슈: #1250. 2026-09-09 사용자가 승인한 앉은 고양이와 해당 원화에서 앞발만 변형한 Blender 인사를 사용한다.

## 표시 규칙

- 고양이: `cat-approved-idle.webp`(앉기) → `cat-approved-wave.webp`(인사) → 앉기.
- `CharacterAvatar`는 고양이의 서버 `poses`/`animations`보다 승인된 번들 포즈를 우선한다. 옛 서버 이미지 프리페치는 생략한다.
- 캐릭터 선택창은 고양이의 `baseAssetKey` 대신 같은 승인 원화를 사용한다.
- 뽑기 결과의 `characters/cat/...`, `characters/cat_...`, `characters/cat.png` 계열 이미지 키는 승인된 앉기 원화로 표시한다. 가구·다른 동물은 기존 경로를 유지한다.
- 서버 캐릭터 보유 상태·선택 ID·카탈로그 데이터는 바꾸지 않는다. 이후 고양이 포즈를 추가하려면 `src/resources/character-art.ts`의 승인 목록을 함께 갱신해야 한다.

옛 `cat-1..4.webp`는 앱 에셋에서 제거했다. 눕기 원본은 캐릭터 정체성의 참고였으나, 현재 승인 세트의 얼굴 크기·발 위치와 맞지 않아 런타임 포즈에서는 제외했다. 옛 원본은 Git 이력에서 확인할 수 있다. `build:characters`는 고양이 옛 스프라이트를 재생성하지 않는다.

## 원본과 재생성

`assets/characters/cat-approved/seated-master.png`는 승인된 앉기 원화, `wave-master.webp`는 Blender 렌더 결과이다. 앱은 `assets/images/characters/cat-approved-*.webp`만 import한다.

Python 3, Pillow, numpy가 있는 환경에서:

```sh
python3 scripts/build-approved-cat.py
```

두 결과는 같은 크롭 좌표와 512×512 캔버스를 사용한다. 원화의 바깥 배경과 분리된 잡티만 제거하고, 얼굴 안쪽의 크림색은 보존한다. 인사는 3초 루프이며 앞발을 든 채 시작하고 끝난다. 앉기에서 팔을 드는 연결 모션은 포함하지 않는다. 각 애니메이션 프레임의 얼굴 영역과 처음/마지막 프레임이 동일한지 검사한다(`verification.json`).

## 확인 방법

개발 서버의 `/dev?entry=Room%20%C2%B7%20%EC%8A%B9%EC%9D%B8%EB%90%9C%20%EA%B3%A0%EC%96%91%EC%9D%B4`에서 고양이를 두 번 탭한다. 앉기 → 인사 → 앉기로 돌아가며 얼굴 크기와 발의 바닥 위치가 유지돼야 한다. 내 방, 친구 방, 프로필, 꾸미기, 온보딩은 같은 공용 아바타를 사용한다.

Expo SDK 55의 [Image](https://docs.expo.dev/versions/v55.0.0/sdk/image/)로 번들 WebP를 렌더한다. 로컬 웹 갤러리와 자동 테스트 검증은 스토어 설치본 검증과 별개이며, 이 변경은 앱 업데이트를 배포해야 설치본에 적용된다. 기존 S3 파일이나 서버 카탈로그를 삭제하는 변경은 포함하지 않는다.

## 검증 기록

- 2026-09-09: TypeScript 검사와 포맷 검사 통과, lint 오류 0개(기존 app-shell 훅 경고 1개).
- Jest 전체 239개 스위트, 1,919개 테스트 통과. 기존 열린 비동기 핸들 때문에 `--forceExit`를 사용했다.
- 실제 Expo 웹 갤러리에서 앉기 → 인사 → 앉기 전환과 두 WebP의 표시를 확인했다. iOS/Android 설치본 검증과 배포는 미실행이다.
- 작업 이슈 #1250을 생성했으나 GitHub CLI 토큰에 `read:project` 권한이 없어 프로젝트 보드 등록은 완료하지 못했다.

![기존 4포즈와 승인된 2포즈 비교](assets/cat-art-renewal.jpg)
