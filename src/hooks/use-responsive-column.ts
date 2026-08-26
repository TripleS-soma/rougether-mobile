import { type ViewStyle } from 'react-native';

import { ContentMaxWidth } from '@/constants/theme';

/**
 * 태블릿·큰 화면에서 콘텐츠를 **가운데 고정폭 컬럼**으로 묶는다 (#725).
 *
 * 이 앱의 화면은 전부 폰 폭(≈390)을 전제로 그려졌다. 폭 제한이 없으면
 * 넓은 화면에서 세 가지가 한꺼번에 망가진다:
 *
 * 1. **리스트 행이 끝까지 늘어난다** — 설정 행의 화살표가 라벨에서 1300px
 *    떨어져 한 줄로 안 읽힌다.
 * 2. **정사각형 캔버스가 화면을 삼킨다** — 방은 `aspectRatio: 1`이라 폭
 *    1366px이면 높이도 1366px이 되고, 루틴 목록이 화면 밖으로 밀린다.
 * 3. **집 커버가 초대형화**돼 좌석 타일이 잘린다.
 *
 * 폰에서는 `maxWidth`가 화면 폭보다 커서 아무 영향이 없다 — 기기 분기
 * (`isPad` 같은 것) 없이 순수 반응형으로 처리하는 게 이 훅의 요지다.
 *
 * 스크롤 화면은 `contentContainerStyle`에, 그 외에는 본문 래퍼에 얹는다.
 *
 * @param max 컬럼 상한. 기본은 공용 토큰. 온보딩처럼 더 좁게 묶어야 하는
 *   화면만 값을 넘긴다(폰 목업이 가운데 서는 레이아웃이라 넓으면 허전하다).
 */
export function useResponsiveColumn(max: number = ContentMaxWidth): ViewStyle {
  return { width: '100%', maxWidth: max, alignSelf: 'center' };
}
