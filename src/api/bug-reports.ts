/** Bug report (버그 제보) endpoints (#496). */
import { Platform } from 'react-native';

import { apiGetList, apiPost } from './client';
import type { BugReportResponse } from './types';

/** Upload-ready screenshot — RN FormData file fields (see `lib/pick-image`). */
export type BugReportImage = { uri: string; name: string; type: string };

/**
 * POST /bug-reports — 제보 제출. 텍스트도 multipart 폼 필드로 보낸다 (#567) —
 * 쿼리 파라미터로 보내던 시절 Tomcat 8KB 한도에 걸려 한글 ~850자에서 400이
 * 났다(600자 클램프의 이유). 서버 @RequestParam은 폼 필드도 받는 것을 실서버
 * 프로브(한글 900자 → 201)로 확인. 스크린샷은 기존대로 images 파트(최대 3장
 * png·jpeg·webp 각 10MB), 이미지가 없어도 multipart 본문으로 전송한다.
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
  form.append('title', title);
  form.append('content', content);
  if (appVersion) form.append('appVersion', appVersion);
  if (deviceInfo) form.append('deviceInfo', deviceInfo);
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
  return apiPost<BugReportResponse>('/bug-reports', form);
}

/** GET /me/bug-reports — 내 제보 목록 (처리 현황 확인, 최신순). */
export function fetchMyBugReports(): Promise<BugReportResponse[]> {
  return apiGetList<BugReportResponse>('/me/bug-reports');
}
