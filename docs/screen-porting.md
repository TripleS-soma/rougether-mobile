# 화면 이식 플레이북 (프로토타입 → RN)

`../rougether-prototype`(Figma Make React 웹 export)의 화면을 Expo RN으로 옮기는 표준 절차다.
프로토타입은 **시각/인터랙션 레퍼런스**일 뿐, 코드를 그대로 가져오지 않는다 (웹 전용 기술 다수).

## 사전 확인 (계약)

이식할 화면이 속한 도메인의 spec을 먼저 읽는다 (무엇을 보여주고 어떤 API를 쓰는지):

- 도메인 features/prd/api: `../rougether-spec/domains/<도메인>/`
- 데이터 모델: [erd.md](https://github.com/TripleS-soma/rougether-spec/blob/main/erd.md)

프로토타입과 spec이 어긋나면 **spec이 우선**. 차이는 spec의 open-questions로 올린다 (프론트에서 임의 결정 금지).

## 웹 → RN 매핑

| 프로토타입(웹)       | RN/Expo 대체                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `div` / `span`       | `View` / `Text`(→ `ThemedText`)                                               |
| Tailwind 클래스      | `StyleSheet` + `Spacing`/`theme` 토큰 ([theming.md](theming.md))              |
| `react-router`       | Expo Router 파일 라우트 ([architecture.md](architecture.md))                  |
| MUI / Radix / shadcn | RN 컴포넌트 또는 자체 컴포넌트 (갤러리 등록)                                  |
| CSS hover/포인터     | press/터치 상태 (`Pressable`의 `pressed`)                                     |
| `img` (URL)          | `expo-image`, **asset_key→URL 헬퍼** ([state-and-data.md](state-and-data.md)) |
| 웹 폰트/그림자       | 토큰 + 플랫폼별 그림자(elevation/shadow)                                      |

## 절차

1. **스코프**: 화면 1개 + 그 안의 신규 컴포넌트 목록을 정한다.
2. **컴포넌트 먼저**: 재사용 단위는 `src/components/`에 [SampleButton](../src/components/sample-button.tsx) 형태로 만들고 **갤러리(registry)에 등록** + 테스트.
3. **라우트**: `src/app/<name>.tsx` 추가. 탭이면 [`app-tabs.tsx`](../src/components/app-tabs.tsx) + [`app-tabs.web.tsx`](../src/components/app-tabs.web.tsx) **둘 다** 수정.
4. **레이아웃**: Flexbox로 구조 재현, 토큰으로 스타일. SafeArea 처리.
5. **데이터**: 우선 정적/목 데이터로 화면 완성 → 이후 데이터 훅으로 spec API 연동 ([state-and-data.md](state-and-data.md)). 로딩/에러/빈 상태 3종 포함.
6. **검증**: `npm run typecheck && npm run lint && npm test`, `/dev`·`npm start`로 눈 확인.

## 완료 체크리스트

- [ ] 신규 컴포넌트가 갤러리에 등록됨
- [ ] 컴포넌트 단위 테스트 있음 (`await render`/`await fireEvent` — [testing.md](testing.md))
- [ ] 색/간격/폰트가 전부 토큰 (하드코딩 없음)
- [ ] 탭 추가 시 네이티브·웹 양쪽 반영
- [ ] 사용자 노출 문자열 ko-KR
- [ ] typecheck·lint·format·test 그린
- [ ] 데이터 화면이면 로딩/에러/빈 상태 처리
- [ ] spec과 어긋난 점은 open-questions로 올림
