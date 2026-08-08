import { fireEvent, render } from '@testing-library/react-native';

import type { WalletHistoryEntry } from '@/api/adapters';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';

const ENTRIES: WalletHistoryEntry[] = [
  { id: 1, currency: 'coin', amount: 10, reason: '루틴 완료', balanceAfter: 130, createdAt: new Date().toISOString() }, // prettier-ignore
  { id: 2, currency: 'coin', amount: -100, reason: '뽑기', balanceAfter: 120, createdAt: new Date().toISOString() }, // prettier-ignore
];

describe('WalletHistorySheet (#734)', () => {
  it('적립은 +, 사용은 부호 그대로 표시하고 직후 잔액을 함께 적는다', async () => {
    const { getByText } = await render(
      <WalletHistorySheet visible onClose={jest.fn()} entries={ENTRIES} />,
    );
    expect(getByText('루틴 완료')).toBeTruthy();
    expect(getByText('+10')).toBeTruthy();
    expect(getByText('-100')).toBeTruthy();
    expect(getByText(/잔액 130/)).toBeTruthy();
  });

  it('더보기 버튼은 hasNext일 때만 — 탭 시 onLoadMore', async () => {
    const onLoadMore = jest.fn();
    const withNext = await render(
      <WalletHistorySheet
        visible
        onClose={jest.fn()}
        entries={ENTRIES}
        hasNext
        onLoadMore={onLoadMore}
      />,
    );
    await fireEvent.press(withNext.getByLabelText('재화 내역 더보기'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    const noNext = await render(
      <WalletHistorySheet visible onClose={jest.fn()} entries={ENTRIES} />,
    );
    expect(noNext.queryByLabelText('재화 내역 더보기')).toBeNull();
  });

  it('첫 페이지 실패는 재시도, 빈 목록은 빈 상태 문구', async () => {
    const onRetry = jest.fn();
    const err = await render(
      <WalletHistorySheet visible onClose={jest.fn()} entries={[]} loadError onRetry={onRetry} />,
    );
    await fireEvent.press(err.getByText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    const empty = await render(<WalletHistorySheet visible onClose={jest.fn()} entries={[]} />);
    expect(empty.getByText('아직 재화 내역이 없어요')).toBeTruthy();
  });
});
