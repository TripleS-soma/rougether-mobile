import { render } from '@testing-library/react-native';
import { RoomGrowthPill } from '@/components/ui/room-growth-pill';

it('서버 레벨 0을 숨기지 않고 다음 단계까지의 포인트를 읽어준다', async () => {
  const ui = await render(
    <RoomGrowthPill growthLevel={0} growthPoints={3} pointsToNextLevel={17} />,
  );
  expect(ui.getByLabelText('나의 방 레벨 0, 다음 레벨까지 17포인트, 누적 3포인트')).toBeTruthy();
});
it('포인트가 없는 서버 응답은 실제 레벨만 표시한다', async () => {
  const ui = await render(<RoomGrowthPill growthLevel={2} />);
  expect(ui.getByText('Lv. 2')).toBeTruthy();
  expect(ui.queryByText(/다음까지/)).toBeNull();
});
it('로딩 중이거나 잘못된 레벨을 0레벨로 꾸며내지 않는다', async () => {
  const ui = await render(<RoomGrowthPill />);
  expect(ui.queryByText(/Lv\./)).toBeNull();
  await ui.rerender(<RoomGrowthPill growthLevel={-1} />);
  expect(ui.queryByText(/Lv\./)).toBeNull();
});
