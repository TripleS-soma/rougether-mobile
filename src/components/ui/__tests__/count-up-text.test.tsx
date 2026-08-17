import { render } from '@testing-library/react-native';

import { CountUpText } from '@/components/ui/count-up-text';

describe('CountUpText', () => {
  it('duration 0이면 즉시 목표값을 보여준다', async () => {
    const { getByText } = await render(<CountUpText value={7} duration={0} suffix="일차" />);
    expect(getByText('7일차')).toBeTruthy();
  });

  /**
   * 마운트할 때부터 0에서 굴리면 시트를 열 때마다 숫자가 요동친다 —
   * 성취가 아니라 소음이다. 첫 렌더는 값 그대로여야 한다.
   */
  it('첫 마운트에는 굴리지 않고 값 그대로 그린다', async () => {
    const { getByText } = await render(<CountUpText value={3} suffix="일차" />);
    expect(getByText('3일차')).toBeTruthy();
  });

  it('값이 줄면 굴리지 않고 바로 반영한다', async () => {
    const { getByText, rerender } = await render(<CountUpText value={5} />);
    await rerender(<CountUpText value={2} />);
    expect(getByText('2')).toBeTruthy();
  });
});
