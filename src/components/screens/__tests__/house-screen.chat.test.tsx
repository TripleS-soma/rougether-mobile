import { fireEvent, render } from '@testing-library/react-native';
import { HouseScreen } from '@/components/screens/house-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MISSION_HOUSE } from '@/test-utils/house-screen-fixtures';

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));
beforeEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

describe('HouseScreen — 레일 채팅', () => {
  describe('레일 채팅 (#1408)', () => {
    it('onOpenChat이 있으면 레일에 채팅·집 탐색 순으로 뜨고, 안 읽은 수를 배지로 보인다 (#1646)', async () => {
      const onOpenChat = jest.fn();
      const ui = await render(
        <HouseScreen
          houses={[MISSION_HOUSE]}
          onOpenMissions={() => {}}
          onOpenChat={onOpenChat}
          chatUnread={3}
        />,
      );
      const labels = ui
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel as string | undefined)
        .filter((l): l is string => !!l && /^(집 채팅|집 탐색)/.test(l));
      // 레일은 채팅·집 탐색 둘뿐이다 — 목표·집 관리는 하늘 위 알약으로 옮겼다 (#1646).
      expect(labels).toHaveLength(2);
      const order = ['채팅', '집 탐색'].map((k) => labels.findIndex((l) => l.includes(k)));
      expect(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]))).toBe(true);
      expect(ui.getByText('3')).toBeTruthy();
      await fireEvent.press(ui.getByLabelText('집 채팅, 안 읽은 메시지 3개'));
      expect(onOpenChat).toHaveBeenCalled();
    });

    it('onOpenChat이 없으면(houseId 없는 집) 채팅 버튼을 그리지 않는다', async () => {
      const ui = await render(<HouseScreen houses={[MISSION_HOUSE]} />);
      expect(ui.queryByLabelText('집 채팅')).toBeNull();
    });
  });
});

describe('HouseScreen — 레일 집 피드', () => {
  it('onOpenFeed가 있으면 채팅 아래·집 추가 위에 집 피드가 뜨고, 누르면 연다', async () => {
    const onOpenFeed = jest.fn();
    const ui = await render(
      <HouseScreen houses={[MISSION_HOUSE]} onOpenChat={() => {}} onOpenFeed={onOpenFeed} />,
    );
    const labels = ui
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel as string | undefined)
      .filter((l): l is string => !!l && /^(집 채팅|집 피드|집 추가)/.test(l));
    expect(labels).toEqual(['집 채팅', '집 피드', '집 추가']);
    await fireEvent.press(ui.getByLabelText('집 피드'));
    expect(onOpenFeed).toHaveBeenCalledTimes(1);
  });

  it('onOpenFeed가 없으면(피드가 꺼진 설치본·houseId 없는 집) 그리지 않는다', async () => {
    const ui = await render(<HouseScreen houses={[MISSION_HOUSE]} onOpenChat={() => {}} />);
    expect(ui.queryByLabelText('집 피드')).toBeNull();
  });
});
