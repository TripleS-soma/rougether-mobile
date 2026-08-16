/**
 * 주간 회고 (#852) — 서버가 매주 생성해 두는 회고를 목록에서 최신 1건만 읽고,
 * 카드를 열 때 그 상세(통계 + LLM 본문)를 지연 로드한다.
 *
 * 목록/상세를 나눠 부르는 이유: 달력 탭 카드는 요약(완료율·기간)만 있으면
 * 그려지고, 무거운 본문은 사용자가 실제로 열 때만 필요하다.
 *
 * 반환 객체는 useMemo, 액션은 useCallback — memo 경계(#539)를 뚫지 않게.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchWeeklyReport, fetchWeeklyReports } from '@/api';
import type { WeeklyReportDetailResponse, WeeklyReportSummaryItem } from '@/api/types';

export function useWeeklyReport(enabled = true) {
  const [latest, setLatest] = useState<WeeklyReportSummaryItem | null>(null);
  const [detail, setDetail] = useState<WeeklyReportDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // 목록을 한 번은 불러봤는지 — "아직 로딩 중"과 "회고가 없다"를 구분한다.
  // 이게 없으면 신규 사용자에게 빈 카드가 깜빡였다.
  const [loaded, setLoaded] = useState(false);
  const detailFor = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      // 실패해도 화면은 살아야 한다 — 회고는 부가 정보라 빈 상태로 접는다.
      const items = await fetchWeeklyReports().catch(() => [] as WeeklyReportSummaryItem[]);
      if (!active) return;
      // 서버 정렬을 믿지 않고 주 시작일 최신순으로 직접 고른다.
      const newest = [...items].sort((a, b) =>
        (b.weekStartDate ?? '').localeCompare(a.weekStartDate ?? ''),
      )[0];
      setLatest(newest ?? null);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  /** 상세 지연 로드 — 같은 회고를 다시 열면 재요청하지 않는다. */
  const loadDetail = useCallback(async () => {
    const reportId = latest?.reportId;
    if (reportId == null || detailFor.current === reportId) return;
    detailFor.current = reportId;
    setLoading(true);
    try {
      const full = await fetchWeeklyReport(reportId);
      setDetail(full);
    } catch {
      // 재시도할 수 있게 캐시 표식을 되돌린다.
      detailFor.current = null;
    } finally {
      setLoading(false);
    }
  }, [latest?.reportId]);

  return useMemo(
    () => ({ latest, detail, loading, loaded, loadDetail }),
    [latest, detail, loading, loaded, loadDetail],
  );
}
