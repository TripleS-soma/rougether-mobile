/** Bug report (버그 제보) endpoints (#496). */
import { Platform } from 'react-native';

import { apiGetList, apiPost } from './client';
import { buildQuery } from './http';
import type { BugReportResponse } from './types';

/** Upload-ready screenshot — RN FormData file fields (see `lib/pick-image`). */
export type BugReportImage = { uri: string; name: string; type: string };

/**
 * POST /bug-reports — 제보 제출. 서버 계약이 특이하게 title/content 등 텍스트는
 * 쿼리 파라미터, 스크린샷만 multipart 본문(images, 최대 3장 png·jpeg·webp
 * 각 10MB)이다. 이미지가 없어도 multipart 본문으로 전송한다.
 */
export async function submitBugReport(input: {
  title: string;
  content: string;
  appVersion?: string;
  deviceInfo?: string;
  images?: BugReportImage[];
}): Promise<BugReportResponse> {
  const { title, content, appVersion, deviceInfo, images = [] } = input;
  const form = new FormData();
  for (const img of images) {
    if (Platform.OS === 'web') {
      // 웹의 FormData는 실제 Blob이 필요 — picker의 로컬 uri를 blob으로 변환.
      const blob = await (await fetch(img.uri)).blob();
      form.append('images', blob, img.name);
    } else {
      // RN의 FormData는 {uri, name, type} 파일 디스크립터를 받는다.
      form.append('images', img as unknown as Blob);
    }
  }
  return apiPost<BugReportResponse>(
    `/bug-reports${buildQuery({ title, content, appVersion, deviceInfo })}`,
    form,
  );
}

/** GET /me/bug-reports — 내 제보 목록 (처리 현황 확인, 최신순). */
export function fetchMyBugReports(): Promise<BugReportResponse[]> {
  return apiGetList<BugReportResponse>('/me/bug-reports');
}
