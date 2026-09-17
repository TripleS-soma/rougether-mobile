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
import { formatDiagnostics } from '@/lib/diagnostics-log';
import { lastErrorEventId } from '@/lib/error-reporting';
import { MAX_BUG_REPORT_CONTENT } from '@/components/screens/bug-report-screen';

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

  /**
   * Submit a report (appVersion/deviceInfo 자동 첨부). Resolves true on success.
   * `includeDiagnostics`면 최근 화면 이동·API 요청 요약을 본문 끝에 붙인다 (#1162) — 서버
   * 스키마에 구조 필드가 아직 없어(deviceInfo는 100자) 2000자 본문 안에서 하위 호환으로 싣는다.
   * 요약 생성이 실패해도 제보는 원문으로 보낸다.
   */
  const submit = useCallback(
    async (input: {
      title: string;
      content: string;
      images: BugReportImage[];
      includeDiagnostics?: boolean;
    }) => {
      const { includeDiagnostics = false, ...rest } = input;
      const content = includeDiagnostics ? withDiagnostics(rest.content) : rest.content;
      try {
        await submitBugReport({
          ...rest,
          content,
          appVersion: appVersion(),
          deviceInfo: deviceInfo(),
        });
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

/** 운영자가 읽는 구분선 — 언어와 무관하게 고정(서버·어드민에서 검색 가능). */
export const DIAGNOSTICS_HEADER = '--- diagnostics (auto) ---';

const DIAGNOSTICS_SEPARATOR = '\n\n';

/** 본문 옆에 붙일 진단 요약 — 서버 본문 한도(2000자)에서 본문이 쓰고 남은 만큼만. 전송과 미리보기가 같은 계산을 쓴다. */
function diagnosticsSummaryFor(content: string, now?: number): string {
  return formatDiagnostics({
    budget: MAX_BUG_REPORT_CONTENT - content.length - DIAGNOSTICS_SEPARATOR.length,
    header: DIAGNOSTICS_HEADER,
    sentryEventId: lastErrorEventId(),
    now,
  });
}

/** 본문 + 진단 요약. 서버 본문 한도(2000자) 안에서 요약이 남는 만큼만 붙인다. */
export function withDiagnostics(content: string, now?: number): string {
  try {
    const summary = diagnosticsSummaryFor(content, now);
    return summary ? `${content}${DIAGNOSTICS_SEPARATOR}${summary}` : content;
  } catch {
    return content;
  }
}

/**
 * 제보 화면 '펼쳐 보기'용 — 지금 이 본문으로 보내면 붙을 요약(본문 없이).
 * 본문 길이에 따라 요약이 줄거나 빠지므로 전송(`withDiagnostics`)과 같은 예산으로 계산한다.
 */
export function previewDiagnostics(content = '', now?: number): string {
  try {
    return diagnosticsSummaryFor(content, now);
  } catch {
    return '';
  }
}
