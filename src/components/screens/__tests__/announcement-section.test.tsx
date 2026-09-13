import { fireEvent, render } from '@testing-library/react-native';

import {
  AnnouncementSection,
  type AnnouncementRow,
} from '@/components/screens/announcement-section';

const row = (n: number, read = false): AnnouncementRow => ({
  id: `a${n}`,
  date: '2026-09-13',
  title: `소식 ${n}`,
  body: `본문 ${n}`,
  read,
  action: n === 1 ? { kind: 'screen', screen: 'minigames', label: '게임 하러 가기' } : undefined,
});

describe('AnnouncementSection (#1320)', () => {
  it('renders nothing without announcements', async () => {
    const { queryByTestId } = await render(<AnnouncementSection announcements={[]} />);
    expect(queryByTestId('announcement-section')).toBeNull();
  });

  it('shows title, date, action label and unread state, and reports taps', async () => {
    const onOpen = jest.fn();
    const { getByLabelText, getByText, getAllByText } = await render(
      <AnnouncementSection announcements={[row(1), row(2, true)]} onOpen={onOpen} />,
    );
    expect(getByText('새 소식')).toBeTruthy();
    expect(getAllByText('9월 13일')).toHaveLength(2);
    expect(getByText('게임 하러 가기 →')).toBeTruthy();
    expect(getByLabelText('소식 1').props.accessibilityState).toEqual({ selected: true });
    expect(getByLabelText('소식 2').props.accessibilityState).toEqual({ selected: false });

    await fireEvent.press(getByLabelText('소식 1'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('collapses to the recent three and expands on 더보기', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <AnnouncementSection announcements={[row(1), row(2), row(3), row(4), row(5)]} />,
    );
    expect(queryByLabelText('소식 4')).toBeNull();
    await fireEvent.press(getByLabelText('지난 소식 2개 더보기'));
    expect(getByLabelText('소식 4')).toBeTruthy();
    expect(getByLabelText('소식 5')).toBeTruthy();
    await fireEvent.press(getByLabelText('새 소식 접기'));
    expect(queryByLabelText('소식 5')).toBeNull();
  });
});
