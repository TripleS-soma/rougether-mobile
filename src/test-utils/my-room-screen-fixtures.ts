import { fireEvent } from '@testing-library/react-native';

import { todayIso } from '@/utils/datetime';

/**
 * MyRoomScreen 테스트 공용 픽스처 — my-room-screen.*.test.tsx 다섯 파일이
 * 나눠 쓴다. `__tests__` 안의 비테스트 파일은 jest가 빈 스위트로 잡으므로 여기.
 */

export const TODAY = todayIso();
// A non-today date guaranteed to sit in the calendar's current month view:
// the 1st, or the 2nd when today is the 1st.
export const OTHER_DAY = `${TODAY.slice(0, 8)}${TODAY.endsWith('01') ? '02' : '01'}`;

/** TODAY shifted by n days (local), "YYYY-MM-DD". */
export const isoShift = (days: number) => {
  const [y, m, d] = TODAY.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
};
export const YESTERDAY = isoShift(-1);
export const TOMORROW = isoShift(1);

/** Open the 달력 tab and select a date, hopping months when needed. */
export const pickCalendarDate = async (
  ui: { getByText: (t: string) => any; getByLabelText: (t: string) => any },
  date: string,
) => {
  await fireEvent.press(ui.getByText('달력'));
  if (date.slice(0, 7) < TODAY.slice(0, 7)) await fireEvent.press(ui.getByLabelText('이전 달'));
  if (date.slice(0, 7) > TODAY.slice(0, 7)) await fireEvent.press(ui.getByLabelText('다음 달'));
  await fireEvent.press(ui.getByLabelText(date));
};
