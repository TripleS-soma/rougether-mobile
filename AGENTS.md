# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# 프론트 기술 하네스

작업 전 `docs/`의 규범을 따른다. 제품/도메인/API/ERD **계약**은 여기서 정의하지 않고 spec 저장소(`../rougether-spec`)가 진실 소스다.

- 시작점: [docs/README.md](docs/README.md) — 경계와 문서 인덱스
- 아키텍처/규약/테마/데이터/테스트/이식: `docs/*.md`
- 반복 작업은 서브에이전트·스킬로: `.claude/agents/{screen-porter,component-builder,frontend-qa}.md`, `.claude/skills/{port-screen,add-component}/SKILL.md`

핵심 주의: 색/간격/폰트는 토큰만(`docs/theming.md`), RNTL은 v14라 `await render`/`await fireEvent`(`docs/testing.md`), 탭 변경 시 native/web 두 파일.
