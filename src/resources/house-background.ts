/**
 * 공동집 프레임의 S3 경로에서 테마를 읽어, 같은 테마의 전면 배경을 고른다.
 *
 * 현재 서버 계약은 `coverImageKey`만 제공하므로 클라이언트가 이 파생값을 쓴다.
 * 추후 `backgroundImageKey`가 별도 필드로 추가되면 이 함수의 입력만 바꾸면
 * 화면/프리페치 계층은 그대로 유지할 수 있다.
 */
export const HOUSE_BACKGROUND_KEY_BY_THEME = {
  'cloud-balloon': 'house/cloud-balloon/backgrounds/house-cloud-balloon-background-v1.webp',
  'coral-aquarium': 'house/coral-aquarium/backgrounds/house-coral-aquarium-background-v1.webp',
  'mushroom-forest': 'house/mushroom-forest/backgrounds/house-mushroom-forest-background-v1.webp',
  'night-observatory':
    'house/night-observatory/backgrounds/house-night-observatory-background-v1.webp',
} as const;

export type HouseBackgroundTheme = keyof typeof HOUSE_BACKGROUND_KEY_BY_THEME;

export function houseBackgroundKey(coverImageKey?: string | null): string | null {
  const theme = coverImageKey?.match(/^house\/([^/]+)\//)?.[1];
  if (theme && theme in HOUSE_BACKGROUND_KEY_BY_THEME) {
    return HOUSE_BACKGROUND_KEY_BY_THEME[theme as HouseBackgroundTheme];
  }
  // 새 테마가 배경 매핑보다 먼저 배포되면 엉뚱한 테마를 붙이지 않고 기존
  // 시간대별 하늘색을 쓴다. 커버 미지정 집은 houseCoverKey에서 기본 구름
  // 프레임으로 먼저 보정되므로 실제 화면에서는 구름 배경이 정상 적용된다.
  return null;
}
