import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SwipeDeleteRow } from '@/components/screens/my-room/swipe-delete-row';
import { hapticSelection } from '@/utils/haptics';

// 스와이프 부품이 받는 props만 본다 — 실제 제스처는 RNGH 몫.
const mockSwipeProps: Record<string, unknown>[] = [];
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { forwardRef } = jest.requireActual('react');
  return {
    __esModule: true,
    default: forwardRef(
      (props: Record<string, unknown> & { children?: unknown }, _ref: unknown) => {
        mockSwipeProps.push(props);
        return props.children;
      },
    ),
  };
});

beforeEach(() => {
  mockSwipeProps.length = 0;
});

describe('SwipeDeleteRow 햅틱 (2026-11-04)', () => {
  it('삭제가 켜진 행은 열리기로 정해지는 순간 선택 햅틱을 낸다', async () => {
    await render(
      <SwipeDeleteRow label="물 마시기" onDelete={jest.fn()}>
        <Text>물 마시기</Text>
      </SwipeDeleteRow>,
    );
    expect(mockSwipeProps.at(-1)?.onSwipeableWillOpen).toBe(hapticSelection);
  });

  it('삭제가 꺼진 행은 열리지 않으니 햅틱도 걸지 않는다', async () => {
    await render(
      <SwipeDeleteRow label="물 마시기">
        <Text>물 마시기</Text>
      </SwipeDeleteRow>,
    );
    expect(mockSwipeProps.at(-1)?.onSwipeableWillOpen).toBeUndefined();
  });
});
