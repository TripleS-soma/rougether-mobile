---
name: spec-compare
description: ../rougether-spec의 도메인 스펙과 이 앱의 실제 구현(및 서버 스웨거)을 3자 비교해 갭 리포트를 만든다. "스펙이랑 비교해줘", "스펙 대비 뭐가 빠졌어?", 새 도메인 작업 시작 전 현황 파악, 스프린트 계획 때 사용.
---

# 스펙 ↔ 구현 ↔ 서버 3자 비교

스펙(팀이 합의한 의도) / 앱 구현(클라이언트 현실) / 스웨거(서버 현실)는 서로 어긋날 수 있다.
갭은 항상 **세 방향 모두** 확인해야 정확하다 — 스펙에 있는데 서버에 없으면 `backend-blocked`,
서버에 있는데 앱에 없으면 미연동, 앱이 스펙과 다르게 동작하면 의도적 편차인지 확인한다.

## 1. 세 소스 수집

1. **스펙**: `../rougether-spec` — 루트 `product.md` / `erd.md` / `api.md` / `open-questions.md` +
   `domains/<도메인>/{prd,features,api}.md` (member / routine-todo / room / shop / gacha / house).
   `features.md`가 기능 단위 비교의 기준. "미정" 표시는 갭이 아니라 open question이므로 구분해 집계.
2. **앱 구현**: 레이어 순서대로 훑는다 —
   - `src/api/*.ts` (엔드포인트 클라이언트) → `src/api/adapters.ts` (wire↔domain 매핑)
   - `src/hooks/use-*.ts` (상태/로딩 로직) → `src/components/screens/*.tsx` (UI 노출)
   - 클라이언트 함수가 있어도 훅/화면이 안 쓰면 "클라이언트만 존재"로 별도 분류.
   - `ui/PendingNotice` 사용처 grep — "서버 준비 중" 고지가 붙은 곳이 곧 알려진 갭 목록.
3. **서버**: 스웨거 주소는 **하드코딩하지 말고 `src/config/shared-endpoints.json`의 `openApiSpec`을 읽어라.**
   ```sh
   curl -s "$(python3 -c "import json;print(json.load(open('src/config/shared-endpoints.json'))['openApiSpec'])")"
   ```
   (2026-08-17: 여기 옛 EC2 IP `3.35.167.122:8080`이 적혀 있었는데 HTTPS/CloudFront 전환 후 죽은 주소였다.
   그걸 찔러보고 **"서버 다운"이라 오판해** 타입을 손으로 쓰고 backend-blocked 재확인을 미뤘다.
   앱과 `gen:api-types`는 줄곧 CloudFront를 보고 정상 동작 중이었다.)
   경로 목록을 뽑아 `src/api/*.ts`의 `apiGet|apiPost|apiPut|apiDelete` 호출 경로와 대조(둘 다 정렬해 diff).

## 2. 갭 분류

발견한 차이는 반드시 다음 중 하나로 분류한다(뭉뚱그리지 말 것):

| 분류                  | 의미                           | 처리                                                |
| --------------------- | ------------------------------ | --------------------------------------------------- |
| **미구현**            | 스펙+서버 있음, 앱 없음        | 연동 이슈 생성 (`api` 라벨)                         |
| **backend-blocked**   | 스펙 있음, 서버 없음           | 이슈에 `backend-blocked` 라벨, 화면엔 PendingNotice |
| **미연동 (신규 API)** | 서버 있음, 앱 없음             | 연동 이슈 생성 후 보드 등록                         |
| **클라이언트만 존재** | `src/api`에 함수 있음, UI 없음 | UI 이슈로 추적                                      |
| **의도적 편차**       | 앱이 스펙과 다르게 동작        | 근거(PR/이슈 번호) 확인, 없으면 팀 확인 필요로 표시 |
| **open question**     | 스펙 자체가 "미정"             | `open-questions.md` 링크, 갭으로 세지 않음          |

의도적 편차의 예: 스펙은 "카테고리 삭제 시 루틴 미분류(NULL) 처리"지만 앱은
"미분류 루틴 금지" 불변식(PR #96)으로 기타 카테고리에 입양시킨다 — 이런 건 버그가 아니다.

## 3. 리포트 형식

도메인별 표로 정리하고, 각 행에 근거(파일 경로 또는 스웨거 경로 또는 이슈 번호)를 단다.
마지막에 "즉시 착수 가능"(미구현+미연동)과 "대기"(backend-blocked)를 나눠 요약한다.
기존 이슈와 중복 생성하지 않도록 `gh issue list --state open`으로 먼저 대조한다.

## 4. 사후 처리 (요청받은 경우에만)

- 새 갭 → 이슈 생성 + 프로젝트 보드 #2 등록 (CLAUDE.md의 gh 명령 참고)
- 해소된 backend-blocked → 해당 이슈에 스웨거 확인 날짜와 함께 코멘트, 라벨 제거
- 스웨거에 새 타입이 생겼으면 `npm run gen:api-types` — 단, **RoutineUpdateRequest의
  `| null` 수동 패치가 지워지므로 복원하고 `npx prettier --write src/api/types.ts` 실행**
