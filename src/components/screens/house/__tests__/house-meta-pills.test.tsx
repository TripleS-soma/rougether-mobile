import { fireEvent, render } from '@testing-library/react-native';

import {
  HouseMetaPills,
  type HouseMissionSummary,
} from '@/components/screens/house/house-meta-pills';

const NONE: HouseMissionSummary = { active: 0, contributedToday: 0, claimable: 0 };

describe('HouseMetaPills (#1646)', () => {
  it('레벨은 숫자만, 멤버는 "명" 없이 인원/정원만 보인다', async () => {
    const { getByText, queryByText } = await render(
      <HouseMetaPills
        level={3}
        growthPoints={240}
        memberCount={4}
        maxMembers={6}
        missions={NONE}
      />,
    );
    expect(getByText('Lv.3 · 40/100')).toBeTruthy();
    expect(getByText('4 / 6')).toBeTruthy();
    expect(queryByText(/명/)).toBeNull();
  });

  it('레벨 알약 탭 → 목표, 멤버 알약 탭 → 집 관리', async () => {
    const onOpenMissions = jest.fn();
    const onOpenMembers = jest.fn();
    const { getByLabelText } = await render(
      <HouseMetaPills
        level={2}
        memberCount={2}
        maxMembers={4}
        missions={{ active: 2, contributedToday: 1, claimable: 1 }}
        onOpenMissions={onOpenMissions}
        onOpenMembers={onOpenMembers}
      />,
    );
    await fireEvent.press(getByLabelText('우리 집의 목표, 오늘 1/2 기여, 받을 보상 1개, Lv.2'));
    expect(onOpenMissions).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('집 관리, 멤버 2 / 4'));
    expect(onOpenMembers).toHaveBeenCalledTimes(1);
  });

  it('진행 중 목표가 있으면 둘째 줄에 진행도, 받을 보상이 있을 때만 점', async () => {
    const ui = await render(
      <HouseMetaPills
        level={1}
        memberCount={1}
        missions={{ active: 2, contributedToday: 1, claimable: 0 }}
        onOpenMissions={() => {}}
      />,
    );
    expect(ui.getByText('1/2')).toBeTruthy();
    expect(ui.queryByTestId('house-level-claimable')).toBeNull();
    await ui.rerender(
      <HouseMetaPills
        level={1}
        memberCount={1}
        missions={{ active: 2, contributedToday: 2, claimable: 1 }}
        onOpenMissions={() => {}}
      />,
    );
    expect(ui.getByText('2/2')).toBeTruthy();
    expect(ui.getByTestId('house-level-claimable')).toBeTruthy();
  });

  it('진행 중 목표가 없으면 둘째 줄을 그리지 않는다', async () => {
    const { queryByTestId, getByLabelText } = await render(
      <HouseMetaPills level={1} memberCount={1} missions={NONE} onOpenMissions={() => {}} />,
    );
    expect(queryByTestId('house-level-missions')).toBeNull();
    expect(getByLabelText('우리 집의 목표, 진행 중 없음, Lv.1')).toBeTruthy();
  });

  it('콜백이 없으면 버튼이 아니다', async () => {
    const { queryAllByRole, getByLabelText } = await render(
      <HouseMetaPills level={1} memberCount={3} maxMembers={4} missions={NONE} />,
    );
    expect(queryAllByRole('button')).toHaveLength(0);
    expect(getByLabelText('멤버 3 / 4')).toBeTruthy();
  });

  it('누를 수 있는 알약은 위아래 hitSlop으로 44pt를 채운다', async () => {
    const { getByTestId } = await render(
      <HouseMetaPills level={1} memberCount={1} missions={NONE} onOpenMembers={() => {}} />,
    );
    const slop = getByTestId('house-members-pill').props.hitSlop;
    expect(slop.top + slop.bottom).toBeGreaterThanOrEqual(10);
  });
});
