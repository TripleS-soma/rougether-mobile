import {
  y2018,
  y2019,
  y2020,
  y2021,
  y2022,
  y2023,
  y2024,
  y2025,
  y2026,
  y2027,
} from '@hyunbinseo/holidays-kr/all';

/**
 * 대한민국 공휴일 (#1292) — 월력요항·관보 기준 `@hyunbinseo/holidays-kr`의 연도별 표를
 * 한 번에 합쳐 둔다. 패키지 기본 API는 연도 파일을 `import()`로 비동기 로드하지만,
 * 달력은 순수·동기 컴포넌트라 `/all`의 정적 표를 쓴다(전 연도 합쳐 28KB).
 * 서버에는 공휴일 API가 없다. 표에 없는 해(2028~)나 새로 지정된 임시공휴일은
 * 패키지를 올리고 OTA로 채운다 — 그 전까지는 평일로 보인다.
 */
const HOLIDAYS: Readonly<Record<string, readonly string[]>> = {
  ...y2018,
  ...y2019,
  ...y2020,
  ...y2021,
  ...y2022,
  ...y2023,
  ...y2024,
  ...y2025,
  ...y2026,
  ...y2027,
};

/**
 * "YYYY-MM-DD"의 공휴일 이름. 하루에 둘이면(2025-05-05 어린이날·부처님 오신 날)
 * 쉼표로 잇는다. 공휴일이 아니면 null.
 */
export function holidayName(date: string): string | null {
  return HOLIDAYS[date]?.join(', ') ?? null;
}
