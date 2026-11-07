import { Linking } from 'react-native';

import {
  storeAppUrl,
  storeReviewAppUrl,
  storeReviewWebUrl,
  storeWebUrl,
} from '@/constants/store-links';

/**
 * 스토어 열기 — 스토어 앱 주소를 먼저, 핸들러가 없어 reject되면 웹 주소로 (#1572·#1678).
 * `canOpenURL`을 쓰지 않는 이유는 `constants/store-links` 참고(네이티브 지문).
 *
 * - `review: false`: 앱 상세(업데이트 안내)
 * - `review: true`: 리뷰 작성 화면(설정의 '앱 평가하기') — Play는 딥링크가 없어 앱 상세
 */
export function openStorePage({ review = false }: { review?: boolean } = {}): void {
  const app = review ? storeReviewAppUrl() : storeAppUrl();
  const web = review ? storeReviewWebUrl() : storeWebUrl();
  const fallback = () => {
    if (web) void Linking.openURL(web).catch(() => {});
  };
  if (app) void Linking.openURL(app).catch(fallback);
  else fallback();
}
