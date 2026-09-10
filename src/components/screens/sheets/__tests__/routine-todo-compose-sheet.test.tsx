import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import {
  RoutineTodoComposeSheet,
  type RoutineTodoComposeSheetProps,
} from '@/components/screens/sheets/routine-todo-compose-sheet';
const DATE = '2026-09-10';
const props = (
  overrides: Partial<RoutineTodoComposeSheetProps> = {},
): RoutineTodoComposeSheetProps => ({
  visible: true,
  initialDate: DATE,
  today: DATE,
  categories: [],
  onSubmit: jest.fn().mockResolvedValue(true),
  onClose: jest.fn(),
  ...overrides,
});
it('카테고리 0개에서도 기본 루틴을 제목만으로 저장한다', async () => {
  const p = props();
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  const head = within(ui.getByTestId('compose-fixed-header'));
  expect(head.getByRole('tab', { name: '루틴' }).props.accessibilityState.selected).toBe(true);
  expect(head.getByRole('tab', { name: '할 일' })).toBeTruthy();
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '  독서 20분  ');
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
  expect(p.onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'routine',
      date: DATE,
      routine: expect.objectContaining({
        title: '독서 20분',
        category: '',
        repeat: 'daily',
        startDate: DATE,
        alarmEnabled: false,
      }),
    }),
  );
});
it('제목·날짜·카테고리·반복 초안을 유형 왕복과 설정 열기에도 보존한다', async () => {
  const p = props({
    categories: [{ id: '20', name: '생활', icon: 'sun', color: '#7FA87F', visibility: 'private' }],
  });
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '운동');
  await fireEvent.press(ui.getByLabelText('반복 선택'));
  await fireEvent.press(ui.getByLabelText('매주'));
  await fireEvent.press(ui.getByLabelText('금요일'));
  await fireEvent.press(ui.getByLabelText('추가 설정'));
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  await fireEvent.press(ui.getByRole('radio', { name: '생활' }));
  await fireEvent.press(ui.getByRole('tab', { name: '할 일' }));
  expect(ui.getByLabelText('할 일 제목').props.value).toBe('운동');
  await fireEvent.press(ui.getByLabelText('할 일 날짜 선택'));
  await fireEvent.press(ui.getByLabelText(/^2026-09-17(?:,|$)/));
  await fireEvent.press(ui.getByRole('tab', { name: '루틴' }));
  expect(ui.getByText('매주 금')).toBeTruthy();
  expect(ui.getByLabelText('루틴 제목').props.value).toBe('운동');
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await waitFor(() =>
    expect(p.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'routine',
        date: '2026-09-18',
        routine: expect.objectContaining({ category: '20', days: [5], startDate: '2026-09-17' }),
      }),
    ),
  );
});
it('명시적으로 할 일로 열면 반복 없이 선택일에 저장한다', async () => {
  const p = props({ initialKind: 'todo', initialDate: '2026-09-18' });
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '자료 보내기');
  expect(ui.queryByLabelText('반복 선택')).toBeNull();
  await fireEvent(ui.getByLabelText('할 일 제목'), 'submitEditing');
  await waitFor(() =>
    expect(p.onSubmit).toHaveBeenCalledWith({
      kind: 'todo',
      title: '자료 보내기',
      category: '',
      date: '2026-09-18',
      time: undefined,
    }),
  );
});
it('루틴 시작일이 과거이거나 요일이 없으면 저장을 막고 초안을 유지한다', async () => {
  const p = props({ initialDate: '2026-09-09' });
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '독서');
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  expect(ui.getByRole('alert').props.children).toContain('오늘 이후');
  await fireEvent.press(ui.getByLabelText('루틴 날짜 선택'));
  await fireEvent.press(ui.getByLabelText(/^2026-09-10(?:,|$)/));
  await fireEvent.press(ui.getByLabelText('반복 선택'));
  await fireEvent.press(ui.getByLabelText('매주'));
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  expect(ui.getByRole('alert').props.children).toContain('요일');
  expect(p.onSubmit).not.toHaveBeenCalled();
});
it('저장 중 중복 제출·유형 전환·닫기를 막고 실패한 초안으로 재시도한다', async () => {
  let settle!: (value: boolean) => void;
  const save = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  const p = props({ onSubmit: save });
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '유지할 초안');
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await fireEvent(ui.getByLabelText('루틴 제목'), 'submitEditing');
  await fireEvent.press(ui.getByRole('tab', { name: '할 일' }));
  await fireEvent.press(ui.getByLabelText('시트 닫기'));
  expect(p.onClose).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledTimes(1);
  expect(ui.getByLabelText('루틴 제목').props.value).toBe('유지할 초안');
  await act(async () => settle(false));
  expect(ui.getByRole('alert')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1));
});
it('취소는 초안 폐기를 확인하고 계속 작성은 제목을 보존한다', async () => {
  const p = props();
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '초안');
  await fireEvent.press(ui.getByLabelText('취소'));
  expect(p.onClose).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByLabelText('계속 작성'));
  expect(ui.getByLabelText('루틴 제목').props.value).toBe('초안');
  await fireEvent.press(ui.getByLabelText('취소'));
  await fireEvent.press(ui.getByLabelText('내용 버리기'));
  expect(p.onClose).toHaveBeenCalledTimes(1);
  expect(p.onSubmit).not.toHaveBeenCalled();
});
it('루틴 알림과 할 일 시간은 유형마다 별도로 보존한다', async () => {
  const p = props();
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '읽기');
  await fireEvent.press(ui.getByLabelText('추가 설정'));
  await fireEvent.press(ui.getByLabelText('루틴 시간 설정'));
  await fireEvent.press(ui.getByLabelText('오후'));
  await fireEvent.press(ui.getByRole('tab', { name: '할 일' }));
  expect(ui.queryByLabelText('할 일 시간 선택')).toBeNull();
  await fireEvent.press(ui.getByRole('tab', { name: '루틴' }));
  expect(ui.getByText('오후 7:00')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('루틴 저장'));
  await waitFor(() =>
    expect(p.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        routine: expect.objectContaining({ alarmEnabled: true, time: '19:00' }),
      }),
    ),
  );
});

it('카테고리 선택에서는 폼을 숨기고 뒤로 이동과 선택 후 초안을 보존한다', async () => {
  const p = props({
    categories: [
      { id: '20', name: '생활', icon: 'sun', color: '#7FA87F', visibility: 'private' },
      {
        id: '21',
        name: '공동집',
        icon: 'sun',
        color: '#7FA87F',
        visibility: 'public',
        houseId: 7,
      },
    ],
  });
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('루틴 제목'), '독서 20분');
  await fireEvent.press(ui.getByLabelText('추가 설정'));
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  expect(ui.getByRole('header', { name: '카테고리' })).toBeTruthy();
  expect(ui.queryByLabelText('루틴 제목')).toBeNull();
  expect(ui.queryByLabelText('루틴 저장')).toBeNull();
  expect(ui.queryByRole('radio', { name: '공동집' })).toBeNull();
  await fireEvent.press(ui.getByLabelText('작성 화면으로 돌아가기'));
  expect(ui.getByLabelText('루틴 제목').props.value).toBe('독서 20분');
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  await fireEvent.press(ui.getByRole('radio', { name: '생활' }));
  expect(ui.getByLabelText('루틴 제목').props.value).toBe('독서 20분');
  expect(ui.getByLabelText('카테고리 선택, 생활')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 생활'));
  expect(ui.getByRole('radio', { name: '생활' }).props.accessibilityState.checked).toBe(true);
  // The native back/backdrop action returns to the draft before offering to discard it.
  await fireEvent.press(ui.getByLabelText('시트 닫기'));
  expect(ui.getByLabelText('루틴 제목').props.value).toBe('독서 20분');
  expect(p.onClose).not.toHaveBeenCalled();
  expect(p.onSubmit).not.toHaveBeenCalled();
});

it('할 일 시간을 선택한 뒤 카테고리를 왕복해도 지정한 시간으로 저장한다', async () => {
  const p = props({ initialKind: 'todo' });
  const ui = await render(<RoutineTodoComposeSheet {...p} />);
  await fireEvent.changeText(ui.getByLabelText('할 일 제목'), '자료 보내기');
  await fireEvent.press(ui.getByLabelText('추가 설정'));
  await fireEvent.press(ui.getByLabelText('할 일 시간 설정'));
  await fireEvent.press(ui.getByLabelText('오후'));
  await fireEvent.press(ui.getByLabelText('5분'));
  await fireEvent.press(ui.getByLabelText('카테고리 선택, 미분류'));
  await fireEvent.press(ui.getByRole('radio', { name: '미분류' }));
  await fireEvent.press(ui.getByLabelText('할 일 저장'));
  await waitFor(() =>
    expect(p.onSubmit).toHaveBeenCalledWith({
      kind: 'todo',
      title: '자료 보내기',
      category: '',
      date: DATE,
      time: '19:05',
    }),
  );
});
