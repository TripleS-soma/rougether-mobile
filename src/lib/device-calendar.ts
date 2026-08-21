import * as Calendar from 'expo-calendar';

import { shiftIso, todayIso } from '@/utils/datetime';

/**
 * 기기 캘린더 읽기 (#844) — OS 캘린더에 연결된 계정(구글 등)의 일정을 읽는다.
 * **읽기 전용이다.** 우리는 캘린더에 쓰지 않는다 — 이 파일은 읽기 API만 부른다.
 *
 * 다만 **선언되는 권한은 읽기만이 아니다.** 예전엔 config plugin으로 미리알림
 * 권한 문구와 안드로이드 WRITE_CALENDAR를 걷어냈는데, expo-calendar가 그걸
 * 전제로 동작해서 iOS는 시작하자마자 죽고 안드로이드는 기능이 조용히 멎었다
 * (#913). 지금은 라이브러리가 요구하는 대로 선언하고, "쓰지 않는다"는 사실은
 * 권한 문구·스토어 설명·개인정보처리방침이 말한다.
 *
 * expo-calendar는 네이티브 모듈이라 웹에서는 없다. 모든 함수가 웹에서
 * 조용히 빈 결과로 떨어진다 — dev 갤러리·웹 스모크가 죽지 않게.
 */

/** 임포트 창 — 오늘부터 며칠까지. 1년치를 넣으면 달력이 일정으로 덮인다. */
export const IMPORT_WINDOW_DAYS = 30;

export type DeviceCalendar = {
  id: string;
  title: string;
  /** 계정 이름 — 개인·업무·공휴일을 고를 때의 단서. */
  source: string;
};

/**
 * 서버 `repeatType`에 담을 수 있는 반복 (#952). 기기 규칙은 이보다 넓어서
 * ("3주마다", "격일", "매월 셋째 화요일") 담기는 것만 루틴으로 보내고
 * 나머지는 회차 투두로 떨어뜨린다 — 근사하면 없는 날에 할 일이 뜬다.
 */
export type DeviceRepeat = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/**
 * `recurrenceRule`을 서버가 아는 반복으로 접는다. 담을 수 없으면 undefined.
 *
 * **요일·일·월은 여기서 안 정한다.** `daysOfTheWeek`는 iOS 전용이라
 * 안드로이드에서는 비어 오므로, 종류만 규칙에서 읽고 나머지는 실제 회차
 * 날짜에서 파생한다(두 플랫폼이 같게 동작한다).
 */
export function toDeviceRepeat(rule?: Calendar.RecurrenceRule | null): DeviceRepeat | undefined {
  if (!rule) return undefined;
  const every = rule.interval ?? 1;
  switch (rule.frequency) {
    case Calendar.Frequency.DAILY:
      // 격일(interval 2)은 서버에 대응이 없다.
      return every === 1 ? 'daily' : undefined;
    case Calendar.Frequency.WEEKLY:
      return every === 1 ? 'weekly' : every === 2 ? 'biweekly' : undefined;
    case Calendar.Frequency.MONTHLY:
      // "매월 셋째 화요일"은 daysOfTheWeek로 오는데 서버는 날짜(dayOfMonth)만 안다.
      return every === 1 && !rule.daysOfTheWeek?.length ? 'monthly' : undefined;
    case Calendar.Frequency.YEARLY:
      return every === 1 ? 'yearly' : undefined;
    default:
      return undefined;
  }
}

export type DeviceEvent = {
  /**
   * **시리즈 id — 반복 일정이면 회차마다 같다.** 고유 키로 쓰면 안 된다.
   * 목록 key·선택 토글·externalId에는 아래 `occurrenceId`를 쓸 것.
   */
  seriesId: string;
  /**
   * 회차 하나를 가리키는 고유 키 (`시리즈 id:날짜`). 투두는 회차 단위로
   * 들어가므로 이게 `externalId`가 된다 — spec#81에 적은 규칙 그대로다.
   *
   * seriesId를 그대로 쓰면 매주 회의 4회차 중 **첫 회차만 들어가고 나머지는
   * 409로 영구히 건너뛰어진다**(서버는 지운 조합도 재등록해주지 않는다).
   * 사용자가 지운 것도 아닌데 조용히 사라지므로 눈치채기 어렵다.
   */
  occurrenceId: string;
  title: string;
  /** 그 회차의 날짜 "YYYY-MM-DD" (로컬). */
  date: string;
  /** 종일 일정인지 — 시각을 마감 시간으로 옮길지 판단에 쓴다. */
  allDay: boolean;
  /**
   * 서버가 아는 반복이면 그 종류 (#952) — 이 회차는 **루틴 후보**다.
   * undefined면 일회성이거나 담을 수 없는 반복이라 회차 투두로 간다.
   */
  repeat?: DeviceRepeat;
};

/** 회차 키 — 시리즈와 날짜를 합친다. 서버 externalId 상한 255자에 여유가 있다. */
export function occurrenceKey(seriesId: string, date: string) {
  return `${seriesId}:${date}`;
}

/** 권한 요청. 거부면 false — 화면이 안내를 띄운다. */
export async function requestCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/** 읽을 수 있는 캘린더 목록. 권한이 없으면 빈 배열. */
export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals.map((c) => ({
    id: c.id,
    title: c.title,
    source: typeof c.source === 'string' ? c.source : (c.source?.name ?? ''),
  }));
}

/**
 * 창 안의 일정을 **회차 단위로** 읽는다. 반복 일정은 이 조회가 회차별로
 * 펼쳐 주므로(EventKit·CalendarContract.Instances 동작) 규칙을 해석하지
 * 않는다 — 회차 하나가 투두 하나가 된다.
 *
 * 과거는 읽지 않는다: 지난 회의가 "미완료 할 일"로 과거 달력에 깔리면
 * 성취 기록이 실패 기록처럼 보인다 (#844 합의).
 */
export async function readUpcomingEvents(calendarIds: string[]): Promise<DeviceEvent[]> {
  if (calendarIds.length === 0) return [];
  const from = todayIso();
  const to = shiftIso(from, IMPORT_WINDOW_DAYS);
  const events = await Calendar.getEventsAsync(
    calendarIds,
    startOfLocalDay(from),
    endOfLocalDay(to),
  );
  return events
    .map((e) => {
      const seriesId = String(e.id);
      const date = localDateOf(e.startDate);
      return {
        seriesId,
        occurrenceId: occurrenceKey(seriesId, date),
        title: (e.title ?? '').trim(),
        date,
        allDay: !!e.allDay,
        repeat: toDeviceRepeat(e.recurrenceRule),
      };
    })
    .filter((e) => e.title.length > 0 && e.date >= from);
}

function startOfLocalDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function endOfLocalDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
/** expo-calendar는 Date 또는 ISO 문자열을 준다 — 둘 다 로컬 날짜로 접는다. */
function localDateOf(value: string | Date) {
  const dt = value instanceof Date ? value : new Date(value);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}
