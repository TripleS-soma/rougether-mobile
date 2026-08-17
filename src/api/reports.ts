/** Weekly retrospective reports — LLM-written review of the past week (#852). */
import { apiGet, apiGetList } from './client';
import type { WeeklyReportDetailResponse, WeeklyReportSummaryItem } from './types';

/** GET /reports/weekly — 생성된 주간 회고 목록(최신순). */
export function fetchWeeklyReports() {
  return apiGetList<WeeklyReportSummaryItem>('/reports/weekly');
}

/** GET /reports/weekly/{reportId} — 통계 + LLM 본문까지 담은 상세. */
export function fetchWeeklyReport(reportId: number) {
  return apiGet<WeeklyReportDetailResponse>(`/reports/weekly/${reportId}`);
}
