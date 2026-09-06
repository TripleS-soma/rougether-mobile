import { fireEvent, render, within } from '@testing-library/react-native';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { DEFAULT_HOUSE_COVER_KEY } from '@/resources/house-frame';

const SIX: House = {
  houseId: 8,
  name: '세로 집',
  maxMembers: 6,
  coverImageKey: DEFAULT_HOUSE_COVER_KEY,
  missions: [],
  floors: [
    {
      level: '3층',
      rooms: [
        { name: '다섯', color: 'transparent', membershipId: 5 },
        { name: '여섯', color: 'transparent', membershipId: 6 },
      ],
    },
    {
      level: '2층',
      rooms: [
        { name: '셋', color: 'transparent', membershipId: 3 },
        { name: '넷', color: 'transparent', membershipId: 4 },
      ],
    },
    {
      level: '1층',
      rooms: [
        { name: '하나', color: 'transparent', membershipId: 1 },
        { name: '둘', color: 'transparent', membershipId: 2 },
      ],
    },
  ],
};

describe('stacked house screen', () => {
  it('retries the same frame after moving to another house and returning', async () => {
    const other = { ...SIX, houseId: 9, name: '다른 집' };
    const ui = await render(<HouseScreen houses={[SIX, other]} houseIndex={0} enabled />);
    await fireEvent(ui.getByTestId('house-frame'), 'error', { nativeEvent: { error: 'offline' } });
    expect(ui.getByTestId('house-frame').props.recyclingKey).toBe(DEFAULT_HOUSE_COVER_KEY);
    await ui.rerender(<HouseScreen houses={[SIX, other]} houseIndex={1} enabled />);
    expect(ui.getByTestId('house-frame').props.recyclingKey).toContain('-6p-frame.webp');
    await ui.rerender(<HouseScreen houses={[SIX, other]} houseIndex={0} enabled />);
    expect(ui.getByTestId('house-frame').props.recyclingKey).toContain('-6p-frame.webp');
  });

  it('does not drop members from malformed rows wider than two seats', async () => {
    const rooms = SIX.floors.flatMap((f) => f.rooms);
    const wide = {
      ...SIX,
      floors: [
        { level: '2층', rooms: rooms.slice(0, 3) },
        { level: '1층', rooms: rooms.slice(3) },
      ],
    };
    const ui = await render(<HouseScreen houses={[wide]} enabled />);
    for (const room of rooms) expect(ui.getByLabelText(room.name!)).toBeTruthy();
  });
  it('places all six seats in the frame, keeps visit identity, and preserves rooms on fallback', async () => {
    const onVisitFriend = jest.fn();
    const ui = await render(<HouseScreen houses={[SIX]} enabled onVisitFriend={onVisitFriend} />);
    expect(ui.getAllByTestId(/^house-window-/)).toHaveLength(6);
    expect(within(ui.getByTestId('house-window-0')).getByLabelText('다섯')).toBeTruthy();
    expect(within(ui.getByTestId('house-window-4')).getByLabelText('하나')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('여섯'));
    expect(onVisitFriend).toHaveBeenCalledWith(
      expect.objectContaining({ houseId: 8, membershipId: 6 }),
    );
    await fireEvent(ui.getByTestId('house-frame'), 'error', {
      nativeEvent: { error: 'unavailable' },
    });
    expect(ui.getByTestId('house-frame').props.recyclingKey).toBe(DEFAULT_HOUSE_COVER_KEY);
    expect(ui.getAllByTestId(/^house-window-/)).toHaveLength(4);
    // Extra rooms return to the legacy overflow grid instead of disappearing.
    for (const name of ['하나', '둘', '셋', '넷', '다섯', '여섯'])
      expect(ui.getByLabelText(name)).toBeTruthy();
  });

  it('keeps the odd upper half-row and bottom seats while switching capacity', async () => {
    const ui = await render(<HouseScreen houses={[SIX]} enabled />);
    const three = {
      ...SIX,
      maxMembers: 3,
      floors: [{ level: '2층', rooms: [SIX.floors[1].rooms[0]] }, SIX.floors[2]],
    };
    await ui.rerender(<HouseScreen houses={[three]} enabled />);
    expect(ui.getByTestId('house-frame').props.recyclingKey).toContain('-4p-frame.webp');
    expect(within(ui.getByTestId('house-window-0')).getByLabelText('셋')).toBeTruthy();
    expect(within(ui.getByTestId('house-window-1')).getByTestId('window-filler')).toBeTruthy();
    expect(within(ui.getByTestId('house-window-2')).getByLabelText('하나')).toBeTruthy();
  });
});
