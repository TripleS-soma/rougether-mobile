import { fireEvent, render } from '@testing-library/react-native';

import type { FeedAuthorHouse } from '@/api/feed-houses';
import { FeedAuthorHouseSheet } from '@/components/feed/feed-author-house-sheet';

const home: FeedAuthorHouse = {
  houseId: 20,
  name: '비공개 집',
  coverImageKey: null,
  level: 0,
  displayMode: 'DIORAMA',
  isPublic: false,
  requiresApproval: true,
  currentMemberCount: 1,
  maxMembers: 4,
  isMember: false,
  isFull: false,
  myMembershipStatus: null,
  myJoinRequestStatus: null,
  canJoin: true,
};

it('비공개 집도 승인 설정에 따라 입주 신청 버튼을 제공한다', async () => {
  const onJoin = jest.fn();
  const ui = await render(<FeedAuthorHouseSheet visible houses={[home]} onJoin={onJoin} />);
  await fireEvent.press(ui.getByLabelText('비공개 집, 입주 신청'));
  expect(onJoin).toHaveBeenCalledWith(20);
});

it('바로 입주 설정이 켜져도 버튼은 입주 신청으로 통일하고 처리 방식을 안내한다', async () => {
  const ui = await render(
    <FeedAuthorHouseSheet visible houses={[{ ...home, requiresApproval: false }]} />,
  );
  expect(ui.getByText('입주 신청')).toBeTruthy();
  expect(ui.getByText('신청하면 바로 입주해요')).toBeTruthy();
});

it('이미 구성원인 집은 집으로 이동하며 참여 요청을 다시 보내지 않는다', async () => {
  const onJoin = jest.fn(),
    onOpenHouse = jest.fn();
  const ui = await render(
    <FeedAuthorHouseSheet
      visible
      houses={[{ ...home, isMember: true, canJoin: false }]}
      onJoin={onJoin}
      onOpenHouse={onOpenHouse}
    />,
  );
  await fireEvent.press(ui.getByLabelText('비공개 집, 집으로 가기'));
  expect(onOpenHouse).toHaveBeenCalledWith(20);
  expect(onJoin).not.toHaveBeenCalled();
});

it('승인 대기와 만석, 강퇴한 집은 참여 버튼이 비활성이다', async () => {
  const ui = await render(
    <FeedAuthorHouseSheet
      visible
      houses={[
        { ...home, name: '대기 집', myJoinRequestStatus: 'PENDING', canJoin: false },
        { ...home, houseId: 21, name: '만석 집', isFull: true, canJoin: false },
        { ...home, houseId: 22, name: '강퇴 집', myMembershipStatus: 'KICKED', canJoin: false },
      ]}
    />,
  );
  for (const label of ['대기 집, 승인 대기', '만석 집, 정원 마감', '강퇴 집, 입주할 수 없음']) {
    expect(ui.getByLabelText(label).props.accessibilityState.disabled).toBe(true);
  }
});

it('불러오기 실패와 빈 집 목록을 구분한다', async () => {
  const onRetry = jest.fn();
  const ui = await render(<FeedAuthorHouseSheet visible houses={[]} error onRetry={onRetry} />);
  expect(ui.getByText('집 목록을 불러오지 못했어요.')).toBeTruthy();
  expect(ui.queryByText('작성자가 참여 중인 집이 없어요.')).toBeNull();
});
