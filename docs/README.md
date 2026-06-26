# rougether-mobile 프론트 기술 문서 (docs/)

이 폴더는 **프론트엔드 구현 상세**(아키텍처·규약·작업 플레이북)를 둔다.
제품/도메인/데이터/API **계약**은 여기서 재정의하지 않고 spec 저장소를 진실 소스로 링크한다.

> spec 규칙: "구현 상세(서버/프론트 작업 노트)는 각 구현 저장소의 `docs/`에 두고,
> spec 저장소는 양쪽이 맞춰야 하는 계약만 유지한다."

## 경계 (무엇이 어디에 있나)

| 구분              | 위치                                                                                         | 다루는 것                                           |
| ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **계약 (무엇)**   | [rougether-spec](https://github.com/TripleS-soma/rougether-spec) (로컬: `../rougether-spec`) | PRD·ERD·API 규약·도메인 features/prd·미결정         |
| **구현 (어떻게)** | 이 `docs/`                                                                                   | 프론트 아키텍처·코딩 규약·테마·테스트·이식 플레이북 |

계약이 필요하면 항상 spec을 링크한다. spec 내용을 이 문서로 복붙하지 않는다 (드리프트 방지).

## 문서

- [architecture.md](architecture.md) — 런타임 스택, `src/` 레이아웃, 라우팅 모델
- [conventions.md](conventions.md) — 파일/컴포넌트/타입/스타일 규약
- [theming.md](theming.md) — 디자인 토큰, 다크모드, `Themed*` 사용
- [state-and-data.md](state-and-data.md) — 상태 분리, spec API 연동 패턴 (도구 중립)
- [testing.md](testing.md) — jest-expo + RNTL 전략, `/dev` 갤러리
- [screen-porting.md](screen-porting.md) — 프로토타입 화면 → RN 이식 플레이북

## AI 협업 하네스

`.claude/agents/`(서브에이전트)와 `.claude/skills/`(스킬)가 위 문서를 규범으로 삼아
반복 작업(화면 이식·컴포넌트 추가·프론트 리뷰)을 구조화한다. 각 에이전트/스킬은
관련 docs를 참조하도록 작성돼 있다.

## 작성 규칙

- 본문 한국어. 코드·파일명·API path·식별자는 영어 유지 (spec 규칙과 동일).
- 계약 수치/필드는 적지 말고 spec 해당 문서를 링크.
- 결정이 안 된 프론트 기술 선택은 본문에 묻지 말고 각 문서의 "열린 결정"에 모은다.
