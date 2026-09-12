/**
 * House cover catalog (server GET /houses/cover-images).
 * Failure is non-fatal: the create/edit forms simply hide the cover section.
 *
 * react-query로 이관 (#1027, 장부 16번). 마스터 데이터라 `staleTime: Infinity` —
 * 종전처럼 세션당 한 번만 받는다(포커스 복귀에도 재조회하지 않는다). 실패는
 * `data`가 비어 빈 목록으로 접힌다.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchHouseCoverImages } from '@/api';
import { toHouseCover } from '@/api/adapters';
import type { HouseCoverImage } from '@/api/types';
import type { HouseCover } from '@/components/room/house-cover-picker';
import { queryKeys } from '@/lib/query-keys';

/** 서버 목록 → 피커 항목 — 모듈 스코프에 두어 react-query가 결과를 메모한다. */
const selectCovers = (items: HouseCoverImage[]): HouseCover[] =>
  items.map(toHouseCover).filter((c): c is HouseCover => c !== null);

/** 로드 전·실패 시의 빈 목록 — 참조를 고정해 집 화면 memo 경계(#539)를 안 흔든다. */
const NO_COVERS: HouseCover[] = [];

export function useHouseCovers() {
  const { data } = useQuery({
    queryKey: queryKeys.houseCovers,
    queryFn: fetchHouseCoverImages,
    select: selectCovers,
    staleTime: Infinity,
  });
  const covers = data ?? NO_COVERS;
  return useMemo(() => ({ covers }), [covers]);
}
