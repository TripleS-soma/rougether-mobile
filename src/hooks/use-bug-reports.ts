/**
 * 버그 제보 (#496) — 내 제보 목록 로드 + 제출. 제출 성공 시 목록을 다시
 * 불러와 방금 제보가 접수됨 배지로 바로 보이게 한다.
 */
import { useCallback, useState } from 'react';

import {
  fetchBugReportScreenshot,
  type BugReportImage,
  fetchMyBugReports,
  submitBugReport,
} from '@/api';
import { toBugReportEntry } from '@/api/adapters';
import type { BugReportEntry } from '@/components/screens/bug-report-screen';
import { appVersion, deviceInfo } from '@/lib/app-info';

export function useBugReports() {
  const [entries, setEntries] = useState<BugReportEntry[]>([]);

  /** Refresh 내 제보 내역 (call when the screen opens). */
  const load = useCallback(async () => {
    try {
      setEntries((await fetchMyBugReports()).map(toBugReportEntry));
    } catch {
      // 목록 로드 실패는 조용히 — 폼 제출은 독립적으로 동작한다.
    }
  }, []);

  /** Submit a report (appVersion/deviceInfo 자동 첨부). Resolves true on success. */
  const submit = useCallback(
    async (input: { title: string; content: string; images: BugReportImage[] }) => {
      try {
        await submitBugReport({ ...input, appVersion: appVersion(), deviceInfo: deviceInfo() });
        void load();
        return true;
      } catch {
        return false;
      }
    },
    [load],
  );

  return {
    /** 첨부 스크린샷 한 장 (#736) — 인증이 필요해 화면이 직접 못 그린다. */
    loadScreenshot: fetchBugReportScreenshot,
    entries,
    load,
    submit,
  };
}
