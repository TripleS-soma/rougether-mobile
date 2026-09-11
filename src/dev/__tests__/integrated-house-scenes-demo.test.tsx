import { fireEvent, render } from '@testing-library/react-native';
import { IntegratedHouseScenesDemo } from '@/dev/integrated-house-scenes-demo';

describe('integrated house gallery', () => {
  it('exposes four themes, all capacities, fixture vacancy and actual visit callbacks', async () => {
    const ui = await render(<IntegratedHouseScenesDemo />);
    for (const label of [
      '구름 풍선 집',
      '버섯 숲 집',
      '밤의 천문대 집',
      '산호 조개 집',
      '2인',
      '4인',
      '6인',
    ]) {
      expect(ui.getByRole('button', { name: label })).toBeTruthy();
    }
    await fireEvent.press(ui.getByRole('button', { name: '6인' }));
    expect(ui.getAllByTestId('preview-room')).toHaveLength(6);
    await fireEvent.press(ui.getByRole('button', { name: '마지막 자리 비우기' }));
    expect(ui.getAllByTestId('preview-room')).toHaveLength(5);
    expect(ui.getAllByTestId('preview-vacant')).toHaveLength(1);
    await fireEvent.press(ui.getByRole('button', { name: '실제 집 화면 보기' }));
    await fireEvent.press(ui.getByRole('button', { name: '멤버 5' }));
    expect(ui.getByText('5번 멤버 5 방문')).toBeTruthy();
  });
});
