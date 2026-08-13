import type { PictogramName } from '@/components/ui/pictograms';

/**
 * 집 생성 화면의 테마 프리셋 색 (#781에서 화면 → 상수로 이동).
 *
 * **브랜드 테마 토큰이 아니라 고정 팔레트다** — 카테고리 색(`routines.ts`)·
 * 캐릭터 색(`characters.ts`)과 같은 성격으로, 사용자가 고른 앱 테마와 무관하게
 * 이 카드들은 늘 같은 색이어야 구분이 선다. 그래서 `useTokens()`가 아니라
 * 여기에 hex로 둔다. 화면 파일 안에 두면 "화면에 색 하드코딩 금지"(AGENTS.md)와
 * 구분이 안 돼 상수 파일로 뺐다.
 */
export type HouseThemePreset = {
  id: string;
  label: string;
  icon: PictogramName;
  /** 카드 채움. */
  bg: string;
  /** 카드 테두리 — bg보다 한 단계 진한 같은 계열. */
  border: string;
};

export const HOUSE_THEME_PRESETS: HouseThemePreset[] = [
  { id: 'morning', label: '기상', icon: 'sunrise', bg: '#FFEFD8', border: '#F0C88A' },
  { id: 'study', label: '공부', icon: 'book', bg: '#E4DCF0', border: '#B8A8D8' },
  { id: 'code', label: '코딩', icon: 'laptop', bg: '#E4F0DC', border: '#A8C898' },
  { id: 'fitness', label: '운동', icon: 'dumbbell', bg: '#FBE0E0', border: '#E8B0A0' },
  { id: 'health', label: '건강', icon: 'water', bg: '#D8E8F0', border: '#A8C4D8' },
  { id: 'hobby', label: '취미', icon: 'palette', bg: '#F5E1D8', border: '#E8B8A8' },
];

/** 비공개 집 배지·자물쇠의 강조색 — 위 프리셋과 같은 고정 팔레트 계열. */
export const HOUSE_PRIVATE_ACCENT = '#D4A574';
