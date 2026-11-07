import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  __resetOpenSwipeRow,
  closeOpenSwipeRow,
  SwipeDeleteRow,
} from '@/components/screens/my-room/swipe-delete-row';
import { hapticSelection } from '@/utils/haptics';

jest.mock('@/utils/haptics', () => ({ hapticSelection: jest.fn() }));

// 스와이프 부품이 받는 props만 본다 — 실제 제스처는 RNGH 몫. ref는 행마다 close 목을 준다.
const mockSwipeProps: Record<string, unknown>[] = [];
const mockClose: jest.Mock[] = [];
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = jest.requireActual('react');
  const MockSwipeable = React.forwardRef(
    (
      props: Record<string, unknown> & {
        children?: unknown;
        renderRightActions?: () => unknown;
      },
      ref: unknown,
    ) => {
      mockSwipeProps.push(props);
      const close = React.useMemo(() => {
        const fn = jest.fn();
        mockClose.push(fn);
        return fn;
      }, []);
      React.useImperativeHandle(ref, () => ({ close }), [close]);
      return React.createElement(
        React.Fragment,
        null,
        props.children,
        props.renderRightActions?.(),
      );
    },
  );
  MockSwipeable.displayName = 'MockSwipeable';
  return { __esModule: true, default: MockSwipeable };
});

beforeEach(() => {
  mockSwipeProps.length = 0;
  mockClose.length = 0;
  __resetOpenSwipeRow();
  jest.mocked(hapticSelection).mockClear();
});

const openRowAt = (index: number) =>
  (mockSwipeProps.filter((p) => p.onSwipeableWillOpen)[index].onSwipeableWillOpen as () => void)();

describe('SwipeDeleteRow 햅틱 (2026-11-04)', () => {
  it('삭제가 켜진 행은 열리기로 정해지는 순간 선택 햅틱을 낸다', async () => {
    await render(
      <SwipeDeleteRow label="물 마시기" onDelete={jest.fn()}>
        <Text>물 마시기</Text>
      </SwipeDeleteRow>,
    );
    openRowAt(0);
    expect(hapticSelection).toHaveBeenCalledTimes(1);
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

/**
 * 열린 삭제 버튼은 다른 동작에 닫힌다 (#1676) — 예전엔 삭제를 누르거나 되밀기 전까지 남았다.
 * 앱 셸 루트가 모든 누르기 시작에 closeOpenSwipeRow를 부른다.
 */
describe('SwipeDeleteRow — 다른 동작이면 닫힘 (#1676)', () => {
  const rows = (onDelete = jest.fn()) => (
    <>
      <SwipeDeleteRow label="물 마시기" onDelete={onDelete}>
        <Text>물 마시기</Text>
      </SwipeDeleteRow>
      <SwipeDeleteRow label="영양제" onDelete={jest.fn()}>
        <Text>영양제</Text>
      </SwipeDeleteRow>
    </>
  );

  it('다른 행을 열면 먼저 열린 행이 닫힌다 — 한 번에 하나', async () => {
    await render(rows());
    openRowAt(0);
    openRowAt(1);
    expect(mockClose[0]).toHaveBeenCalledTimes(1);
    expect(mockClose[1]).not.toHaveBeenCalled();
  });

  it('다른 곳을 누르면(루트의 누르기 시작) 열린 행이 닫힌다', async () => {
    await render(rows());
    openRowAt(0);
    closeOpenSwipeRow();
    expect(mockClose[0]).toHaveBeenCalledTimes(1);
    // 닫힌 뒤엔 더 할 일이 없다.
    closeOpenSwipeRow();
    expect(mockClose[0]).toHaveBeenCalledTimes(1);
  });

  it('루트까지 안 올라온 삭제 버튼 터치(모달 안 등)는 다음 틱에 표시가 지워진다 (#1677 리뷰)', async () => {
    const ui = await render(rows());
    openRowAt(0);
    fireEvent(ui.getByLabelText('물 마시기 스와이프 삭제'), 'touchStart');
    // 루트가 이 터치를 못 받았다 — 다음 이벤트 처리 전에 표시가 풀려야 한다.
    await new Promise((resolve) => setTimeout(resolve, 0));
    closeOpenSwipeRow();
    expect(mockClose[0]).toHaveBeenCalledTimes(1);
  });

  // press는 맨 끝에 — Pressable 내부 타이머가 다음 테스트의 렌더를 비우는 일이 있었다.
  it('삭제 버튼을 누른 터치는 닫지 않고 삭제가 나간다', async () => {
    const onDelete = jest.fn();
    const ui = await render(rows(onDelete));
    openRowAt(0);
    const del = ui.getByLabelText('물 마시기 스와이프 삭제');
    // 터치는 버튼 → 루트 순으로 올라온다.
    fireEvent(del, 'touchStart');
    closeOpenSwipeRow();
    expect(mockClose[0]).not.toHaveBeenCalled();
    await fireEvent.press(del);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('SwipeDeleteRow — 누르기 시작 이벤트 이름', () => {
  // 웹은 마우스 클릭에 touchstart가 없어 포인터로, 네이티브는 터치로 — 둘을 같이 걸면 한 번에 두 번 불린다.
  it.each([
    ['ios', 'onTouchStart'],
    ['android', 'onTouchStart'],
    ['web', 'onPointerDown'],
  ])('%s는 %s', (os, expected) => {
    jest.isolateModules(() => {
      const { Platform } = jest.requireActual('react-native');
      const restore = jest.replaceProperty(Platform, 'OS', os as 'ios');
      try {
        const mod = jest.requireActual('@/components/screens/my-room/swipe-delete-row');
        expect(mod.PRESS_START_EVENT).toBe(expected);
      } finally {
        restore.restore();
      }
    });
  });
});
