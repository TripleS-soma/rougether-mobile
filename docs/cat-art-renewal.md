# 고양이 시그니처 포즈 리뉴얼

관련 이슈: #1250. 누워 있는 시그니처를 기본 자세로 유지하면서 같은 원화에서 표정 모션을 만든다. 기존 앉기 시안과 Blender 인사는 추가 포즈로 제공한다.

## 표시 순서

1. `cat-approved-idle.webp`: 새로 그린 시그니처 눕기. 두 앞발을 내밀고 고개를 기울인 기본 대기 모션. 3.2초 주기로 고개를 좌우 ±3° 흔든다. 눈깜빡임은 별도 포즈로 유지한다.
2. `cat-approved-blink.webp`: 누운 채 두 번 눈깜빡임, 4초 루프.
3. `cat-approved-wink.webp`: 누운 채 한쪽 눈 윙크, 4초 루프.
4. `cat-approved-seated.webp`: 기존 승인 앉기 원화.
5. `cat-approved-wave.webp`: 앉아서 앞발 인사, 3초 루프.

인사 다음에는 눕기로 돌아간다. 프로필·선택창·뽑기에서도 같은 눕기 대기 모션을 사용한다. 시그니처를 삭제하거나 앉기로 대체하지 않는다.

## 원화와 일관성

눕기 원화는 기존 `cat-1.webp`의 자세와 사용자가 승인한 앉기 시안의 얼굴·그림체를 참조해 새로 제작했다. 눈을 감은 생성 결과에서는 눈 주변만 마스크로 사용하고, 나머지는 눕기 원화의 픽셀을 그대로 유지한다. 윙크는 동일한 눈 편집 중 한쪽만 적용한다.

눈깜빡임·윙크에서 실루엣, 코·입, 앞발, 몸통, 꼬리는 움직이지 않는다. 원본 마스크 밖 픽셀 동일성과 디코딩한 WebP의 알파, 몸통, 루프 시작/끝을 검사한다. 결과는 `assets/characters/cat-approved/signature-verification.json`에 남는다.

기본 대기는 같은 원화에 고개 회전을 적용하고 목 부분에서만 변형량을 줄인다. 눈·코·입은 같은 회전으로 움직여 비율을 유지하고 앞발·뒷몸통·꼬리는 고정한다. `head-idle-verification.json`은 움직임 존재, 얼굴 기준점, 고정 영역, 캔버스 잘림, 반복 경계를 검사한다. 전체 프레임에 같은 256색 팔레트를 사용해 용량을 약 2.1MB로 줄였고, 팔레트 적용 전후 불투명 픽셀의 프레임별 평균 RGB 오차는 255 중 최대 1.60 이하다. 3.2초/±3°는 새로 조정한 값이며 기존 설치본의 정확한 속도를 측정한 값은 아니다.

5종 모두 512×512 투명 캔버스를 사용한다. 눕기 3종은 같은 크롭/배율/바닥 좌표를 사용하고, 앉기·인사도 두 눈 사이 간격이 눕기와 비슷하도록 함께 축소한다. 눕기와 앉기 사이의 연결 동작은 포함하지 않는다.

## 모바일 적용

- `src/resources/character-art.ts`에 고양이 5포즈와 포스터 매핑을 모은다.
- `CharacterAvatar`는 고양이의 옛 서버 `poses`/`animations`보다 리뉴얼 포즈를 우선한다. 구형 고양이 이미지 프리페치는 생략한다.
- 캐릭터 선택창은 옛 `baseAssetKey` 대신 새 눕기 원화를 표시한다.
- 뽑기 결과와 보상 목록의 `characters/cat/...`, `characters/cat_...`, `characters/cat.png` 계열 키도 새 눕기 포스터를 사용한다.
- 다른 동물, 가구, 캐릭터 보유/선택 ID, 서버 카탈로그와 S3 원본은 유지한다. 새 서버 고양이 포즈를 노출하려면 리뉴얼 목록도 함께 갱신해야 한다.

원래 4장의 번들 파일은 새 세트로 교체했다. 원본은 Git 이력에서 찾을 수 있다. `build:characters`는 고양이의 오래된 스트립을 재생성하지 않는다.

## 재생성

`assets/characters/cat-approved`에는 눕기 원화·눈 편집 참조, 승인 앉기 원화·Blender 인사 원본이 있다. 앱에는 `assets/images/characters/cat-approved-*.webp`만 import된다.

Python 3, Pillow, numpy, OpenCV가 있는 환경에서:

```sh
python3 scripts/build-approved-cat.py
python3 scripts/build-signature-cat.py
python3 scripts/build-cat-head-idle.py
npx prettier --write assets/characters/cat-approved/*.json
```

Expo SDK 55의 [Image](https://docs.expo.dev/versions/v55.0.0/sdk/image/)로 번들 WebP를 렌더한다. 개발 갤러리의 `Room · 승인된 고양이`에서 5번 탭하면 눕기 → 깜빡임 → 윙크 → 앉기 → 인사 → 눕기로 돌아온다.

웹 갤러리/자동 테스트 검증은 iOS·Android 설치본 검증과 별개다. 이 PR은 업데이트 배포 전이며 기존 S3 파일이나 서버 카탈로그를 삭제하지 않는다. 작업 이슈 #1250의 프로젝트 보드 등록은 CLI 토큰의 `read:project` 권한 부족으로 미완료다.

![리뉴얼된 눕기와 5가지 포즈](assets/cat-art-renewal.jpg)
