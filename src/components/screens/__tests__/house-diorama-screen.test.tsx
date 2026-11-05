import { fireEvent, render } from '@testing-library/react-native';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { FOREST_CANOPY_COVER_KEY, EVENING_BRICK_COVER_KEY } from '@/resources/house-diorama';

const house = (count: number, id = 11): House => ({
  houseId: id,
  name: '우리 집',
  coverImageKey: FOREST_CANOPY_COVER_KEY,
  maxMembers: count,
  memberCount: count,
  floors: Array.from({ length: Math.ceil(count / 2) }, (_, r) => ({
    level: String(r),
    rooms: Array.from({ length: Math.min(2, count - r * 2) }, (_, c) => {
      const i = r * 2 + c;
      return { name: `멤버${i + 1}`, membershipId: i + 101, userId: i + 201, color: '#eee' };
    }),
  })).reverse(),
});

describe('default shared-house renderer', () => {
  it.each([1, 3, 4, 6, 10])(
    'keeps each of %i real members reachable through annexes and preserves visit identity',
    async (count) => {
      const onVisitFriend = jest.fn();
      const ui = await render(
        <HouseScreen houses={[house(count)]} onVisitFriend={onVisitFriend} />,
      );
      expect(ui.queryAllByTestId('room-preview')).toHaveLength(0);
      const seen = new Set<number>();
      for (let page = 0; page < Math.ceil(Math.ceil(count / 2) / 2); page++) {
        if (page > 0) await fireEvent.press(ui.getByLabelText(`별채 ${page} 보기`));
        const buttons = ui
          .getAllByRole('button')
          .filter((b) => /^멤버\d+$/.test(b.props.accessibilityLabel ?? ''));
        for (const button of buttons) {
          await fireEvent.press(button);
          const value = onVisitFriend.mock.calls.at(-1)?.[0];
          expect(value.houseId).toBe(11);
          seen.add(value.membershipId);
        }
      }
      expect([...seen].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, i) => 101 + i),
      );
    },
  );
  it('returns to the main house when the displayed house changes', async () => {
    const houses = [house(10), { ...house(4, 12), coverImageKey: EVENING_BRICK_COVER_KEY }];
    const ui = await render(<HouseScreen houses={houses} houseIndex={0} />);
    await fireEvent.press(ui.getByLabelText('별채 2 보기'));
    await ui.rerender(<HouseScreen houses={houses} houseIndex={1} />);
    expect(ui.queryByTestId('diorama-annexes')).toBeNull();
    expect(ui.getByLabelText('멤버1')).toBeTruthy();
  });
});

it.each([1, 3, 4, 6, 10])(
  'preserves all %i members and their visit targets in classic mode',
  async (count) => {
    const onVisitFriend = jest.fn();
    const current = { ...house(count), displayMode: 'CLASSIC' as const };
    const previews = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [i + 101, { placements: [] }]),
    );
    const ui = await render(
      <HouseScreen houses={[current]} roomPreviews={previews} onVisitFriend={onVisitFriend} />,
    );
    expect(ui.queryByTestId('diorama-annexes')).toBeNull();
    expect(ui.getAllByTestId('room-preview')).toHaveLength(count);
    for (let i = 0; i < count; i++) {
      await fireEvent.press(ui.getByLabelText(`멤버${i + 1}`));
      expect(onVisitFriend).toHaveBeenLastCalledWith(
        expect.objectContaining({ houseId: 11, membershipId: i + 101 }),
      );
    }
  },
);
