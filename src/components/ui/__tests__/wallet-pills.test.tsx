import { act, fireEvent, render } from '@testing-library/react-native';

import { WalletPills } from '@/components/ui/wallet-pills';

describe('WalletPills', () => {
  it('shows balances up to four digits as-is', async () => {
    const { getByText } = await render(<WalletPills coin={9999} diamond={1234} />);
    expect(getByText('9,999')).toBeTruthy();
    expect(getByText('1,234')).toBeTruthy();
  });

  it('caps five-digit balances at 9999+ and reveals the real value on tap', async () => {
    const { getByText, queryByText } = await render(<WalletPills coin={123456} diamond={500} />);
    expect(getByText('9999+')).toBeTruthy();
    expect(queryByText('123,456')).toBeNull();

    await fireEvent.press(getByText('9999+'));
    expect(getByText('123,456')).toBeTruthy();

    // Tapping again re-caps.
    await fireEvent.press(getByText('123,456'));
    expect(getByText('9999+')).toBeTruthy();
  });

  it('keeps the real balance in the accessibility label even when capped', async () => {
    const { getByLabelText } = await render(<WalletPills coin={123456} diamond={500} />);
    expect(getByLabelText('코인 123456')).toBeTruthy();
    expect(getByLabelText('다이아 500')).toBeTruthy();
  });

  it('-0 prop은 0으로 표기한다 (#714) — 롤링이 안 도는 경로라 영구 표기되던 버그', async () => {
    const { getByLabelText, getByText, queryByText } = await render(
      <WalletPills coin={-0} diamond={3} />,
    );
    expect(queryByText('-0')).toBeNull();
    expect(getByText('0')).toBeTruthy();
    expect(getByLabelText('코인 0')).toBeTruthy();
  });

  it('음수에서 0으로 롤링하는 동안에도 -0 프레임을 그리지 않는다 (#714)', async () => {
    jest.useFakeTimers();
    try {
      const view = await render(<WalletPills coin={-5} diamond={0} compact />);
      await view.rerender(<WalletPills coin={0} diamond={0} compact />);
      // 80ms 스로틀 스텝 단위로 전 구간을 훑는다 — 마지막 구간의
      // Math.round(-0.x)가 -0을 그리던 지점 포함.
      for (let i = 0; i < 10; i += 1) {
        await act(async () => {
          jest.advanceTimersByTime(80);
        });
        expect(view.queryByText('-0')).toBeNull();
      }
      expect(view.getByText('0')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('550ms 롤링 중 재변동 시 이전 목표값을 스냅 표시하지 않고 최신 값으로 수렴한다 (#696)', async () => {
    jest.useFakeTimers();
    try {
      const view = await render(<WalletPills coin={100} diamond={0} compact />);
      await view.rerender(<WalletPills coin={200} diamond={0} compact />);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      // 롤링 중 재변동 — 중단된 이전 애니메이션의 완료 콜백이 200을 강제
      // 표시하면 안 된다 (finished 가드).
      await view.rerender(<WalletPills coin={350} diamond={0} compact />);
      expect(view.queryByText('200')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(view.getByText('350')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
