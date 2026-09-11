import { render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Calendar } from '@/components/ui/calendar';

/** 날짜 칸 숫자의 글자색 — 칸(Pressable)은 라벨로, 숫자는 그 안의 텍스트로 찾는다. */
function dayColor(ui: Awaited<ReturnType<typeof render>>, label: string, day: string) {
  const cell = ui.getByLabelText(label);
  return StyleSheet.flatten(within(cell).getByText(day).props.style).color;
}

describe('Calendar 공휴일 (#1292)', () => {
  it('공휴일 숫자는 일요일과 같은 빨강이고, 토요일 공휴일도 파랑보다 빨강이 우선한다', async () => {
    const ui = await render(<Calendar value="2026-09-11" onSelect={() => {}} />);

    const sunday = dayColor(ui, '2026-09-20', '20');
    const saturday = dayColor(ui, '2026-09-19', '19');
    const weekday = dayColor(ui, '2026-09-23', '23');

    // 9/25(금) 추석 — 평일 공휴일
    expect(dayColor(ui, '2026-09-25, 추석', '25')).toBe(sunday);
    expect(dayColor(ui, '2026-09-25, 추석', '25')).not.toBe(weekday);
    // 9/26(토) 추석 다음 날 — 토요일이어도 빨강
    expect(dayColor(ui, '2026-09-26, 추석 다음 날', '26')).toBe(sunday);
    expect(saturday).not.toBe(sunday);
  });

  it('스크린리더 라벨에 공휴일 이름을 넣는다 — 대체공휴일 포함', async () => {
    const ui = await render(<Calendar value="2026-08-03" onSelect={() => {}} />);

    expect(ui.getByLabelText('2026-08-15, 광복절')).toBeTruthy();
    expect(ui.getByLabelText('2026-08-17, 대체공휴일(광복절)')).toBeTruthy();
    expect(ui.getByLabelText('2026-08-18')).toBeTruthy();
  });
});
