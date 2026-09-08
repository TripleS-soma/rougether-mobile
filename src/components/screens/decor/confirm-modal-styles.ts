import { StyleSheet } from 'react-native';

import { Overlay, Radius, Spacing } from '@/constants/theme';

/**
 * 꾸미기 화면 확인 모달 3종(구매·미저장 이탈·프리뷰 정산)이 같이 쓰는 카드 크롬.
 * room-decor-screen의 `styles`에서 그대로 옮겼다 — 키 이름도 유지.
 */
export const confirmStyles = StyleSheet.create({
  confirmBackdrop: {
    flex: 1,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCard: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmText: {
    lineHeight: 24,
  },
  leaveBtns: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  leaveBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  leaveStay: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
