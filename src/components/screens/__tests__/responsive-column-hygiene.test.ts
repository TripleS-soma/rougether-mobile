import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCREENS = join(__dirname, '..');

/**
 * 태블릿/큰 화면 폭 제한 위생 (#725).
 *
 * 화면은 전부 폰 폭(≈390)을 전제로 그려져 있어, 폭 제한이 없으면 넓은 화면에서
 * 행이 끝까지 늘어나거나 정사각형 캔버스가 화면을 삼킨다. `useResponsiveColumn()`이
 * 그 처방인데, **새 화면을 만들 때 잊기 쉽다** — 폰에서는 아무 증상이 없어서
 * 리뷰에서도 안 보인다. 그래서 파일 단위로 강제한다.
 *
 * 스타일 규칙(#382 폰트 위생)과 같은 취지: 사람이 기억해야 하는 규칙을 테스트로
 * 옮긴다.
 */

/**
 * 면제 — 이유를 파일별로 적는다. "아직 안 했음"은 면제 사유가 아니다.
 */
const EXEMPT: Record<string, string> = {
  // WebView가 외부 HTML을 그린다. 폭·타이포는 그 문서(rougether-landing)가
  // 스스로 정하므로 네이티브 쪽에서 묶으면 오히려 이중 여백이 된다.
  'policy-viewer-screen.tsx': 'WebView — 문서가 자기 레이아웃을 가진다',
  'policy-viewer-screen.web.tsx': 'WebView — 문서가 자기 레이아웃을 가진다',
  // 캔버스는 묶고 카탈로그는 넓히는 별도 처리가 필요해 후속 PR로 뺐다 (#725).
  'room-decor-screen.tsx': '캔버스/카탈로그 분리 처리 — 후속 PR',
};

describe('화면 폭 제한 위생 (#725)', () => {
  const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));

  it('스캔 대상 화면이 실제로 존재한다', () => {
    // 경로가 바뀌어 0개를 스캔하면서 조용히 통과하는 걸 막는다.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.filter((f) => !(f in EXEMPT)))('%s 가 useResponsiveColumn을 쓴다', (file) => {
    const src = readFileSync(join(SCREENS, file), 'utf8');
    expect(src).toContain('useResponsiveColumn');
  });

  it('면제 목록에 죽은 항목이 없다', () => {
    // 화면이 지워졌는데 면제만 남으면 다음 사람이 잘못된 전제를 읽는다.
    expect(Object.keys(EXEMPT).filter((f) => !files.includes(f))).toEqual([]);
  });
});
