import { StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

/**
 * 온보딩만 공용 상한보다 좁게 묶는다 (#725) — 폰 목업이 가운데 서는
 * 레이아웃이라 넓으면 허전하다. 상한 자체는 `useResponsiveColumn`이 관리한다.
 */
const CONTENT_MAX_W = 480;

/** 온보딩 단계 화면 공용 스타일 — 목표·캐릭터·닉네임 단계가 같이 쓴다(리팩토링 장부 25번). */
export const onboardingStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  intro: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  introBody: {
    marginTop: Spacing.half,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  // 캐릭터 카드 캐러셀 (#589) — 카드가 세로 공간을 꽉 채우고, 이웃 카드는
  // 좌우 피크로 살짝 보인다.
  characterRail: {
    alignItems: 'stretch',
    paddingBottom: Spacing.two,
  },
  characterSlide: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  characterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterMeta: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  goalCard: {
    width: '47%',
    minHeight: 64,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
    justifyContent: 'center',
  },
  goalCheck: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
  checkCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    width: '100%',
    maxWidth: CONTENT_MAX_W,
    alignSelf: 'center',
  },
  dot: {
    height: 8,
    borderRadius: Radius.pill,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: CONTENT_MAX_W,
    alignSelf: 'center',
  },
  // 닉네임 단계 (#635).
  nicknameBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  nicknameInput: {
    alignSelf: 'stretch',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
