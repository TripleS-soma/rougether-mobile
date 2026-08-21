/** Bug report (버그 제보) endpoints (#496). */
import { Platform } from 'react-native';

import { getAccessToken } from './auth';
import { apiGetList, apiPost } from './client';
import { API_BASE } from './config';
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

/**
 * GET /me/bug-reports/screenshots?key= — 내 제보에 첨부한 스크린샷 (#736).
 *
 * **`<Image source={{ uri }}>`에 주소를 그대로 넘길 수 없다.** 비공개 리소스라
 * Authorization 헤더가 필요한데 `<Image>`는 그 헤더를 붙여주지 않는다(RN의
 * `source.headers`는 플랫폼별로 동작이 갈리고 캐시와도 어긋난다). 그래서
 * 바이트를 직접 받아 **data URI**로 바꿔 넘긴다.
 *
 * 실패하면 null — 첨부 한 장을 못 불러온다고 제보 내역 전체가 깨지면 안 된다.
 */
export async function fetchBugReportScreenshot(key: string): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `${API_BASE}/me/bug-reports/screenshots?key=${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUri(blob);
  } catch {
    return null;
  }
}

/** Blob → data URI. FileReader는 웹·RN 양쪽에 있다. */
function blobToDataUri(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(blob);
  });
}
