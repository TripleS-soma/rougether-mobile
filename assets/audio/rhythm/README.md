# 작은 발걸음

사용자가 연결한 Chrome의 Suno 기존 계정에서 2026-10-14에 요청에 따라 생성·다운로드했다. 공개 게시 버튼은 사용하지 않았다. 다운로드 화면은 기존 Pro 플랜·잔여 다운로드25회를 표시했다.

- 채택한 곡: https://suno.com/song/8b361e0f-97f5-49c2-9249-9037e5e0a3da
- 함께 생성된 대안: https://suno.com/song/c0b760e3-32b2-4353-8210-1da9c583bb2d
- 원본: `small-steps-source.m4a`,126.72초. 게임용 편집: `small-steps.mp3`,약70.319초,mono44.1kHz160kbps.
- 스타일: felt piano,marimba,nylon guitar,upright bass,woodblock,soft kick. 따뜻한 루틴/동물 마을,무보컬,straight4/4.
- 요청120BPM과 실제 음원은 다르다. 채택 구간은 약116.097BPM이고,불안정한 도입부를 제외한 원곡39.932초 부근부터 편집했다.

`python3 scripts/align-rhythm-audio.py`로 원본 디코딩→트랜지언트 분석→채보→MP3→offline WebView base64를 재생성한다. 생성 후 해당JSON/TS를 Prettier로 정리한다. `analysis/rhythm/alignment-report.json`에 원본/편집 SHA256과 실제 판정 지점 증거를 남긴다.

원작 Rhythm Doctor 이미지·음원·효과음·폰트는 포함하지 않는다. 캐릭터는 앱이 이미 사용 중인 루게더 고양이 이미지이며, 신호음은 WebAudio에서 자체 생성한다.
