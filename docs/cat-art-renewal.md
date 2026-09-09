# 고양이 시그니처 포즈 리뉴얼

관련 이슈: #1250. 누워 있는 시그니처와 얼굴·체형을 유지하면서, 내 방은 모든 포즈가 반복 재생되고 터치마다 다음 포즈로 넘어가도록 리뉴얼한다.

## 화면별 동작

- 내 방: 아래 8종을 모두 애니메이션으로 제공한다. 8번 터치하면 기본 눕기로 돌아온다. 정지 이미지는 순환 목록에 없다.
- 친구 방: 같은 눕기 원화의 `cat-approved-still.webp`를 사용한다. 포즈 터치 버튼이 없으며 헤더의 고양이도 정지 이미지다.
- 캐릭터 선택·프로필·뽑기: 새 기본 눕기 모션을 사용한다.

`Room.interactiveCharacter`가 켜져 있으면 항상 움직인다. 친구 화면은 `animateCharacter={false}`를 명시하고 `CharacterAvatar`가 별도 정지 원화를 선택한다. 단순히 웹에서 지원되지 않는 autoplay 끄기에 의존하지 않는다. 고양이 리뉴얼 범위이며 다른 동물 에셋은 변경하지 않는다.

## 내 방 표시 순서

| 순서 | 파일                        | 반복 동작                                      | 주기   |
| ---- | --------------------------- | ---------------------------------------------- | ------ |
| 1    | `cat-approved-idle.webp`    | 누운 채 고개 좌우 흔들기                       | 3.2초  |
| 2    | `cat-approved-blink.webp`   | 누워 숨 쉬며 두 번 깜빡임                      | 4초    |
| 3    | `cat-approved-wink.webp`    | 누워 숨 쉬며 윙크                              | 4초    |
| 4    | `cat-approved-seated.webp`  | 좌우를 돌아보고 눈을 깜빡이는 연속 그림        | 2.72초 |
| 5    | `cat-approved-wave.webp`    | 앞발을 들어 흔들고 내려놓는 연속 그림          | 2.72초 |
| 6    | `cat-approved-stretch.webp` | 앞발을 뻗고 엉덩이를 올렸다 돌아오는 연속 그림 | 2.88초 |
| 7    | `cat-approved-sleep.webp`   | 몸을 말고 잠들어 천천히 숨 쉬기                | 6초    |
| 8    | `cat-approved-groom.webp`   | 앞발을 핥고 볼을 닦은 뒤 내려놓는 연속 그림    | 2.72초 |

포즈를 전환할 때 새 모션을 처음부터 재생한다. 서로 다른 자세 사이를 이어주는 전환 동작은 포함하지 않는다. 기본 고개 흔들기의 ±3°/3.2초는 새로 조정한 값이며 기존 설치본의 정확한 속도를 측정한 값은 아니다.

## 원화와 일관성

승인된 눕기·앉기 원화를 참조해 내장 `imagegen`으로 세수·앞발 인사·두리번·기지개의 전체 캐릭터 연속 그림을 새로 제작했다. 원본 4×4 시트와 실제 프롬프트는 [`assets/characters/cat-drawn`](../assets/characters/cat-drawn/prompts.md)에 보관한다. 한 동작에서 머리·얼굴·앞발·몸통이 함께 바뀌는 그림이며 Blender, 분리된 팔 회전, 메시 변형, 광학 보간으로 만들지 않는다.

`build-drawn-cat.py`가 청록 배경을 제거하고 동작별 공통 배율과 프레임 전체 이동으로 정렬한다. 그림 일부를 잘라 회전하거나 늘이지 않는다. 세수는 앞발이 턱처럼 보이던 교차 그림을 제외하고 볼을 위아래로 닦는 그림을 반복한다. 두리번은 정면을 거쳐 반대편을 보도록 순서를 정리했고, 기지개는 일어서던 마지막 그림 대신 몸을 낮춘 시작 자세로 역순 복귀한다. 실제 재생 순서는 `playback_cell_indices`에 기록한다.

두리번은 두 앞발의 밝은 분홍 발끝 사이 중심과 바닥 높이로 정렬한다. 갈색 외곽선까지 발끝으로 인식하던 기준을 수정했다. 디코딩한 512px 프레임에서 앞발 중심의 좌우 범위는 58px에서 2px로 줄었고 바닥 높이 범위는 1px다. 이 값은 몸의 지지점 정렬 오차이며 고개 회전에 따른 얼굴 이동이나 원화 윤곽 변화까지 없다는 뜻은 아니다. 재생성 시 앞발 중심과 바닥의 이동 범위를 각각 2px 이하로 검사한다.

네 동작은 512×512 투명 무손실 WebP이며 16/17개 재생 프레임을 사용한다. 같은 시작 그림을 루프 끝에 재사용한다. 생성 그림 사이에 윤곽·얼굴 비율의 미세한 변화가 남아 있으므로, 픽셀 수준 일관성이나 완전한 자연스러움을 자동 검증했다고 주장하지 않는다. 약 6fps의 연속 그림 초안이며 기기 크기에서 시각 검토가 필요하다.

사용자가 앞서 확인한 기본 눕기 고개 흔들기와 깜빡임·윙크·잠들기는 기존 원화 모션을 유지한다. 이 네 모션은 원화의 회전·호흡 변형을 사용한다. `cat-approved`의 이전 `paw-rig-*`, `groom-action.json`, `wave-action.json` 및 네 동작의 옛 `*-encoding.json`은 이전 시안 기록으로만 남으며 현재 네 동작의 검증 자료가 아니다.

## 모바일 적용

`src/resources/character-art.ts`가 8종 모션과 친구 방 정지 원화를 관리한다. `CharacterAvatar`는 서버의 옛 고양이 포즈보다 이 목록을 우선하며 옛 이미지는 프리페치하지 않는다. 새 서버 고양이 포즈를 노출하려면 이 목록도 함께 갱신해야 한다.

캐릭터 보유·선택 ID, 다른 동물, 가구, 서버 카탈로그와 S3 원본은 유지한다. 기존 번들 4장은 새 세트로 교체했고, 원본은 Git 이력에 남는다. `build:characters`는 옛 고양이 스트립을 재생성하지 않는다.

## 재생성 및 검증

Python 3, Pillow, numpy, OpenCV가 있는 환경에서 실행한다.

```sh
python3 scripts/build-approved-cat.py
python3 scripts/build-signature-cat.py
python3 scripts/build-cat-head-idle.py
python3 scripts/build-cat-motion-set.py
npx prettier --write assets/characters/cat-approved/*.json assets/characters/cat-drawn/*.json
```

`build-approved-cat.py`와 `build-signature-cat.py`의 정지 PNG는 제작용 중간 원화다. `build-cat-motion-set.py`는 새 4종을 `build-drawn-cat.py`로 조립하므로 재실행해도 폐기한 팔 리그로 되돌아가지 않는다. `--verify-only` 옵션은 에셋을 재생성하지 않고 현재 번들을 검사한다.

- `motion-set-verification.json`: 8종의 프레임 수, 주기, 파일 크기·해시, 무한 반복 설정, 움직임 존재, 루프 경계, 잘림, 생성 방식. 바닥 픽셀 고정 검사는 기존 원화 모션에만 적용한다.
- `cat-drawn/*-verification.json`: 원본 시트 해시, 선택한 그림 순서, 공통 배율, 좌표, 무변형 조립 여부, 실제 WebP 해시. 세수의 두 앞발 구조와 포즈 연결은 그림별 시각 검토 대상이다.
- `head-idle-verification.json`: 기본 눕기의 얼굴 기준점과 고정 부위.
- `signature-verification.json`: 눈 마스크 밖 원화 픽셀 보존.
- `blink/wink/sleep-encoding.json`: 유지한 원화 모션의 압축 오차와 설정.
- 컴포넌트 테스트: 서버의 구형 포즈를 건너뛰고 8종 순환, 8번 탭 후 기본 복귀, 친구 화면의 정지 원화 및 탭 버튼 부재.

Expo SDK 55의 [Image](https://docs.expo.dev/versions/v55.0.0/sdk/image/)를 사용한다. 개발 갤러리 `Room · 승인된 고양이`와 `Room · 친구 고양이 (정지)`에서 두 동작을 비교할 수 있다.

웹 갤러리와 자동 테스트 검증은 iOS·Android 설치본 검증과 별개다. 이 PR은 업데이트 배포 전이다. 이슈의 프로젝트 보드 등록은 CLI 토큰의 `read:project` 권한 부족으로 미완료다.

![리뉴얼된 8종 고양이 포즈](assets/cat-art-renewal.jpg)
