---
name: store-release
description: dev의 JS 변경을 스토어 사용자에게 내보낸다 — 승격 PR(dev → main) 생성·CI·리뷰 확인·merge commit 머지 → main에서 eas-release(운영 OTA) 실행·지문 대조까지 한 번에.
disable-model-invocation: true
---

# 스토어 OTA 릴리스

사용자가 `/store-release`를 부른 것 자체가 **승격 머지와 운영 OTA 발행의 명시적 승인**이다. 단계마다 다시 묻지 않는다. 다만 아래 **멈춤 조건**에 걸리면 그 자리에서 멈추고 이유를 보고한다 — 멈춤은 실패가 아니라 이 스킬의 정상 결과 중 하나다.

배경 규칙은 `docs/release-ops.md`(승격 ≠ 발행, 채널·지문)가 단일 출처다. 여기서는 순서만 다룬다.

## 1. 사전 점검

```sh
git fetch -q origin
git log --oneline origin/main..origin/dev            # 승격할 커밋
git diff --name-only origin/main origin/dev | grep -E '^(app\.json|package(-lock)?\.json|eas\.json|\.gitignore|\.fingerprintignore|targets/|plugins/)'
gh pr list --base dev --state open --json number,title,autoMergeRequest
```

**멈춤 조건**

- 승격할 커밋이 없다 → "dev가 main과 같다"고 보고. 단, auto-merge가 걸린 dev PR이 CI 중이면 그 PR이 머지될 때까지 기다린 뒤 다시 본다.
- 지문 파일이 바뀌었거나 범위 안 PR에 `native-build` 라벨이 있다 → OTA가 스토어 빌드에 닿지 않는다. 새 빌드(`store-build`)가 필요하다고 보고하고 멈춘다.

완료 기준: 승격할 커밋 목록이 있고, 지문 파일 변경 0건.

## 2. 승격 PR

제목 `release: dev → main (YYYY-MM-DD)`(오늘 날짜). 본문은 AGENTS.md 컨벤션(`## 요약` — 커밋 목록의 PR 번호·제목, `## 리뷰 포인트` — JS만·지문 변화 없음) + 끝에 Claude Code 서명. 같은 head/base의 열린 승격 PR이 이미 있으면 새로 만들지 않고 그것을 쓴다.

## 3. CI·리뷰 확인

`gh pr checks <N> --watch`로 끝까지 기다린다. 그다음 Claude 자동 리뷰 코멘트(마지막 코멘트)를 **전부** 읽는다.

**멈춤 조건**

- 필수 체크(`check`·`prebuild` 등) 실패 → 실패 로그 요약 보고.
- 리뷰가 "확신 있는 지적"(버그·회귀)을 남겼다 → 지적 요약과 수정안을 보고하고 멈춘다. 고칠지·그대로 낼지는 사용자가 정한다. "참고(비차단)"만 있으면 진행하고 보고에 한 줄로 남긴다.

완료 기준: 모든 체크 pass(또는 skipping), 차단 지적 0건.

## 4. 머지

`gh pr merge <N> --merge` — main은 merge commit만 허용한다(squash 금지). 상태가 `MERGED`인지 확인.

## 5. 운영 OTA 발행

```sh
gh workflow run eas-release.yml --ref main
gh run list --workflow=eas-release.yml --limit 1     # 새 런 id (headSha = 방금 머지 커밋)
gh run watch <id> --exit-status
gh run view <id> --log | grep 'Runtime version'      # iOS·Android 두 줄
```

권한 거부로 실행이 막히면 우회하지 말고, 사용자에게 `! gh workflow run eas-release.yml --ref main` 입력을 안내한다.

**지문 대조**: 이번 런의 iOS·Android `Runtime version`을 직전 성공 런(`gh run list --workflow=eas-release.yml --status success --limit 2`의 두 번째)과 비교한다. 같으면 기존 스토어 설치본이 받는다. 다르면 "OTA는 발행됐지만 스토어 빌드에 닿지 않는다"고 보고한다.

완료 기준: 런 conclusion `success`, 두 플랫폼 런타임 지문이 직전 발행과 같음(또는 다름을 보고함).

## 6. 보고

한국어로 짧게: 내보낸 PR 목록(번호·한 줄 요약), 승격 PR 번호, 발행 런 결과, 지문 대조 결과, 리뷰의 비차단 참고 사항.
