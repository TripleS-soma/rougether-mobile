import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import { todayIso } from '@/utils/datetime';
import { calendarHeading } from '@/test-utils/my-room-screen-fixtures';

const TODAY = todayIso();
const [year, month] = TODAY.split('-').map(Number);
const PREVIOUS_MONTH_DATE = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}-15`;
const routine = {
  id: 42,
  title: '달력 복귀 확인',
  categoryId: 20,
  repeatType: 'DAILY',
  authType: 'CHECK',
  startsOn: '2020-01-01',
};
const realFetch = global.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const body =
      url.endsWith('/routines/42') && init?.method === 'PUT'
        ? routine
        : url.endsWith('/routines')
          ? { items: [routine] }
          : url.includes('/categories')
            ? { items: [{ id: 20, name: '생활' }] }
            : url.endsWith('/today') || url.includes('/calendar?')
              ? { categories: [], summary: {}, streak: {} }
              : { items: [] };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});

const finishTransition = () =>
  act(async () => {
    jest.advanceTimersByTime(400);
  });

const renderShell = () => renderWithProviders(<AppShell />);

describe('달력 하단 탭 왕복 (#1159)', () => {
  it('다른 달의 선택 날짜를 탭 전환과 루틴 추가 화면 왕복 뒤에도 유지한다', async () => {
    const ui = await renderShell();
    await fireEvent.press(ui.getByLabelText('달력'));
    await fireEvent.press(ui.getByLabelText('이전 달'));
    await fireEvent.press(ui.getByLabelText(new RegExp(`^${PREVIOUS_MONTH_DATE},`)));

    await fireEvent.press(ui.getByLabelText('내 정보'));
    await fireEvent.press(ui.getByLabelText('달력'));
    expect(
      ui.getByLabelText(new RegExp(`^${PREVIOUS_MONTH_DATE},`)).props.accessibilityState.selected,
    ).toBe(true);

    await fireEvent.press(ui.getByLabelText('이 날에 루틴 추가'));
    await finishTransition();
    expect(ui.getByText('루틴 추가')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('뒤로가기'));
    await finishTransition();
    await waitFor(() =>
      expect(ui.getByRole('header', { name: calendarHeading(PREVIOUS_MONTH_DATE) })).toBeTruthy(),
    );
    expect(ui.getByLabelText('달력').props.accessibilityState.selected).toBe(true);
    expect(
      ui.getByLabelText(new RegExp(`^${PREVIOUS_MONTH_DATE},`)).props.accessibilityState.selected,
    ).toBe(true);

    // 오늘은 서버 날짜 조회를 생략해도 선택값 자체는 반드시 저장해야 한다.
    await fireEvent.press(ui.getByLabelText('오늘로'));
    await fireEvent.press(ui.getByLabelText('이 날에 루틴 추가'));
    await finishTransition();
    await fireEvent.press(ui.getByLabelText('뒤로가기'));
    await finishTransition();
    await waitFor(() =>
      expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy(),
    );
    expect(ui.getByLabelText(new RegExp(`^${TODAY},`)).props.accessibilityState.selected).toBe(
      true,
    );
  });

  it.each(['달력', '나의 방'])(
    '%s에서 루틴을 수정하고 저장하면 연 탭으로 돌아간다',
    async (tab) => {
      const ui = await renderShell();
      await fireEvent.press(ui.getByLabelText(tab));
      await waitFor(() => expect(ui.getByLabelText('달력 복귀 확인 메뉴')).toBeTruthy());
      await fireEvent.press(ui.getByLabelText('달력 복귀 확인 메뉴'));
      await fireEvent.press(ui.getByLabelText('달력 복귀 확인 루틴 수정'));
      expect(ui.getByText('루틴 수정')).toBeTruthy();
      await finishTransition();
      await fireEvent.press(ui.getByText('수정하기'));
      await waitFor(() => expect(ui.queryByText('수정하기')).toBeNull());
      expect(ui.getByLabelText(tab).props.accessibilityState.selected).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/routines/42'),
        expect.objectContaining({ method: 'PUT' }),
      );
    },
  );
});
