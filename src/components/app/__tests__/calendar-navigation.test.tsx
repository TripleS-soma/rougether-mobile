import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import { calendarHeading, TODAY } from '@/test-utils/my-room-screen-fixtures';

// TODAY는 픽스처의 KST 오늘 — 셸(use-calendar-view)이 쓰는 기준. 기기 로컬 todayIso()로
// 두면 UTC 러너에서 15:00Z 이후 셸과 다른 날이 돼 '오늘로' 헤딩 단언이 깨진다(2026-09-12 CI).
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

const dateLabel = (date: string) => new RegExp(`^${date}(?:,|$)`);
/** 주간 보기의 뒤로 (#1327) — 펼침 연출(220ms)이 끝나야 달력 탭으로 돌아간다. */
const goBackFromWeek = async (ui: Awaited<ReturnType<typeof renderShell>>) => {
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));
  await finishTransition();
  await waitFor(() => expect(ui.queryByText('주간 보기')).toBeNull());
};

describe('달력 하단 탭 왕복 (#1159)', () => {
  it('다른 달의 선택 날짜를 탭 전환과 루틴 추가 화면 왕복 뒤에도 유지한다', async () => {
    const ui = await renderShell();
    await fireEvent.press(ui.getByLabelText('달력'));
    await fireEvent.press(ui.getByLabelText('이전 달'));
    // 날짜 탭 → 주간 보기 (#1327): 하단 탭 없이 선택 주 한 줄 + 그날 목록.
    await fireEvent.press(ui.getByLabelText(dateLabel(PREVIOUS_MONTH_DATE)));
    expect(ui.getByText('주간 보기')).toBeTruthy();
    expect(ui.queryByLabelText('내 정보')).toBeNull();
    expect(ui.getByRole('header', { name: calendarHeading(PREVIOUS_MONTH_DATE) })).toBeTruthy();
    await goBackFromWeek(ui);

    await fireEvent.press(ui.getByLabelText('내 정보'));
    await fireEvent.press(ui.getByLabelText('달력'));
    expect(
      ui.getByLabelText(dateLabel(PREVIOUS_MONTH_DATE)).props.accessibilityState.selected,
    ).toBe(true);
    // 월 화면엔 목록이 없다 (#1327) — 날짜를 눌러야 그날 목록.
    expect(ui.queryByLabelText('선택한 날에 추가')).toBeNull();

    await fireEvent.press(ui.getByLabelText(dateLabel(PREVIOUS_MONTH_DATE)));
    await fireEvent.press(ui.getByLabelText('선택한 날에 추가'));
    expect(ui.getByLabelText('루틴 제목')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('취소'));
    await finishTransition();
    // 연 곳(주간 보기)으로 돌아오고 선택 날짜도 그대로.
    await waitFor(() =>
      expect(ui.getByRole('header', { name: calendarHeading(PREVIOUS_MONTH_DATE) })).toBeTruthy(),
    );
    expect(ui.getByText('주간 보기')).toBeTruthy();
    await goBackFromWeek(ui);
    expect(ui.getByLabelText('달력').props.accessibilityState.selected).toBe(true);
    expect(
      ui.getByLabelText(dateLabel(PREVIOUS_MONTH_DATE)).props.accessibilityState.selected,
    ).toBe(true);

    // '오늘로'는 선택만 되돌리고 주간 보기를 열지 않는다 (#1327). 오늘은 서버 날짜 조회를
    // 생략해도 선택값 자체는 반드시 저장해야 한다.
    await fireEvent.press(ui.getByLabelText('오늘로'));
    expect(ui.queryByText('주간 보기')).toBeNull();
    expect(ui.getByLabelText(dateLabel(TODAY)).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(ui.getByLabelText(dateLabel(TODAY)));
    await fireEvent.press(ui.getByLabelText('선택한 날에 추가'));
    await fireEvent.press(ui.getByLabelText('취소'));
    await finishTransition();
    await waitFor(() =>
      expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy(),
    );
    await goBackFromWeek(ui);
    expect(ui.getByLabelText(dateLabel(TODAY)).props.accessibilityState.selected).toBe(true);
  });

  it.each(['달력', '나의 방'])(
    '%s에서 루틴을 수정하고 저장하면 연 곳으로 돌아간다',
    async (tab) => {
      const ui = await renderShell();
      await fireEvent.press(ui.getByLabelText(tab));
      // 달력은 월 화면에 목록이 없어 오늘을 눌러 주간 보기로 (#1327).
      if (tab === '달력') await fireEvent.press(ui.getByLabelText(dateLabel(TODAY)));
      await waitFor(() => expect(ui.getByLabelText('달력 복귀 확인 메뉴')).toBeTruthy());
      await fireEvent.press(ui.getByLabelText('달력 복귀 확인 메뉴'));
      await fireEvent.press(ui.getByLabelText('달력 복귀 확인 루틴 수정'));
      expect(ui.getByText('루틴 수정')).toBeTruthy();
      await finishTransition();
      await fireEvent.press(ui.getByText('수정하기'));
      await waitFor(() => expect(ui.queryByText('수정하기')).toBeNull());
      if (tab === '달력') expect(ui.getByText('주간 보기')).toBeTruthy();
      else expect(ui.getByLabelText(tab).props.accessibilityState.selected).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/routines/42'),
        expect.objectContaining({ method: 'PUT' }),
      );
    },
  );
});

describe('주간 보기 (#1327)', () => {
  it('날짜를 누르면 주간 보기로 밀리고(즉시), 주 이동은 선택만 바꾸며, 뒤로는 펼친 뒤 닫힌다', async () => {
    const ui = await renderShell();
    await fireEvent.press(ui.getByLabelText('달력'));
    expect(ui.queryByRole('header', { name: calendarHeading(TODAY) })).toBeNull();
    await fireEvent.press(ui.getByLabelText(dateLabel(TODAY)));
    // 즉시 전환 — 떠나는 층 없이 바로 주간 보기.
    expect(ui.getByText('주간 보기')).toBeTruthy();
    expect(ui.getAllByLabelText('다음 주').length).toBe(1);
    expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('다음 주'));
    // 주 이동은 주간 보기 안에서 선택만 바꾼다 — 여전히 주간 보기.
    expect(ui.getByText('주간 보기')).toBeTruthy();
    expect(ui.queryByRole('header', { name: calendarHeading(TODAY) })).toBeNull();
    await fireEvent.press(ui.getByLabelText('오늘로'));
    expect(ui.getByRole('header', { name: calendarHeading(TODAY) })).toBeTruthy();
    await goBackFromWeek(ui);
    expect(ui.getByLabelText('달력').props.accessibilityState.selected).toBe(true);
    expect(ui.getByLabelText('다음 달')).toBeTruthy();
  });
});
