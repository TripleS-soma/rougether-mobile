---
name: port-screen
description: 프로토타입(rougether-prototype)의 웹 화면 하나를 Expo React Native로 이식한다. 사용자가 특정 화면을 모바일로 옮기려 할 때 사용.
---

# 화면 이식 (프로토타입 → RN)

프로토타입 화면 하나를 이 저장소의 Expo RN 화면으로 옮긴다. 전체 규범은 `docs/screen-porting.md`다.

## 절차

1. **대상 확정**: 어떤 화면인지 사용자에게 확인한다. 프로토타입에서 해당 컴포넌트를 찾는다 (`../rougether-prototype/src/app/components/`).
2. **계약 확인**: 화면이 속한 도메인의 spec을 읽는다 (`../rougether-spec/domains/<도메인>/` + `erd.md`/`api.md`). 프로토타입과 다르면 spec 우선.
3. **이식**: `screen-porter` 서브에이전트에 위임하거나 직접 수행한다. 순서 — 신규 컴포넌트(갤러리 등록+테스트) → 라우트 추가(탭이면 native/web 둘 다) → 레이아웃(토큰) → (목)데이터 → 데이터 연동.
4. **검증**: `npm run typecheck && npm run lint && npm test`. `docs/screen-porting.md`의 완료 체크리스트를 채운다.

## 주의

- 웹 전용 코드(Tailwind/Radix/MUI/react-router)를 그대로 옮기지 않는다 — `docs/screen-porting.md`의 매핑을 따른다.
- 색/간격/폰트는 토큰만 (`docs/theming.md`).
- spec과의 차이는 임의로 결정하지 말고 보고 → open-questions 후보.

## 산출

만든 파일, 내린 결정, spec과 어긋난 점, 남은 TODO(데이터 연동 등)와 검증 결과를 요약한다.
