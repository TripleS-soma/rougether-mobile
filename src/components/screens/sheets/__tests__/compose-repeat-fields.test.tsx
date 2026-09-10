import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  ComposeRepeatFields,
  type RepeatDraft,
} from '@/components/screens/sheets/compose-repeat-fields';
const INITIAL: RepeatDraft = { repeat: 'weekly', days: [1, 5], dayOfMonth: 10, month: 9 };
function Harness({ changed }: { changed: (value: RepeatDraft) => void }) {
  const [value, setValue] = useState(INITIAL);
  return (
    <ComposeRepeatFields
      value={value}
      onChange={(next) => {
        setValue(next);
        changed(next);
      }}
    />
  );
}
it('격주로 전환해도 요일을 보존하고 특정 요일만 해제한다', async () => {
  const changed = jest.fn();
  const ui = await render(<Harness changed={changed} />);
  await fireEvent.press(ui.getByLabelText('격주'));
  expect(ui.getByText('시작일이 속한 주부터 2주마다 반복해요.')).toBeTruthy();
  expect(changed).toHaveBeenLastCalledWith(
    expect.objectContaining({ repeat: 'biweekly', days: [1, 5] }),
  );
  await fireEvent.press(ui.getByLabelText('월요일'));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ days: [5] }));
});
it('매월 31일과 매년 2월 29일을 선택하고 주간 초안을 다시 가져온다', async () => {
  const changed = jest.fn();
  const ui = await render(<Harness changed={changed} />);
  await fireEvent.press(ui.getByLabelText('매월'));
  await fireEvent.press(ui.getByLabelText('31일'));
  expect(changed).toHaveBeenLastCalledWith(
    expect.objectContaining({ repeat: 'monthly', dayOfMonth: 31 }),
  );
  await fireEvent.press(ui.getByLabelText('매년'));
  await fireEvent.press(ui.getByLabelText('2월'));
  await fireEvent.press(ui.getByLabelText('29일'));
  expect(changed).toHaveBeenLastCalledWith(
    expect.objectContaining({ repeat: 'yearly', month: 2, dayOfMonth: 29 }),
  );
  await fireEvent.press(ui.getByLabelText('매주'));
  expect(ui.getByLabelText('월요일').props.accessibilityState.selected).toBe(true);
  expect(ui.getByLabelText('금요일').props.accessibilityState.selected).toBe(true);
});
