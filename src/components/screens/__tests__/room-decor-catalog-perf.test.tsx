import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { FURNITURE_ITEMS, slotIdsToPlacements } from '@/resources/furniture';

/**
 * 카탈로그 타일이 몇 번 그려지는지 세는 스파이 (#794). 실서버 가구는 122종이라
 * 방을 한 번 건드릴 때마다 그리드 전체가 다시 그려지면 그 비용이 조작마다
 * 깔린다 — memo 경계와 참조 고정 콜백이 살아 있는지 렌더 횟수로 못 박는다.
 */
const renders = { count: 0 };
jest.mock('@/components/room/furniture-placeholder', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    FurniturePlaceholder: () => {
      renders.count += 1;
      return <RNView />;
    },
  };
});

const items = (ids: string[]) => slotIdsToPlacements(ids, FURNITURE_ITEMS);

/** 테스트가 방에 배치하는 가구 수 — 선택 시 허용되는 재렌더 상한. */
const ROOM_ITEMS = 2;

/** 가구 탭 제스처(방 안에서 선택)를 성공 상태로 발사한다. */
const tapItem = (id: string) =>
  act(() =>
    fireGestureHandler(getByGestureTestId(`item-tap-${id}`), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]),
  );

describe('RoomDecorScreen 카탈로그 렌더 비용 (#794)', () => {
  beforeEach(() => {
    renders.count = 0;
  });

  it('방 안 가구를 선택해도 카탈로그 그리드를 다시 그리지 않는다', async () => {
    const { getByTestId } = await render(
      <RoomDecorScreen initialItems={items(['bed', 'plant'])} freeLayout />,
    );
    // 드래그 오버레이는 캔버스 onLayout 이후에만 그려진다.
    await fireEvent(getByTestId('decor-canvas'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 320 } },
    });

    const afterMount = renders.count;
    // 마운트 시엔 카탈로그(로컬 데모 10종)와 방 안 가구가 함께 그려진다.
    expect(afterMount).toBeGreaterThan(ROOM_ITEMS);

    // 선택은 방 쪽 상태(selectedId)만 바꾼다 — 카탈로그와 무관하다.
    await tapItem('bed');
    const afterSelect = renders.count - afterMount;

    // 방 안 가구만 다시 그려야 한다. memo 경계나 참조 고정이 깨지면 카탈로그가
    // 통째로 딸려 와 이 값이 방 가구 수를 넘는다 (실측: 최적화 전 12 → 후 2,
    // 로컬 데모 카탈로그 10종 기준. 실서버 가구는 122종이라 격차가 더 크다).
    expect(afterSelect).toBeLessThanOrEqual(ROOM_ITEMS);
  });

  it('배치 여부 판정은 Set이라 카탈로그가 커져도 선형이다', () => {
    // placed.includes를 타일마다 돌면 카탈로그 크기의 제곱이 된다.
    const placed = new Set(items(['bed', 'plant']).map((p) => p.furnitureId));
    expect(placed.has('bed')).toBe(true);
    expect(placed.has('plant')).toBe(true);
    expect(placed.has('shelf')).toBe(false);
  });
});
