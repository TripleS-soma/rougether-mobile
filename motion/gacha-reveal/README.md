# 범용 뽑기 시네마틱

벽지·바닥·가구에 공통 적용하는 등급별 영상 3개다. 영상에는 아이템·문구·버튼을 넣지 않는다. 실제 보상 이미지는 앱의 투명 PNG/WebP 레이어가 합성한다.

## 타이밍 및 좌표

| 등급      | 길이  | 공개 시점 | 카메라 최종 정착 |
| --------- | ----- | --------- | ---------------- |
| common    | 2.4초 | 1.1초     | 1.68초           |
| rare      | 2.7초 | 1.3초     | 1.88초           |
| legendary | 2.9초 | 1.55초    | 2.13초           |

- 소스 캔버스: `1080×2340`, 최종 MP4: `720×1560`, `30fps`. 두 비율 모두 `6:13`이다.
- 가구 중심: 소스 좌표 `(540, 780)` / 정규화 좌표 `(0.5, 1/3)`.
- 가구 최대 팝 영역: `470×460`. 권장 정착 영역: `439×430`. 원본 비율을 유지하는 `contain`을 사용한다.
- 포털 중심: `(540, 810)`. 가구는 상자 덮개와 간격을 확보하기 위해 중심에서 30px 위에 놓는다.
- 결과 문구 권장 영역: `x120–960, y1590–1900`. 제목 중심 `y1690`, 보조 문구 `y1760`.
- 카메라는 공개 후 0.58초에 scale=1, y=0으로 정착한다.
- 5+1은 결과 중 가장 높은 등급의 셸을 한 번 재생한 뒤 결과 목록을 공개한다.
- OS 동작 줄이기 설정과 건너뛰기는 앱에서 제어한다.

구조화된 수치는 `timing-contract.json`에 기록했다. 앱 좌표는 뷰포트 비율에 맞춘 `cover` 스케일과 중앙 크롭 오프셋을 동일하게 적용해야 한다.

## 연출

기존 수채화 방·상자 아트를 사용한다. 기대 구간의 카메라 당김, 공개 직전 짧은 멈춤, 공개 시 당김 해제와 빛 확산, 정착 순서로 이어진다. 등급이 높을수록 기대 길이·카메라 압축·빛 변화·꽃가루 밀도가 커진다. 원본의 금빛 포털 위에 완벽한 CSS 동심원이나 UI 테두리를 추가하지 않는다.

단일 일러스트의 뚜껑을 개별 레이어처럼 움직이는 효과는 포함하지 않는다. 아이템별 전용 영상이나 모션은 필요 없다.

## 미디어 출처

- `assets/reveal-stage.png`: 이 작업에서 사용자가 승인한 수채화 무대 이미지. 원본 이미지 생성 후 가구·문구·UI를 제거한 플레이트.
- `.media/audio/sfx/sfx_001.mp3`: 기존 작업에서 확보한 2.5초 멜로디 스팅.
- `.media/audio/sfx/sfx_002.mp3`: 기존 작업에서 확보한 0.574688초 공개 우시 효과.
- 앱 포스터 `assets/images/gacha/cinematic-{tier}.jpg`: 각 MP4의 마지막 프레임에서 추출한다. 영상 종료 시 배경이 바뀌지 않는다.

## 재생성

프로젝트 루트에서:

```bash
node motion/gacha-reveal/build-shells.mjs
```

생성기는 앱의 개발 의존성인 Prettier와 저장소 설정을 사용해 HTML·JSON을 포맷한다. 먼저 앱 루트에서 `npm ci`를 실행하면 재생성 후에도 포맷 검사가 유지된다.

이 디렉터리에서:

```bash
npx hyperframes@0.8.30 check .
npx hyperframes@0.8.30 render . -c compositions/common.html --quality high --fps 30 --workers 2 --output renders/gacha-reveal-common-master.mp4
npx hyperframes@0.8.30 render . -c compositions/rare.html --quality high --fps 30 --workers 2 --output renders/gacha-reveal-rare-master.mp4
npx hyperframes@0.8.30 render . -c compositions/legendary.html --quality high --fps 30 --workers 2 --output renders/gacha-reveal-legendary-master.mp4
node export-mobile.mjs
```

`export-mobile.mjs`는 승인된 렌더 결과를 H.264/AAC, yuv420p, faststart MP4로 변환하고 최종 포스터를 추출한다. 미리보기 영상에는 가구를 굽지 않는다. 가구 표시 검수는 앱 개발 갤러리에서 진행한다.
