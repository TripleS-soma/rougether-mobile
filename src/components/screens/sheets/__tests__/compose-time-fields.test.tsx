import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ComposeTimeFields } from '@/components/screens/sheets/compose-time-fields';
function Harness({ changed }: { changed: (value: string) => void }) {
  const [value, setValue] = useState('23:55');
  return (
    <ComposeTimeFields
      value={value}
      onChange={(next) => {
        setValue(next);
        changed(next);
      }}
    />
  );
}
it('시·오전오후·분 변경을 24시간제로 보존하고 분은 5분 단위로 고른다', async () => {
  const changed = jest.fn();
  const ui = await render(<Harness changed={changed} />);
  await fireEvent.press(ui.getByLabelText('12시'));
  expect(changed).toHaveBeenLastCalledWith('12:55');
  await fireEvent.press(ui.getByLabelText('오전'));
  expect(changed).toHaveBeenLastCalledWith('00:55');
  await fireEvent.press(ui.getByLabelText('5분'));
  expect(changed).toHaveBeenLastCalledWith('00:05');
  expect(ui.queryByLabelText('1분')).toBeNull();
  await fireEvent.press(ui.getByLabelText('1시'));
  expect(changed).toHaveBeenLastCalledWith('01:05');
});
