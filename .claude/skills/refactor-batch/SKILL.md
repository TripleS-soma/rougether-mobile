---
name: refactor-batch
description: 리팩토링 장부의 한 묶음을 브랜치 하나·PR 하나로 안전하게 끝낸다. 동작 변경 없음을 테스트로 증명하고, 병렬 작업은 워크트리로 격리한다. "리팩토링 하자", "장부 N번 해줘", 큰 파일 분리·중복 제거·react-query 이관 착수 시 사용.
---

# 리팩토링 한 묶음 실행 (refactor-batch)

리팩토링은 **동작을 바꾸지 않는 변경**이다. 이 스킬의 전 과정은 그 한 문장을
증명하는 데 쓰인다. 기능 추가·버그 수정이 섞이면 리뷰가 불가능해지므로 다른 PR로 뺀다.

## 0. 장부에서 범위를 고정한다

착수 전에 **반드시** 다음을 확인한다.

1. 메모리 `refactor-ledger-*`의 아티팩트 링크를 열어 항목 번호로 범위를 고정한다.
   장부에 없는 것을 하려면 먼저 장부에 항목을 추가한다 — 즉흥 확장이 PR을 부풀린다.
2. `gh pr list --state open` 과 원격 브랜치를 본다. 팀원이 같은 파일을 열어뒀는지 확인.
3. 장부의 **"건드리지 말 것"** 목록을 읽는다. 거기 적힌 것들은 전부 버그의 기록이다:
   - room-decor `NO_SURFACES` 모듈 상수 — memo 무효화 방지
   - house-screen 제스처 팩토리가 객체 2개를 만드는 것 — 의도적
   - my-room `rowHandlers` Map의 렌더 중 쓰기 — 이동 시 `registerRows`로 감쌀 것
   - shared value의 `useRef` 앵커 (tab-pager, house-screen) — jest가 렌더마다 새 객체를 준다
   - 나의 방을 방/달력 탭 화면으로 쪼개지 말 것 — 두 인스턴스가 디스패처를 공유
   - `src/api/types.ts` 는 `gen:api-types` 생성 파일
4. 한 PR의 크기는 **"리뷰어가 한 호흡에 볼 수 있는 단위"**. 파일 40개·600줄이 지난 라운드의
   상한이었다. 그보다 커지면 항목을 쪼갠다.

## 1. 착수 전에 지금이 초록인지 확인한다

```sh
npm run typecheck && npm run lint && npm run format:check && npm test
```

**리팩토링 시작 전에 한 번 돌려 기준선을 잡는다.** 이걸 건너뛰면 나중에 깨진 테스트가
내 변경 때문인지 원래 그랬는지 알 수 없다. 이미 빨간 테스트가 있으면 먼저 보고하고 멈춘다.

브랜치는 항상 `dev`에서 직접 분기한다(PR 스택 금지).

```sh
git checkout dev && git pull && git checkout -b refactor/<항목>
```

## 2. 안전망을 먼저 확인한다

옮기려는 코드를 **덮는 테스트가 있는지** 먼저 본다. 없으면 옮기기 전에 쓴다.
테스트 없는 코드를 옮기는 것은 리팩토링이 아니라 도박이다.

옮길 대상이 순수 함수라면(기하 계산, 그룹핑, 클램프 수학) **먼저 순수 모듈로 뽑고
단위 테스트를 붙인 뒤** 화면에서 걷어낸다. 화면 테스트가 그 값을 재계산하고 있었다면
그 단언은 순수 모듈 테스트로 옮기고 화면 테스트에서는 지운다.

주의: 이 저장소의 화면 테스트 여럿이 **구현 세부에 결합**돼 있어 순수한 이동에도 깨진다.
깨지면 먼저 "동작이 바뀌었나, 아니면 테스트가 내부를 보고 있었나"를 판정한다.
후자면 테스트를 행동 단언으로 고치고 그 사실을 PR 본문에 적는다. 대표 패턴:

- fetch 호출 **횟수**나 특정 URL 발생을 "재조회했다"의 신호로 쓰는 단언 → react-query 이관에서 반드시 깨진다
- `StyleSheet.flatten(...).width` 같은 계산된 픽셀 값 → 비율 상수를 소스에서 export해 유도하게 고친다
- CDN 에셋 키 문자열 리터럴 → `resolveHouseFrame` 등 이미 export된 해석 함수를 쓰게 고친다
- React fiber(`unstable_fiber`)·RNGH 내부 핸들러 접근 → 가능하면 공개 API로

## 3. 병렬 작업은 워크트리로 격리한다

서브에이전트를 둘 이상 돌릴 때, **메인 작업 트리에는 최대 하나만** 둔다.
에이전트가 메인 트리에서 편집 중일 때 `git checkout`·`git stash`·리베이스를 하면 작업이 깨진다.

```sh
git worktree add ../rougether-mobile-wt-<name> -b refactor/<name> origin/dev
ln -s ../rougether-mobile/node_modules ../rougether-mobile-wt-<name>/node_modules
# .git/info/exclude 에 node_modules 가 이미 있다 — 심링크가 커밋되면 autofix 봇이 돌아 CI가 승인 대기에 걸린다
```

에이전트에게 **"전체 jest는 돌리지 말 것"**을 지시한다(동시 실행 시 타임아웃 플레이키).
전체 스위트는 부모가 순서대로 한 번씩 돌린다. 끝나면 정리:

```sh
rm ../rougether-mobile-wt-<name>/node_modules
git worktree remove ../rougether-mobile-wt-<name> && git branch -D refactor/<name>
```

커밋은 반드시 **경로 지정** `git add <paths>` — 심링크·부산물 커밋 방지.

## 4. 옮기는 방법

**한 번에 한 종류의 변경만 한다.** 이동과 수정을 섞지 않는다.

- **파일 분리**: 코드를 그대로 옮기고 import만 고친다. 같은 커밋에서 로직을 다듬지 않는다.
  배럴 재export(`export * from`)를 두면 호출부 diff가 0이 된다 — 리뷰 범위가 크게 준다.
- **훅 추출**: 반환 객체의 **참조를 고정**한다. `useMemo`로 감싸고, `useMutation`이 주는
  객체는 매 렌더 새것이므로 `mutateAsync`만 꺼낸다. 중복 탭 가드는 `useLatestRef`.
  `app-shell-render-stability.test.tsx` 가 이걸 강제한다 — 이 테스트가 빨간 채로 넘어가지 말 것.
- **훅 순서**: `app-shell`의 페이지 훅들은 서로 반환값을 먹는다. 새 훅을 끼울 때 호출 순서를
  확인한다(예: 꾸미기 훅은 `useMyRoomPages`가 그 반환을 받으므로 그보다 앞에 서야 한다).
- **react-query 이관**: 전면 리라이트 금지. 슬라이스 하나씩 옮기고, 키는
  `src/lib/query-keys.ts`에 추가하며, 사용자별 데이터는 두 번째 원소에 userId를 둔다.
  무효화는 접두 키(`all`)로. 이관한 슬라이스의 재조회 호출부를 전부 무효화로 바꿨는지 확인.
- **중복 JSX 통합**: 두 분기가 같은 것을 그리면 컴포넌트로 뽑고 분기는 **배치만** 결정하게 한다.
  뽑은 컴포넌트가 memo 리프라면 내려가는 콜백을 전부 참조 고정한다.

## 5. 증명한다

```sh
npm run typecheck && npm run lint && npm run format:check && npm test
```

네 가지가 전부 초록이어야 한다. 그리고 **동작 무변경의 근거**를 하나 이상 확보한다:

- 테스트 수가 줄지 않았는가 (줄었으면 왜인지 PR에 쓴다)
- 화면을 만졌으면 `/web-smoke` 로 실서버 기준 스모크 (사용자가 띄운 8081 재사용)
- 렌더 안정성을 건드렸으면 `app-shell-render-stability.test.tsx` 통과 확인

## 6. PR

브랜치 하나 · PR 하나 · `dev` 대상. 제목은 커밋 컨벤션(squash 머지가 제목을 커밋 메시지로 쓴다):

```
refactor(<범위>): <무엇을 어디로> — <왜>
```

본문 필수 두 섹션:

- `## 요약` — 무엇을 왜 옮겼는지. **동작 변경이 없음을 명시.** 관련 이슈는 `Closes #N`.
- `## 리뷰 포인트` — 순수 이동이 아닌 부분, 참조 안정성 판단, 테스트를 고쳤다면 그 이유,
  수행한 검증(4종 체크·스모크).

라벨: 지문이 바뀌면(`app.json`·네이티브 모듈) `native-build` — 이 경우 auto-merge 금지이고
머지 시점은 사용자가 정한다. JS만 바뀌면 CI 초록에 바로 머지해도 된다.

## 7. 장부를 갱신한다

머지 후 장부 아티팩트의 해당 항목 상태와 메모리 `refactor-ledger-*` 진행 줄을 고친다.
**조사에서 틀렸던 것도 적는다** — 지난 라운드에 "죽은 코드"로 판정한 `DEMO_MISSIONS`가
fixtures 내부에서 쓰이고 있었고, `ChargingBox` 삭제 범위 경계도 실제와 달랐다.
삭제 전 경계 재확인은 매번 필수다.
