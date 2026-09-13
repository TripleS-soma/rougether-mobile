import { render, fireEvent } from '@testing-library/react-native';
import { StarterSpeakerPreview } from '@/dev/starter-speaker-preview';
it('shows the fixed free speaker result and opens an empty room for manual placement', async () => {
  const view = await render(<StarterSpeakerPreview reducedMotion />);
  await fireEvent.press(view.getByLabelText('첫 가구 뽑기 (무료)'));
  expect(view.getByText('포근한 스피커')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('방 꾸미러 가기'));
  expect(view.getByText('적용하기')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('포근한 스피커'));
  await fireEvent.press(view.getByText('적용하기'));
  expect(view.getByLabelText('스피커 재생')).toBeTruthy();
});
