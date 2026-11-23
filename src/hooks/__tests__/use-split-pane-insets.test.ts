/**
 * 2단에서 칸별로 비울 위 안전 영역. 펼친 아이폰 Duo(위 82)는 시스템 표시가 오른쪽 위 모서리에만
 * 있어 왼쪽 칸이 그 띠를 쓰고, 안드로이드·아이패드(상태 표시줄 높이쯤)는 전체 폭의 줄이라
 * 두 칸 모두 비운다.
 */
import {
  CORNER_CLUSTER_MIN_TOP_INSET,
  isCornerClusterInset,
  SPLIT_LEFT_TOP_INSET,
  splitLeftTopInset,
} from '@/hooks/use-split-pane-insets';

describe('isCornerClusterInset', () => {
  it('창을 다 쓰는 2단에서 위 인셋이 상태 표시줄보다 훨씬 크면 모서리 묶음으로 본다', () => {
    expect(isCornerClusterInset(82, true)).toBe(true);
    expect(isCornerClusterInset(CORNER_CLUSTER_MIN_TOP_INSET, true)).toBe(false);
    // 안드로이드 상태 표시줄(추정 32), 아이패드(24).
    expect(isCornerClusterInset(32, true)).toBe(false);
    expect(isCornerClusterInset(24, true)).toBe(false);
  });

  it('창을 다 쓰는 2단이 아니면 아니다 — 폰의 노치(위 59)도 해당 없음', () => {
    expect(isCornerClusterInset(82, false)).toBe(false);
    expect(isCornerClusterInset(59, false)).toBe(false);
  });
});

describe('splitLeftTopInset', () => {
  it('모서리 묶음이면 왼쪽 칸은 작은 여백까지만 — 기본 16, 제목 알약이 없는 칸은 0', () => {
    expect(splitLeftTopInset(82, true)).toBe(SPLIT_LEFT_TOP_INSET);
    expect(splitLeftTopInset(82, true, 0)).toBe(0);
  });

  it('전체 폭의 상태 표시줄이면 왼쪽 칸도 그 높이를 비운다 — 시계가 왼쪽 위에 있다', () => {
    expect(splitLeftTopInset(32, true)).toBe(32);
    expect(splitLeftTopInset(32, true, 0)).toBe(32);
    expect(splitLeftTopInset(0, true)).toBe(0);
  });

  it('창을 다 쓰는 2단이 아니면 시스템 값 그대로', () => {
    expect(splitLeftTopInset(82, false)).toBe(82);
    expect(splitLeftTopInset(47, false, 0)).toBe(47);
  });
});
