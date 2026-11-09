# 크리스마스 뽑기 연출

승인된 기존 수채화 에셋으로 크리스마스 전용 결과 연출을 만든다. 영상에는 보상 아이템, 이름, 버튼을 굽지 않는다. 앱이 서버가 확정한 결과를 투명 아트로 합성한다.

- 단일: 720×1560, 30fps, 3.4초. 1.55초에 보상을 공개하고 2.12초에 정착한다.
- 5+1: 같은 비율, 4.3초. 기존 `src/constants/gacha-multi-timing.json`의 6개 공개 박자와 종료 시간을 그대로 사용한다.
- 선물 꾸러미가 들썩이고 눈송이와 금빛 별이 퍼진다. 한 장짜리 상자 이미지의 뚜껑을 임의로 잘라 움직이지 않는다.
- 단일 결과 아트의 정착 영역은 원본 720×1560 기준 x165, y440, width390, height390이다. 앱은 영상과 같은 cover crop을 사용한다.
- 입력 미디어는 승인 원본 및 애니메이션의 첫 프레임이다. 색감은 변경하지 않았다. 원래 샘플 트리는 실제 영상에서 제거했다.

`build-shells.mjs`는 `shell-template.txt`에서 단일 `index.html`과 `compositions/multi.html`을 만든다. 입자는 고정 시드 표와 현재 타임라인 시각으로만 계산한다. 두 파일은 독립적인 렌더 진입점이며 한 영상으로 겹쳐 마운트하지 않는다.

```sh
node build-shells.mjs
npm run check
npx --yes hyperframes@0.9.26 render --quality high --fps 30 --workers 2 --output ../../assets/videos/gacha-reveal-christmas.mp4
npx --yes hyperframes@0.9.26 render -c compositions/multi.html --quality high --fps 30 --workers 2 --output ../../assets/videos/gacha-reveal-christmas-multi.mp4
ffmpeg -sseof -0.034 -i ../../assets/videos/gacha-reveal-christmas.mp4 -frames:v 1 -q:v 2 ../../assets/images/gacha/cinematic-christmas.jpg
```

신규 네이티브 모듈이나 앱 설정 변경 없이 기존 expo-video 경로를 사용한다. 건너뛰기, 동작 줄이기, 백그라운드 전환과 오류 시 결과 복원을 유지한다. 종료 화면에도 같은 마지막 프레임을 사용한다. 연출은 추첨 요청을 추가하지 않는다.

크리스마스 화면은 서버가 운영 중인 `christmas_2026` 머신을 실제로 내려줄 때만 나타난다. ID와 가격을 클라이언트가 만들어 넣지 않는다. 이 UI 변경은 서버의 이벤트 머신 생성, 50% 그룹 추첨, 출석, 팝업 또는 이벤트 활성화 작업을 대신하지 않는다. 이 작업에서 실제 사용자에게 알림을 보내지 않는다.
