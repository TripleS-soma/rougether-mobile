import { fireEvent, render } from '@testing-library/react-native';

import { GachaStorybookPreview } from '@/dev/gacha-preview';

it('keeps the earlier illustrated stage as an isolated art comparison without a paid draw', async () => {
  const screen = await render(<GachaStorybookPreview />);
  expect(
    screen.getByText('이전 숲속 아트 비교용 · 실제 뽑기 화면에서는 사용하지 않아요'),
  ).toBeTruthy();
  expect(screen.queryByText('1회 뽑기')).toBeNull();
  await fireEvent.press(screen.getByLabelText('선물상자 열기'));
  expect(screen.getByText('다시 보기')).toBeTruthy();
  await fireEvent.press(screen.getByText('다시 보기'));
  expect(screen.queryByText('다시 보기')).toBeNull();
});
