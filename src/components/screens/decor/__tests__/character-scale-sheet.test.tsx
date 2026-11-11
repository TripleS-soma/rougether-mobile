import { fireEvent, render } from '@testing-library/react-native';
import { CharacterScaleSheet } from '@/components/screens/decor/character-scale-sheet';

it('clamps at the limits, restores 100%, and clears transient preview when closing', async () => {
  const onCommit = jest.fn();
  const onPreview = jest.fn();
  const onClose = jest.fn();
  const view = await render(
    <CharacterScaleSheet
      visible
      value={0.7}
      onCommit={onCommit}
      onPreview={onPreview}
      onClose={onClose}
    />,
  );
  await fireEvent.press(view.getByLabelText('캐릭터 작게'));
  expect(onCommit).toHaveBeenLastCalledWith(0.7);
  await fireEvent.press(view.getByText('기본 크기'));
  expect(onCommit).toHaveBeenLastCalledWith(1);
  await view.rerender(
    <CharacterScaleSheet
      visible
      value={1.3}
      onCommit={onCommit}
      onPreview={onPreview}
      onClose={onClose}
    />,
  );
  await fireEvent.press(view.getByLabelText('캐릭터 크게'));
  expect(onCommit).toHaveBeenLastCalledWith(1.3);
  await fireEvent.press(view.getByText('확인'));
  expect(onPreview).toHaveBeenLastCalledWith(null);
  expect(onClose).toHaveBeenCalledTimes(1);
});
