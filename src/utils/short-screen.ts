/**
 * 넓고 짧은 화면 — 배치 폭 / 화면 높이가 이 값 이상. 일반 폰은 0.46 안팎(402×874, 412×915),
 * 접힌 아이폰 Duo(안전 영역을 뺀 382×678)와 iPhone SE(375×667)는 0.56.
 * 이런 화면에서 폭에 맞춰 커지는 그림(방·집)은 세로를 다 먹어 목록이 첫 화면 밖으로 밀린다.
 */
export const SHORT_SCREEN_MIN_ASPECT = 0.5;

/** 짧은 화면에서 주인공 그림이 차지할 수 있는 높이 — 화면 높이의 이 비율까지. */
export const SHORT_SCREEN_HERO_HEIGHT_RATIO = 0.5;

export function isShortScreen(width: number, height: number): boolean {
  return height > 0 && width / height >= SHORT_SCREEN_MIN_ASPECT;
}

/**
 * 짧은 화면에서 그림(폭/높이 = `aspectRatio`)을 높이 상한에 맞춘 폭. 줄일 필요가 없으면
 * undefined — 일반 폰이거나, 이미 상한보다 낮은 그림.
 */
export function shortScreenHeroWidth(
  width: number,
  height: number,
  aspectRatio: number,
): number | undefined {
  if (!isShortScreen(width, height)) return undefined;
  const maxHeight = height * SHORT_SCREEN_HERO_HEIGHT_RATIO;
  if (width / aspectRatio <= maxHeight) return undefined;
  return maxHeight * aspectRatio;
}
