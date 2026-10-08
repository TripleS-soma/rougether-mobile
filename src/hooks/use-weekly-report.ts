/**
 * 주간 회고 (#852) — 서버가 매주 생성해 두는 회고를 목록에서 최신 1건만 읽고,
 * 카드를 열 때 그 상세(통계 + LLM 본문)를 지연 로드한다.
 *
 * 목록/상세를 나눠 부르는 이유: 달력 탭 카드는 요약(완료율·기간)만 있으면
 * 그려지고, 무거운 본문은 사용자가 실제로 열 때만 필요하다.
 *
 * 서버 상태는 react-query (#1027, 리팩토링 장부 16번) — 목록·상세가 사용자별 키로 캐시된다.
 * '마지막으로 읽은 회고'는 기기 저장소라 그대로 useState.
 *
 * 반환 객체는 useMemo, 액션은 useCallback — memo 경계(#539)를 뚫지 않게.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchWeeklyReport, fetchWeeklyReports, getSessionUserId } from '@/api';
import type { WeeklyReportSummaryItem } from '@/api/types';
import { queryKeys } from '@/lib/query-keys';
import { loadLastReadReportId, saveLastReadReportId } from '@/lib/weekly-report-read';

/** 서버 정렬을 믿지 않고 주 시작일 최신순으로 직접 고른다. */
function newestOf(items: WeeklyReportSummaryItem[]): WeeklyReportSummaryItem | null {
  return (
    [...items].sort((a, b) => (b.weekStartDate ?? '').localeCompare(a.weekStartDate ?? ''))[0] ??
    null
  );
}

export function useWeeklyReport(enabled = true) {
  const userId = getSessionUserId();
  // 마지막으로 열어본 회고 id — 새 회고가 왔는지(탭 점) 판단한다. undefined는
  // "아직 저장소를 안 읽음"이라 그동안은 점을 찍지 않는다(깜빡임 방지).
  const [lastReadId, setLastReadId] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadLastReadReportId().then((id) => {
      if (active) setLastReadId(id);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  const list = useQuery({
    queryKey: queryKeys.weeklyReports.list(userId),
    // 실패해도 화면은 살아야 한다 — 회고는 부가 정보라 빈 상태로 접는다.
    queryFn: () => fetchWeeklyReports().catch(() => [] as WeeklyReportSummaryItem[]),
    select: newestOf,
    enabled,
  });
  const latest = list.data ?? null;
  // 목록을 한 번은 불러봤는지 — "아직 로딩 중"과 "회고가 없다"를 구분한다.
  // 이게 없으면 신규 사용자에게 빈 카드가 깜빡였다.
  const loaded = list.isSuccess;

  // 상세는 loadDetail로 연 회고만 받는다. 지난주 회고는 바뀌지 않으니 캐시를 영구히 믿는다 —
  // 같은 회고를 다시 열면 재요청하지 않는다. 실패는 캐시에 남지 않아 다음 열기에서 다시 시도한다.
  const queryClient = useQueryClient();
  const [openedId, setOpenedId] = useState<number | null>(null);
  const detailQuery = useQuery({
    queryKey: queryKeys.weeklyReports.detail(userId, openedId),
    queryFn: () => fetchWeeklyReport(openedId as number),
    enabled: openedId != null,
    staleTime: Infinity,
  });
  const detail = detailQuery.data ?? null;
  const [loading, setLoading] = useState(false);

  /** 상세 지연 로드 — 받아 둔 회고면 요청 없이 캐시로 끝난다. */
  const loadDetail = useCallback(async () => {
    const reportId = latest?.reportId;
    if (reportId == null) return;
    setLoading(true);
    try {
      await queryClient.fetchQuery({
        queryKey: queryKeys.weeklyReports.detail(userId, reportId),
        queryFn: () => fetchWeeklyReport(reportId),
        staleTime: Infinity,
        retry: false,
      });
      setOpenedId(reportId);
    } catch {
      // 실패해도 카드는 요약으로 남는다 — 다음 열기에서 다시 시도한다.
    } finally {
      setLoading(false);
    }
  }, [latest?.reportId, queryClient, userId]);

  /** 주간회고 탭을 열었다 — 지금 회고를 읽음으로 표시해 탭 점을 끈다. */
  const markRead = useCallback(() => {
    const reportId = latest?.reportId;
    if (reportId == null || lastReadId === reportId) return;
    setLastReadId(reportId);
    void saveLastReadReportId(reportId);
  }, [latest?.reportId, lastReadId]);

  // 저장소를 읽기 전(undefined)에는 점을 찍지 않는다 — 켤 때마다 잠깐 점이
  // 떴다 사라지는 게 "새 회고"라는 신호를 값싸게 만든다.
  const unread =
    lastReadId !== undefined && latest?.reportId != null && lastReadId !== latest.reportId;

  return useMemo(
    () => ({ latest, detail, loading, loaded, unread, loadDetail, markRead }),
    [latest, detail, loading, loaded, unread, loadDetail, markRead],
  );
}
