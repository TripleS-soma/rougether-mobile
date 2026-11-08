/**
 * 스토어 열기 (#1572·#1678) — 스토어 앱 주소 먼저, 안 열리면 웹 주소로.
 * 리뷰 작성(설정의 '앱 평가하기')은 iOS만 write-review까지, Play는 앱 상세.
 */
import { Linking, Platform } from 'react-native';

import {
  ANDROID_PACKAGE,
  IOS_ASC_APP_ID,
  storeReviewAppUrl,
  storeReviewWebUrl,
} from '@/constants/store-links';
import { openStorePage } from '@/lib/open-store';

describe('리뷰 작성 주소', () => {
  it('iOS는 리뷰 작성 화면까지 연다', () => {
    expect(storeReviewAppUrl('ios')).toBe(
      `itms-apps://apps.apple.com/app/id${IOS_ASC_APP_ID}?action=write-review`,
    );
    expect(storeReviewWebUrl('ios')).toBe(
      `https://apps.apple.com/app/id${IOS_ASC_APP_ID}?action=write-review`,
    );
  });

  it('Play는 리뷰 작성 딥링크가 없어 앱 상세로', () => {
    expect(storeReviewAppUrl('android')).toBe(`market://details?id=${ANDROID_PACKAGE}`);
    expect(storeReviewWebUrl('android')).toBe(
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    );
  });

  it('웹엔 스토어가 없다', () => {
    expect(storeReviewAppUrl('web')).toBeUndefined();
    expect(storeReviewWebUrl('web')).toBeUndefined();
  });
});

describe('openStorePage', () => {
  afterEach(() => jest.restoreAllMocks());

  it('리뷰 작성 — 스토어 앱 주소를 먼저 연다', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    openStorePage({ review: true });
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toBe(storeReviewAppUrl('ios'));
  });

  it('스토어 앱이 안 열리면 웹 주소로 떨어뜨린다', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no handler'))
      .mockResolvedValueOnce(true);
    openStorePage({ review: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open.mock.calls[1]?.[0]).toBe(storeReviewWebUrl('ios'));
  });
});
