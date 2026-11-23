import { createContext, useContext } from 'react';

import { useAppFrame } from '@/hooks/use-app-frame';

/** `BrandSplit`(로그인·회원가입·온보딩의 넓은 화면 배치)이 오른쪽 칸의 화면에 내려 주는 값. */
export type BrandSplitValue = {
  /** 화면이 2단의 오른쪽 칸 안에 그려지는 중인가. */
  inSplit: boolean;
  /** 그 칸의 폭 — 2단이 아니면 null. */
  paneWidth: number | null;
};

export const NOT_IN_BRAND_SPLIT: BrandSplitValue = { inSplit: false, paneWidth: null };

/** `components/app/brand-split`의 `BrandSplit`이 채운다. 화면은 아래 두 훅으로만 읽는다. */
export const BrandSplitContext = createContext<BrandSplitValue>(NOT_IN_BRAND_SPLIT);

/** 화면이 `BrandSplit`의 오른쪽 칸 안에 그려지는 중인가 — 그러면 자기 로고·소개를 숨긴다. */
export function useBrandSplit(): boolean {
  return useContext(BrandSplitContext).inSplit;
}

/**
 * 화면이 쓸 수 있는 폭 — `BrandSplit`의 오른쪽 칸 안이면 그 칸의 폭, 아니면 앱 프레임 폭.
 * 폭으로 카드 크기를 계산하는 화면(온보딩)이 칸 안에서도 맞는 크기를 얻는다.
 */
export function usePaneWidth(): number {
  const { width } = useAppFrame();
  return useContext(BrandSplitContext).paneWidth ?? width;
}
