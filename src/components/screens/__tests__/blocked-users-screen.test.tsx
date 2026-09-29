import { fireEvent, render } from '@testing-library/react-native';

import { type BlockedUser, BlockedUsersScreen } from '@/components/screens/blocked-users-screen';

const USERS: BlockedUser[] = [
  { userId: 8, nickname: '이웃', profileImageKey: null, blockedAt: '2026-09-29T03:00:00Z' },
  { userId: 9, nickname: null, profileImageKey: null, blockedAt: '2026-09-28T03:00:00Z' },
];

describe('BlockedUsersScreen (#1428)', () => {
  it('차단한 사용자를 닉네임으로 보여 주고, 닉네임이 없으면 알 수 없는 사용자', async () => {
    const { getByText } = await render(<BlockedUsersScreen users={USERS} onUnblock={jest.fn()} />);
    expect(getByText('차단한 사용자')).toBeTruthy();
    expect(getByText('이웃')).toBeTruthy();
    expect(getByText('알 수 없는 사용자')).toBeTruthy();
  });

  it('차단 해제는 확인 다이얼로그를 거쳐 그 사용자 id로', async () => {
    const onUnblock = jest.fn();
    const { getByLabelText, getByText, getAllByText } = await render(
      <BlockedUsersScreen users={USERS} onUnblock={onUnblock} />,
    );
    await fireEvent.press(getByLabelText('이웃 차단 해제'));
    expect(getByText('차단을 해제할까요?')).toBeTruthy();
    expect(getByText('이웃님의 게시물과 댓글이 다시 보여요.')).toBeTruthy();
    expect(onUnblock).not.toHaveBeenCalled();
    // 행 버튼과 다이얼로그 확정 버튼 — 확정은 마지막에 그려진다.
    const confirm = getAllByText('차단 해제');
    await fireEvent.press(confirm[confirm.length - 1]);
    expect(onUnblock).toHaveBeenCalledWith(8);
  });

  it('취소하면 해제하지 않는다', async () => {
    const onUnblock = jest.fn();
    const { getByLabelText, getByText } = await render(
      <BlockedUsersScreen users={USERS} onUnblock={onUnblock} />,
    );
    await fireEvent.press(getByLabelText('이웃 차단 해제'));
    await fireEvent.press(getByText('취소'));
    expect(onUnblock).not.toHaveBeenCalled();
  });

  it('비어 있으면 안내', async () => {
    const { getByText } = await render(<BlockedUsersScreen users={[]} />);
    expect(getByText('차단한 사용자가 없어요')).toBeTruthy();
  });

  it('불러오기 실패는 다시 시도', async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(<BlockedUsersScreen loadError onRetry={onRetry} />);
    expect(getByText('차단 목록을 불러오지 못했어요')).toBeTruthy();
    await fireEvent.press(getByText('다시 시도'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('다음 페이지가 있으면 더 보기', async () => {
    const onLoadMore = jest.fn();
    const { getByText } = await render(
      <BlockedUsersScreen users={USERS} hasNext onLoadMore={onLoadMore} />,
    );
    await fireEvent.press(getByText('더 보기'));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
