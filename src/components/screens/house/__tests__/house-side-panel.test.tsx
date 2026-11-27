import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HouseSidePanel } from '@/components/screens/house/house-side-panel';
import type { HouseMission, RoomCell } from '@/components/screens/house/types';

// 집의 자리 순서 — 내 자리가 가운데에 있어도 목록에서는 맨 위로 온다.
const MEMBERS: RoomCell[] = [
  { name: '친구', color: '#fff', lastSeenLabel: '3시간 전' },
  { name: '나', color: '#fff', isMine: true, isOwner: true, online: true },
  { name: '도우미', color: '#fff', bot: true },
];
const MISSIONS: HouseMission[] = [
  { id: 1, title: '주간 루틴 지키기', desc: '', unit: '회', icon: 'calendar', current: 3, target: 10, status: 'ACTIVE' }, // prettier-ignore
  { id: 2, title: '지난 미션', desc: '', icon: 'calendar', current: 5, target: 5, status: 'COMPLETED' }, // prettier-ignore
];

const base = {
  name: '실집',
  isOwner: true,
  level: 2,
  growthPoints: 230,
  members: MEMBERS,
  maxMembers: 4,
  missions: MISSIONS,
  userName: 'Kinsey',
};

describe('HouseSidePanel — 2단 집 탭의 오른쪽 칸', () => {
  it('집 이름·레벨, 진행 중인 목표, 구성원을 그린다', async () => {
    const ui = await render(<HouseSidePanel {...base} />);
    expect(ui.getByRole('header', { name: '실집' })).toBeTruthy();
    expect(ui.getByText('Lv.2 · 30/100')).toBeTruthy();
    // 진행 중인 목표만 — 끝난 미션은 목록에 없다.
    expect(ui.getByText('주간 루틴 지키기')).toBeTruthy();
    expect(ui.getByText('3/10회')).toBeTruthy();
    expect(ui.queryByText('지난 미션')).toBeNull();
    // 구성원: 내 자리는 라이브 닉네임 + (나), 방장 표시, 접속 상태.
    expect(ui.getByText('구성원 3 / 4')).toBeTruthy();
    const mine = within(ui.getByTestId('house-side-member-0'));
    expect(mine.getByText('Kinsey (나)')).toBeTruthy();
    expect(mine.getByText('방장')).toBeTruthy();
    expect(mine.getByText('접속 중')).toBeTruthy();
    expect(within(ui.getByTestId('house-side-member-1')).getByText('3시간 전 접속')).toBeTruthy();
    expect(within(ui.getByTestId('house-side-member-2')).getByText('봇')).toBeTruthy();
  });

  it('구성원 줄은 구분선 사이에서 세로 가운데에 놓인다 — 줄 사이를 카드 gap이 아니라 줄의 위아래 여백이 만든다', async () => {
    const ui = await render(<HouseSidePanel {...base} />);
    const row = ui.getByTestId('house-side-member-1');
    const style = StyleSheet.flatten(row.props.style);
    expect(style.alignItems).toBe('center');
    expect(style.paddingVertical).toBeGreaterThan(0);
    // 줄 묶음에 gap이 있으면 구분선(다음 줄의 위 테두리) 아래로만 간격이 붙는다.
    expect(StyleSheet.flatten(row.parent?.props.style)?.gap).toBeUndefined();
  });

  it('진행 중인 목표가 없으면 안내 문구', async () => {
    const ui = await render(<HouseSidePanel {...base} missions={[MISSIONS[1]]} />);
    expect(ui.getByText('진행 중인 목표가 없어요')).toBeTruthy();
  });

  it('버튼이 각 콜백을 부른다 — 없는 진입점은 그리지 않는다', async () => {
    const on = {
      onOpenChat: jest.fn(),
      onOpenFeed: jest.fn(),
      onOpenSearch: jest.fn(),
      onOpenMissions: jest.fn(),
      onOpenMembers: jest.fn(),
    };
    const ui = await render(<HouseSidePanel {...base} {...on} chatUnread={3} />);
    await fireEvent.press(ui.getByRole('button', { name: '집 채팅, 안 읽은 메시지 3개' }));
    await fireEvent.press(ui.getByRole('button', { name: '집 피드' }));
    await fireEvent.press(ui.getByRole('button', { name: '집 추가' }));
    await fireEvent.press(ui.getByRole('button', { name: '우리 집의 목표 전체 보기' }));
    await fireEvent.press(ui.getByRole('button', { name: '구성원 관리' }));
    for (const fn of Object.values(on)) expect(fn).toHaveBeenCalledTimes(1);

    const bare = await render(<HouseSidePanel {...base} />);
    expect(bare.queryByRole('button', { name: '집 피드' })).toBeNull();
    expect(bare.queryByRole('button', { name: '구성원 관리' })).toBeNull();
  });
});
