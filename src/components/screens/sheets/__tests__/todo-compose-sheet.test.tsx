import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  TodoComposeSheet,
  type TodoComposeSheetProps,
} from '@/components/screens/sheets/todo-compose-sheet';
import type { RoutineCategoryMeta } from '@/constants/routines';

const DATE = '2026-09-18';
const CATEGORY: RoutineCategoryMeta = {
  id: '20',
  name: '생활',
  icon: 'sun',
  color: '#7FA87F',
  visibility: 'private',
};
const props = (overrides: Partial<TodoComposeSheetProps> = {}): TodoComposeSheetProps => ({
  visible: true,
  initialDate: DATE,
  today: '2026-09-10',
  categories: [CATEGORY],
  onSubmit: jest.fn().mockResolvedValue(true),
  onClose: jest.fn(),
  ...overrides,
});

it('제목만으로 선택한 날짜에 미분류 투두를 저장한다', async () => {
  const p = props();
  const ui = await render(<TodoComposeSheet {...p} />);
  expect(ui.getByLabelText('할 일 저장').props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '  멘토링 자료 보내기  ');
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
  expect(p.onSubmit).toHaveBeenCalledWith('', '멘토링 자료 보내기', DATE);
});

it('날짜와 카테고리를 고르는 동안 제목을 유지하고 명시적 저장만 제출한다', async () => {
  const p = props();
  const ui = await render(<TodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '장보기');
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  await fireEvent.press(ui.getByRole('radio', { name: '생활' }));
  await fireEvent.press(ui.getByLabelText('할 일 날짜 선택'));
  await fireEvent.press(ui.getByLabelText(/^2026-09-20(?:,|$)/));
  expect(ui.getByLabelText('할 일 제목').props.value).toBe('장보기');
  expect(p.onSubmit).not.toHaveBeenCalled();
  await fireEvent(ui.getByLabelText('할 일 제목'), 'submitEditing');
  await waitFor(() => expect(p.onSubmit).toHaveBeenCalledWith('20', '장보기', '2026-09-20'));
});

it('저장 중 연속 제출과 닫기를 막고, 실패한 제목으로 다시 시도한다', async () => {
  let settle!: (value: boolean) => void;
  const submit = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  const p = props({ onSubmit: submit });
  const ui = await render(<TodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '제출할 내용');
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await fireEvent(ui.getByLabelText('할 일 제목'), 'submitEditing');
  await fireEvent.press(ui.getByLabelText('시트 닫기'));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(p.onClose).not.toHaveBeenCalled();
  await act(async () => settle(false));
  expect(ui.getByLabelText('할 일 제목').props.value).toBe('제출할 내용');
  expect(ui.getByRole('alert')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
  expect(submit).toHaveBeenCalledTimes(2);
});

it('예외가 나도 입력을 유지하고 취소는 투두를 생성하지 않는다', async () => {
  const p = props({ onSubmit: jest.fn().mockRejectedValue(new Error('offline')) });
  const ui = await render(<TodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '오프라인 초안');
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await waitFor(() => expect(ui.getByRole('alert')).toBeTruthy());
  expect(ui.getByLabelText('할 일 제목').props.value).toBe('오프라인 초안');
  expect(p.onClose).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByRole('button', { name: '취소' }));
  expect(p.onSubmit).toHaveBeenCalledTimes(1);
  expect(p.onClose).toHaveBeenCalledTimes(1);
});

it('루틴 추가로 전환할 때 날짜를 유지하고 투두를 저장하지 않는다', async () => {
  const p = props({ onAddRoutine: jest.fn() });
  const ui = await render(<TodoComposeSheet {...p} />);
  await fireEvent.press(ui.getByLabelText('루틴 추가'));
  expect(p.onAddRoutine).toHaveBeenCalledWith(DATE);
  expect(p.onSubmit).not.toHaveBeenCalled();
});
