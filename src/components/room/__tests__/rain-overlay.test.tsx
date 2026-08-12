import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RainOverlay } from '@/components/room/rain-overlay';

type Node = { props?: { testID?: string; style?: unknown }; children?: Node[] | null };

/** 렌더 트리에서 오버레이를 찾아 각 빗줄기의 평탄화된 스타일을 돌려준다. */
const dropStyles = (tree: Node | null) => {
  const find = (n: Node | null): Node | null => {
    if (!n || typeof n !== 'object') return null;
    if (n.props?.testID === 'rain-overlay') return n;
    for (const c of n.children ?? []) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  const overlay = find(tree);
  expect(overlay).not.toBeNull();
  return (overlay?.children ?? []).map(
    (c) => StyleSheet.flatten(c.props?.style as never) as Record<string, unknown>,
  );
};

describe('RainOverlay (#360, #771)', () => {
  it('줄기를 transform으로 움직인다 — top(레이아웃) 애니메이션 금지', async () => {
    const tree = (await render(<RainOverlay />)).toJSON() as unknown as Node;
    const styles = dropStyles(tree);
    expect(styles.length).toBeGreaterThan(0);

    for (const s of styles) {
      // `top: %`는 매 프레임 Yoga 레이아웃을 강제한다 — 줄기 14개 무한 루프라
      // 비 오는 내내 비용이 깔린다. 기준점 0만 남고 애니메이션은 transform.
      expect(s.top).toBe(0);
      expect(Array.isArray(s.transform)).toBe(true);
    }
  });

  it('12° 기울기를 유지한다 — 애니메이션 transform이 정적 transform을 덮어쓰는 함정', async () => {
    const tree = (await render(<RainOverlay />)).toJSON() as unknown as Node;
    for (const s of dropStyles(tree)) {
      const transform = s.transform as { rotate?: string }[];
      // translateY만 넣고 rotate를 빠뜨리면 기울기가 조용히 사라진다.
      expect(transform.some((entry) => entry.rotate === '12deg')).toBe(true);
    }
  });
});
